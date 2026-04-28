import type { AppContext } from "../services/runtime-context.js";
import type { SandboxTurnRequest, SandboxTurnResponse } from "../domain/types.js";

export interface WorkflowDependencies {
  context: AppContext;
  runSandboxTurn: (request: SandboxTurnRequest) => Promise<SandboxTurnResponse>;
}

export interface WorkflowOutcome {
  action:
    | "noop"
    | "paused"
    | "qualified"
    | "researched"
    | "sent"
    | "replied"
    | "handed_off";
  prospectId: string;
  threadId: string;
  reason?: string;
  followupDelayMs?: number;
}
