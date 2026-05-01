import { intakePayloadSchema } from "../domain/types.js";
import type { AppContext } from "../services/runtime-context.js";

export async function handleIntakeWebhook(context: AppContext, request: Request) {
  if (!context.security.verifySharedSecretHeader(request, context.config.SIGNAL_WEBHOOK_SECRET)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const payload = intakePayloadSchema.parse(await request.json());
  const result = await context.repository.ingestWebhookEvent(payload);
  await context.repository.appendAuditEvent("intake_event", result.intakeEventId, "WebhookCaptured", {
    source: payload.source,
    type: payload.type,
  });

  return {
    payload,
    result,
  };
}
