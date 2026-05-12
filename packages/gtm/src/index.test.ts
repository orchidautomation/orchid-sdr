import { describe, expect, it, vi } from "vitest";

import { createTrellisTestApp, runTrellisSmoke, schema, trellis } from "./index.js";
import { agentmail, attio, firecrawl } from "@trellis/providers";

describe("@trellis/gtm v3 API", () => {
  it("defines the one-screen GTM agent shape without exposing Flue or Cloudflare", async () => {
    const agent = trellis.agent("sdr", {
      crm: attio(),
      email: agentmail(),
      research: firecrawl(),
      knowledge: "knowledge/**/*.md",
      skills: "skills/**/SKILL.md",
      safety: trellis.safeOutbound(),
    }, async (app) => {
      const signal = await app.signal();
      const qualification = await app.skill("icp-qualification", {
        context: await app.context(signal),
        schema: schema.qualification(),
      });

      return app.workflow("prospect").start({ signal, qualification });
    });

    const app = createTrellisTestApp({
      skillResults: {
        "icp-qualification": {
          decision: "qualified",
          summary: "Strong ICP fit.",
          confidence: 0.86,
          matchedEvidence: ["Hiring GTM engineers"],
          missingEvidence: [],
        },
      },
    });
    const result = await agent.handler(app);

    expect(agent.kind).toBe("trellis.gtm.agent");
    expect(agent.config.safety).toEqual({
      noSends: true,
      requireApproval: ["email.send", "mail.reply", "crm.update", "handoff.webhook"],
      killSwitch: true,
    });
    expect(agent.config.crm?.id).toBe("attio");
    expect(agent.config.email?.id).toBe("agentmail");
    expect(agent.config.research?.id).toBe("firecrawl");
    expect(app.skillCalls).toHaveLength(1);
    expect(app.startedWorkflows).toHaveLength(1);
    expect(result).toMatchObject({
      ok: true,
      workflow: "prospect",
    });
    expect(schema.replyPolicy().parse({
      classification: "positive",
      action: "handoff",
      reason: "Buyer asked for next steps.",
      confidence: 0.9,
    })).toMatchObject({
      classification: "positive",
      action: "handoff",
    });
    expect(schema.handoffPolicy().parse({
      shouldHandoff: true,
      reason: "Positive buying signal.",
    })).toMatchObject({
      shouldHandoff: true,
      urgency: "normal",
    });
  });

  it("runs the v3 smoke workflow as a real safe fixture", async () => {
    const result = await runTrellisSmoke();

    expect(result.ok).toBe(true);
    expect(result.externalWrites).toBe(false);
    expect(result.noSendsMode).toBe(true);
    expect(result.fixture.id).toBe("sig_smoke_001");
    expect(result.skillCalls.map((call) => call.name)).toEqual(["icp-qualification", "research-brief", "sdr-copy"]);
    expect(result.startedWorkflows.map((workflow) => workflow.name)).toEqual(["prospect"]);
    expect(result.prospects).toHaveLength(1);
    expect(result.drafts).toEqual([
      expect.objectContaining({
        status: "blocked_pending_approval",
        approvalRequiredFor: ["email.send", "crm.update"],
        body: expect.stringContaining("Subject: GTM agent workflow"),
      }),
    ]);
    expect(result.approvals).toEqual([
      expect.objectContaining({ action: "email.send", status: "pending" }),
      expect.objectContaining({ action: "crm.update", status: "pending" }),
    ]);
    expect(result.auditEvents.map((event) => event.type)).toEqual([
      "signal.accepted",
      "skill.completed",
      "skill.completed",
      "skill.completed",
      "workflow.started",
      "draft.created",
    ]);
    expect(result.checks.every((check) => check.status === "pass")).toBe(true);
  });

  it("turns reply workflow decisions into approval-gated reply and handoff actions", async () => {
    const agent = trellis.agent("sdr", {
      crm: attio(),
      email: agentmail(),
      research: firecrawl(),
      knowledge: "knowledge/**/*.md",
      skills: "skills/**/SKILL.md",
      safety: trellis.safeOutbound(),
    }, async (app) => {
      const signal = await app.signal();
      const context = await app.context(signal);
      const reply = await app.skill("reply-policy", {
        context,
        schema: schema.replyPolicy(),
      });
      const handoff = await app.skill("handoff-policy", {
        context,
        args: { reply },
        schema: schema.handoffPolicy(),
      });

      return app.workflow("reply").start({ signal, reply, handoff });
    });
    const app = createTrellisTestApp({
      signal: {
        id: "sig_reply_policy",
        threadId: "agentmail_thread",
        provider: "agentmail",
        source: "reply.webhook",
      },
      skillResults: {
        "reply-policy": {
          classification: "positive",
          action: "reply",
          reason: "Buyer asked for details.",
          confidence: 0.88,
        },
        "handoff-policy": {
          shouldHandoff: true,
          reason: "Positive buyer reply should notify sales.",
          destination: "sales",
          urgency: "high",
        },
      },
    });

    const result = await agent.handler(app);

    expect(result).toMatchObject({
      ok: true,
      workflow: "reply",
    });
    expect(app.skillCalls.map((call) => call.name)).toEqual(["reply-policy", "handoff-policy"]);
    expect(app.drafts).toEqual([
      expect.objectContaining({
        channel: "reply",
        approvalRequiredFor: ["mail.reply", "handoff.webhook"],
        body: expect.stringContaining("Positive buyer reply should notify sales."),
      }),
    ]);
  });

  it("hides the Cloudflare worker shell behind trellis.cloudflare", async () => {
    const runtime = trellis.cloudflare(trellis.agent("sdr", {
      crm: attio(),
      email: agentmail(),
      research: firecrawl(),
      knowledge: "knowledge/**/*.md",
      skills: "skills/**/SKILL.md",
      safety: trellis.safeOutbound(),
    }, async (app) => {
      const signal = await app.signal();
      const qualification = await app.skill("icp-qualification", {
        context: await app.context(signal),
        schema: schema.qualification(),
      });

      return app.workflow("prospect").start({ signal, qualification });
    }));

    const fakeD1 = createFakeD1();
    const fakeQueue = createFakeQueue();
    const fakeR2 = createFakeR2({
      "knowledge/manifest.json": JSON.stringify({
        source: "knowledge",
        files: [{ path: "knowledge/icp.md" }],
      }),
      "knowledge/files/icp.md": "# ICP",
      "skills/files/icp-qualification/SKILL.md": "# ICP Qualification",
    });
    const fakeWorkflow = {
      create: vi.fn(async (options: Record<string, unknown>) => ({
        id: options.id,
      })),
    };
    const env = {
      TRELLIS_DB: fakeD1,
      TRELLIS_EVENTS: fakeQueue,
      TRELLIS_PACKS: fakeR2,
      PROSPECT_WORKFLOW: fakeWorkflow,
      TRELLIS_WEBHOOK_SECRET: "test-secret",
    };

    const health = await runtime.worker.fetch(new Request("https://example.com/healthz"), env);
    const smoke = await runtime.worker.fetch(new Request("https://example.com/smoke"), {});
    const unauthorizedWebhook = await runtime.worker.fetch(new Request("https://example.com/webhooks/signals", {
      method: "POST",
      body: JSON.stringify({ id: "sig_denied" }),
    }), env);
    const idempotentWebhook = await runtime.worker.fetch(new Request("https://example.com/webhooks/signals", {
      method: "POST",
      headers: {
        authorization: "Bearer test-secret",
        "idempotency-key": "retry key",
      },
      body: JSON.stringify({
        workspaceId: "wrk_retry",
        threadId: "thr_retry",
      }),
    }), {
      TRELLIS_WEBHOOK_SECRET: "test-secret",
      TRELLIS_PACKS: fakeR2,
    });
    const webhook = await runtime.worker.fetch(new Request("https://example.com/webhooks/signals", {
      method: "POST",
      headers: {
        authorization: "Bearer test-secret",
        "idempotency-key": "retry-sig-live",
      },
      body: JSON.stringify({
        id: "sig_live",
        workspaceId: "wrk_live",
        threadId: "thr_live",
        provider: "test",
        source: "unit.test",
      }),
    }), env);
    const approval = await runtime.worker.fetch(new Request("https://example.com/approvals/approval_draft_sig_live_email_send/approve", {
      method: "POST",
      body: JSON.stringify({
        signalId: "sig_live",
        draftId: "draft_sig_live",
        action: "email.send",
        actor: "operator@example.com",
        reason: "Fixture approval.",
      }),
    }), env);
    const providerActionExecuteBlocked = await runtime.worker.fetch(new Request("https://example.com/provider-actions/provider_action_approval_draft_sig_live_email_send/execute", {
      method: "POST",
      body: JSON.stringify({
        actor: "agentmail-worker",
      }),
    }), env);
    const providerActionFail = await runtime.worker.fetch(new Request("https://example.com/provider-actions/provider_action_approval_draft_sig_live_email_send/fail", {
      method: "POST",
      body: JSON.stringify({
        signalId: "sig_live",
        actor: "agentmail-worker",
        reason: "No-send mode blocked the fixture action.",
      }),
    }), env);
    const mcp = await runtime.worker.fetch(new Request("https://example.com/mcp/trellis"), env);
    const providerActions = await runtime.worker.fetch(new Request("https://example.com/provider-actions"), env);
    const dashboard = await runtime.worker.fetch(new Request("https://example.com/dashboard"), env);

    await expect(health.json()).resolves.toMatchObject({
      ok: true,
      stack: "trellis-v3-cloudflare",
      bindings: {
        TRELLIS_DB: true,
        TRELLIS_EVENTS: true,
      },
    });
    await expect(smoke.json()).resolves.toMatchObject({
      ok: true,
      mode: "safe-fixture",
    });
    expect(unauthorizedWebhook.status).toBe(401);
    await expect(unauthorizedWebhook.json()).resolves.toMatchObject({
      ok: false,
      error: "unauthorized_webhook",
    });
    await expect(idempotentWebhook.json()).resolves.toMatchObject({
      ok: true,
      signal: {
        id: "sig_retry_key",
        idempotencyKey: "retry key",
      },
      webhook: {
        verified: true,
        idempotencyKey: "retry key",
      },
      packs: {
        enabled: true,
        knowledge: {
          manifest: {
            files: 1,
          },
          objects: 1,
          files: [
            {
              key: "knowledge/files/icp.md",
              path: "icp.md",
              text: "# ICP",
              truncated: false,
            },
          ],
        },
        skills: {
          objects: 1,
          files: [
            {
              key: "skills/files/icp-qualification/SKILL.md",
              path: "icp-qualification/SKILL.md",
              text: "# ICP Qualification",
              truncated: false,
            },
          ],
        },
      },
    });
    await expect(webhook.json()).resolves.toMatchObject({
      ok: true,
      accepted: true,
      mode: "processed",
      traceId: "trace_sig_live",
      signal: {
        id: "sig_live",
        traceId: "trace_sig_live",
        workspaceId: "wrk_live",
        threadId: "thr_live",
        idempotencyKey: "retry-sig-live",
      },
      prospects: [
        expect.objectContaining({ signalId: "sig_live" }),
      ],
      drafts: [
        expect.objectContaining({ status: "blocked_pending_approval" }),
      ],
      approvals: [
        expect.objectContaining({ action: "email.send", status: "pending" }),
        expect.objectContaining({ action: "crm.update", status: "pending" }),
      ],
      persistence: {
        enabled: true,
      },
      queue: {
        enabled: true,
        messages: 1,
      },
      workflowDispatch: {
        enabled: true,
        ok: true,
        workflow: "prospect",
        instanceId: "trellis_sig_live_prospect",
        persistence: {
          enabled: true,
          table: "trellis_workflow_runs",
          id: "trellis_sig_live_prospect",
          status: "dispatched",
        },
      },
      webhook: {
        verified: true,
        idempotencyKey: "retry-sig-live",
      },
      packs: {
        enabled: true,
        knowledge: {
          manifest: {
            files: 1,
          },
        },
        skills: {
          objects: 1,
        },
      },
      noSendsMode: true,
    });
    expect(fakeD1.statements.some((statement) => statement.sql.includes("CREATE TABLE IF NOT EXISTS trellis_signals"))).toBe(true);
    expect(fakeD1.statements.some((statement) => statement.sql.includes("INSERT OR REPLACE INTO trellis_signals"))).toBe(true);
    expect(fakeD1.statements.some((statement) => statement.sql.includes("INSERT OR REPLACE INTO trellis_prospects"))).toBe(true);
    expect(fakeD1.statements.some((statement) => statement.sql.includes("INSERT OR REPLACE INTO trellis_drafts"))).toBe(true);
    expect(fakeD1.statements.some((statement) => statement.sql.includes("INSERT OR REPLACE INTO trellis_approvals"))).toBe(true);
    expect(fakeD1.statements.some((statement) => statement.sql.includes("CREATE TABLE IF NOT EXISTS trellis_provider_actions"))).toBe(true);
    expect(fakeD1.statements.some((statement) => statement.sql.includes("INSERT OR REPLACE INTO trellis_provider_actions"))).toBe(true);
    expect(fakeD1.statements.some((statement) => statement.sql.includes("CREATE TABLE IF NOT EXISTS trellis_workflow_runs"))).toBe(true);
    expect(fakeD1.statements.some((statement) => statement.sql.includes("INSERT OR REPLACE INTO trellis_workflow_runs"))).toBe(true);
    expect(fakeD1.statements.some((statement) => statement.sql.includes("CREATE TABLE IF NOT EXISTS trellis_trace_events"))).toBe(true);
    expect(fakeD1.statements.some((statement) => statement.sql.includes("INSERT OR REPLACE INTO trellis_trace_events"))).toBe(true);
    expect(fakeD1.statements.some((statement) => statement.sql.includes("INSERT OR REPLACE INTO trellis_audit_events"))).toBe(true);
    expect(fakeD1.statements.some((statement) => statement.sql.includes("UPDATE trellis_approvals SET status = ?"))).toBe(true);
    expect(fakeD1.statements.some((statement) => statement.sql.includes("UPDATE trellis_provider_actions SET status = ?"))).toBe(true);
    expect(fakeWorkflow.create).toHaveBeenCalledWith({
      id: "trellis_sig_live_prospect",
      params: expect.objectContaining({
        workflow: "prospect",
        traceId: "trace_sig_live",
        signal: expect.objectContaining({ id: "sig_live" }),
        prospectIds: ["prospect_sig_live"],
        draftIds: ["draft_sig_live"],
        approvalIds: [
          "approval_draft_sig_live_email_send",
          "approval_draft_sig_live_crm_update",
        ],
      }),
    });
    expect(fakeQueue.messages).toEqual([
      expect.objectContaining({
        type: "trellis.signal.processed",
        traceId: "trace_sig_live",
        signalId: "sig_live",
        workspaceId: "wrk_live",
      }),
      expect.objectContaining({
        type: "trellis.approval.decided",
        traceId: "trace_sig_live",
        approvalId: "approval_draft_sig_live_email_send",
        status: "approved",
        providerActionId: "provider_action_approval_draft_sig_live_email_send",
      }),
      expect.objectContaining({
        type: "trellis.provider.action.blocked",
        providerAction: expect.objectContaining({
          id: "provider_action_approval_draft_sig_live_email_send",
          provider: "agentmail",
          operation: "email.send",
          status: "blocked_no_send",
          traceId: "trace_sig_live",
        }),
      }),
      expect.objectContaining({
        type: "trellis.provider.action.failed",
        traceId: "trace_sig_live",
        providerActionId: "provider_action_approval_draft_sig_live_email_send",
        status: "failed",
      }),
    ]);
    await expect(mcp.json()).resolves.toMatchObject({
      ok: true,
      snapshot: {
        enabled: true,
        counts: {
          signals: 1,
          prospects: 1,
          drafts: 1,
          approvals: 2,
          providerActions: 1,
          workflowRuns: 1,
          traceEvents: 8,
          auditEvents: 8,
        },
        packs: {
          enabled: true,
          knowledge: {
            objects: 1,
          },
          skills: {
            objects: 1,
          },
        },
      },
      tools: expect.arrayContaining(["trellis.smoke", "trellis.workflow.inspect", "trellis.approval.approve"]),
    });
    await expect(providerActions.json()).resolves.toMatchObject({
      ok: true,
      snapshot: {
        counts: {
          providerActions: 1,
        },
      },
    });
    const dashboardHtml = await dashboard.text();
    expect(dashboardHtml).toContain("v3 Cloudflare GTM runtime");
    expect(dashboardHtml).toContain("<dt>Signals</dt><dd>1</dd>");
    expect(dashboardHtml).toContain("<dt>Prospects</dt><dd>1</dd>");
    expect(dashboardHtml).toContain("<dt>Drafts</dt><dd>1</dd>");
    expect(dashboardHtml).toContain("<dt>Approvals</dt><dd>2</dd>");
    expect(dashboardHtml).toContain("<dt>Provider Actions</dt><dd>1</dd>");
    expect(dashboardHtml).toContain("<dt>Workflow Runs</dt><dd>1</dd>");
    expect(dashboardHtml).toContain("<dt>Trace Events</dt><dd>8</dd>");
    expect(dashboardHtml).toContain("<dt>Knowledge Files</dt><dd>1</dd>");
    expect(dashboardHtml).toContain("<dt>Skill Files</dt><dd>1</dd>");
    const workflowStep = createFakeWorkflowStep();
    const workflowRun = await new runtime.ProspectWorkflow(env).run({
      params: {
        workflow: "prospect",
        signal: {
          id: "sig_live",
          workspaceId: "wrk_live",
          threadId: "thr_live",
        },
        prospectIds: ["prospect_sig_live"],
        draftIds: ["draft_sig_live"],
        approvalIds: [
          "approval_draft_sig_live_email_send",
          "approval_draft_sig_live_crm_update",
        ],
      },
    }, workflowStep);
    expect(workflowStep.steps).toEqual([
      "record workflow start",
      "plan approval gate",
      "record approval wait",
    ]);
    expect(workflowRun).toMatchObject({
      ok: true,
      workflow: "prospect",
      runId: "trellis_sig_live_prospect",
      traceId: "trace_sig_live",
      status: "waiting_for_approval",
      checkpoint: {
        next: "await_outbound_approval",
        approvalIds: [
          "approval_draft_sig_live_email_send",
          "approval_draft_sig_live_crm_update",
        ],
      },
      persistence: {
        waiting: {
          enabled: true,
          table: "trellis_workflow_runs",
          status: "waiting_for_approval",
        },
      },
    });
    await expect(approval.json()).resolves.toMatchObject({
      ok: true,
      approval: {
        id: "approval_draft_sig_live_email_send",
        status: "approved",
      },
      persistence: {
        enabled: true,
      },
      queue: {
        enabled: true,
        messages: 2,
      },
      providerAction: {
        id: "provider_action_approval_draft_sig_live_email_send",
        provider: "agentmail",
        operation: "email.send",
        status: "blocked_no_send",
        traceId: "trace_sig_live",
      },
    });
    expect(providerActionExecuteBlocked.status).toBe(409);
    await expect(providerActionExecuteBlocked.json()).resolves.toMatchObject({
      ok: false,
      error: "no_send_mode_enabled",
      providerAction: {
        id: "provider_action_approval_draft_sig_live_email_send",
        status: "blocked_no_send",
      },
    });
    await expect(providerActionFail.json()).resolves.toMatchObject({
      ok: true,
      providerAction: {
        id: "provider_action_approval_draft_sig_live_email_send",
        status: "failed",
      },
      persistence: {
        enabled: true,
      },
      queue: {
        enabled: true,
        messages: 1,
      },
    });
  });

  it("accepts AgentMail reply webhooks as first-class v3 signals", async () => {
    const runtime = trellis.cloudflare(trellis.agent("sdr", {
      crm: attio(),
      email: agentmail(),
      research: firecrawl(),
      knowledge: "knowledge/**/*.md",
      skills: "skills/**/SKILL.md",
      safety: trellis.safeOutbound(),
    }, async (app) => {
      const signal = await app.signal();
      const qualification = await app.skill("icp-qualification", {
        context: await app.context(signal),
        schema: schema.qualification(),
      });

      return app.workflow("prospect").start({ signal, qualification });
    }));

    const fakeD1 = createFakeD1();
    const fakeQueue = createFakeQueue();
    const env = {
      TRELLIS_DB: fakeD1,
      TRELLIS_EVENTS: fakeQueue,
      AGENTMAIL_WEBHOOK_SECRET: "agentmail-secret",
    };
    const body = JSON.stringify({
      event_type: "message.received",
      message: {
        inbox_id: "inbox_reply",
        thread_id: "am_thread_1",
        message_id: "am_msg_in_1",
        subject: "Re: Hello",
        text: "This sounds useful. Can you send details?",
      },
    });

    const unauthorized = await runtime.worker.fetch(new Request("https://example.com/webhooks/agentmail", {
      method: "POST",
      body,
    }), env);
    const webhook = await runtime.worker.fetch(new Request("https://example.com/webhooks/agentmail", {
      method: "POST",
      headers: {
        "x-agentmail-webhook-secret": "agentmail-secret",
      },
      body,
    }), env);

    expect(unauthorized.status).toBe(401);
    await expect(unauthorized.json()).resolves.toMatchObject({
      ok: false,
      error: "unauthorized_agentmail_webhook",
    });
    expect(webhook.status).toBe(202);
    await expect(webhook.json()).resolves.toMatchObject({
      ok: true,
      accepted: true,
      signal: {
        id: "sig_agentmail_am_msg_in_1",
        threadId: "agentmail_am_thread_1",
        provider: "agentmail",
        source: "reply.webhook",
        payload: {
          providerInboxId: "inbox_reply",
          providerThreadId: "am_thread_1",
          providerMessageId: "am_msg_in_1",
          bodyText: "This sounds useful. Can you send details?",
        },
      },
      webhook: {
        verified: true,
        type: "agentmail",
        eventType: "message.received",
      },
      persistence: {
        enabled: true,
      },
      queue: {
        enabled: true,
        messages: 1,
      },
    });
    expect(fakeQueue.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "trellis.signal.processed",
        signalId: "sig_agentmail_am_msg_in_1",
        threadId: "agentmail_am_thread_1",
      }),
    ]));
  });

  it("executes queued provider actions through the v3 executor path", async () => {
    const runtime = trellis.cloudflare(trellis.agent("sdr", {
      crm: attio(),
      email: agentmail(),
      research: firecrawl(),
      knowledge: "knowledge/**/*.md",
      skills: "skills/**/SKILL.md",
      safety: trellis.safeOutbound({ noSends: false }),
    }, async (app) => {
      const signal = await app.signal();
      const qualification = await app.skill("icp-qualification", {
        context: await app.context(signal),
        schema: schema.qualification(),
      });

      return app.workflow("prospect").start({ signal, qualification });
    }));

    const fakeD1 = createFakeD1();
    const fakeQueue = createFakeQueue();
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        id: "msg_agentmail_123",
        thread_id: "thread_agentmail_123",
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    try {
      const env = {
        TRELLIS_DB: fakeD1,
        TRELLIS_EVENTS: fakeQueue,
        AGENTMAIL_API_KEY: "am_test",
        AGENTMAIL_BASE_URL: "https://agentmail.test",
      };

      await runtime.worker.fetch(new Request("https://example.com/webhooks/signals", {
        method: "POST",
        body: JSON.stringify({
          id: "sig_execute",
          workspaceId: "wrk_execute",
          threadId: "thr_execute",
          provider: "test",
          source: "unit.test",
        }),
      }), env);
      const approval = await runtime.worker.fetch(new Request("https://example.com/approvals/approval_draft_sig_execute_email_send/approve", {
        method: "POST",
        body: JSON.stringify({
          signalId: "sig_execute",
          draftId: "draft_sig_execute",
          action: "email.send",
          actor: "operator@example.com",
        }),
      }), env);
      const execution = await runtime.worker.fetch(new Request("https://example.com/provider-actions/provider_action_approval_draft_sig_execute_email_send/execute", {
        method: "POST",
        body: JSON.stringify({
          actor: "agentmail-worker",
          input: {
            inboxId: "inbox_123",
            to: "buyer@example.com",
            subject: "Quick question",
            bodyText: "Fixture outbound draft. Not sent.",
          },
        }),
      }), env);
      const snapshot = await runtime.worker.fetch(new Request("https://example.com/provider-actions"), env);

      await expect(approval.json()).resolves.toMatchObject({
        providerAction: {
          id: "provider_action_approval_draft_sig_execute_email_send",
          provider: "agentmail",
          operation: "email.send",
          status: "queued",
        },
      });
      expect(execution.status).toBe(200);
      await expect(execution.json()).resolves.toMatchObject({
        ok: true,
        providerAction: {
          id: "provider_action_approval_draft_sig_execute_email_send",
          status: "completed",
        },
        execution: {
          ok: true,
          provider: "agentmail",
          operation: "email.send",
          externalId: "msg_agentmail_123",
          externalThreadId: "thread_agentmail_123",
        },
        queue: {
          enabled: true,
          messages: 1,
        },
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string | URL | Request, RequestInit];
      expect(String(url)).toBe("https://agentmail.test/v0/inboxes/inbox_123/messages/send");
      expect(init).toMatchObject({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer am_test",
        }),
      });
      expect(JSON.parse(String(init?.body))).toEqual({
        to: ["buyer@example.com"],
        subject: "Quick question",
        text: "Fixture outbound draft. Not sent.",
      });
      expect(fakeD1.statements.some((statement) =>
        statement.sql.includes("UPDATE trellis_provider_actions SET status = ?")
          && statement.bindings[0] === "completed",
      )).toBe(true);
      expect(fakeQueue.messages).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: "trellis.provider.action.queued",
          providerAction: expect.objectContaining({
            status: "queued",
          }),
        }),
        expect.objectContaining({
          type: "trellis.provider.action.completed",
          providerActionId: "provider_action_approval_draft_sig_execute_email_send",
        }),
      ]));
      await expect(snapshot.json()).resolves.toMatchObject({
        snapshot: {
          counts: {
            providerActions: 1,
            auditEvents: 7,
          },
        },
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("executes approved AgentMail replies through the built-in v3 provider executor", async () => {
    const runtime = trellis.cloudflare(trellis.agent("sdr", {
      crm: attio(),
      email: agentmail(),
      research: firecrawl(),
      knowledge: "knowledge/**/*.md",
      skills: "skills/**/SKILL.md",
      safety: trellis.safeOutbound({ noSends: false }),
    }, async (app) => {
      const signal = await app.signal();
      const qualification = await app.skill("icp-qualification", {
        context: await app.context(signal),
        schema: schema.qualification(),
      });

      return app.workflow("prospect").start({ signal, qualification });
    }));

    const fakeD1 = createFakeD1();
    const fakeQueue = createFakeQueue();
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        id: "msg_agentmail_reply_123",
        thread_id: "thread_agentmail_reply_123",
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    try {
      const env = {
        TRELLIS_DB: fakeD1,
        TRELLIS_EVENTS: fakeQueue,
        AGENTMAIL_API_KEY: "am_reply",
        AGENTMAIL_BASE_URL: "https://agentmail.test",
      };

      await runtime.worker.fetch(new Request("https://example.com/webhooks/signals", {
        method: "POST",
        body: JSON.stringify({
          id: "sig_reply",
          workspaceId: "wrk_reply",
          threadId: "thr_reply",
          provider: "agentmail",
          source: "reply.webhook",
        }),
      }), env);
      const approval = await runtime.worker.fetch(new Request("https://example.com/approvals/approval_reply_sig_reply_mail_reply/approve", {
        method: "POST",
        body: JSON.stringify({
          signalId: "sig_reply",
          action: "mail.reply",
          actor: "operator@example.com",
        }),
      }), env);
      const execution = await runtime.worker.fetch(new Request("https://example.com/provider-actions/provider_action_approval_reply_sig_reply_mail_reply/execute", {
        method: "POST",
        body: JSON.stringify({
          actor: "agentmail-worker",
          input: {
            inboxId: "inbox_reply",
            messageId: "am_inbound_1",
            subject: "Re: Hello",
            bodyText: "Thanks for the context. Looping in a human.",
            replyAll: false,
          },
        }),
      }), env);

      await expect(approval.json()).resolves.toMatchObject({
        providerAction: {
          id: "provider_action_approval_reply_sig_reply_mail_reply",
          provider: "agentmail",
          operation: "mail.reply",
          status: "queued",
        },
      });
      expect(execution.status).toBe(200);
      await expect(execution.json()).resolves.toMatchObject({
        ok: true,
        providerAction: {
          id: "provider_action_approval_reply_sig_reply_mail_reply",
          status: "completed",
        },
        execution: {
          ok: true,
          provider: "agentmail",
          operation: "mail.reply",
          externalId: "msg_agentmail_reply_123",
          externalThreadId: "thread_agentmail_reply_123",
        },
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string | URL | Request, RequestInit];
      expect(String(url)).toBe("https://agentmail.test/v0/inboxes/inbox_reply/messages/am_inbound_1/reply");
      expect(init).toMatchObject({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer am_reply",
        }),
      });
      expect(JSON.parse(String(init?.body))).toEqual({
        text: "Thanks for the context. Looping in a human.",
        subject: "Re: Hello",
      });
      expect(fakeQueue.messages).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: "trellis.provider.action.completed",
          providerActionId: "provider_action_approval_reply_sig_reply_mail_reply",
        }),
      ]));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("executes approved handoff webhooks through the built-in v3 provider executor", async () => {
    const runtime = trellis.cloudflare(trellis.agent("sdr", {
      crm: attio(),
      email: agentmail(),
      research: firecrawl(),
      knowledge: "knowledge/**/*.md",
      skills: "skills/**/SKILL.md",
      safety: trellis.safeOutbound({ noSends: false }),
    }, async (app) => {
      const signal = await app.signal();
      const qualification = await app.skill("icp-qualification", {
        context: await app.context(signal),
        schema: schema.qualification(),
      });

      return app.workflow("prospect").start({ signal, qualification });
    }));

    const fakeD1 = createFakeD1();
    const fakeQueue = createFakeQueue();
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        handoffId: "handoff_123",
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const env = {
      TRELLIS_DB: fakeD1,
      TRELLIS_EVENTS: fakeQueue,
      TRELLIS_FETCH: fetchMock,
      HANDOFF_WEBHOOK_URL: "https://handoff.test/trellis",
      HANDOFF_WEBHOOK_SECRET: "handoff-secret",
    };

    await runtime.worker.fetch(new Request("https://example.com/webhooks/signals", {
      method: "POST",
      body: JSON.stringify({
        id: "sig_handoff",
        workspaceId: "wrk_handoff",
        threadId: "thr_handoff",
        provider: "agentmail",
        source: "reply.webhook",
        bodyText: "Can you send more detail?",
      }),
    }), env);
    const approval = await runtime.worker.fetch(new Request("https://example.com/approvals/approval_reply_sig_handoff_handoff_webhook/approve", {
      method: "POST",
      body: JSON.stringify({
        signalId: "sig_handoff",
        action: "handoff.webhook",
        actor: "operator@example.com",
      }),
    }), env);
    const execution = await runtime.worker.fetch(new Request("https://example.com/provider-actions/provider_action_approval_reply_sig_handoff_handoff_webhook/execute", {
      method: "POST",
      body: JSON.stringify({
        actor: "handoff-worker",
        input: {
          reason: "Positive reply needs sales follow-up.",
          destination: "sales",
        },
      }),
    }), env);

    await expect(approval.json()).resolves.toMatchObject({
      providerAction: {
        id: "provider_action_approval_reply_sig_handoff_handoff_webhook",
        provider: "handoff",
        operation: "handoff.webhook",
        status: "queued",
      },
    });
    expect(execution.status).toBe(200);
    await expect(execution.json()).resolves.toMatchObject({
      ok: true,
      providerAction: {
        id: "provider_action_approval_reply_sig_handoff_handoff_webhook",
        status: "completed",
      },
      execution: {
        ok: true,
        provider: "handoff",
        operation: "handoff.webhook",
        externalId: "handoff_123",
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string | URL | Request, RequestInit];
    expect(String(url)).toBe("https://handoff.test/trellis");
    expect(init).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({
        "x-trellis-handoff-secret": "handoff-secret",
      }),
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      type: "trellis.handoff.requested",
      providerActionId: "provider_action_approval_reply_sig_handoff_handoff_webhook",
      signalId: "sig_handoff",
      threadId: "thr_handoff",
      workspaceId: "wrk_handoff",
      destination: "sales",
      reason: "Positive reply needs sales follow-up.",
    });
  });

  it("executes approved Attio CRM updates through the built-in v3 provider executor", async () => {
    const runtime = trellis.cloudflare(trellis.agent("sdr", {
      crm: attio(),
      email: agentmail(),
      research: firecrawl(),
      knowledge: "knowledge/**/*.md",
      skills: "skills/**/SKILL.md",
      safety: trellis.safeOutbound({ noSends: false }),
    }, async (app) => {
      const signal = await app.signal();
      const qualification = await app.skill("icp-qualification", {
        context: await app.context(signal),
        schema: schema.qualification(),
      });

      return app.workflow("prospect").start({ signal, qualification });
    }));

    const fakeD1 = createFakeD1();
    const fakeQueue = createFakeQueue();
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);
      if (href.includes("/objects/companies/records")) {
        return new Response(JSON.stringify({
          data: {
            id: { record_id: "company_123" },
            web_url: "https://app.attio.com/company_123",
          },
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        data: {
          id: { record_id: "person_123" },
          web_url: "https://app.attio.com/person_123",
        },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const env = {
      TRELLIS_DB: fakeD1,
      TRELLIS_EVENTS: fakeQueue,
      TRELLIS_FETCH: fetchMock,
      ATTIO_API_KEY: "attio_test",
      ATTIO_BASE_URL: "https://attio.test",
    };

    await runtime.worker.fetch(new Request("https://example.com/webhooks/signals", {
      method: "POST",
      body: JSON.stringify({
        id: "sig_attio",
        workspaceId: "wrk_attio",
        threadId: "thr_attio",
        provider: "test",
        source: "unit.test",
        company: "Acme Corp",
        domain: "https://www.acme.com/pricing",
        fullName: "Avery Buyer",
        email: "avery@acme.com",
        title: "VP RevOps",
        linkedinUrl: "https://linkedin.com/in/avery",
      }),
    }), env);
    const approval = await runtime.worker.fetch(new Request("https://example.com/approvals/approval_draft_sig_attio_crm_update/approve", {
      method: "POST",
      body: JSON.stringify({
        signalId: "sig_attio",
        draftId: "draft_sig_attio",
        action: "crm.update",
        actor: "operator@example.com",
      }),
    }), env);
    const execution = await runtime.worker.fetch(new Request("https://example.com/provider-actions/provider_action_approval_draft_sig_attio_crm_update/execute", {
      method: "POST",
      body: JSON.stringify({
        actor: "attio-worker",
      }),
    }), env);

    await expect(approval.json()).resolves.toMatchObject({
      providerAction: {
        id: "provider_action_approval_draft_sig_attio_crm_update",
        provider: "attio",
        operation: "crm.update",
        status: "queued",
      },
    });
    expect(execution.status).toBe(200);
    await expect(execution.json()).resolves.toMatchObject({
      ok: true,
      providerAction: {
        id: "provider_action_approval_draft_sig_attio_crm_update",
        status: "completed",
      },
      execution: {
        ok: true,
        provider: "attio",
        operation: "crm.update",
        externalId: "person_123",
        raw: {
          company: {
            recordId: "company_123",
            webUrl: "https://app.attio.com/company_123",
          },
          person: {
            recordId: "person_123",
            webUrl: "https://app.attio.com/person_123",
          },
        },
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [companyUrl, companyInit] = fetchMock.mock.calls[0] as unknown as [string | URL | Request, RequestInit];
    const [personUrl, personInit] = fetchMock.mock.calls[1] as unknown as [string | URL | Request, RequestInit];
    expect(String(companyUrl)).toBe("https://attio.test/objects/companies/records?matching_attribute=domains");
    expect(companyInit).toMatchObject({
      method: "PUT",
      headers: expect.objectContaining({
        authorization: "Bearer attio_test",
      }),
    });
    expect(JSON.parse(String(companyInit?.body))).toEqual({
      data: {
        values: {
          name: "Acme Corp",
          domains: ["acme.com"],
        },
      },
    });
    expect(String(personUrl)).toBe("https://attio.test/objects/people/records?matching_attribute=email_addresses");
    expect(personInit).toMatchObject({
      method: "PUT",
      headers: expect.objectContaining({
        authorization: "Bearer attio_test",
      }),
    });
    expect(JSON.parse(String(personInit?.body))).toEqual({
      data: {
        values: {
          name: [
            {
              first_name: "Avery",
              last_name: "Buyer",
              full_name: "Avery Buyer",
            },
          ],
          email_addresses: ["avery@acme.com"],
          job_title: "VP RevOps",
          linkedin: "https://linkedin.com/in/avery",
          company: [
            {
              target_object: "companies",
              target_record_id: "company_123",
            },
          ],
        },
      },
    });
    expect(fakeQueue.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "trellis.provider.action.completed",
        providerActionId: "provider_action_approval_draft_sig_attio_crm_update",
      }),
    ]));
  });

  it("drains queued provider actions from the Cloudflare queue consumer", async () => {
    const runtime = trellis.cloudflare(trellis.agent("sdr", {
      crm: attio(),
      email: agentmail(),
      research: firecrawl(),
      knowledge: "knowledge/**/*.md",
      skills: "skills/**/SKILL.md",
      safety: trellis.safeOutbound({ noSends: false }),
    }, async (app) => {
      const signal = await app.signal();
      const qualification = await app.skill("icp-qualification", {
        context: await app.context(signal),
        schema: schema.qualification(),
      });

      return app.workflow("prospect").start({ signal, qualification });
    }));

    const fakeD1 = createFakeD1();
    const fakeQueue = createFakeQueue();
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        id: "msg_queue_123",
        thread_id: "thread_queue_123",
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    try {
      const env = {
        TRELLIS_DB: fakeD1,
        TRELLIS_EVENTS: fakeQueue,
        AGENTMAIL_API_KEY: "am_queue",
        AGENTMAIL_BASE_URL: "https://agentmail.test",
      };

      await runtime.worker.fetch(new Request("https://example.com/webhooks/signals", {
        method: "POST",
        body: JSON.stringify({
          id: "sig_queue",
          workspaceId: "wrk_queue",
          threadId: "thr_queue",
          provider: "test",
          source: "unit.test",
          inboxId: "inbox_queue",
          to: "queue-buyer@example.com",
          subject: "Queue hello",
        }),
      }), env);
      await runtime.worker.fetch(new Request("https://example.com/approvals/approval_draft_sig_queue_email_send/approve", {
        method: "POST",
        body: JSON.stringify({
          signalId: "sig_queue",
          draftId: "draft_sig_queue",
          action: "email.send",
          actor: "operator@example.com",
        }),
      }), env);

      const queuedMessage = fakeQueue.messages.find((message) =>
        isTestRecord(message) && message.type === "trellis.provider.action.queued",
      );
      const ack = vi.fn();
      const retry = vi.fn();
      const drain = await runtime.worker.queue?.({
        messages: [
          {
            body: queuedMessage,
            ack,
            retry,
          },
        ],
      }, env);

      expect(drain).toMatchObject({
        ok: true,
        processed: 1,
        skipped: 0,
        results: [
          {
            ok: true,
            providerActionId: "provider_action_approval_draft_sig_queue_email_send",
            status: 200,
          },
        ],
      });
      expect(ack).toHaveBeenCalledTimes(1);
      expect(retry).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string | URL | Request, RequestInit];
      expect(String(url)).toBe("https://agentmail.test/v0/inboxes/inbox_queue/messages/send");
      expect(JSON.parse(String(init?.body))).toEqual({
        to: ["queue-buyer@example.com"],
        subject: "Queue hello",
        text: "Fixture outbound draft. Not sent.",
      });
      expect(fakeQueue.messages).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: "trellis.provider.action.completed",
          providerActionId: "provider_action_approval_draft_sig_queue_email_send",
        }),
      ]));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("routes app.skill through a hidden Flue-compatible harness when provided", async () => {
    const runtime = trellis.cloudflare(trellis.agent("sdr", {
      crm: attio(),
      email: agentmail(),
      research: firecrawl(),
      model: "openrouter/test-model",
      knowledge: "knowledge/**/*.md",
      skills: "skills/**/SKILL.md",
      safety: trellis.safeOutbound(),
    }, async (app) => {
      const signal = await app.signal();
      const qualification = await app.skill("icp-qualification", {
        context: await app.context(signal),
        schema: schema.qualification(),
      });

      return app.workflow("prospect").start({ signal, qualification });
    }));

    const skillCalls: Array<{ sessionName?: string; name: string; options: Record<string, unknown> }> = [];
    const flueContext = {
      init: vi.fn(async (options: Record<string, unknown>) => ({
        session: vi.fn(async (sessionName?: string) => ({
          skill: vi.fn(async (name: string, options: Record<string, unknown>) => {
            skillCalls.push({ sessionName, name, options });
            return {
              data: {
                decision: "qualified",
                summary: "Qualified by Flue harness.",
                confidence: 0.91,
                matchedEvidence: ["R2 ICP pack"],
                missingEvidence: [],
              },
            };
          }),
        })),
        options,
      })),
    };
    const fakeR2 = createFakeR2({
      "knowledge/manifest.json": JSON.stringify({
        source: "knowledge",
        files: [{ path: "knowledge/icp.md" }],
      }),
      "knowledge/files/icp.md": "# ICP\n\nUse this rule.",
      "skills/files/icp-qualification/SKILL.md": "# ICP Qualification",
    });
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      if (String(url).endsWith("/v2/search")) {
        return new Response(JSON.stringify({
          data: {
            news: [
              {
                title: "Acme expands GTM team",
                url: "https://example.com/acme-news",
                description: "Acme is hiring revenue operators.",
              },
            ],
          },
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        data: {
          markdown: "# Acme\n\nRevenue operations update.",
        },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const webhook = await runtime.worker.fetch(new Request("https://example.com/webhooks/signals", {
      method: "POST",
      body: JSON.stringify({
        id: "sig_flue",
        workspaceId: "wrk_flue",
        threadId: "thr_flue",
      }),
    }), {
      TRELLIS_FLUE_CONTEXT: flueContext,
      TRELLIS_PACKS: fakeR2,
      TRELLIS_FETCH: fetchMock,
      FIRECRAWL_API_KEY: "fc_test",
      FIRECRAWL_BASE_URL: "https://firecrawl.test",
    });

    await expect(webhook.json()).resolves.toMatchObject({
      ok: true,
      prospects: [
        {
          id: "prospect_sig_flue",
          status: "qualified",
        },
      ],
      auditEvents: expect.arrayContaining([
        expect.objectContaining({ type: "skill.completed" }),
      ]),
    });
    expect(flueContext.init).toHaveBeenCalledWith(expect.objectContaining({
      model: "openrouter/test-model",
      sandbox: undefined,
      tools: expect.arrayContaining([
        expect.objectContaining({ name: "trellis.health" }),
        expect.objectContaining({ name: "research.search", provider: "firecrawl" }),
        expect.objectContaining({ name: "research.extract", provider: "firecrawl" }),
      ]),
    }));
    const initOptions = flueContext.init.mock.calls[0]?.[0] as Record<string, unknown>;
    const tools = initOptions.tools as Array<{
      name: string;
      execute?: (input: Record<string, unknown>) => Promise<unknown> | unknown;
    }>;
    const searchTool = tools.find((tool) => tool.name === "research.search");
    const extractTool = tools.find((tool) => tool.name === "research.extract");
    const searchResult = await searchTool?.execute?.({
      query: "Acme news",
      limit: 2,
      sources: ["news"],
    });
    const extractResult = await extractTool?.execute?.({
      url: "https://example.com/acme-news",
    });
    expect(searchResult).toMatchObject({
      provider: "firecrawl",
      operation: "research.search",
      query: "Acme news",
      results: [
        {
          title: "Acme expands GTM team",
          url: "https://example.com/acme-news",
          source: "news",
        },
      ],
    });
    expect(extractResult).toMatchObject({
      provider: "firecrawl",
      operation: "research.extract",
      url: "https://example.com/acme-news",
      markdown: "# Acme\n\nRevenue operations update.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://firecrawl.test/v2/search");
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe("https://firecrawl.test/v1/scrape");
    expect(skillCalls).toHaveLength(1);
    expect(skillCalls[0]).toMatchObject({
      sessionName: "thr_flue",
      name: "icp-qualification",
      options: {
        args: {
          signal: expect.objectContaining({ id: "sig_flue" }),
          packs: {
            knowledge: {
              files: [
                expect.objectContaining({
                  path: "icp.md",
                  text: "# ICP\n\nUse this rule.",
                }),
              ],
            },
          },
          context: {
            signal: expect.objectContaining({ id: "sig_flue" }),
          },
        },
      },
    });
  });

  it("builds hidden Flue context through a factory after Trellis hydrates Cloudflare packs", async () => {
    const runtime = trellis.cloudflare(trellis.agent("sdr", {
      crm: attio(),
      email: agentmail(),
      research: firecrawl(),
      knowledge: "knowledge/**/*.md",
      skills: "skills/**/SKILL.md",
      safety: trellis.safeOutbound(),
    }, async (app) => {
      const signal = await app.signal();
      const qualification = await app.skill("icp-qualification", {
        context: await app.context(signal),
        schema: schema.qualification(),
      });

      return app.workflow("prospect").start({ signal, qualification });
    }));

    const skill = vi.fn(async () => ({
      data: {
        decision: "qualified",
        summary: "Qualified by generated Flue factory.",
        confidence: 0.88,
        matchedEvidence: ["Generated R2 pack"],
        missingEvidence: [],
      },
    }));
    const session = vi.fn(async () => ({ skill }));
    const flueContext = {
      init: vi.fn(async () => ({ session })),
    };
    const factory = vi.fn(async () => flueContext);
    const fakeR2 = createFakeR2({
      "knowledge/manifest.json": JSON.stringify({
        source: "knowledge",
        files: [{ path: "knowledge/icp.md" }],
      }),
      "knowledge/files/icp.md": "# ICP\n\nGenerated pack rule.",
      "skills/files/icp-qualification/SKILL.md": "# ICP Qualification",
    });

    const webhook = await runtime.worker.fetch(new Request("https://example.com/webhooks/signals", {
      method: "POST",
      body: JSON.stringify({
        id: "sig_factory",
        workspaceId: "wrk_factory",
        threadId: "thr_factory",
      }),
    }), {
      TRELLIS_FLUE_CONTEXT_FACTORY: factory,
      TRELLIS_FLUE_CWD: "/workspace",
      TRELLIS_PACKS: fakeR2,
    });

    await expect(webhook.json()).resolves.toMatchObject({
      ok: true,
      traceId: "trace_sig_factory",
      prospects: [
        {
          id: "prospect_sig_factory",
          status: "qualified",
        },
      ],
    });
    expect(factory).toHaveBeenCalledWith(expect.objectContaining({
      signal: expect.objectContaining({
        id: "sig_factory",
        workspaceId: "wrk_factory",
        threadId: "thr_factory",
      }),
      packs: expect.objectContaining({
        enabled: true,
        knowledge: expect.objectContaining({
          files: [
            expect.objectContaining({
              path: "icp.md",
              text: "# ICP\n\nGenerated pack rule.",
            }),
          ],
        }),
        skills: expect.objectContaining({
          files: [
            expect.objectContaining({
              path: "icp-qualification/SKILL.md",
              text: "# ICP Qualification",
            }),
          ],
        }),
      }),
      tools: expect.arrayContaining([
        expect.objectContaining({ name: "trellis.health" }),
      ]),
    }));
    expect(flueContext.init).toHaveBeenCalledWith(expect.objectContaining({
      model: "cloudflare/@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      cwd: "/workspace",
      tools: expect.arrayContaining([
        expect.objectContaining({ name: "trellis.health" }),
      ]),
    }));
    expect(session).toHaveBeenCalledWith("thr_factory");
    expect(skill).toHaveBeenCalledWith("icp-qualification", expect.objectContaining({
      args: expect.objectContaining({
        signal: expect.objectContaining({ id: "sig_factory" }),
        packs: expect.objectContaining({ enabled: true }),
      }),
    }));
  });
});

function isTestRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createFakeD1() {
  const statements: Array<{ sql: string; bindings: unknown[] }> = [];
  const signals = new Map<string, Record<string, unknown>>();
  const drafts = new Map<string, Record<string, unknown>>();
  const providerActions = new Map<string, Record<string, unknown>>();
  return {
    statements,
    prepare(sql: string) {
      return {
        bind(...bindings: unknown[]) {
          return {
            run() {
              const normalized = sql.replace(/\s+/g, " ").trim();
              statements.push({
                sql: normalized,
                bindings,
              });
              if (normalized.includes("INSERT OR REPLACE INTO trellis_signals")) {
                signals.set(String(bindings[0]), {
                  id: bindings[0],
                  workspaceId: bindings[1],
                  threadId: bindings[2],
                  campaignId: bindings[3],
                  provider: bindings[4],
                  source: bindings[5],
                  payloadJson: bindings[6],
                  createdAt: bindings[7],
                });
              }
              if (normalized.includes("INSERT OR REPLACE INTO trellis_drafts")) {
                drafts.set(String(bindings[0]), {
                  id: bindings[0],
                  signalId: bindings[1],
                  channel: bindings[2],
                  status: bindings[3],
                  approvalRequiredJson: bindings[4],
                  body: bindings[5],
                  updatedAt: bindings[6],
                });
              }
              if (normalized.includes("INSERT OR REPLACE INTO trellis_provider_actions")) {
                providerActions.set(String(bindings[0]), {
                  id: bindings[0],
                  approvalId: bindings[1],
                  signalId: bindings[2],
                  draftId: bindings[3],
                  provider: bindings[4],
                  operation: bindings[5],
                  status: bindings[6],
                  traceId: bindings[7],
                  createdAt: bindings[8],
                  updatedAt: bindings[9],
                });
              }
              if (normalized.includes("UPDATE trellis_provider_actions SET status = ?")) {
                const row = providerActions.get(String(bindings[2]));
                if (row) {
                  row.status = bindings[0];
                  row.updatedAt = bindings[1];
                }
              }
              return { success: true };
            },
            first() {
              const normalized = sql.replace(/\s+/g, " ").trim();
              const match = normalized.match(/^SELECT COUNT\(\*\) AS count FROM (\w+)$/i);
              if (match?.[1]) {
                const tableName = match[1];
                const count = statements.filter((statement) =>
                  statement.sql.includes(`INSERT OR REPLACE INTO ${tableName}`),
                ).length;
                return { count };
              }
              if (normalized.includes("FROM trellis_provider_actions WHERE id = ?")) {
                return providerActions.get(String(bindings[0])) ?? null;
              }
              if (normalized.includes("FROM trellis_drafts WHERE id = ?")) {
                return drafts.get(String(bindings[0])) ?? null;
              }
              if (normalized.includes("FROM trellis_signals WHERE id = ?")) {
                return signals.get(String(bindings[0])) ?? null;
              }
              return null;
            },
          };
        },
      };
    },
  };
}

function createFakeQueue() {
  const messages: unknown[] = [];
  return {
    messages,
    send(message: unknown) {
      messages.push(message);
      return { success: true };
    },
  };
}

function createFakeWorkflowStep() {
  const steps: string[] = [];
  return {
    steps,
    async do<T>(name: string, callback: () => Promise<T> | T) {
      steps.push(name);
      return await callback();
    },
  };
}

function createFakeR2(objects: Record<string, string>) {
  return {
    get(key: string) {
      const value = objects[key];
      if (value === undefined) {
        return null;
      }
      return {
        text() {
          return value;
        },
      };
    },
    list({ prefix = "" }: { prefix?: string } = {}) {
      return {
        objects: Object.entries(objects)
          .filter(([key]) => key.startsWith(prefix))
          .map(([key, value]) => ({
            key,
            size: Buffer.byteLength(value),
          })),
      };
    },
  };
}
