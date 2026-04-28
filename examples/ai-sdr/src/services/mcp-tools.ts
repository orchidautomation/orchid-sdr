import type { MessageInsertInput } from "../repository.js";
import type { ProspectSnapshot } from "../repository.js";
import { previewDraftForProspect } from "../orchestration/prospect-workflow.js";
import { runSandboxTurn } from "../orchestration/sandbox-broker.js";
import { getActorClient } from "./actor-client.js";
import { shouldHandoff } from "./policy-service.js";
import { DefaultSdrMcpToolService } from "../../../../packages/default-sdr/src/mcp-tool-service.js";

import type { AppContext } from "./runtime-context.js";

const MAIL_PREVIEW_TIMEOUT_MS = 90_000;

export class TrellisMcpToolService extends DefaultSdrMcpToolService<AppContext> {
  constructor(protected override readonly context: AppContext) {
    super(context, {
      getActorClient,
    });
  }

  override async handleTool(name: string, args: Record<string, unknown>) {
    switch (name) {
      case "knowledge.search":
        return this.context.knowledge.search(String(args.query ?? ""), Number(args.limit ?? 5));
      case "crm.syncProspect":
        return this.handleCrmSync(args);
      case "email.enrich":
        return this.handleEmailEnrich(String(args.prospectId));
      case "research.search":
        return this.context.providers.search.search(String(args.query ?? ""), {
          limit: Number(args.limit ?? 5),
        });
      case "research.extract":
        return this.context.providers.extract.extract(String(args.url ?? ""));
      case "mail.send":
        return this.handleMailSend(args);
      case "mail.preview":
        return this.handleMailPreview(args);
      case "mail.reply":
        return this.handleMailReply(args);
      case "mail.pause":
        return this.handleMailPause(String(args.threadId), String(args.reason ?? "manual pause"));
      case "handoff.slack":
        return this.handleSlackHandoff(String(args.threadId), String(args.reason ?? "handoff"), args.payload);
      case "handoff.webhook":
        return this.handleWebhookHandoff(String(args.threadId), String(args.reason ?? "handoff"), args.payload);
      default:
        return super.handleTool(name, args);
    }
  }

  private getConfiguredCrmProvider() {
    return this.context.providers.crm;
  }

  private getConfiguredEmailProvider() {
    return this.context.providers.email;
  }

  private getConfiguredHandoffProvider() {
    return this.context.providers.handoff;
  }

