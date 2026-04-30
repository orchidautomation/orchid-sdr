import { createGatewayProvider } from "@ai-sdk/gateway";
import { generateObject } from "ai";
import { z } from "zod";

import { getConfig } from "../config.js";
import type { QualificationAssessment } from "../domain/types.js";
import { replyClasses } from "../domain/types.js";
import { getFrameworkRuntimeConfig } from "./framework-stack.js";
import { resolveStructuredModel } from "./model-routing.js";
import {
  type QualificationInput,
  heuristicIcpQualification,
} from "./qualification-engine.js";

const replyClassEnum = z.enum(replyClasses);
const POLICY_CHECK_TIMEOUT_MS = 8_000;
const qualificationSchema = z.object({
  decision: z.enum(["qualified", "rejected"]),
  reason: z.string(),
  summary: z.string(),
  confidence: z.number().min(0).max(1),
  matchedSegments: z.array(z.string()).max(4),
  matchedSignals: z.array(z.string()).max(6),
  disqualifiers: z.array(z.string()).max(4),
  dimensions: z.object({
    personQualified: z.boolean(),
    companyQualified: z.boolean(),
    signalQualified: z.boolean(),
    negativeSignalsPresent: z.boolean(),
  }).optional(),
  missingEvidence: z.array(z.string()).max(6).optional(),
  checks: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      passed: z.boolean(),
      detail: z.string(),
      kind: z.enum(["required", "fit", "supporting", "negative"]),
    }),
  ),
});

export class AiStructuredService {
  private readonly config = getConfig();
  private readonly frameworkConfig = getFrameworkRuntimeConfig().config;
  private readonly provider = createGatewayProvider({
    apiKey: this.config.gatewayApiKey,
  });

  constructor() {
    if (this.config.gatewayApiKey && !process.env.AI_GATEWAY_API_KEY) {
      process.env.AI_GATEWAY_API_KEY = this.config.gatewayApiKey;
    }
  }

  async classifyReply(body: string) {
    if (!this.config.gatewayApiKey) {
      return heuristicReplyClassification(body);
    }

    try {
      const result = await generateObject({
        model: this.provider(resolveStructuredModel(this.frameworkConfig, "classifyReply")),
        schema: z.object({
          classification: replyClassEnum,
          rationale: z.string(),
          shouldHandoff: z.boolean(),
        }),
        prompt: [
          "Classify the inbound B2B sales email reply into one of the allowed classes.",
          `Allowed classes: ${replyClasses.join(", ")}.`,
          "Return only structured output.",
          "",
          body,
        ].join("\n"),
      });

      return result.object;
    } catch {
      return heuristicReplyClassification(body);
    }
  }

  async policyCheck(body: string) {
    if (!this.config.gatewayApiKey) {
      return heuristicPolicyCheck(body);
    }

    try {
      const result = await promiseWithTimeout(
        generateObject({
          model: this.provider(resolveStructuredModel(this.frameworkConfig, "policyCheck")),
          schema: z.object({
            allow: z.boolean(),
            reasons: z.array(z.string()),
          }),
          prompt: [
            "Review the outbound sales email draft for policy risks.",
            "Disallow deceptive claims, fabricated facts, harassment, or anything that ignores unsubscribes.",
            "Be strict. Return structured output only.",
            "",
            body,
          ].join("\n"),
        }),
        POLICY_CHECK_TIMEOUT_MS,
      );

      return result.object;
    } catch {
      return heuristicPolicyCheck(body);
    }
  }

