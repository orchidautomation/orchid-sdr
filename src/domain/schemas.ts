import { z } from "zod";

import { lifecycleStages, replyClasses } from "./types.js";

export const apifyWebhookSchema = z.object({
  eventType: z.string(),
  resource: z.object({
    actorRunId: z.string(),
    defaultDatasetId: z.string().optional(),
  }),
});

export const agentmailWebhookSchema = z.object({
  type: z.string(),
  threadId: z.string().optional(),
  messageId: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const handoffWebhookSchema = z.object({
  threadId: z.string(),
  disposition: z.string(),
  notes: z.string().optional(),
  actor: z.string().optional(),
});

export const sendAuthorityInputSchema = z.object({
  quietHoursBlocked: z.boolean(),
  touchCapReached: z.boolean(),
  unsubscribed: z.boolean(),
  bounced: z.boolean(),
  emailConfidence: z.number(),
  emailConfidenceThreshold: z.number(),
  hasPublicProvenance: z.boolean(),
  researchConfidence: z.number(),
  researchConfidenceThreshold: z.number(),
  policyPass: z.boolean(),
});

export const replyClassificationSchema = z.object({
  classification: z.enum(replyClasses),
  rationale: z.string(),
  shouldHandoff: z.boolean(),
});

export const lifecycleStageSchema = z.enum(lifecycleStages);
