import { DurableObject, WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { trellis } from "@trellis/gtm";
import agent from "./agent";
import { withTrellisRuntime } from "./trellis-runtime";

const runtime = trellis.cloudflare(agent);
const RuntimeTrellisAgent = runtime.TrellisAgent;
const RuntimeTrellisWorkflow = runtime.TrellisWorkflow;

export class TrellisAgent extends DurableObject<Record<string, unknown>> {
  async fetch(request: Request) {
    return new RuntimeTrellisAgent(this.ctx, this.env).fetch(request);
  }
}

export class TrellisWorkflow extends WorkflowEntrypoint<Record<string, unknown>, Record<string, unknown>> {
  async run(event: Readonly<WorkflowEvent<Record<string, unknown>>>, step: WorkflowStep) {
    return new RuntimeTrellisWorkflow(this.env).run(event, step);
  }
}

export default {
  fetch(request: Request, env: Record<string, unknown>) {
    return runtime.worker.fetch(request, withTrellisRuntime(env, request));
  },
  queue(batch: MessageBatch<unknown>, env: Record<string, unknown>) {
    return runtime.worker.queue?.(batch as never, withTrellisRuntime(env));
  },
  scheduled(controller: ScheduledController, env: Record<string, unknown>, ctx: ExecutionContext) {
    ctx.waitUntil(runtime.worker.scheduled?.(controller, withTrellisRuntime(env), ctx) ?? Promise.resolve());
  },
};
