import {
  createDefaultSdrDiscoveryCoordinator,
  type DefaultSdrCoordinatorSource,
} from "../../../../packages/default-sdr/src/discovery-coordinator.js";

import type { AppConfig } from "../config.js";
import { createId } from "../lib/ids.js";
import { ingestApifyRun } from "./source-ingest.js";
import {
  normalizeTerms,
  parseDiscoveryPlan,
  selectFallbackDiscoveryTerms,
} from "./discovery-planner.js";
import { getAppContext } from "../services/runtime-context.js";
import { runSandboxTurn } from "./sandbox-broker.js";
import { isWeekdayInTimezone } from "./discovery-window.js";
import { getAutomationPauseReason } from "./workflow-control.js";

function getSeedTerms(config: AppConfig, source: DefaultSdrCoordinatorSource) {
  return source === "x_public_post"
    ? config.DISCOVERY_X_SEED_TERMS
    : config.DISCOVERY_LINKEDIN_SEED_TERMS;
}

export const discoveryCoordinator = createDefaultSdrDiscoveryCoordinator({
  getContext: getAppContext,
  createId,
  ingestApifyRun: (input, payload) => ingestApifyRun(input as any, payload),
  normalizeTerms,
  parseDiscoveryPlan,
  selectFallbackDiscoveryTerms,
  isWeekdayInTimezone,
  getAutomationPauseReason,
  runSandboxTurn,
  getSeedTerms: (source) => getSeedTerms(getAppContext().config, source),
});
