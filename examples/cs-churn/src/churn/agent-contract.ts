import type { TrellisSignal } from "@trellis/gtm";
import { z } from "zod";

const evidenceSlice = z.object({
  summary: z.string().min(1),
  flags: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  dataFreshness: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

const riskScore = z.object({
  score: z.number().min(0).max(100),
  band: z.enum(["Green", "Yellow", "Orange", "Red"]),
  topDrivers: z.array(z.object({
    driver: z.string(),
    evidence: z.string(),
    weight: z.number(),
  })).default([]),
  mitigants: z.array(z.string()).default([]),
  confidence: z.enum(["High", "Medium", "Low"]),
  math: z.string().optional(),
});

const playbook = z.object({
  headline: z.string().min(1),
  highestLeverageAction: z.string().min(1),
  actions: z.array(z.object({
    owner: z.string(),
    persona: z.string(),
    timeframe: z.string(),
    action: z.string(),
    definitionOfDone: z.string(),
  })).max(6),
  stopDoing: z.array(z.string()).default([]),
});

export const churnSchemas = {
  evidenceSlice,
  riskScore,
  playbook,
};

export const churnTrace = {
  salesforce: {
    parent: "churn-assessment",
    phase: "gather",
    sequence: 1,
    label: "Salesforce CRM slice",
  },
  zendesk: {
    parent: "churn-assessment",
    phase: "gather",
    sequence: 2,
    label: "Zendesk support slice",
  },
  usage: {
    parent: "churn-assessment",
    phase: "gather",
    sequence: 3,
    label: "Usage telemetry slice",
  },
  riskScore: {
    parent: "churn-assessment",
    phase: "score",
    sequence: 4,
    dependsOn: ["churn-salesforce", "churn-zendesk", "churn-usage"],
  },
  playbook: {
    parent: "churn-assessment",
    phase: "recommend",
    sequence: 5,
    dependsOn: ["churn-risk-score"],
  },
};

export function accountArgs(signal: TrellisSignal) {
  return {
    accountName: String(signal.payload?.accountName ?? signal.payload?.account ?? "Unknown account"),
    accountId: typeof signal.payload?.accountId === "string" ? signal.payload.accountId : undefined,
  };
}

export function churnBriefDraft(input: { accountName: string; score: unknown; savePlan: unknown }) {
  return {
    subject: `Churn risk brief: ${input.accountName}`,
    body: JSON.stringify({
      accountName: input.accountName,
      score: input.score,
      savePlan: input.savePlan,
    }, null, 2),
  };
}
