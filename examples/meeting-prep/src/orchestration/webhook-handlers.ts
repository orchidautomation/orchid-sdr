import { meetingBookingPayloadSchema } from "../domain/types.js";
import type { AppContext } from "../services/runtime-context.js";

export async function handleMeetingBookingWebhook(context: AppContext, request: Request) {
  if (!context.security.verifySharedSecretHeader(request, context.config.SIGNAL_WEBHOOK_SECRET)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const payload = meetingBookingPayloadSchema.parse(await request.json());
  const result = await context.repository.ingestBooking(payload);
  await context.repository.appendAuditEvent("meeting", result.meetingId, "MeetingCaptured", {
    source: payload.source,
    attendeeCount: payload.meeting.attendees.length,
  });

  return {
    payload,
    result,
  };
}
