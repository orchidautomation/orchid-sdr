import type { ReplyClass, SendAuthorityResult, SendKind } from "../domain/types.js";
import type { ControlFlags, ProspectSnapshot } from "../repository.js";

export interface SendAuthorityInput {
  snapshot: ProspectSnapshot;
  controlFlags: ControlFlags;
  kind: SendKind;
  emailConfidence: number;
  researchConfidence: number;
  policyPass: boolean;
  now?: Date;
}

export function evaluateSendAuthority(input: SendAuthorityInput): SendAuthorityResult {
  const reasons: string[] = [];
  const now = input.now ?? new Date();
  const hour = now.getUTCHours();

  if (input.controlFlags.globalKillSwitch) {
    reasons.push("global kill switch enabled");
  }
  if (input.controlFlags.noSendsMode) {
    reasons.push("no sends mode enabled");
  }
  if (input.controlFlags.pausedCampaignIds.includes(input.snapshot.campaign.id)) {
    reasons.push("campaign is paused");
  }
  if (input.snapshot.thread.status === "paused") {
    reasons.push("thread is paused");
  }

  const quietHoursBlocked = isQuietHours(
    hour,
    input.snapshot.campaign.quietHoursStart,
    input.snapshot.campaign.quietHoursEnd,
  );
  if (quietHoursBlocked) {
    reasons.push("quiet hours active");
  }

  const touchCount = input.snapshot.messages.filter((message) => message.direction === "outbound").length;
  if (touchCount >= input.snapshot.campaign.touchCap) {
    reasons.push("touch cap reached");
  }

  if (hasBlockingReplyClass(input.snapshot.thread.lastReplyClass)) {
    reasons.push(`thread blocked by reply class ${input.snapshot.thread.lastReplyClass}`);
  }

  if (input.emailConfidence < input.snapshot.campaign.emailConfidenceThreshold) {
    reasons.push("email confidence below threshold");
  }

  if (!input.snapshot.prospect.sourceSignalId) {
    reasons.push("public-source provenance missing");
  }

  if (input.researchConfidence < input.snapshot.campaign.researchConfidenceThreshold) {
    reasons.push("research confidence below threshold");
  }

  if (!input.policyPass) {
    reasons.push("content policy check failed");
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    policyPass: input.policyPass,
  };
}

export function shouldHandoff(replyClass: ReplyClass) {
  return replyClass === "positive" || replyClass === "objection" || replyClass === "referral" || replyClass === "needs_human";
}

function hasBlockingReplyClass(replyClass: ReplyClass | null) {
  return replyClass === "unsubscribe" || replyClass === "bounce" || replyClass === "wrong_person" || replyClass === "spam_risk";
}

function isQuietHours(currentHourUtc: number, quietStart: number, quietEnd: number) {
  if (quietStart === quietEnd) {
    return false;
  }

  if (quietStart > quietEnd) {
    return currentHourUtc >= quietStart || currentHourUtc < quietEnd;
  }

  return currentHourUtc >= quietStart && currentHourUtc < quietEnd;
}