  private async handleCrmSync(args: Record<string, unknown>) {
    const prospectId = String(args.prospectId ?? "");
    if (!prospectId) {
      throw new Error("prospectId is required");
    }
    const crmProvider = this.getConfiguredCrmProvider();
    if (!crmProvider) {
      throw new Error("no CRM provider is configured for this stack");
    }
    if (crmProvider.providerId !== "attio") {
      throw new Error(`configured CRM provider "${crmProvider.providerId}" is not supported by the reference AI SDR yet`);
    }
    if (!crmProvider.isConfigured()) {
      throw new Error("configured CRM provider is not authenticated");
    }
    const crm = crmProvider.adapter;

    const createNote = args.createNote !== false;
    const addToList = args.addToList === true;
    const requestedListStage = typeof args.listStage === "string" && args.listStage.trim()
      ? args.listStage.trim()
      : this.context.config.ATTIO_DEFAULT_LIST_STAGE ?? null;
    const snapshot = await this.context.repository.getProspectSnapshot(prospectId);
    const [signal, prospectRow] = await Promise.all([
      snapshot.prospect.sourceSignalId
        ? this.context.repository.getSignal(snapshot.prospect.sourceSignalId)
        : Promise.resolve(null),
      this.context.repository.getProspectDashboardRow(prospectId),
    ]);

    const providerRunId = await this.context.repository.recordProviderRun({
      provider: crmProvider.providerId,
      kind: "crm_sync",
      externalId: prospectId,
      status: "running",
      requestPayload: {
        prospectId,
        createNote,
        addToList,
        listStage: requestedListStage,
      },
    });

    try {
      const warnings: string[] = [];
      const company = await crm.upsertCompany({
        name: snapshot.prospect.company,
        domain: snapshot.prospect.companyDomain,
        recordId: snapshot.prospect.attioCompanyRecordId,
      });
      if (!snapshot.prospect.companyDomain && snapshot.prospect.company) {
        warnings.push("company synced without domain; Attio may create duplicates on repeated syncs");
      }
      warnings.push(...(company?.warnings ?? []));

      const person = await crm.upsertPerson({
        fullName: snapshot.prospect.fullName,
        title: snapshot.prospect.title,
        email: snapshot.email?.address ?? null,
        linkedinUrl: snapshot.prospect.linkedinUrl,
        twitterUrl: snapshot.prospect.twitterUrl,
        companyRecordId: company?.recordId ?? null,
        companyDomain: snapshot.prospect.companyDomain,
        recordId: snapshot.prospect.attioPersonRecordId,
      });
      warnings.push(...(person.warnings ?? []));
      if (!snapshot.email?.address && person.mode === "create") {
        warnings.push("person synced without email; created a new Attio person record");
      }

      let note: { noteId: string | null } | null = null;
      if (createNote) {
        if (!company?.recordId) {
          warnings.push("company record missing; skipped Attio note creation");
        } else {
        note = await crm.createNote({
          parentObject: "companies",
          parentRecordId: company.recordId,
          title: `Trellis qualification - ${snapshot.prospect.company ?? snapshot.prospect.fullName}`,
          content: this.buildCrmNote(snapshot, signal, prospectRow?.qualification ?? null),
        });
        }
      }

      let listEntry: { entryId: string | null; listId?: string | null } | null = null;
      if (addToList) {
        if (!this.context.config.ATTIO_DEFAULT_LIST_ID) {
          warnings.push("ATTIO_DEFAULT_LIST_ID is not configured; skipped Attio list entry");
        } else if (!company?.recordId) {
          warnings.push("company record missing; skipped Attio list entry");
        } else {
          const list = await crm.getList(this.context.config.ATTIO_DEFAULT_LIST_ID);
          if (!list.parentObject.includes("companies")) {
            warnings.push(`Attio list "${list.name}" is not a companies list; skipped list entry`);
          } else {
            const existingEntries = await crm.listRecordEntries("companies", company.recordId);
            const matchingEntries = existingEntries.filter((entry) => entry.listId === list.listId);

            if (matchingEntries.length > 1) {
              warnings.push(
                `multiple Attio pipeline cards already exist for company ${company.recordId} in list ${list.listId}; skipped automatic card update`,
              );
              listEntry = {
                entryId: matchingEntries[0]?.entryId ?? null,
                listId: list.listId,
              };
            } else {
              const entryValues: Record<string, unknown> = {};
              const listAttributes = await crm.listAttributes(list.listId);
              const mainPointOfContactAttribute = listAttributes.find((attribute) =>
                attribute.type === "record-reference"
                && attribute.isWritable
                && (
                  attribute.apiSlug === "main_point_of_contact"
                  || attribute.title.toLowerCase() === "main point of contact"
                )
              );

              if (person.recordId && mainPointOfContactAttribute) {
                const personReference = {
                  target_object: "people",
                  target_record_id: person.recordId,
                };
                entryValues[mainPointOfContactAttribute.apiSlug] = mainPointOfContactAttribute.isMultiselect
                  ? [personReference]
                  : personReference;
              } else if (!person.recordId) {
                warnings.push(
                  `Attio person record missing; skipped main point of contact on list "${list.name}"`,
                );
              } else {
                warnings.push(
                  `Attio list "${list.name}" does not expose a writable main point of contact attribute; skipped contact assignment`,
                );
              }

              if (requestedListStage) {
                const stageAttribute = listAttributes.find(
                  (attribute) => attribute.type === "status" && attribute.isWritable,
                );
                if (!stageAttribute) {
                  warnings.push(
                    `Attio list "${list.name}" does not expose a writable status attribute; skipped stage update`,
                  );
                } else {
                  const statuses = await crm.listStatuses(list.listId, stageAttribute.apiSlug);
                  const matchedStatus = statuses.find(
                    (status) => status.title.toLowerCase() === requestedListStage.toLowerCase(),
                  );
                  if (!matchedStatus) {
                    warnings.push(
                      `Attio stage "${requestedListStage}" was not found on list "${list.name}"; available stages: ${statuses.map((status) => status.title).join(", ")}`,
                    );
                  } else {
                    entryValues[stageAttribute.apiSlug] = matchedStatus.title;
                  }
                }
              }

              const assertedEntry = await crm.assertCompanyInList({
                listId: list.listId,
                companyRecordId: company.recordId,
                entryValues,
              });
              listEntry = {
                entryId: assertedEntry.entryId,
                listId: assertedEntry.listId,
              };
            }
          }
        }
      }

      const result = {
        ok: true,
        provider: crmProvider.providerId,
        company,
        person,
        note,
        listEntry,
        warnings,
      };

      await this.context.repository.updateProspectCrmReferences({
        prospectId,
        attioCompanyRecordId: company?.recordId ?? null,
        attioPersonRecordId: person.recordId,
        attioListEntryId: listEntry?.entryId ?? null,
      });

      await this.context.repository.updateProviderRun(providerRunId, {
        status: "succeeded",
        responsePayload: result as unknown as Record<string, unknown>,
      });
      await this.context.repository.appendAuditEvent("prospect", prospectId, "CrmSynced", {
        provider: crmProvider.providerId,
        personRecordId: person.recordId,
        companyRecordId: company?.recordId ?? null,
        noteId: note?.noteId ?? null,
        listEntryId: listEntry?.entryId ?? null,
        listId: listEntry?.listId ?? null,
        warnings,
      });

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.context.repository.updateProviderRun(providerRunId, {
        status: "failed",
        responsePayload: {
          error: message,
        },
      });
      throw error;
    }
  }