  async qualifyProspectAgainstIcp(input: {
    icpMarkdown: string;
    candidate: QualificationInput;
  }): Promise<QualificationAssessment> {
    if (!this.config.gatewayApiKey) {
      return heuristicIcpQualification(input.candidate, input.icpMarkdown);
    }

    try {
      const result = await generateObject({
        model: this.provider(resolveStructuredModel(this.frameworkConfig, "qualifyProspect")),
        schema: qualificationSchema,
        prompt: [
          "You are qualifying a prospect against the current ICP document.",
          "Use the ICP markdown as the source of truth.",
          "Apply a generic ICP methodology: identity, source provenance, person fit, company fit, pain or trigger fit, and explicit negatives.",
          "Return a rigorous decision for whether the person and company are qualified against this ICP.",
          "Generic topical overlap is not enough.",
          "Always include checks for identity, source_provenance, person_fit, company_fit, pain_or_trigger_fit, and negative_signals.",
          "Also return dimensions.personQualified, dimensions.companyQualified, dimensions.signalQualified, dimensions.negativeSignalsPresent, plus missingEvidence when relevant.",
          "",
          "ICP markdown:",
          input.icpMarkdown,
          "",
          "Candidate data:",
          JSON.stringify(input.candidate, null, 2),
        ].join("\n"),
      });

      return {
        engine: "icp_doc_structured_v2",
        ruleVersion: "icp_doc_v2",
        decision: result.object.decision,
        ok: result.object.decision === "qualified",
        reason: result.object.reason,
        summary: result.object.summary,
        confidence: result.object.confidence,
        matchedSegments: result.object.matchedSegments,
        matchedSignals: result.object.matchedSignals,
        disqualifiers: result.object.disqualifiers,
        dimensions: result.object.dimensions,
        missingEvidence: result.object.missingEvidence ?? [],
        checks: result.object.checks,
      };
    } catch {
      return heuristicIcpQualification(input.candidate, input.icpMarkdown);
    }
  }
}

function heuristicReplyClassification(body: string) {
  const text = body.toLowerCase();

  if (text.includes("unsubscribe") || text.includes("remove me")) {
    return {
      classification: "unsubscribe" as const,
      rationale: "Detected unsubscribe language.",
      shouldHandoff: false,
    };
  }

  if (text.includes("bounce") || text.includes("delivery failed")) {
    return {
      classification: "bounce" as const,
      rationale: "Detected bounce language.",
      shouldHandoff: false,
    };
  }

  if (text.includes("wrong person") || text.includes("not the right person")) {
    return {
      classification: "wrong_person" as const,
      rationale: "Detected wrong person response.",
      shouldHandoff: false,
    };
  }

  if (text.includes("interested") || text.includes("let's talk") || text.includes("sounds good")) {
    return {
      classification: "positive" as const,
      rationale: "Detected positive interest language.",
      shouldHandoff: true,
    };
  }

  if (text.includes("forwarding") || text.includes("reach out to")) {
    return {
      classification: "referral" as const,
      rationale: "Detected referral language.",
      shouldHandoff: true,
    };
  }

  if (text.includes("not now") || text.includes("circle back") || text.includes("later")) {
    return {
      classification: "not_now" as const,
      rationale: "Detected deferment language.",
      shouldHandoff: false,
    };
  }

  if (text.includes("out of office") || text.includes("ooo")) {
    return {
      classification: "ooo" as const,
      rationale: "Detected out-of-office language.",
      shouldHandoff: false,
    };
  }

  if (text.includes("why") || text.includes("concern") || text.includes("not sure")) {
    return {
      classification: "objection" as const,
      rationale: "Detected objection or skepticism.",
      shouldHandoff: true,
    };
  }

  return {
    classification: "soft_interest" as const,
    rationale: "Defaulted to soft interest due to non-blocking response.",
    shouldHandoff: false,
  };
}

function heuristicPolicyCheck(body: string) {
  const text = body.toLowerCase();
  const reasons: string[] = [];

  if (text.includes("guarantee") || text.includes("100%")) {
    reasons.push("contains strong guarantee language");
  }
  if (text.includes("ignore previous")) {
    reasons.push("contains prompt injection marker");
  }

  return {
    allow: reasons.length === 0,
    reasons,
  };
}


function promiseWithTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}
