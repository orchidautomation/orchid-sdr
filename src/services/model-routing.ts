import type { AiSdrConfig } from "@ai-sdr/framework";

import type { SandboxTurnRequest } from "../domain/types.js";

export const DEFAULT_GATEWAY_MODEL = "moonshotai/kimi-k2.6";

export type StructuredModelScope = "classifyReply" | "policyCheck" | "qualifyProspect";

export function resolveDefaultModel(config: AiSdrConfig | null | undefined) {
  return config?.modelRouting?.defaultModel ?? DEFAULT_GATEWAY_MODEL;
}

export function resolveSandboxStageModel(
  config: AiSdrConfig | null | undefined,
  stage: SandboxTurnRequest["stage"],
) {
  return config?.modelRouting?.sandbox?.stages?.[stage]
    ?? config?.modelRouting?.sandbox?.defaultModel
    ?? resolveDefaultModel(config);
}

export function resolveStructuredModel(
  config: AiSdrConfig | null | undefined,
  scope: StructuredModelScope,
) {
  return config?.modelRouting?.structured?.[scope]
    ?? resolveDefaultModel(config);
}