  private async maybeAutoSyncProspectToCrm(input: {
    prospectId: string;
    listStage: string | null;
    createNote: boolean;
    addToList: boolean;
    sourceEvent: string;
  }) {
    const crmProvider = this.getConfiguredCrmProvider();
    if (!crmProvider?.isConfigured()) {
      return null;
    }

    try {
      return await this.handleCrmSync({
        prospectId: input.prospectId,
        createNote: input.createNote,
        addToList: input.addToList,
        listStage: input.listStage,
      });
    } catch (error) {
      console.error(
        `[${crmProvider.providerId}] automatic sync failed after ${input.sourceEvent} for prospect ${input.prospectId}`,
        error,
      );
      return null;
    }
  }

  private buildCrmNote(
    snapshot: Awaited<ReturnType<AppContext["repository"]["getProspectSnapshot"]>>,
    signal: Awaited<ReturnType<AppContext["repository"]["getSignal"]>>,
    qualification: {
      summary?: string;
      reason?: string;
      matchedSegments?: string[];
      matchedSignals?: string[];
      disqualifiers?: string[];
    } | null,
  ) {
    const lines = [
      `Qualified lead synced from Trellis`,
      ``,
      `Prospect: ${snapshot.prospect.fullName}`,
      `Title: ${snapshot.prospect.title ?? "Unknown"}`,
      `Company: ${snapshot.prospect.company ?? "Unknown"}`,
      `Company domain: ${snapshot.prospect.companyDomain ?? "Unknown"}`,
      `LinkedIn: ${snapshot.prospect.linkedinUrl ?? "Unknown"}`,
      `Twitter/X: ${snapshot.prospect.twitterUrl ?? "Unknown"}`,
      `Email: ${snapshot.email?.address ?? "Unknown"}`,
      `Campaign: ${snapshot.campaign.name}`,
      `Stage: ${snapshot.prospect.stage}`,
      `Status: ${snapshot.prospect.status}`,
    ];

    if (signal) {
      lines.push(
        ``,
        `Source signal`,
        `- Source: ${signal.source}`,
        `- Topic: ${signal.topic}`,
        `- URL: ${signal.url}`,
        `- Content: ${signal.content || "n/a"}`,
      );
    }

    if (qualification) {
      lines.push(
        ``,
        `Qualification`,
        `- Summary: ${qualification.summary ?? "n/a"}`,
        `- Reason: ${qualification.reason ?? "n/a"}`,
        `- Matched segments: ${(qualification.matchedSegments ?? []).join(", ") || "n/a"}`,
        `- Matched signals: ${(qualification.matchedSignals ?? []).join(", ") || "n/a"}`,
      );
      if ((qualification.disqualifiers ?? []).length > 0) {
        lines.push(`- Disqualifiers: ${qualification.disqualifiers?.join(", ")}`);
      }
    }

    if (snapshot.researchBrief) {
      lines.push(
        ``,
        `Research brief`,
        snapshot.researchBrief.summary,
        ``,
        `Evidence`,
      );
      for (const item of snapshot.researchBrief.evidence.slice(0, 6)) {
        lines.push(`- ${item.title}: ${item.url}`);
      }
    }

    return lines.join("\n");
  }

