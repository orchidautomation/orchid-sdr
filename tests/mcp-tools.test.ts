import { beforeEach, describe, expect, it, vi } from "vitest";

let mockClient: any;

vi.mock("../src/services/actor-client.js", () => ({
  getActorClient: () => mockClient,
}));

import { OrchidMcpToolService } from "../src/services/mcp-tools.js";

describe("OrchidMcpToolService operator tools", () => {
  beforeEach(() => {
    mockClient = {
      discoveryCoordinator: {
        getOrCreate: vi.fn(() => ({
          getSnapshot: vi.fn(async () => ({
            state: {
              source: "linkedin_public_post",
              lastStatus: "running",
              initialized: true,
              ticks: 2,
            },
            runs: [
              {
                actor_run_id: "run_1",
                status: "running",
                term: "revops",
              },
            ],
            sourceState: {
              consecutive_empty_runs: 0,
            },
          })),
          enqueueTick: vi.fn(async () => ({
            ok: true,
            queued: true,
          })),
        })),
      },
      sandboxBroker: {
        getOrCreate: vi.fn(() => ({
          listJobs: vi.fn(async () => [
            {
              id: "job_1",
              status: "succeeded",
              stage: "build_research_brief",
              prospectId: "pros_1",
              campaignId: "cmp_default",
              metadata: {},
              outputText: "done",
              usage: {},
              error: null,
              createdAt: 1000,
              startedAt: 1500,
              completedAt: 3500,
              updatedAt: 3500,
            },
          ]),
        })),
      },
      campaignOps: {
        getOrCreate: vi.fn(() => ({
          getSnapshot: vi.fn(async () => ({
            state: {
              lastMutationAt: 0,
            },
            flags: {
              globalKillSwitch: false,
              noSendsMode: true,
              pausedCampaignIds: [],
            },
          })),
        })),
      },
    };
  });

  function createService() {
    const repository = {
      ensureDefaultCampaign: vi.fn(async () => ({
        id: "cmp_default",
        name: "Default SDR Campaign",
      })),
      getDashboardSummary: vi.fn(async () => ({
        signals: 10,
        prospects: 8,
        qualifiedLeads: 3,
        activeThreads: 2,
        pausedThreads: 6,
        providerRuns24h: 5,
        globalKillSwitch: false,
        noSendsMode: true,
      })),
      listActiveThreads: vi.fn(async () => [
        {
          threadId: "thr_1",
          prospectId: "pros_1",
          fullName: "Ada Lovelace",
          company: "Analytical Engines",
          title: "RevOps Lead",
          linkedinUrl: "https://linkedin.com/in/ada",
          stage: "build_research_brief",
          status: "active",
          qualificationReason: "Strong ICP fit",
          qualification: null,
          nextFollowUpAt: null,
          updatedAt: "2026-04-23T12:00:00.000Z",
        },
      ]),
      listQualifiedLeads: vi.fn(async () => [
        {
          prospectId: "pros_1",
          fullName: "Ada Lovelace",
          company: "Analytical Engines",
          title: "RevOps Lead",
          qualificationReason: "Strong ICP fit",
          qualification: null,
          threadStatus: "active",
          researchConfidence: 0.88,
          email: null,
          emailConfidence: null,
          updatedAt: "2026-04-23T12:00:00.000Z",
        },
      ]),
      listRecentProviderRuns: vi.fn(async () => [
        {
          id: "prun_1",
          provider: "apify",
          kind: "linkedin_public_post-source",
          externalId: "run_1",
          status: "succeeded",
          createdAt: "2026-04-23T12:00:00.000Z",
          updatedAt: "2026-04-23T12:00:01.000Z",
          durationMs: 1000,
          requestTerm: "revops",
          error: null,
        },
      ]),
      listRecentAuditEvents: vi.fn(async () => [
        {
          id: "audit_1",
          entityType: "prospect",
          entityId: "pros_1",
          eventName: "LeadQualified",
          payload: {},
          createdAt: "2026-04-23T12:00:00.000Z",
        },
      ]),
      listRecentProspects: vi.fn(async () => [
        {
          id: "pros_1",
          fullName: "Ada Lovelace",
          company: "Analytical Engines",
          title: "RevOps Lead",
          stage: "build_research_brief",
          status: "active",
          isQualified: true,
          qualificationReason: "Strong ICP fit",
          qualification: null,
          pausedReason: null,
          updatedAt: "2026-04-23T12:00:00.000Z",
        },
        {
          id: "pros_2",
          fullName: "Blocked Prospect",
          company: "Blocked Co",
          title: "Ops",
          stage: "qualify",
          status: "paused",
          isQualified: false,
          qualificationReason: "context missing",
          qualification: null,
          pausedReason: "company context missing",
          updatedAt: "2026-04-23T12:02:00.000Z",
        },
        {
          id: "pros_3",
          fullName: "Rejected Prospect",
          company: "No Fit Co",
          title: "Recruiter",
          stage: "qualify",
          status: "paused",
          isQualified: false,
          qualificationReason: "poor fit: recruiter title",
          qualification: null,
          pausedReason: "poor fit: recruiter title",
          updatedAt: "2026-04-23T12:03:00.000Z",
        },
      ]),
      getControlFlags: vi.fn(async () => ({
        globalKillSwitch: false,
        noSendsMode: true,
        pausedCampaignIds: [],
      })),
      getProspectSnapshot: vi.fn(async () => ({
        prospect: {
          prospectId: "pros_1",
          accountId: null,
          campaignId: "cmp_default",
          fullName: "Ada Lovelace",
          firstName: "Ada",
          title: "RevOps Lead",
          company: "Analytical Engines",
          companyDomain: "analyticalengines.com",
          linkedinUrl: "https://linkedin.com/in/ada",
          twitterUrl: null,
          attioCompanyRecordId: null,
          attioPersonRecordId: null,
          attioListEntryId: null,
          sourceSignalId: "sig_1",
          status: "paused",
          stage: "build_research_brief",
          lastReplyClass: null,
          pausedReason: "no sends mode",
        },
        qualificationReason: "Strong ICP fit",
        qualification: {
          decision: "qualified",
          summary: "Qualified against current ICP.",
          reason: "Strong ICP fit",
          confidence: 0.91,
          matchedSegments: ["RevOps Lead"],
          matchedSignals: ["Active Clay user"],
          disqualifiers: [],
          checks: [],
        },
        campaign: {
          id: "cmp_default",
          name: "Default SDR Campaign",
          status: "active",
          quietHoursStart: 21,
          quietHoursEnd: 8,
          touchCap: 5,
          emailConfidenceThreshold: 0.75,
          researchConfidenceThreshold: 0.65,
          sourceLinkedinEnabled: true,
          senderEmail: null,
          senderDisplayName: null,
          senderProviderInboxId: null,
        },
        thread: {
          id: "thr_1",
          stage: "build_research_brief",
          status: "paused",
          lastReplyClass: null,
          pausedReason: "no sends mode",
          nextFollowUpAt: null,
          providerThreadId: null,
          providerInboxId: null,
        },
        email: null,
        researchBrief: {
          id: "rb_1",
          prospectId: "pros_1",
          campaignId: "cmp_default",
          summary: "Strong technical fit.",
          evidence: [
            {
              title: "Post",
              url: "https://example.com/post",
              note: "Relevant buying signal",
            },
          ],
          confidence: 0.88,
          createdAt: Date.parse("2026-04-23T12:00:00.000Z"),
        },
        messages: [],
      })),
      getProspectDashboardRow: vi.fn(async () => ({
        id: "pros_1",
        fullName: "Ada Lovelace",
        company: "Analytical Engines",
        title: "RevOps Lead",
        stage: "build_research_brief",
        status: "paused",
        isQualified: true,
        qualificationReason: "Strong ICP fit",
        qualification: {
          decision: "qualified",
          summary: "Qualified against current ICP.",
          reason: "Strong ICP fit",
          confidence: 0.91,
          matchedSegments: ["RevOps Lead"],
          matchedSignals: ["Active Clay user"],
          disqualifiers: [],
          checks: [],
        },
        pausedReason: "no sends mode",
        updatedAt: "2026-04-23T12:00:00.000Z",
      })),
      getSignal: vi.fn(async () => ({
        id: "sig_1",
        campaignId: "cmp_default",
        source: "linkedin_public_post",
        sourceRef: "post_1",
        actorRunId: "run_1",
        url: "https://linkedin.com/posts/1",
        authorName: "Ada Lovelace",
        authorTitle: "RevOps Lead",
        authorCompany: "Analytical Engines",
        companyDomain: "analyticalengines.com",
        topic: "Clay workflow",
        content: "Using Clay heavily",
        capturedAt: Date.parse("2026-04-23T11:59:00.000Z"),
        metadata: {},
      })),
      listAuditEventsForEntity: vi.fn(async () => [
        {
          id: "audit_1",
          entityType: "prospect",
          entityId: "pros_1",
          eventName: "LeadQualified",
          payload: {},
          createdAt: "2026-04-23T12:00:00.000Z",
        },
      ]),
      countOutboundMessages: vi.fn(async () => 0),
      getLatestInboundMessage: vi.fn(async () => null),
      recordProviderRun: vi.fn(async () => "prun_attio_1"),
      updateProviderRun: vi.fn(async () => undefined),
      appendAuditEvent: vi.fn(async () => undefined),
      updateProspectCrmReferences: vi.fn(async () => undefined),
      getThread: vi.fn(async () => ({
        id: "thr_1",
        prospect_id: "pros_1",
        campaign_id: "cmp_default",
        stage: "build_research_brief",
        status: "paused",
        last_reply_class: null,
        paused_reason: "no sends mode",
        provider_thread_id: null,
        provider_inbox_id: null,
      })),
      updateThreadState: vi.fn(async () => undefined),
      updateProspectState: vi.fn(async () => undefined),
      addMessage: vi.fn(async () => "msg_1"),
      updateCampaignSenderIdentity: vi.fn(async () => undefined),
    };

    const attio = {
      isConfigured: vi.fn(() => true),
      upsertCompany: vi.fn(async () => ({
        mode: "assert",
        matchedBy: "domain",
        warnings: [],
        recordId: "attio_company_1",
        webUrl: "https://app.attio.com/company/1",
        raw: {},
      })),
      upsertPerson: vi.fn(async () => ({
        mode: "query",
        matchedBy: "linkedin",
        warnings: [],
        recordId: "attio_person_1",
        webUrl: "https://app.attio.com/person/1",
        raw: {},
      })),
      createNote: vi.fn(async () => ({
        noteId: "attio_note_1",
        raw: {},
      })),
      getList: vi.fn(async () => ({
        listId: "list_default",
        name: "AISDR",
        parentObject: ["companies"],
        raw: {},
      })),
      listRecordEntries: vi.fn(async () => []),
      listAttributes: vi.fn(async () => [
        {
          attributeId: "attr_stage",
          title: "Stage",
          apiSlug: "stage",
          type: "status",
          isWritable: true,
          isMultiselect: false,
          allowedObjectIds: [],
        },
        {
          attributeId: "attr_main_contact",
          title: "Main point of contact",
          apiSlug: "main_point_of_contact",
          type: "record-reference",
          isWritable: true,
          isMultiselect: false,
          allowedObjectIds: ["people_object"],
        },
      ]),
      listStatuses: vi.fn(async () => [
        {
          statusId: "status_qualification",
          title: "Qualification",
          isArchived: false,
        },
      ]),
      assertCompanyInList: vi.fn(async () => ({
        entryId: "attio_entry_1",
        listId: "list_default",
        parentRecordId: "attio_company_1",
        parentObject: "companies",
        raw: {},
      })),
    };

    const context = {
      repository,
      attio,
      agentMail: {
        isConfigured: vi.fn(() => true),
        createInbox: vi.fn(async () => ({
          providerInboxId: "inbox_campaign_1",
          email: "ai-sdr@agentmail.to",
          displayName: "Default SDR Campaign",
          raw: {},
        })),
        send: vi.fn(async () => ({
          providerMessageId: "am_msg_1",
          providerThreadId: "am_thr_1",
          providerInboxId: "inbox_campaign_1",
          raw: {},
        })),
        reply: vi.fn(async () => ({
          providerMessageId: "am_msg_reply_1",
          providerThreadId: "am_thr_1",
          providerInboxId: "inbox_campaign_1",
          raw: {},
        })),
      },
      ai: {
        policyCheck: vi.fn(async () => ({ allow: true })),
      },
      policy: {
        evaluateSendAuthority: vi.fn(() => ({
          allowed: true,
          reasons: [],
          policyPass: true,
        })),
      },
      config: {
        DISCOVERY_LINKEDIN_ENABLED: true,
        DISCOVERY_X_ENABLED: false,
        ATTIO_DEFAULT_LIST_ID: "list_default",
        ATTIO_DEFAULT_LIST_STAGE: "Qualification",
        AGENTMAIL_AUTO_PROVISION_INBOX: true,
        AGENTMAIL_DEFAULT_SENDER_NAME: "Orchid SDR",
        AGENTMAIL_DEFAULT_INBOX_DOMAIN: undefined,
      },
    } as any;

    return {
      service: new OrchidMcpToolService(context),
      repository,
      attio,
      context,
    };
  }

  it("returns a composed pipeline summary", async () => {
    const { service, repository, attio } = createService();

    const result = await service.handleTool("pipeline.summary", { limit: 3 });

    expect(repository.getDashboardSummary).toHaveBeenCalled();
    expect(result).toMatchObject({
      summary: {
        qualifiedLeads: 3,
        activeThreads: 2,
      },
      activeThreads: [
        {
          fullName: "Ada Lovelace",
        },
      ],
      discovery: {
        linkedin_public_post: {
          state: {
            lastStatus: "running",
          },
        },
      },
    });
    expect((result as any).headline).toContain("3 qualified leads");
  });

  it("queues a manual discovery tick", async () => {
    const { service } = createService();

    const result = await service.handleTool("control.runDiscovery", {
      source: "linkedin_public_post",
      reason: "manual test",
    });

    expect(mockClient.discoveryCoordinator.getOrCreate).toHaveBeenCalledWith([
      "cmp_default",
      "linkedin_public_post",
    ]);
    expect(result).toMatchObject({
      ok: true,
      queued: true,
      campaignId: "cmp_default",
      source: "linkedin_public_post",
    });
  });

  it("adds computed durations to sandbox jobs", async () => {
    const { service } = createService();

    const result = await service.handleTool("runtime.sandboxJobs", { limit: 5 });

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "job_1",
          durationMs: 2000,
        }),
      ]),
    );
  });

  it("returns a clean lead inspection payload", async () => {
    const { service, repository } = createService();

    const result = await service.handleTool("lead.inspect", { prospectId: "pros_1" });

    expect(repository.getProspectSnapshot).toHaveBeenCalledWith("pros_1");
    expect(result).toMatchObject({
      prospect: {
        prospectId: "pros_1",
        fullName: "Ada Lovelace",
      },
      qualification: {
        decision: "qualified",
        summary: "Qualified against current ICP.",
      },
      research: {
        confidence: 0.88,
        evidenceCount: 1,
      },
      sourceSignal: {
        id: "sig_1",
        topic: "Clay workflow",
      },
    });
  });

  it("summarizes failures without mixing in no-sends pauses", async () => {
    const { service } = createService();

    const result = await service.handleTool("pipeline.failures", {});

    expect(result).toMatchObject({
      providerFailures: [],
      sandboxFailures: [],
      operationalBlocks: [
        expect.objectContaining({
          prospectId: "pros_2",
          pausedReason: "company context missing",
        }),
      ],
      qualificationRejections: [
        expect.objectContaining({
          prospectId: "pros_3",
          pausedReason: "poor fit: recruiter title",
        }),
      ],
    });
  });

  it("returns summarized discovery health", async () => {
    const { service } = createService();

    const result = await service.handleTool("runtime.discoveryHealth", {});

    expect(result).toMatchObject({
      sources: expect.arrayContaining([
        expect.objectContaining({
          source: "linkedin_public_post",
          health: "healthy",
        }),
      ]),
    });
  });

  it("syncs a prospect to Attio through the generic CRM tool", async () => {
    const { service, repository, attio } = createService();

    const result = await service.handleTool("crm.syncProspect", {
      prospectId: "pros_1",
      createNote: true,
      addToList: true,
    });

    expect(repository.recordProviderRun).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "attio",
        kind: "crm_sync",
        externalId: "pros_1",
      }),
    );
    expect(repository.updateProviderRun).toHaveBeenCalledWith(
      "prun_attio_1",
      expect.objectContaining({
        status: "succeeded",
      }),
    );
    expect(repository.appendAuditEvent).toHaveBeenCalledWith(
      "prospect",
      "pros_1",
      "CrmSynced",
      expect.objectContaining({
        provider: "attio",
        personRecordId: "attio_person_1",
      }),
    );
    expect(repository.updateProspectCrmReferences).toHaveBeenCalledWith({
      prospectId: "pros_1",
      attioCompanyRecordId: "attio_company_1",
      attioPersonRecordId: "attio_person_1",
      attioListEntryId: "attio_entry_1",
    });
    expect(attio.assertCompanyInList).toHaveBeenCalledWith({
      listId: "list_default",
      companyRecordId: "attio_company_1",
      entryValues: {
        main_point_of_contact: {
          target_object: "people",
          target_record_id: "attio_person_1",
        },
        stage: "Qualification",
      },
    });
    expect(result).toMatchObject({
      ok: true,
      provider: "attio",
      company: {
        recordId: "attio_company_1",
      },
      person: {
        recordId: "attio_person_1",
      },
      note: {
        noteId: "attio_note_1",
      },
      listEntry: {
        entryId: "attio_entry_1",
        listId: "list_default",
      },
      warnings: [],
    });
  });

  it("auto-provisions one campaign sender inbox before first outbound", async () => {
    const { service, repository, context } = createService();
    const baseSnapshot: any = await repository.getProspectSnapshot();
    repository.getProspectSnapshot.mockResolvedValueOnce({
      ...baseSnapshot,
      prospect: {
        ...baseSnapshot.prospect,
        status: "active",
        stage: "first_outbound",
      },
      campaign: {
        ...baseSnapshot.campaign,
        senderEmail: null,
        senderDisplayName: null,
        senderProviderInboxId: null,
      },
      thread: {
        ...baseSnapshot.thread,
        status: "active",
        stage: "first_outbound",
        pausedReason: null,
        providerInboxId: null,
      },
      email: {
        address: "ada@analyticalengines.com",
        confidence: 0.91,
        source: "prospeo",
      },
    });

    const result = await service.handleTool("mail.send", {
      threadId: "thr_1",
      kind: "first_outbound",
      subject: "Hello Ada",
      bodyText: "Quick note",
    });

    expect(context.agentMail.createInbox).toHaveBeenCalledWith({
      displayName: "Orchid SDR",
      clientId: "campaign:cmp_default",
      domain: undefined,
    });
    expect(repository.updateCampaignSenderIdentity).toHaveBeenCalledWith({
      campaignId: "cmp_default",
      senderEmail: "ai-sdr@agentmail.to",
      senderDisplayName: "Default SDR Campaign",
      senderProviderInboxId: "inbox_campaign_1",
    });
    expect(context.agentMail.send).toHaveBeenCalledWith({
      inboxId: "inbox_campaign_1",
      to: "ada@analyticalengines.com",
      subject: "Hello Ada",
      bodyText: "Quick note",
      bodyHtml: null,
    });
    expect(repository.updateThreadState).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: "thr_1",
        providerInboxId: "inbox_campaign_1",
        providerThreadId: "am_thr_1",
      }),
    );
    expect(result).toMatchObject({
      ok: true,
      senderEmail: "ai-sdr@agentmail.to",
      providerInboxId: "inbox_campaign_1",
    });
  });
});
