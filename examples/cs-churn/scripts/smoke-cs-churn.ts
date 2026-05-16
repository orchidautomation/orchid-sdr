import { createTrellisTestApp } from "@trellis/gtm";
import agent from "../src/agent";

const traceEvents: Array<{
  type: string;
  span: string;
  payload?: Record<string, unknown>;
}> = [];

const app = createTrellisTestApp({
  signal: {
    id: "sig_cs_churn_acme_001",
    traceId: "trace_cs_churn_acme_001",
    workspaceId: "wrk_customer_success",
    threadId: "thr_acme_health_review",
    provider: "manual.test",
    source: "account.health.review",
    payload: {
      accountName: "Acme Benefits",
      accountId: "001000000000001AAA",
      segment: "employer",
      reason: "Renewal prep and declining engagement signals",
    },
  },
  eventSink: {
    async emit(event) {
      traceEvents.push({
        type: event.type,
        span: event.span,
        payload: event.payload,
      });
    },
  },
});

const result = await agent.handler(app);

console.log(JSON.stringify({
  ok: true,
  agent: agent.name,
  skillGraph: app.skillCalls.map((call) => ({
    name: call.name,
    trace: call.trace,
  })),
  workflows: app.startedWorkflows.map((workflow) => workflow.name),
  approvals: app.drafts.flatMap((draft) => draft.approvalRequiredFor),
  traceEvents,
  result,
}, null, 2));
