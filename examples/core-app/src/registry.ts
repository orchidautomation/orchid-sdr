import { actor, setup } from "rivetkit";

import { executeWorkItemWorkflow } from "./orchestration/work-item-workflow.js";
import { runSandboxTurn } from "./orchestration/sandbox-broker.js";
import { getAppContext, type AppContext } from "./services/runtime-context.js";

const intakeEventThread = actor({
  state: {
    intakeEventId: null as string | null,
    workflowRunId: null as string | null,
    lastStatus: "pending" as string,
  },
  actions: {
    bootstrapFromWebhook: async (c, input: { intakeEventId: string; workflowRunId: string }) => {
      c.state.intakeEventId = input.intakeEventId;
      c.state.workflowRunId = input.workflowRunId;
      await executeWorkItemWorkflow(getAppContext(), input.intakeEventId);
      const detail = await getAppContext().repository.getIntakeEventDetail(input.intakeEventId);
      c.state.lastStatus = detail?.workflowRun?.status ?? "ready";
      return {
        ok: true,
        intakeEventId: input.intakeEventId,
      };
    },
    rerun: async (c, input: { intakeEventId: string }) => {
      c.state.intakeEventId = input.intakeEventId;
      await executeWorkItemWorkflow(getAppContext(), input.intakeEventId);
      const detail = await getAppContext().repository.getIntakeEventDetail(input.intakeEventId);
      c.state.lastStatus = detail?.workflowRun?.status ?? "ready";
      return {
        ok: true,
        intakeEventId: input.intakeEventId,
      };
    },
    getSnapshot: async (c) => ({
      state: c.state,
    }),
  },
});

const sandboxBroker = actor({
  state: {
    lastTurnId: null as string | null,
    lastTargetId: null as string | null,
  },
  actions: {
    runTurn: async (c, input: Parameters<typeof runSandboxTurn>[1]) => {
      c.state.lastTurnId = input.turnId;
      c.state.lastTargetId = input.targetId;
      return await runSandboxTurn(getAppContext() as AppContext, input);
    },
    getSnapshot: async (c) => ({
      state: c.state,
    }),
  },
});

export const registry = setup({
  managerHost: "127.0.0.1",
  managerPort: 6420,
  use: {
    intakeEventThread,
    sandboxBroker,
  },
});
