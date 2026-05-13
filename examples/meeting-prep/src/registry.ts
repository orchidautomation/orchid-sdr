import { actor, setup } from "rivetkit";

import { executeMeetingPrepWorkflow } from "./orchestration/work-item-workflow.js";
import { runSandboxTurn } from "./orchestration/sandbox-broker.js";
import { getAppContext, type AppContext } from "./services/runtime-context.js";

const meetingPrepThread = actor({
  state: {
    meetingId: null as string | null,
    prepRunId: null as string | null,
    lastStatus: "pending" as string,
  },
  actions: {
    bootstrapFromWebhook: async (c, input: { meetingId: string; prepRunId: string }) => {
      c.state.meetingId = input.meetingId;
      c.state.prepRunId = input.prepRunId;
      await executeMeetingPrepWorkflow(getAppContext(), input.meetingId);
      const detail = await getAppContext().repository.getMeetingDetail(input.meetingId);
      c.state.lastStatus = detail?.prepRun?.status ?? "ready";
      return { ok: true, meetingId: input.meetingId };
    },
    rerun: async (c, input: { meetingId: string }) => {
      c.state.meetingId = input.meetingId;
      await executeMeetingPrepWorkflow(getAppContext(), input.meetingId);
      const detail = await getAppContext().repository.getMeetingDetail(input.meetingId);
      c.state.lastStatus = detail?.prepRun?.status ?? "ready";
      return { ok: true, meetingId: input.meetingId };
    },
    getSnapshot: async (c) => ({ state: c.state }),
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
    getSnapshot: async (c) => ({ state: c.state }),
  },
});

export const registry = setup({
  managerHost: "127.0.0.1",
  managerPort: 6420,
  use: {
    meetingPrepThread,
    sandboxBroker,
  },
});
