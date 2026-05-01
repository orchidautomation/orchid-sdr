import { actor, setup } from "rivetkit";

import { executeWorkItemWorkflow } from "./orchestration/work-item-workflow.js";
import { runSandboxTurn } from "./orchestration/sandbox-broker.js";
import { getAppContext, type AppContext } from "./services/runtime-context.js";

const workItemThread = actor({
  state: {
    workItemId: null as string | null,
    lastEventId: null as string | null,
    lastStatus: "new" as string,
  },
  actions: {
    bootstrapFromWebhook: async (c, input: { workItemId: string; eventId: string }) => {
      c.state.workItemId = input.workItemId;
      c.state.lastEventId = input.eventId;
      await executeWorkItemWorkflow(getAppContext(), input.workItemId);
      const workItem = await getAppContext().repository.getWorkItem(input.workItemId);
      c.state.lastStatus = workItem?.status ?? "ready";
      return {
        ok: true,
        workItemId: input.workItemId,
      };
    },
    rerun: async (c, input: { workItemId: string }) => {
      c.state.workItemId = input.workItemId;
      await executeWorkItemWorkflow(getAppContext(), input.workItemId);
      const workItem = await getAppContext().repository.getWorkItem(input.workItemId);
      c.state.lastStatus = workItem?.status ?? "ready";
      return {
        ok: true,
        workItemId: input.workItemId,
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
    lastWorkItemId: null as string | null,
  },
  actions: {
    runTurn: async (c, input: Parameters<typeof runSandboxTurn>[1]) => {
      c.state.lastTurnId = input.turnId;
      c.state.lastWorkItemId = input.workItemId;
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
    workItemThread,
    sandboxBroker,
  },
});
