import { createGatewayProvider } from "@ai-sdk/gateway";
import { generateObject } from "ai";

import { workArtifactSchema, type IntakePayload, type WorkArtifact } from "../domain/types.js";
import { getConfig } from "../config.js";
import { getFrameworkRuntimeConfig } from "./framework-stack.js";

const DEFAULT_GATEWAY_MODEL = "moonshotai/kimi-k2.6";

export class AiStructuredService {
  private readonly config = getConfig();
  private readonly frameworkConfig = getFrameworkRuntimeConfig().config;
  private readonly provider = createGatewayProvider({
    apiKey: this.config.gatewayApiKey,
  });

  async buildArtifact(input: {
    payload: IntakePayload;
    knowledgeContext: string;
  }): Promise<WorkArtifact> {
    if (!this.config.gatewayApiKey) {
      return heuristicArtifact(input.payload);
    }

    try {
      const result = await generateObject({
        model: this.provider(
          this.frameworkConfig.modelRouting?.defaultModel
            ?? this.frameworkConfig.modelRouting?.sandbox?.defaultModel
            ?? DEFAULT_GATEWAY_MODEL,
        ),
        schema: workArtifactSchema,
        prompt: [
          "You are preparing a concise work artifact from a structured webhook payload.",
          "Use the provided knowledge context as the policy and product context.",
          "Be factual. Do not invent missing details. Put uncertainty into openQuestions.",
          "",
          "Knowledge context:",
          input.knowledgeContext || "No matching knowledge snippets found.",
          "",
          "Payload:",
          JSON.stringify(input.payload, null, 2),
        ].join("\n"),
      });

      return result.object;
    } catch {
      return heuristicArtifact(input.payload);
    }
  }
}

function heuristicArtifact(payload: IntakePayload): WorkArtifact {
  const body = payload.body?.trim();
  return {
    summary: body ? `${payload.title}: ${body.slice(0, 220)}` : payload.title,
    keyFacts: [
      `source: ${payload.source}`,
      `type: ${payload.type}`,
      ...(payload.externalId ? [`externalId: ${payload.externalId}`] : []),
    ],
    nextActions: ["Review the payload and refine the workflow for this source."],
    openQuestions: Object.keys(payload.metadata ?? {}).length === 0 ? ["No metadata was provided with this event."] : [],
    confidence: 0.45,
  };
}