  private async handleEmailEnrich(prospectId: string) {
    const snapshot = await this.context.repository.getProspectSnapshot(prospectId);
    const enrichmentProvider = this.context.providers.enrichment;
    if (!enrichmentProvider) {
      return null;
    }

    const enriched = await enrichmentProvider.enrich(snapshot.prospect);
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

  private async handleMailPreview(args: Record<string, unknown>) {
    const threadId = String(args.threadId ?? "");
    if (!threadId) {
      throw new Error("threadId is required");
    }

    const thread = await this.context.repository.getThread(threadId);
    if (!thread) {
      throw new Error(`thread ${threadId} not found`);
    }

    const kind =
      args.kind === "follow_up" || args.kind === "reply"
        ? (args.kind as "follow_up" | "reply")
        : "first_outbound";

    const draft = await previewDraftForProspect(
      {
        context: this.context,
        runSandboxTurn: (request) => runSandboxTurn(this.context, request, { timeoutMs: MAIL_PREVIEW_TIMEOUT_MS }),
      },
      String(thread.prospect_id),
      kind,
    );

    return {
      ok: true,
      threadId,
      prospectId: String(thread.prospect_id),
      ...draft,
    };
  }

  private async performSend(input: {
    snapshot: ProspectSnapshot;
    kind: "first_outbound" | "reply" | "follow_up";
    subject: string;
    bodyText: string;
    bodyHtml: string | null;
    isReply: boolean;
  }) {
    const emailProvider = this.getConfiguredEmailProvider();
    if (!emailProvider) {
      throw new Error("no outbound email provider is configured for this stack");
    }

    const controlFlags = await this.context.repository.getControlFlags();
    const preflightAuthority = this.context.policy.evaluateSendAuthority({
      snapshot: input.snapshot,
      controlFlags,
      kind: input.kind,
      emailConfidence: input.snapshot.email?.confidence ?? 0,
      researchConfidence: input.snapshot.researchBrief?.confidence ?? 0,
      policyPass: true,
    });

    if (!preflightAuthority.allowed) {
      await this.context.repository.pauseThread(input.snapshot.thread.id, preflightAuthority.reasons.join("; "));
      return {
        ok: false,
        blocked: true,
        reasons: preflightAuthority.reasons,
      };
    }

    const policy = await this.context.ai.policyCheck(input.bodyText);
    const authority = this.context.policy.evaluateSendAuthority({
      snapshot: input.snapshot,
      controlFlags,
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

    const sender = await this.ensureCampaignSenderIdentity(input.snapshot, emailProvider);
    if (!sender.ok) {
      await this.context.repository.pauseThread(input.snapshot.thread.id, sender.reasons.join("; "));
      return {
        ok: false,
        blocked: true,
        reasons: sender.reasons,
      };
    }

    const campaignInboxId = sender.senderProviderInboxId;
    const threadInboxId = input.snapshot.thread.providerInboxId;
    if (!input.isReply && threadInboxId && campaignInboxId && threadInboxId !== campaignInboxId) {
      const reasons = ["thread sender inbox differs from campaign sender identity"];
      await this.context.repository.pauseThread(input.snapshot.thread.id, reasons.join("; "));
      return {
        ok: false,
        blocked: true,
        reasons,
      };
    }

    const providerInboxId = threadInboxId ?? campaignInboxId;
    if (!providerInboxId) {
      throw new Error(`no ${emailProvider.providerId} inbox available for campaign ${input.snapshot.campaign.id}`);
    }

    const sendResponse = input.isReply
      ? await this.replyFromThread(input.snapshot, emailProvider, {
          inboxId: providerInboxId,
          bodyText: input.bodyText,
          bodyHtml: input.bodyHtml,
          subject: input.subject,
        })
      : await emailProvider.send({
          inboxId: providerInboxId,
          to: this.requireProspectEmail(input.snapshot),
          subject: input.subject,
          bodyText: input.bodyText,
          bodyHtml: input.bodyHtml,
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
      providerInboxId,
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
      senderEmail: sender.senderEmail,
      providerInboxId,
      providerThreadId: sendResponse.providerThreadId,
      providerMessageId: sendResponse.providerMessageId,
    });

    if (!input.isReply && input.kind === "first_outbound") {
      await this.maybeAutoSyncProspectToCrm({
        prospectId: input.snapshot.prospect.prospectId,
        createNote: true,
        addToList: true,
        listStage: this.context.config.ATTIO_AUTO_OUTBOUND_STAGE,
        sourceEvent: "OutboundSent",
      });
    }

    return {
      ok: true,
      blocked: false,
      senderEmail: sender.senderEmail,
      providerInboxId,
      providerThreadId: sendResponse.providerThreadId,
      providerMessageId: sendResponse.providerMessageId,
    };
  }

  private requireProspectEmail(snapshot: ProspectSnapshot) {
    const email = snapshot.email?.address;
    if (!email) {
      throw new Error(`no email available for prospect ${snapshot.prospect.prospectId}`);
    }

    return email;
  }

  private async replyFromThread(
    snapshot: ProspectSnapshot,
    emailProvider: NonNullable<AppContext["providers"]["email"]>,
    input: {
      inboxId: string;
      subject: string;
      bodyText: string;
      bodyHtml: string | null;
    },
  ) {
    const latestInbound = await this.context.repository.getLatestInboundMessage(snapshot.thread.id);
    const providerMessageId =
      typeof latestInbound?.provider_message_id === "string" && latestInbound.provider_message_id.trim().length > 0
        ? latestInbound.provider_message_id
        : null;

    if (!providerMessageId) {
      throw new Error(`cannot reply on thread ${snapshot.thread.id} without an inbound provider message id`);
    }

    return emailProvider.reply({
      inboxId: input.inboxId,
      messageId: providerMessageId,
      bodyText: input.bodyText,
      bodyHtml: input.bodyHtml,
      subject: input.subject,
      replyAll: true,
    });
  }

  private async ensureCampaignSenderIdentity(
    snapshot: ProspectSnapshot,
    emailProvider: NonNullable<AppContext["providers"]["email"]>,
  ) {
    if (snapshot.campaign.senderProviderInboxId) {
      if (!emailProvider.isConfigured()) {
        return {
          ok: true as const,
          senderEmail: snapshot.campaign.senderEmail,
          senderDisplayName: snapshot.campaign.senderDisplayName,
          senderProviderInboxId: snapshot.campaign.senderProviderInboxId,
        };
      }

      try {
        const providerInbox = await emailProvider.getInbox(snapshot.campaign.senderProviderInboxId);
        const senderEmail = providerInbox.email ?? snapshot.campaign.senderEmail;
        const senderDisplayName =
          providerInbox.displayName ?? snapshot.campaign.senderDisplayName ?? snapshot.campaign.name;
        const senderProviderInboxId = providerInbox.providerInboxId ?? snapshot.campaign.senderProviderInboxId;

        if (
          senderEmail !== snapshot.campaign.senderEmail
          || senderDisplayName !== snapshot.campaign.senderDisplayName
          || senderProviderInboxId !== snapshot.campaign.senderProviderInboxId
        ) {
          await this.context.repository.updateCampaignSenderIdentity({
            campaignId: snapshot.campaign.id,
            senderEmail,
            senderDisplayName,
            senderProviderInboxId,
          });
          await this.context.repository.appendAuditEvent("campaign", snapshot.campaign.id, "SenderIdentityRefreshed", {
            senderEmail,
            senderDisplayName,
            senderProviderInboxId,
            source: emailProvider.providerId,
          });
        }

        return {
          ok: true as const,
          senderEmail,
          senderDisplayName,
          senderProviderInboxId,
        };
      } catch (error) {
        console.warn(
          `[${emailProvider.providerId}] failed to refresh sender identity for campaign ${snapshot.campaign.id}`,
          error,
        );
        return {
          ok: true as const,
          senderEmail: snapshot.campaign.senderEmail,
          senderDisplayName: snapshot.campaign.senderDisplayName,
          senderProviderInboxId: snapshot.campaign.senderProviderInboxId,
        };
      }
    }

    if (!emailProvider.isConfigured()) {
      return {
        ok: false as const,
        reasons: [`${emailProvider.providerId} is not configured`],
      };
    }

    if (!this.context.config.AGENTMAIL_AUTO_PROVISION_INBOX) {
      return {
        ok: false as const,
        reasons: ["campaign sender inbox not configured"],
      };
    }

    const provisioned = await emailProvider.createInbox({
      displayName:
        snapshot.campaign.senderDisplayName
        ?? this.context.config.AGENTMAIL_DEFAULT_SENDER_NAME
        ?? snapshot.campaign.name,
      clientId: `campaign-${snapshot.campaign.id}`,
      domain: this.context.config.AGENTMAIL_DEFAULT_INBOX_DOMAIN ?? undefined,
    });

    if (!provisioned.providerInboxId) {
      throw new Error(`${emailProvider.providerId} did not return an inbox id for campaign ${snapshot.campaign.id}`);
    }

    await this.context.repository.updateCampaignSenderIdentity({
      campaignId: snapshot.campaign.id,
      senderEmail: provisioned.email ?? snapshot.campaign.senderEmail,
      senderDisplayName: provisioned.displayName ?? snapshot.campaign.senderDisplayName ?? snapshot.campaign.name,
      senderProviderInboxId: provisioned.providerInboxId,
    });
    await this.context.repository.appendAuditEvent("campaign", snapshot.campaign.id, "SenderProvisioned", {
      senderEmail: provisioned.email,
      senderDisplayName: provisioned.displayName ?? snapshot.campaign.name,
      senderProviderInboxId: provisioned.providerInboxId,
      autoProvisioned: true,
    });

    return {
      ok: true as const,
      senderEmail: provisioned.email ?? snapshot.campaign.senderEmail,
      senderDisplayName: provisioned.displayName ?? snapshot.campaign.senderDisplayName ?? snapshot.campaign.name,
      senderProviderInboxId: provisioned.providerInboxId,
    };
  }

  private async handleMailPause(threadId: string, reason: string) {
    await this.context.repository.pauseThread(threadId, reason);
    await this.context.repository.appendAuditEvent("thread", threadId, "ThreadPaused", { reason });
    return { ok: true };
  }

  private async handleSlackHandoff(threadId: string, reason: string, payload: unknown) {
    const handoffProvider = this.getConfiguredHandoffProvider();
    if (!handoffProvider) {
      throw new Error("no handoff provider is configured for this stack");
    }

    const handoffId = await this.context.repository.createHandoff(threadId, handoffProvider.providerId, {
      reason,
      payload,
    });
    await handoffProvider.notify(
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
        "x-trellis-signature": signature,
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
