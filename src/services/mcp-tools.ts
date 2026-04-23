import type { MessageInsertInput } from "../repository.js";
import type { ProspectSnapshot } from "../repository.js";
import { shouldHandoff } from "./policy-service.js";

import type { AppContext } from "./runtime-context.js";

export class OrchidMcpToolService {
  constructor(private readonly context: AppContext) {}

  async handleTool(name: string, args: Record<string, unknown>) {
    switch (name) {
      case "knowledge.search":
        return this.context.knowledge.search(String(args.query ?? ""), Number(args.limit ?? 5));
      case "lead.getContext":
        return this.context.repository.getProspectSnapshot(String(args.prospectId));
      case "lead.updateState":
        return this.handleLeadUpdate(args);
      case "email.enrich":
        return this.handleEmailEnrich(String(args.prospectId));
      case "research.search":
        return this.context.parallel.search(String(args.query ?? ""), Number(args.limit ?? 5));
      case "research.extract":
        return this.context.firecrawl.extract(String(args.url ?? ""));
      case "mail.send":
        return this.handleMailSend(args);
      case "mail.reply":
        return this.handleMailReply(args);
      case "mail.pause":
        return this.handleMailPause(String(args.threadId), String(args.reason ?? "manual pause"));
      case "handoff.slack":
        return this.handleSlackHandoff(String(args.threadId), String(args.reason ?? "handoff"), args.payload);
      case "handoff.webhook":
        return this.handleWebhookHandoff(String(args.threadId), String(args.reason ?? "handoff"), args.payload);
      default:
        throw new Error(`unknown MCP tool ${name}`);
    }
  }

  private async handleLeadUpdate(args: Record<string, unknown>) {
    const prospectId = String(args.prospectId);
    await this.context.repository.updateProspectState({
      prospectId,
      stage: args.stage as ProspectSnapshot["prospect"]["stage"] | undefined,
      status: args.status as ProspectSnapshot["prospect"]["status"] | undefined,
      lastReplyClass: (args.lastReplyClass as ProspectSnapshot["prospect"]["lastReplyClass"]) ?? undefined,
      pausedReason: (args.pausedReason as string | null) ?? undefined,
    });
    return { ok: true };
  }

  private async handleEmailEnrich(prospectId: string) {
    const snapshot = await this.context.repository.getProspectSnapshot(prospectId);
    const enriched = await this.context.prospeo.enrich(snapshot.prospect);
    if (enriched) {
      await this.context.repository.upsertContactEmail(prospectId, enriched);
    }
    return enriched;
  }

  private async handleMailSend(args: Record<string, unknown>) {
    const threadId = String(args.threadId);
    const thread = await this.context.repository.getThread(threadId);
    if (!thread) {
      throw new Error(`thread ${threadId} not found`);
    }

    const snapshot = await this.context.repository.getProspectSnapshot(thread.prospect_id as string);
    return this.performSend({
      snapshot,
      kind: String(args.kind ?? "first_outbound") as "first_outbound" | "reply" | "follow_up",
      subject: String(args.subject ?? ""),
      bodyText: String(args.bodyText ?? ""),
      bodyHtml: typeof args.bodyHtml === "string" ? args.bodyHtml : null,
      isReply: false,
    });
  }

  private async handleMailReply(args: Record<string, unknown>) {
    const threadId = String(args.threadId);
    const thread = await this.context.repository.getThread(threadId);
    if (!thread) {
      throw new Error(`thread ${threadId} not found`);
    }

    const snapshot = await this.context.repository.getProspectSnapshot(thread.prospect_id as string);
    return this.performSend({
      snapshot,
      kind: "reply",
      subject: String(args.subject ?? "Re: follow up"),
      bodyText: String(args.bodyText ?? ""),
      bodyHtml: typeof args.bodyHtml === "string" ? args.bodyHtml : null,
      isReply: true,
    });
  }

