import type {
  AiSdrCapabilityId,
  AiSdrContractId,
  AiSdrModuleDefinition,
} from "./index.js";

export type AiSdrCompositionProfile = {
  id: string;
  displayName: string;
  description: string;
  requiredCapabilities: readonly AiSdrCapabilityId[];
  requiredContracts: readonly AiSdrContractId[];
};

export type AiSdrCompositionEvaluation = {
  profile: AiSdrCompositionProfile;
  ok: boolean;
  providedCapabilities: AiSdrCapabilityId[];
  missingCapabilities: AiSdrCapabilityId[];
  providedContracts: AiSdrContractId[];
  missingContracts: AiSdrContractId[];
  modulesByCapability: Partial<Record<AiSdrCapabilityId, string[]>>;
  modulesByContract: Partial<Record<AiSdrContractId, string[]>>;
};

export type AiSdrCompositionProfileId = keyof typeof aiSdrCompositionProfiles;

export const aiSdrCompositionProfiles = {
  minimum: {
    id: "minimum",
    displayName: "Minimum runnable AI SDR",
    description: "Smallest stack that can ingest a signal, research it, route model work, run agents, persist state, and expose tools.",
    requiredCapabilities: [
      "state",
      "source",
      "search",
      "extract",
      "runtime",
      "model",
      "mcp",
    ],
    requiredContracts: [
      "state.reactive.v1",
      "state.workflow.v1",
      "signal.normalized.v1",
      "research.search.v1",
      "research.extract.v1",
      "model.gateway.v1",
      "runtime.actor.v1",
      "mcp.tools.v1",
    ],
  },
  productionParity: {
    id: "productionParity",
    displayName: "Current production parity",
    description: "Stack shape needed to recreate the current Orchid SDR behavior from modules.",
    requiredCapabilities: [
      "state",
      "source",
      "search",
      "extract",
      "enrichment",
      "runtime",
      "model",
      "email",
      "crm",
      "handoff",
      "mcp",
    ],
    requiredContracts: [
      "state.reactive.v1",
      "state.workflow.v1",
      "state.agentThreads.v1",
      "state.auditLog.v1",
      "signal.normalized.v1",
      "signal.discovery.v1",
      "research.search.v1",
      "research.extract.v1",
      "research.enrich.v1",
      "model.gateway.v1",
      "runtime.actor.v1",
      "runtime.sandbox.v1",
      "email.outbound.v1",
      "email.inbound.v1",
      "crm.prospectSync.v1",
      "crm.stageUpdate.v1",
      "handoff.notify.v1",
      "mcp.tools.v1",
    ],
  },
} as const satisfies Record<string, AiSdrCompositionProfile>;

export function evaluateModuleComposition(
  modules: AiSdrModuleDefinition[],
  input: {
    profile?: AiSdrCompositionProfileId | AiSdrCompositionProfile;
  } = {},
): AiSdrCompositionEvaluation {
  const profile = resolveCompositionProfile(input.profile ?? "minimum");
  const modulesByCapability: Partial<Record<AiSdrCapabilityId, string[]>> = {};
  const modulesByContract: Partial<Record<AiSdrContractId, string[]>> = {};

  for (const module of modules) {
    for (const capability of module.capabilityIds ?? []) {
      modulesByCapability[capability] = [...(modulesByCapability[capability] ?? []), module.id];
    }

    for (const contract of module.contracts ?? []) {
      modulesByContract[contract] = [...(modulesByContract[contract] ?? []), module.id];
    }
  }

  const providedCapabilities = sortValues(Object.keys(modulesByCapability) as AiSdrCapabilityId[]);
  const providedContracts = sortValues(Object.keys(modulesByContract) as AiSdrContractId[]);
  const providedCapabilitySet = new Set(providedCapabilities);
  const providedContractSet = new Set(providedContracts);
  const missingCapabilities = profile.requiredCapabilities.filter((capability) => !providedCapabilitySet.has(capability));
  const missingContracts = profile.requiredContracts.filter((contract) => !providedContractSet.has(contract));

  return {
    profile,
    ok: missingCapabilities.length === 0 && missingContracts.length === 0,
    providedCapabilities,
    missingCapabilities: [...missingCapabilities],
    providedContracts,
    missingContracts: [...missingContracts],
    modulesByCapability,
    modulesByContract,
  };
}

export function resolveCompositionProfile(
  profile: AiSdrCompositionProfileId | AiSdrCompositionProfile,
): AiSdrCompositionProfile {
  return typeof profile === "string" ? aiSdrCompositionProfiles[profile] : profile;
}

function sortValues<T extends string>(values: T[]): T[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}