  private async performSend(input: {
    snapshot: ProspectSnapshot;
    kind: "first_outbound" | "reply" | "follow_up";
    subject: string;
    bodyText: string;
    bodyHtml: string | null;
    isReply: boolean;
  }) {
    const policy = await this.context.ai.policyCheck(input.bodyText);
    const authority = this.context.policy.evaluateSendAuthority({
      snapshot: input.snapshot,
      controlFlags: await this.context.repository.getControlFlags(),
      kind: input.kind,
      emailConfidence: input.snapshot.email?.confidence ?? 0,
      researchConfidence: input.snapshot.researchBrief?.confidence ?? 0,
      policyPass: policy.allow,
    });

    if (!authority.allowed) {
      await this.context.repository.pauseThread(input.snapshot.thread.id, authority.reasons.join("; "));
      return {
        ok: false,
        blocked: true,
        reasons: authority.reasons,
      };
    }

    const email = input.snapshot.email?.address;
    if (!email) {
      throw new Error(`no email available for prospect ${input.snapshot.prospect.prospectId}`);
    }

    const sendResponse = input.isReply
      ? await this.context.agentMail.reply({
          threadId: input.snapshot.thread.providerThreadId ?? input.snapshot.thread.id,
          bodyText: input.bodyText,
          bodyHtml: input.bodyHtml,
          subject: input.subject,
        })
      : await this.context.agentMail.send({
          to: email,
          subject: input.subject,
          bodyText: input.bodyText,
          bodyHtml: input.bodyHtml,
          threadId: input.snapshot.thread.providerThreadId,
        });

    const message: MessageInsertInput = {
      threadId: input.snapshot.thread.id,
      providerMessageId: sendResponse.providerMessageId ?? null,
      direction: "outbound",
      kind: input.kind,
      subject: input.subject,
      bodyText: input.bodyText,
      bodyHtml: input.bodyHtml,
      metadata: sendResponse.raw,
    };

    await this.context.repository.addMessage(message);
    await this.context.repository.updateThreadState({
      threadId: input.snapshot.thread.id,
      providerThreadId: sendResponse.providerThreadId ?? input.snapshot.thread.providerThreadId,
      stage: "await_reply",
      status: "active",
      pausedReason: null,
    });
    await this.context.repository.updateProspectState({
      prospectId: input.snapshot.prospect.prospectId,
      stage: "await_reply",
      status: "active",
      pausedReason: null,
    });
    await this.context.repository.appendAuditEvent("thread", input.snapshot.thread.id, "OutboundSent", {
      kind: input.kind,
      providerThreadId: sendResponse.providerThreadId,
      providerMessageId: sendResponse.providerMessageId,
    });

    return {
      ok: true,
      blocked: false,
      providerThreadId: sendResponse.providerThreadId,
      providerMessageId: sendResponse.providerMessageId,
    };
  }

  private async handleMailPause(threadId: string, reason: string) {
    await this.context.repository.pauseThread(threadId, reason);
    await this.context.repository.appendAuditEvent("thread", threadId, "ThreadPaused", { reason });
    return { ok: true };
  }

  private async handleSlackHandoff(threadId: string, reason: string, payload: unknown) {
    const handoffId = await this.context.repository.createHandoff(threadId, "slack", {
      reason,
      payload,
    });
    await this.context.slack.notify(
      undefined,
      `SDR handoff requested for thread ${threadId}: ${reason}`,
      { threadId, reason, payload },
    );
    await this.context.repository.markHandoffStatus(handoffId, "sent");
    await this.context.repository.pauseThread(threadId, `handoff:${reason}`);
    return { ok: true, handoffId };
  }

  private async handleWebhookHandoff(threadId: string, reason: string, payload: unknown) {
    const handoffId = await this.context.repository.createHandoff(threadId, "webhook", {
      reason,
      payload,
    });

    if (!this.context.config.APP_URL) {
      throw new Error("APP_URL is not configured");
    }

    const signature = this.context.security.signHandoffBody(
      JSON.stringify({
        threadId,
        reason,
        payload,
      }),
    );

    await fetch(`${this.context.config.APP_URL}/webhooks/handoff`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-orchid-signature": signature,
      },
      body: JSON.stringify({
        threadId,
        disposition: reason,
        payload,
      }),
    });

    await this.context.repository.markHandoffStatus(handoffId, "sent");
    await this.context.repository.pauseThread(threadId, `handoff:${reason}`);
    return { ok: true, handoffId };
  }
}
