import { describe, expect, it, vi } from "vitest";

import { createTrellisTestApp, runTrellisSmoke, schema, trellis } from "./index.js";
import { agentmail, attio, firecrawl } from "@trellis/providers";

describe("@trellis/gtm API", () => {
  it("defines the one-screen GTM agent shape without exposing runtime internals", async () => {
    const agent = trellis.agent("sdr", {
      crm: attio(),
      email: agentmail(),
      research: firecrawl(),
      model: "anthropic/claude-sonnet-4.6",
      state: trellis.state({
        tables: {
          prospects: {
            primaryKey: "id",
            fields: {
              id: "prospect.id",
              status: "qualification.decision",
              summary: "qualification.summary",
            },
            indexes: [{ name: "prospects_by_status", fields: ["status"] }],
          },
        },
      }),
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
      requireApproval: ["email.send", "email.reply", "crm.update", "handoff.webhook"],
      killSwitch: true,
    });
    expect(agent.config.crm?.id).toBe("attio");
    expect(agent.config.email?.id).toBe("agentmail");
    expect(agent.config.research?.id).toBe("firecrawl");
    expect(agent.config.model).toBe("anthropic/claude-sonnet-4.6");
    expect(agent.config.state?.tables.prospects?.fields.summary).toBe("qualification.summary");
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

  it("runs the smoke workflow as a real safe fixture", async () => {
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

  it("lets each agent name its MCP surface", async () => {
    const runtime = trellis.cloudflare(trellis.agent("enterprise-sdr", {
      knowledge: "knowledge/**/*.md",
      skills: "skills/**/SKILL.md",
      mcp: { name: "trellis-enterprise-sdr" },
    }, async () => ({ ok: true })));

    const response = await runtime.worker.fetch(new Request("https://example.com/mcp/trellis"), {});

    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      server: "trellis-enterprise-sdr",
      mcp: {
        name: "trellis-enterprise-sdr",
        agent: "enterprise-sdr",
      },
      agent: "enterprise-sdr",
    });
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
        approvalRequiredFor: ["email.reply", "handoff.webhook"],
        body: expect.stringContaining("Positive buyer reply should notify sales."),
      }),
    ]);
  });

  it("hides the Cloudflare worker shell behind trellis.cloudflare", async () => {
    const flueContext = {
      init: vi.fn(async (options: Record<string, unknown>) => ({
        options,
        session: vi.fn(async () => ({
          skill: vi.fn(async () => ({
            data: {
              decision: "qualified",
              summary: "ok",
              confidence: 0.9,
              matchedEvidence: [],
              missingEvidence: [],
            },
          })),
        })),
      })),
    };
    const runtime = trellis.cloudflare(trellis.agent("sdr", {
      crm: attio(),
      email: agentmail(),
      research: firecrawl(),
      model: "anthropic/claude-sonnet-4.6",
      state: trellis.state({
        tables: {
          prospects: {
            primaryKey: "id",
            fields: {
              id: "prospect.id",
              status: "qualification.decision",
              summary: "qualification.summary",
            },
            indexes: [{ name: "prospects_by_status", fields: ["status"] }],
          },
        },
      }),
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
    const protectedEnv = {
      ...env,
      TRELLIS_DB: createFakeD1(),
      TRELLIS_EVENTS: createFakeQueue(),
      PROSPECT_WORKFLOW: {
        create: vi.fn(async (options: Record<string, unknown>) => ({
          id: options.id,
        })),
      },
      TRELLIS_API_KEY: "test-api-key",
    };
    const protectedHealth = await runtime.worker.fetch(new Request("https://example.com/healthz"), protectedEnv);
    const protectedSmoke = await runtime.worker.fetch(new Request("https://example.com/smoke"), protectedEnv);
    const protectedMcpDenied = await runtime.worker.fetch(new Request("https://example.com/mcp/trellis"), protectedEnv);
    const protectedMcpAllowed = await runtime.worker.fetch(new Request("https://example.com/mcp/trellis", {
      headers: {
        "x-trellis-api-key": "test-api-key",
      },
    }), protectedEnv);
    const protectedWebhookAllowed = await runtime.worker.fetch(new Request("https://example.com/webhooks/signals", {
      method: "POST",
      headers: {
        authorization: "Bearer test-api-key",
        "x-trellis-webhook-secret": "test-secret",
      },
      body: JSON.stringify({
        id: "sig_api_key",
        workspaceId: "wrk_api_key",
        threadId: "thr_api_key",
      }),
    }), protectedEnv);

    await expect(health.json()).resolves.toMatchObject({
      ok: true,
      stack: "trellis-cloudflare",
      auth: {
        apiKey: {
          enabled: false,
        },
      },
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
    expect(fakeD1.statements.some((statement) => statement.sql.includes("CREATE TABLE IF NOT EXISTS trellis_state_records"))).toBe(true);
    expect(fakeD1.statements.some((statement) => statement.sql.includes("INSERT OR REPLACE INTO trellis_state_records"))).toBe(true);
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
          stateRecords: 1,
          drafts: 1,
          approvals: 2,
          providerActions: 1,
          workflowRuns: 1,
          traceEvents: 13,
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
        recent: {
          signals: [
            expect.objectContaining({
              id: "sig_live",
              payload: expect.objectContaining({
                traceId: "trace_sig_live",
              }),
            }),
          ],
          workflowRuns: [
            expect.objectContaining({
              id: "trellis_sig_live_prospect",
              status: "dispatched",
              params: expect.objectContaining({
                workflow: "prospect",
              }),
            }),
          ],
          stateRecords: [
            expect.objectContaining({
              entity: "prospects",
              recordId: "prospect_sig_live",
              fields: expect.objectContaining({
                id: "prospect_sig_live",
                status: "needs_review",
                summary: "Fixture qualification result.",
              }),
              schema: expect.objectContaining({
                primaryKey: "id",
              }),
              indexes: expect.arrayContaining([
                expect.objectContaining({ name: "prospects_by_status" }),
              ]),
            }),
          ],
          providerActions: [
            expect.objectContaining({
              id: "provider_action_approval_draft_sig_live_email_send",
              status: "failed",
            }),
          ],
          auditEvents: expect.arrayContaining([
            expect.objectContaining({
              type: "provider_action.failed",
            }),
          ]),
          traceEvents: expect.arrayContaining([
            expect.objectContaining({
              type: "provider_action.failed",
            }),
          ]),
        },
      },
      tools: expect.arrayContaining(["trellis.smoke", "trellis.workflow.inspect", "trellis.approval.approve"]),
      toolCatalog: expect.arrayContaining([
        expect.objectContaining({
          name: "trellis.knowledge.inspect",
          executable: true,
        }),
        expect.objectContaining({
          name: "trellis.approval.approve",
          executable: false,
          inputSchema: expect.objectContaining({
            required: ["approvalId"],
          }),
        }),
        expect.objectContaining({
          name: "trellis.providerAction.execute",
          executable: false,
          inputSchema: expect.objectContaining({
            required: ["providerActionId"],
          }),
        }),
        expect.objectContaining({
          name: "research.search",
          executable: true,
          provider: "firecrawl",
        }),
      ]),
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
    expect(dashboardHtml).toContain("Trellis GTM runtime");
    expect(dashboardHtml).toContain("<dt>Signals</dt><dd>1</dd>");
    expect(dashboardHtml).toContain("<dt>Prospects</dt><dd>1</dd>");
    expect(dashboardHtml).toContain("<dt>State Records</dt><dd>1</dd>");
    expect(dashboardHtml).toContain("<dt>Drafts</dt><dd>1</dd>");
    expect(dashboardHtml).toContain("<dt>Approvals</dt><dd>2</dd>");
    expect(dashboardHtml).toContain("<dt>Provider Runs</dt><dd>1</dd>");
    expect(dashboardHtml).toContain("<dt>Provider Actions</dt><dd>1</dd>");
    expect(dashboardHtml).toContain("<dt>Workflow Runs</dt><dd>1</dd>");
    expect(dashboardHtml).toContain("<dt>Smoke Runs</dt><dd>0</dd>");
    expect(dashboardHtml).toContain("<dt>Trace Events</dt><dd>13</dd>");
    expect(dashboardHtml).toContain("<dt>Knowledge Files</dt><dd>1</dd>");
    expect(dashboardHtml).toContain("<dt>Skill Files</dt><dd>1</dd>");
    expect(dashboardHtml).toContain("Recent Workflow Runs");
    expect(dashboardHtml).toContain("Recent Provider Runs");
    expect(dashboardHtml).toContain("test:succeeded provider_run_test_sig_live");
    expect(dashboardHtml).toContain("prospect:dispatched trellis_sig_live_prospect");
    expect(dashboardHtml).toContain("Recent Provider Actions");
    expect(dashboardHtml).toContain("agentmail:email.send failed");
    expect(dashboardHtml).toContain("Recent Audit Events");
    expect(dashboardHtml).toContain("provider_action.failed");
    await expect(protectedHealth.json()).resolves.toMatchObject({
      ok: true,
      auth: {
        apiKey: {
          enabled: true,
          env: "TRELLIS_API_KEY",
        },
      },
    });
    expect(protectedSmoke.status).toBe(200);
    expect(protectedMcpDenied.status).toBe(401);
    await expect(protectedMcpDenied.json()).resolves.toMatchObject({
      ok: false,
      error: "unauthorized",
    });
    expect(protectedMcpAllowed.status).toBe(200);
    await expect(protectedMcpAllowed.json()).resolves.toMatchObject({
      ok: true,
      server: "trellis",
    });
    expect(protectedWebhookAllowed.status).toBe(202);
    await expect(protectedWebhookAllowed.json()).resolves.toMatchObject({
      ok: true,
      signal: {
        id: "sig_api_key",
      },
      webhook: {
        verified: true,
      },
    });
    const smokeWithHistory = await runtime.worker.fetch(new Request("https://example.com/smoke"), env);
    await expect(smokeWithHistory.json()).resolves.toMatchObject({
      ok: true,
      history: {
        enabled: true,
        table: "trellis_smoke_runs",
        status: "pass",
      },
    });
    expect(fakeD1.statements.some((statement) =>
      statement.sql.includes("CREATE TABLE IF NOT EXISTS trellis_smoke_runs"),
    )).toBe(true);
    expect(fakeD1.statements.some((statement) =>
      statement.sql.includes("INSERT OR REPLACE INTO trellis_smoke_runs"),
    )).toBe(true);
    const snapshotAfterSmoke = await runtime.worker.fetch(new Request("https://example.com/mcp/trellis"), env);
    await expect(snapshotAfterSmoke.json()).resolves.toMatchObject({
      snapshot: {
        counts: {
          smokeRuns: 1,
        },
      },
      tools: expect.arrayContaining(["trellis.smoke.history"]),
    });
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
    const followUpStep = createFakeWorkflowStep();
    const followUpRun = await new runtime.ProspectWorkflow(env).run({
      params: {
        workflow: "follow_up",
        traceId: "trace_sig_live",
        signal: {
          id: "sig_live",
          workspaceId: "wrk_live",
          threadId: "thr_live",
        },
        providerActionId: "provider_action_approval_draft_sig_live_email_send",
        draftId: "draft_sig_live",
        followUp: {
          delay: "1 day",
        },
      },
    }, followUpStep);
    expect(followUpStep.steps).toEqual([
      "plan follow-up check",
      "record follow-up schedule",
      "wait for follow-up window",
      "record follow-up due",
    ]);
    expect(followUpStep.sleeps).toEqual([
      {
        name: "wait for follow-up window",
        duration: "1 day",
      },
    ]);
    expect(followUpRun).toMatchObject({
      ok: true,
      workflow: "follow_up",
      runId: "trellis_sig_live_follow_up",
      traceId: "trace_sig_live",
      status: "follow_up_due",
      checkpoint: {
        signalId: "sig_live",
        providerActionId: "provider_action_approval_draft_sig_live_email_send",
        draftId: "draft_sig_live",
        delay: "1 day",
        next: "draft_follow_up_if_no_reply",
      },
      sleep: {
        enabled: true,
        duration: "1 day",
      },
      persistence: {
        due: {
          enabled: true,
          table: "trellis_workflow_runs",
          status: "follow_up_due",
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

  it("runs explicit Attio provider smoke writes behind a token gate", async () => {
    const runtime = trellis.cloudflare(trellis.agent("sdr", {
      crm: attio({
        map: {
          companies: {
            name: "company",
            domains: "domain",
            icp_status: "qualification.decision",
          },
          people: {
            name: "fullName",
            email_addresses: "email",
            qualification_summary: "qualification.summary",
          },
        },
      }),
      email: agentmail(),
      research: firecrawl(),
      knowledge: "knowledge/**/*.md",
      skills: "skills/**/SKILL.md",
      safety: trellis.safeOutbound(),
    }, async (app) => app.workflow("prospect").start({ signal: await app.signal() })));
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);
      if (href.includes("/objects/companies/records")) {
        return new Response(JSON.stringify({
          data: {
            id: { record_id: "company_smoke" },
            web_url: "https://app.attio.com/company_smoke",
          },
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({
        data: {
          id: { record_id: "person_smoke" },
          web_url: "https://app.attio.com/person_smoke",
        },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const env = {
      ATTIO_API_KEY: "attio_test",
      ATTIO_BASE_URL: "https://attio.test",
      TRELLIS_PROVIDER_SMOKE_TOKEN: "smoke-secret",
      TRELLIS_FETCH: fetchMock,
    };

    const blocked = await runtime.worker.fetch(new Request("https://example.com/smoke/attio", {
      method: "POST",
    }), env);
    const smoke = await runtime.worker.fetch(new Request("https://example.com/smoke/attio", {
      method: "POST",
      headers: {
        authorization: "Bearer smoke-secret",
      },
    }), env);

    expect(blocked.status).toBe(401);
    expect(smoke.status).toBe(200);
    await expect(smoke.json()).resolves.toMatchObject({
      ok: true,
      mode: "provider-integration",
      provider: "attio",
      externalWrites: true,
      mappedFields: {
        companies: expect.arrayContaining(["name", "domains", "icp_status"]),
        people: expect.arrayContaining(["name", "email_addresses", "qualification_summary"]),
      },
      execution: {
        ok: true,
        externalId: "person_smoke",
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, companyInit] = fetchMock.mock.calls[0] as unknown as [string | URL | Request, RequestInit];
    const [, personInit] = fetchMock.mock.calls[1] as unknown as [string | URL | Request, RequestInit];
    expect(JSON.parse(String(companyInit?.body))).toEqual({
      data: {
        values: {
          name: "Trellis Smoke Test",
          domains: ["trellis-smoke.example.com"],
          icp_status: "needs_review",
        },
      },
    });
    expect(JSON.parse(String(personInit?.body))).toEqual({
      data: {
        values: {
          name: [
            {
              first_name: "Trellis",
              last_name: "Smoke",
              full_name: "Trellis Smoke",
            },
          ],
          email_addresses: ["trellis-smoke@example.com"],
          job_title: "Provider Smoke",
          linkedin: "https://linkedin.com/company/trellis-smoke",
          qualification_summary: "Attio provider smoke qualification.",
          company: [
            {
              target_object: "companies",
              target_record_id: "company_smoke",
            },
          ],
        },
      },
    });
  });

  it("normalizes mixed-source webhook batches through the signal route", async () => {
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
    const fakeWorkflow = {
      create: vi.fn(async (options: Record<string, unknown>) => ({
        id: options.id,
      })),
    };
    const env = {
      TRELLIS_DB: fakeD1,
      TRELLIS_EVENTS: fakeQueue,
      PROSPECT_WORKFLOW: fakeWorkflow,
    };

    const webhook = await runtime.worker.fetch(new Request("https://example.com/webhooks/signals", {
      method: "POST",
      body: JSON.stringify({
        provider: "batch-import",
        externalId: "run_batch_1",
        campaignId: "cmp_batch",
        workspaceId: "wrk_batch",
        signals: [
          {
            source: "x_public_post",
            url: "https://x.com/example/status/1",
            name: "Jordan",
            title: "RevOps Lead",
            company: "Northstar",
            text: "We adopted Clay last month.",
          },
          {
            source: "podcast_mention",
            url: "https://example.fm/episodes/123",
            author: "Avery",
            role: "Founder",
            companyName: "Northstar",
            description: "Talking about GTM systems and agent workflows.",
          },
        ],
      }),
    }), env);
    const body = await webhook.json() as {
      prospects: unknown[];
      drafts: unknown[];
      approvals: unknown[];
    };

    expect(webhook.status).toBe(202);
    expect(body).toMatchObject({
      ok: true,
      accepted: true,
      mode: "processed_batch",
      signalsReceived: 2,
      signals: [
        expect.objectContaining({
          workspaceId: "wrk_batch",
          campaignId: "cmp_batch",
          provider: "batch-import",
          source: "x_public_post",
          payload: expect.objectContaining({
            authorName: "Jordan",
            authorTitle: "RevOps Lead",
            authorCompany: "Northstar",
            sourceRef: "https://x.com/example/status/1",
            content: "We adopted Clay last month.",
          }),
        }),
        expect.objectContaining({
          provider: "batch-import",
          source: "podcast_mention",
          payload: expect.objectContaining({
            authorName: "Avery",
            authorTitle: "Founder",
            authorCompany: "Northstar",
            content: expect.stringContaining("GTM systems"),
          }),
        }),
      ],
      prospects: expect.arrayContaining([
        expect.objectContaining({ workspaceId: "wrk_batch" }),
      ]),
      persistence: {
        enabled: true,
        results: [expect.objectContaining({ enabled: true }), expect.objectContaining({ enabled: true })],
      },
      queue: {
        enabled: true,
        messages: 2,
      },
      workflowDispatch: {
        enabled: true,
        ok: true,
        results: [expect.objectContaining({ workflow: "prospect" }), expect.objectContaining({ workflow: "prospect" })],
      },
      providerRun: {
        enabled: true,
        table: "trellis_provider_runs",
        provider: "batch-import",
        kind: "signal.batch",
        externalId: "run_batch_1",
        status: "succeeded",
        responsePayload: expect.objectContaining({
          signalsReceived: 2,
          prospectsProcessed: 2,
          workflowFailures: [],
        }),
      },
      webhook: {
        verified: false,
        idempotencyKey: null,
      },
    });
    expect(body.prospects).toHaveLength(2);
    expect(body.drafts).toHaveLength(2);
    expect(body.approvals).toHaveLength(4);
    expect(fakeWorkflow.create).toHaveBeenCalledTimes(2);
    expect(fakeQueue.messages).toEqual([
      expect.objectContaining({
        type: "trellis.signal.processed",
        workspaceId: "wrk_batch",
      }),
      expect.objectContaining({
        type: "trellis.signal.processed",
        workspaceId: "wrk_batch",
      }),
    ]);

    const mcp = await runtime.worker.fetch(new Request("https://example.com/mcp/trellis"), env);
    await expect(mcp.json()).resolves.toMatchObject({
      snapshot: {
        counts: {
          signals: 2,
          prospects: 2,
          drafts: 2,
          approvals: 4,
          providerRuns: 1,
          workflowRuns: 2,
        },
      },
    });
  });

  it("accepts Apify discovery webhooks through the signal path", async () => {
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
    const fakeWorkflow = {
      create: vi.fn(async (options: Record<string, unknown>) => ({
        id: options.id,
      })),
    };
    const env = {
      TRELLIS_DB: fakeD1,
      TRELLIS_EVENTS: fakeQueue,
      PROSPECT_WORKFLOW: fakeWorkflow,
      APIFY_WEBHOOK_SECRET: "apify-secret",
    };

    const unauthorized = await runtime.worker.fetch(new Request("https://example.com/webhooks/apify", {
      method: "POST",
      body: JSON.stringify({ eventType: "ACTOR.RUN.SUCCEEDED" }),
    }), env);
    const webhook = await runtime.worker.fetch(new Request("https://example.com/webhooks/apify?secret=apify-secret", {
      method: "POST",
      body: JSON.stringify({
        eventType: "ACTOR.RUN.SUCCEEDED",
        actorRunId: "run_apify_1",
        defaultDatasetId: "dataset_1",
        source: "linkedin_public_post",
        campaignId: "cmp_apify",
        workspaceId: "wrk_apify",
        term: "waterfall enrichment",
        items: [
          {
            entityId: "post_1",
            author: {
              name: "Sam Rivera",
              headline: "VP Sales at Northstar",
            },
            socialContent: {
              shareUrl: "https://linkedin.com/feed/update/post_1",
              text: "Looking for better outbound enrichment workflows.",
            },
            companyName: "Northstar",
            companyDomain: "northstar.example",
          },
        ],
      }),
    }), env);
    const body = await webhook.json() as Record<string, unknown>;

    expect(unauthorized.status).toBe(401);
    await expect(unauthorized.json()).resolves.toMatchObject({
      ok: false,
      error: "unauthorized_apify_webhook",
    });
    expect(webhook.status).toBe(202);
    expect(body).toMatchObject({
      ok: true,
      accepted: true,
      mode: "processed",
      signal: {
        id: "sig_run_apify_1",
        workspaceId: "wrk_apify",
        campaignId: "cmp_apify",
        provider: "apify",
        source: "linkedin_public_post",
        payload: expect.objectContaining({
          sourceRef: "post_1",
          authorName: "Sam Rivera",
          authorTitle: "VP Sales at Northstar",
          authorCompany: "Northstar",
          companyDomain: "northstar.example",
          topic: "waterfall enrichment",
          content: "Looking for better outbound enrichment workflows.",
        }),
      },
      providerRun: {
        enabled: true,
        provider: "apify",
        kind: "signal.webhook",
        externalId: "run_apify_1",
        status: "succeeded",
      },
      webhook: {
        verified: true,
        type: "apify",
        eventType: "ACTOR.RUN.SUCCEEDED",
        actorRunId: "run_apify_1",
        datasetId: "dataset_1",
        fetchedDataset: false,
      },
      queue: {
        enabled: true,
        messages: 1,
      },
      workflowDispatch: {
        enabled: true,
        workflow: "prospect",
      },
    });
    expect(fakeWorkflow.create).toHaveBeenCalledWith({
      id: "trellis_sig_run_apify_1_prospect",
      params: expect.objectContaining({
        signal: expect.objectContaining({
          provider: "apify",
          source: "linkedin_public_post",
        }),
      }),
    });
    expect(fakeQueue.messages).toEqual([
      expect.objectContaining({
        type: "trellis.signal.processed",
        signalId: "sig_run_apify_1",
        workspaceId: "wrk_apify",
      }),
    ]);

    const mcp = await runtime.worker.fetch(new Request("https://example.com/mcp/trellis"), env);
    await expect(mcp.json()).resolves.toMatchObject({
      snapshot: {
        counts: {
          signals: 1,
          providerRuns: 1,
          workflowRuns: 1,
        },
      },
    });
  });

  it("scopes persisted audit and trace event ids per signal", async () => {
    const runtime = trellis.cloudflare(trellis.agent("sdr", {
      email: agentmail(),
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
    const env = {
      TRELLIS_DB: fakeD1,
    };

    await runtime.worker.fetch(new Request("https://example.com/webhooks/signals", {
      method: "POST",
      body: JSON.stringify({
        id: "sig_audit_a",
        workspaceId: "wrk_audit",
        threadId: "thr_audit_a",
      }),
    }), env);
    await runtime.worker.fetch(new Request("https://example.com/webhooks/signals", {
      method: "POST",
      body: JSON.stringify({
        id: "sig_audit_b",
        workspaceId: "wrk_audit",
        threadId: "thr_audit_b",
      }),
    }), env);

    const mcp = await runtime.worker.fetch(new Request("https://example.com/mcp/trellis"), env);
    await expect(mcp.json()).resolves.toMatchObject({
      snapshot: {
        counts: {
          signals: 2,
          auditEvents: 8,
          traceEvents: 18,
        },
      },
    });
    expect(fakeD1.statements).toEqual(expect.arrayContaining([
      expect.objectContaining({
        bindings: expect.arrayContaining(["evt_sig_audit_a_1"]),
      }),
      expect.objectContaining({
        bindings: expect.arrayContaining(["evt_sig_audit_b_1"]),
      }),
    ]));
  });

  it("exposes read-only durable agent snapshots", async () => {
    const runtime = trellis.cloudflare(trellis.agent("sdr", {
      email: agentmail(),
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
    const get = vi.fn(async (key: string) => {
      if (key === "trellis:snapshot") {
        return {
          status: "active",
          signalId: "sig_agent_snapshot",
        };
      }
      if (key === "trellis:memory") {
        return {
          lastStage: "approval",
        };
      }
      return null;
    });
    const exec = vi.fn((query: string) => {
      if (query.includes("sqlite_master")) {
        return {
          toArray: () => [
            { name: "trellis_agent_memory" },
          ],
        };
      }
      if (query.includes("trellis_agent_memory")) {
        return {
          toArray: () => [
            {
              key: "lastSignal",
              value: JSON.stringify({ id: "sig_agent_snapshot" }),
              updatedAt: "2026-05-12T00:00:00.000Z",
            },
          ],
        };
      }
      return {
        toArray: () => [],
      };
    });
    const agentObject = new runtime.TrellisAgent({
      storage: {
        get,
        sql: {
          exec,
        },
      },
    }, {});

    const response = await agentObject.fetch(new Request("https://example.com/agents/prospect_sig_agent_snapshot"));
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      runtime: "trellis-agent",
      path: "/agents/prospect_sig_agent_snapshot",
      storage: "durable-object-sqlite",
      snapshot: {
        enabled: true,
        kv: {
          snapshot: {
            status: "active",
            signalId: "sig_agent_snapshot",
          },
          memory: {
            lastStage: "approval",
          },
        },
        sqlite: {
          enabled: true,
          tables: [
            {
              name: "trellis_agent_memory",
            },
          ],
          memory: [
            {
              key: "lastSignal",
              value: {
                id: "sig_agent_snapshot",
              },
            },
          ],
        },
      },
    });
    expect(get).toHaveBeenCalledWith("trellis:snapshot");
    expect(get).toHaveBeenCalledWith("trellis:memory");
    expect(exec).toHaveBeenCalledWith("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name LIMIT 20");
  });

  it("enforces operator kill switch and pause controls before workflow dispatch and provider execution", async () => {
    const runtime = trellis.cloudflare(trellis.agent("sdr", {
      email: agentmail(),
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
    const fakeWorkflow = {
      create: vi.fn(async (options: Record<string, unknown>) => ({ id: options.id })),
    };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      id: "msg_control_1",
      thread_id: "thr_control_agentmail",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    const env = {
      TRELLIS_DB: fakeD1,
      TRELLIS_EVENTS: fakeQueue,
      PROSPECT_WORKFLOW: fakeWorkflow,
      AGENTMAIL_API_KEY: "am_control",
      AGENTMAIL_BASE_URL: "https://agentmail.test",
      TRELLIS_FETCH: fetchMock,
    };

    const enableKill = await runtime.worker.fetch(new Request("https://example.com/operator/kill-switch/enable", {
      method: "POST",
      body: JSON.stringify({
        actor: "ops@example.com",
        reason: "incident response",
      }),
    }), env);
    await expect(enableKill.json()).resolves.toMatchObject({
      ok: true,
      control: {
        id: "global:kill_switch",
        status: "enabled",
        reason: "incident response",
      },
      persistence: {
        enabled: true,
      },
      queue: {
        enabled: true,
        messages: 1,
      },
    });

    const webhook = await runtime.worker.fetch(new Request("https://example.com/webhooks/signals", {
      method: "POST",
      body: JSON.stringify({
        id: "sig_control",
        workspaceId: "wrk_control",
        threadId: "thr_control",
        campaignId: "cmp_control",
        inboxId: "inbox_control",
        to: "buyer@example.com",
        subject: "Control test",
        bodyText: "Control body",
      }),
    }), env);
    await expect(webhook.json()).resolves.toMatchObject({
      ok: true,
      workflowDispatch: {
        enabled: true,
        ok: true,
        blocked: true,
        status: "paused",
        reason: "incident response",
        controls: {
          blocked: true,
          reasons: ["incident response"],
        },
      },
    });
    expect(fakeWorkflow.create).not.toHaveBeenCalled();

    await runtime.worker.fetch(new Request("https://example.com/approvals/approval_draft_sig_control_email_send/approve", {
      method: "POST",
      body: JSON.stringify({
        signalId: "sig_control",
        draftId: "draft_sig_control",
        action: "email.send",
        actor: "ops@example.com",
      }),
    }), env);
    const blockedExecution = await runtime.worker.fetch(new Request("https://example.com/provider-actions/provider_action_approval_draft_sig_control_email_send/execute", {
      method: "POST",
      body: JSON.stringify({
        actor: "agentmail-worker",
      }),
    }), env);
    expect(blockedExecution.status).toBe(423);
    await expect(blockedExecution.json()).resolves.toMatchObject({
      ok: false,
      error: "operator_control_active",
      detail: "incident response",
      controls: {
        blocked: true,
      },
    });
    expect(fetchMock).not.toHaveBeenCalled();

    await runtime.worker.fetch(new Request("https://example.com/operator/kill-switch/disable", {
      method: "POST",
      body: JSON.stringify({
        actor: "ops@example.com",
        reason: "incident resolved",
      }),
    }), env);
    const workflowReplay = await runtime.worker.fetch(new Request("https://example.com/operator/workflows/trellis_sig_control_prospect/replay", {
      method: "POST",
      body: JSON.stringify({
        replayId: "trellis_sig_control_prospect_manual",
        actor: "ops@example.com",
        reason: "manual workflow retry",
      }),
    }), env);
    await expect(workflowReplay.json()).resolves.toMatchObject({
      ok: true,
      workflowRunId: "trellis_sig_control_prospect",
      replayId: "trellis_sig_control_prospect_manual",
      workflow: "prospect",
      persistence: {
        enabled: true,
        status: "replayed",
      },
    });
    expect(fakeWorkflow.create).toHaveBeenCalledWith({
      id: "trellis_sig_control_prospect_manual",
      params: expect.objectContaining({
        replayOf: "trellis_sig_control_prospect",
        replayActor: "ops@example.com",
        replayReason: "manual workflow retry",
      }),
    });

    const pauseCampaign = await runtime.worker.fetch(new Request("https://example.com/operator/campaigns/cmp_control/pause", {
      method: "POST",
      body: JSON.stringify({ reason: "campaign review" }),
    }), env);
    await expect(pauseCampaign.json()).resolves.toMatchObject({
      ok: true,
      control: {
        id: "campaign:cmp_control",
        status: "paused",
      },
    });
    const pausedExecution = await runtime.worker.fetch(new Request("https://example.com/provider-actions/provider_action_approval_draft_sig_control_email_send/execute", {
      method: "POST",
      body: JSON.stringify({ actor: "agentmail-worker" }),
    }), env);
    expect(pausedExecution.status).toBe(423);
    await expect(pausedExecution.json()).resolves.toMatchObject({
      detail: "campaign review",
    });
    const providerReplay = await runtime.worker.fetch(new Request("https://example.com/operator/provider-actions/provider_action_approval_draft_sig_control_email_send/replay", {
      method: "POST",
      body: JSON.stringify({
        actor: "ops@example.com",
        reason: "retry after campaign review",
      }),
    }), env);
    await expect(providerReplay.json()).resolves.toMatchObject({
      ok: true,
      providerAction: {
        id: "provider_action_approval_draft_sig_control_email_send",
        status: "queued",
      },
      queue: {
        enabled: true,
        messages: 1,
      },
    });
    expect(fakeQueue.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "trellis.provider.action.queued",
        providerAction: expect.objectContaining({
          id: "provider_action_approval_draft_sig_control_email_send",
          status: "queued",
        }),
      }),
    ]));

    await runtime.worker.fetch(new Request("https://example.com/operator/campaigns/cmp_control/resume", {
      method: "POST",
      body: JSON.stringify({ reason: "review complete" }),
    }), env);
    const execution = await runtime.worker.fetch(new Request("https://example.com/provider-actions/provider_action_approval_draft_sig_control_email_send/execute", {
      method: "POST",
      body: JSON.stringify({ actor: "agentmail-worker" }),
    }), env);
    expect(execution.status).toBe(200);
    await expect(execution.json()).resolves.toMatchObject({
      ok: true,
      providerAction: {
        id: "provider_action_approval_draft_sig_control_email_send",
        status: "completed",
      },
      execution: {
        provider: "agentmail",
        operation: "email.send",
        externalId: "msg_control_1",
        externalThreadId: "thr_control_agentmail",
      },
    });

    const controls = await runtime.worker.fetch(new Request("https://example.com/operator/controls"), env);
    await expect(controls.json()).resolves.toMatchObject({
      ok: true,
      controls: {
        enabled: true,
        blocked: false,
        globalKillSwitch: {
          status: "disabled",
        },
      },
    });
    const mcp = await runtime.worker.fetch(new Request("https://example.com/mcp/trellis"), env);
    await expect(mcp.json()).resolves.toMatchObject({
      tools: expect.arrayContaining([
        "trellis.operator.controls",
        "trellis.operator.killSwitch.enable",
        "trellis.workflow.pause",
        "trellis.workflow.resume",
        "trellis.workflow.replay",
        "trellis.providerAction.replay",
      ]),
      snapshot: {
        counts: {
          operatorControls: 2,
          workflowRuns: 3,
        },
      },
    });
  });

  it("exports trace events to optional observability sinks without blocking ingest", async () => {
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
    const fetchMock = vi.fn(async (url: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify({ ok: !String(url).includes("trace-sink.test") }), {
        status: String(url).includes("trace-sink.test") ? 500 : 202,
        headers: { "content-type": "application/json" },
      }),
    );
    const exporter = {
      export: vi.fn(async () => {
        throw new Error("sink temporarily unavailable");
      }),
    };
    const env = {
      TRELLIS_DB: fakeD1,
      TRELLIS_FETCH: fetchMock,
      TRELLIS_TRACE_EXPORTER: exporter,
      TRELLIS_TRACE_EXPORT_URL: "https://trace-sink.test/events",
      TRELLIS_TRACE_EXPORT_TOKEN: "trace_token",
      LANGFUSE_PUBLIC_KEY: "pk_test",
      LANGFUSE_SECRET_KEY: "sk_test",
      LANGFUSE_BASE_URL: "https://langfuse.test",
      BRAINTRUST_API_KEY: "bt_test",
      BRAINTRUST_PROJECT_ID: "proj_test",
      BRAINTRUST_BASE_URL: "https://braintrust.test",
    };

    const health = await runtime.worker.fetch(new Request("https://example.com/healthz"), env);
    const webhook = await runtime.worker.fetch(new Request("https://example.com/webhooks/signals", {
      method: "POST",
      body: JSON.stringify({
        id: "sig_trace_export",
        workspaceId: "wrk_trace",
        threadId: "thr_trace",
      }),
    }), env);
    const mcp = await runtime.worker.fetch(new Request("https://example.com/mcp/trellis"), env);

    await expect(health.json()).resolves.toMatchObject({
      ok: true,
      traceExport: {
        enabled: true,
        binding: true,
        generic: true,
        langfuse: true,
        braintrust: true,
      },
    });
    expect(webhook.status).toBe(202);
    await expect(webhook.json()).resolves.toMatchObject({
      ok: true,
      accepted: true,
      persistence: {
        enabled: true,
      },
      workflowDispatch: {
        enabled: false,
      },
    });
    await expect(mcp.json()).resolves.toMatchObject({
      snapshot: {
        traceExport: {
          enabled: true,
          langfuse: true,
          braintrust: true,
        },
        counts: {
          traceEvents: 9,
        },
      },
      tools: expect.arrayContaining(["trellis.trace.export"]),
    });
    expect(exporter.export).toHaveBeenCalled();
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(12);

    const genericCall = fetchMock.mock.calls.find(([url]) => String(url) === "https://trace-sink.test/events");
    const langfuseCall = fetchMock.mock.calls.find(([url]) => String(url) === "https://langfuse.test/api/public/ingestion");
    const braintrustCall = fetchMock.mock.calls.find(([url]) =>
      String(url) === "https://braintrust.test/v1/project_logs/proj_test/insert",
    );
    expect(genericCall?.[1]).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({
        authorization: "Bearer trace_token",
      }),
    });
    expect(langfuseCall?.[1]).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({
        authorization: expect.stringMatching(/^Basic /),
      }),
    });
    expect(braintrustCall?.[1]).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({
        authorization: "Bearer bt_test",
      }),
    });
    expect(JSON.parse(String(langfuseCall?.[1]?.body))).toMatchObject({
      batch: [
        {
          type: "event-create",
          body: {
            traceId: "trace_sig_trace_export",
          },
        },
      ],
    });
  });

  it("accepts AgentMail reply webhooks as first-class signals", async () => {
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

  it("executes queued provider actions through the executor path", async () => {
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
      const fakeWorkflow = {
        create: vi.fn(async (options: Record<string, unknown>) => ({ id: options.id })),
      };
      const env = {
        TRELLIS_DB: fakeD1,
        TRELLIS_EVENTS: fakeQueue,
        AGENTMAIL_API_KEY: "am_test",
        AGENTMAIL_BASE_URL: "https://agentmail.test",
      };
      const executionEnv = {
        ...env,
        PROSPECT_WORKFLOW: fakeWorkflow,
        TRELLIS_FOLLOW_UP_DELAY: "2 days",
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
      }), executionEnv);
      const snapshot = await runtime.worker.fetch(new Request("https://example.com/provider-actions"), executionEnv);

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
        followUpWorkflow: {
          enabled: true,
          ok: true,
          workflow: "follow_up",
          instanceId: "trellis_sig_execute_follow_up_provider_action_approval_draft_sig_execute_email_send",
          delay: "2 days",
          next: "draft_follow_up_if_no_reply",
        },
      });
      expect(fakeWorkflow.create).toHaveBeenCalledWith({
        id: "trellis_sig_execute_follow_up_provider_action_approval_draft_sig_execute_email_send",
        params: expect.objectContaining({
          workflow: "follow_up",
          providerActionId: "provider_action_approval_draft_sig_execute_email_send",
          draftId: "draft_sig_execute",
          followUp: expect.objectContaining({
            delay: "2 days",
            next: "draft_follow_up_if_no_reply",
          }),
          execution: {
            externalId: "msg_agentmail_123",
            externalThreadId: "thread_agentmail_123",
          },
        }),
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string | URL | Request, RequestInit];
      expect(String(url)).toBe("https://agentmail.test/v0/inboxes/inbox_123/messages/send");
      expect(init).toMatchObject({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer am_test",
          "x-trellis-trace-id": "trace_sig_execute",
          "x-trellis-provider-action-id": "provider_action_approval_draft_sig_execute_email_send",
          "x-trellis-signal-id": "sig_execute",
          "x-trellis-draft-id": "draft_sig_execute",
          "x-trellis-workflow": "prospect",
          "x-trellis-prospect-id": "prospect_sig_execute",
          "x-trellis-thread-id": "thr_execute",
          "x-trellis-workspace-id": "wrk_execute",
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
            auditEvents: 8,
            workflowRuns: 1,
          },
        },
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("uses AgentMail sequence maps for default inboxes, follow-up steps, and cron sweeps", async () => {
    const runtime = trellis.cloudflare(trellis.agent("sdr", {
      crm: attio(),
      email: agentmail({
        sequence: {
          provider: "agentmail",
          defaultInboxId: "env:AGENTMAIL_INBOX_ID",
          stopOn: ["reply.received", "unsubscribe", "bounce", "manual.pause", "kill_switch"],
          steps: [
            {
              id: "initial",
              operation: "email.send",
              approval: "required",
            },
            {
              id: "follow_up_1",
              operation: "email.reply",
              delay: "1 ms",
              condition: "no_reply",
              approval: "required",
            },
          ],
        },
      }),
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
    const fakeWorkflow = {
      create: vi.fn(async (options: Record<string, unknown>) => ({ id: options.id })),
    };
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        id: "msg_sequence_123",
        thread_id: "thread_sequence_123",
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
        PROSPECT_WORKFLOW: fakeWorkflow,
        AGENTMAIL_API_KEY: "am_sequence",
        AGENTMAIL_BASE_URL: "https://agentmail.test",
        AGENTMAIL_INBOX_ID: "inbox_sequence",
      };

      await runtime.worker.fetch(new Request("https://example.com/webhooks/signals", {
        method: "POST",
        body: JSON.stringify({
          id: "sig_sequence",
          workspaceId: "wrk_sequence",
          threadId: "thr_sequence",
          provider: "test",
          source: "unit.test",
          to: "sequence-buyer@example.com",
          subject: "Sequence hello",
        }),
      }), env);
      await runtime.worker.fetch(new Request("https://example.com/approvals/approval_draft_sig_sequence_email_send/approve", {
        method: "POST",
        body: JSON.stringify({
          signalId: "sig_sequence",
          draftId: "draft_sig_sequence",
          action: "email.send",
          actor: "operator@example.com",
        }),
      }), env);

      const execution = await runtime.worker.fetch(new Request("https://example.com/provider-actions/provider_action_approval_draft_sig_sequence_email_send/execute", {
        method: "POST",
        body: JSON.stringify({
          actor: "agentmail-worker",
        }),
      }), env);
      const body = await execution.json();

      expect(execution.status).toBe(200);
      expect(body).toMatchObject({
        ok: true,
        followUpWorkflow: {
          enabled: true,
          ok: true,
          workflow: "follow_up",
          next: "follow_up_1",
          delay: "1 ms",
          sequence: {
            currentStepId: "initial",
            nextStepId: "follow_up_1",
            stopOn: ["reply.received", "unsubscribe", "bounce", "manual.pause", "kill_switch"],
          },
        },
      });
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string | URL | Request, RequestInit];
      expect(String(url)).toBe("https://agentmail.test/v0/inboxes/inbox_sequence/messages/send");
      expect(JSON.parse(String(init?.body))).toMatchObject({
        to: ["sequence-buyer@example.com"],
        subject: "Sequence hello",
      });
      expect(fakeWorkflow.create).toHaveBeenCalledWith({
        id: "trellis_sig_sequence_follow_up_provider_action_approval_draft_sig_sequence_email_send",
        params: expect.objectContaining({
          followUp: expect.objectContaining({
            next: "follow_up_1",
            operation: "email.reply",
            condition: "no_reply",
            sequence: {
              provider: "agentmail",
              currentStepId: "initial",
              nextStepId: "follow_up_1",
              stopOn: ["reply.received", "unsubscribe", "bounce", "manual.pause", "kill_switch"],
            },
          }),
        }),
      });

      const sweep = await runtime.worker.scheduled?.({
        scheduledTime: Date.now() + 1_000,
        cron: "*/15 * * * *",
      }, env);
      expect(sweep).toMatchObject({
        ok: true,
        enabled: true,
        checked: 1,
        due: 1,
      });
      expect(fakeD1.statements.some((statement) =>
        statement.sql.includes("INSERT OR REPLACE INTO trellis_workflow_runs")
          && statement.bindings[2] === "follow_up"
          && statement.bindings[3] === "follow_up_due",
      )).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("passes Trellis context through bound provider executors", async () => {
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
    const executorFetch = vi.fn(async (request: Request) => {
      expect(request.headers.get("x-trellis-trace-id")).toBe("trace_sig_bound");
      expect(request.headers.get("x-trellis-provider-action-id")).toBe("provider_action_approval_draft_sig_bound_email_send");
      expect(request.headers.get("x-trellis-signal-id")).toBe("sig_bound");
      expect(request.headers.get("x-trellis-draft-id")).toBe("draft_sig_bound");
      expect(request.headers.get("x-trellis-workflow")).toBe("prospect");
      expect(request.headers.get("x-trellis-prospect-id")).toBe("prospect_sig_bound");
      expect(request.headers.get("x-trellis-thread-id")).toBe("thr_bound");
      expect(request.headers.get("x-trellis-workspace-id")).toBe("wrk_bound");

      await expect(request.json()).resolves.toMatchObject({
        action: {
          id: "provider_action_approval_draft_sig_bound_email_send",
          signalId: "sig_bound",
          draftId: "draft_sig_bound",
        },
        signal: {
          id: "sig_bound",
          workspaceId: "wrk_bound",
          threadId: "thr_bound",
        },
        prospect: {
          id: "prospect_sig_bound",
          status: "needs_review",
        },
      });

      return new Response(JSON.stringify({
        ok: true,
        provider: "agentmail",
        operation: "email.send",
        externalId: "bound_msg_1",
        externalThreadId: "bound_thread_1",
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const env = {
      TRELLIS_DB: fakeD1,
      TRELLIS_PROVIDER_EXECUTOR: {
        fetch: executorFetch,
      },
    };

    await runtime.worker.fetch(new Request("https://example.com/webhooks/signals", {
      method: "POST",
      body: JSON.stringify({
        id: "sig_bound",
        workspaceId: "wrk_bound",
        threadId: "thr_bound",
        provider: "test",
        source: "unit.test",
      }),
    }), env);
    await runtime.worker.fetch(new Request("https://example.com/approvals/approval_draft_sig_bound_email_send/approve", {
      method: "POST",
      body: JSON.stringify({
        signalId: "sig_bound",
        draftId: "draft_sig_bound",
        action: "email.send",
        actor: "operator@example.com",
      }),
    }), env);
    const execution = await runtime.worker.fetch(new Request("https://example.com/provider-actions/provider_action_approval_draft_sig_bound_email_send/execute", {
      method: "POST",
      body: JSON.stringify({
        actor: "executor-binding",
      }),
    }), env);

    expect(executorFetch).toHaveBeenCalledTimes(1);
    await expect(execution.json()).resolves.toMatchObject({
      ok: true,
      execution: {
        ok: true,
        provider: "agentmail",
        operation: "email.send",
        externalId: "bound_msg_1",
        externalThreadId: "bound_thread_1",
      },
      providerAction: {
        id: "provider_action_approval_draft_sig_bound_email_send",
        status: "completed",
      },
    });
  });

  it("executes approved AgentMail replies through the built-in provider executor", async () => {
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
          action: "email.reply",
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
          operation: "email.reply",
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
          operation: "email.reply",
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
          "x-trellis-trace-id": "trace_sig_reply",
          "x-trellis-provider-action-id": "provider_action_approval_reply_sig_reply_mail_reply",
          "x-trellis-signal-id": "sig_reply",
          "x-trellis-workflow": "reply",
          "x-trellis-prospect-id": "prospect_sig_reply",
          "x-trellis-thread-id": "thr_reply",
          "x-trellis-workspace-id": "wrk_reply",
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

  it("executes approved handoff webhooks through the built-in provider executor", async () => {
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
        "x-trellis-trace-id": "trace_sig_handoff",
        "x-trellis-provider-action-id": "provider_action_approval_reply_sig_handoff_handoff_webhook",
        "x-trellis-signal-id": "sig_handoff",
        "x-trellis-workflow": "reply",
        "x-trellis-prospect-id": "prospect_sig_handoff",
        "x-trellis-thread-id": "thr_handoff",
        "x-trellis-workspace-id": "wrk_handoff",
      }),
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      type: "trellis.handoff.requested",
      providerActionId: "provider_action_approval_reply_sig_handoff_handoff_webhook",
      signalId: "sig_handoff",
      workflow: "reply",
      prospectId: "prospect_sig_handoff",
      threadId: "thr_handoff",
      workspaceId: "wrk_handoff",
      destination: "sales",
      reason: "Positive reply needs sales follow-up.",
    });
  });

  it("executes approved Attio CRM updates through the built-in provider executor", async () => {
    const runtime = trellis.cloudflare(trellis.agent("sdr", {
      crm: attio({
        map: {
          companies: {
            icp_status: "qualification.decision",
            latest_signal: "signal.payload.signal",
          },
          people: {
            qualification_summary: "qualification.summary",
          },
        },
      }),
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
    const fakeWorkflow = {
      create: vi.fn(async (options: Record<string, unknown>) => ({ id: options.id })),
    };
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
      PROSPECT_WORKFLOW: fakeWorkflow,
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
        signal: "Opened the pricing page twice this week.",
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
        "x-trellis-trace-id": "trace_sig_attio",
        "x-trellis-provider-action-id": "provider_action_approval_draft_sig_attio_crm_update",
        "x-trellis-signal-id": "sig_attio",
        "x-trellis-draft-id": "draft_sig_attio",
        "x-trellis-workflow": "prospect",
        "x-trellis-prospect-id": "prospect_sig_attio",
        "x-trellis-thread-id": "thr_attio",
        "x-trellis-workspace-id": "wrk_attio",
      }),
    });
    expect(JSON.parse(String(companyInit?.body))).toEqual({
      data: {
        values: {
          name: "Acme Corp",
          domains: ["acme.com"],
          icp_status: "needs_review",
          latest_signal: "Opened the pricing page twice this week.",
        },
      },
    });
    expect(String(personUrl)).toBe("https://attio.test/objects/people/records?matching_attribute=email_addresses");
    expect(personInit).toMatchObject({
      method: "PUT",
      headers: expect.objectContaining({
        authorization: "Bearer attio_test",
        "x-trellis-trace-id": "trace_sig_attio",
        "x-trellis-provider-action-id": "provider_action_approval_draft_sig_attio_crm_update",
        "x-trellis-signal-id": "sig_attio",
        "x-trellis-draft-id": "draft_sig_attio",
        "x-trellis-workflow": "prospect",
        "x-trellis-prospect-id": "prospect_sig_attio",
        "x-trellis-thread-id": "thr_attio",
        "x-trellis-workspace-id": "wrk_attio",
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
          qualification_summary: "Fixture qualification result.",
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
      expect(init).toMatchObject({
        headers: expect.objectContaining({
          "x-trellis-trace-id": "trace_sig_queue",
          "x-trellis-provider-action-id": "provider_action_approval_draft_sig_queue_email_send",
          "x-trellis-signal-id": "sig_queue",
          "x-trellis-workflow": "prospect",
          "x-trellis-prospect-id": "prospect_sig_queue",
          "x-trellis-thread-id": "thr_queue",
          "x-trellis-workspace-id": "wrk_queue",
        }),
      });
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

  it("keeps failed queue provider actions retryable for dead-letter recovery", async () => {
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
    const env = {
      TRELLIS_DB: fakeD1,
      TRELLIS_EVENTS: fakeQueue,
    };

    await runtime.worker.fetch(new Request("https://example.com/webhooks/signals", {
      method: "POST",
      body: JSON.stringify({
        id: "sig_queue_fail",
        workspaceId: "wrk_queue_fail",
        threadId: "thr_queue_fail",
        provider: "test",
        source: "unit.test",
        inboxId: "inbox_queue_fail",
        to: "fail-buyer@example.com",
      }),
    }), env);
    await runtime.worker.fetch(new Request("https://example.com/approvals/approval_draft_sig_queue_fail_email_send/approve", {
      method: "POST",
      body: JSON.stringify({
        signalId: "sig_queue_fail",
        draftId: "draft_sig_queue_fail",
        action: "email.send",
        actor: "operator@example.com",
      }),
    }), env);

    const queuedMessage = fakeQueue.messages.find((message) =>
      isTestRecord(message)
        && message.type === "trellis.provider.action.queued"
        && isTestRecord(message.providerAction)
        && message.providerAction.id === "provider_action_approval_draft_sig_queue_fail_email_send",
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
      ok: false,
      processed: 1,
      results: [
        {
          ok: false,
          providerActionId: "provider_action_approval_draft_sig_queue_fail_email_send",
          status: 502,
          retryState: {
            enabled: true,
          },
        },
      ],
    });
    expect(retry).toHaveBeenCalledTimes(1);
    expect(ack).not.toHaveBeenCalled();
    expect(fakeQueue.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "trellis.provider.action.failed",
        providerActionId: "provider_action_approval_draft_sig_queue_fail_email_send",
      }),
    ]));
    expect(fakeD1.statements.some((statement) =>
      statement.sql.includes("UPDATE trellis_provider_actions")
        && statement.bindings[0] === "queued"
        && statement.bindings[2] === "provider_action_approval_draft_sig_queue_fail_email_send",
    )).toBe(true);

    const replay = await runtime.worker.fetch(new Request("https://example.com/operator/provider-actions/provider_action_approval_draft_sig_queue_fail_email_send/replay", {
      method: "POST",
      body: JSON.stringify({
        actor: "ops@example.com",
        reason: "retry after DLQ inspection",
      }),
    }), env);
    await expect(replay.json()).resolves.toMatchObject({
      ok: true,
      providerAction: {
        id: "provider_action_approval_draft_sig_queue_fail_email_send",
        status: "queued",
      },
      queue: {
        enabled: true,
        messages: 1,
      },
    });
  });

  it("routes app.skill through a hidden Trellis-compatible harness when provided", async () => {
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
                summary: "Qualified by Trellis runtime.",
                confidence: 0.91,
                matchedEvidence: ["ICP pack"],
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
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
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
      if (String(url).endsWith("/enrich-person")) {
        if (String(init?.body ?? "").includes("No Match")) {
          return new Response(JSON.stringify({
            error: true,
            error_code: "NO_MATCH",
          }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({
          person: {
            email: {
              email: "sam@northstar.example",
              status: "VERIFIED",
              revealed: true,
            },
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
      PROSPEO_API_KEY: "prospeo_test",
      PROSPEO_BASE_URL: "https://prospeo.test",
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
        expect.objectContaining({ name: "trellis.health", parameters: expect.objectContaining({ type: "object" }) }),
        expect.objectContaining({ name: "research.search", provider: "firecrawl", parameters: expect.objectContaining({ type: "object" }) }),
        expect.objectContaining({ name: "research.extract", provider: "firecrawl", parameters: expect.objectContaining({ type: "object" }) }),
        expect.objectContaining({ name: "research.map", provider: "firecrawl", parameters: expect.objectContaining({ type: "object" }) }),
        expect.objectContaining({ name: "enrich.email", parameters: expect.objectContaining({ type: "object" }) }),
      ]),
    }));
    const initOptions = flueContext.init.mock.calls[0]?.[0] as Record<string, unknown>;
    const tools = initOptions.tools as Array<{
      name: string;
      parameters?: Record<string, unknown>;
      execute?: (input: Record<string, unknown>) => Promise<unknown> | unknown;
    }>;
    const searchTool = tools.find((tool) => tool.name === "research.search");
    const extractTool = tools.find((tool) => tool.name === "research.extract");
    const mapTool = tools.find((tool) => tool.name === "research.map");
    const enrichTool = tools.find((tool) => tool.name === "enrich.email");
    const searchResult = await searchTool?.execute?.({
      query: "Acme news",
      limit: 2,
      sources: ["news"],
    });
    const extractResult = await extractTool?.execute?.({
      url: "https://example.com/acme-news",
    });
    const mapResult = await mapTool?.execute?.({
      url: "https://example.com",
      limit: 3,
    });
    const enrichResult = await enrichTool?.execute?.({
      fullName: "Sam Rivera",
      companyName: "Northstar",
      companyDomain: "https://northstar.example",
    });
    const enrichNoMatch = await enrichTool?.execute?.({
      fullName: "No Match",
      companyDomain: "northstar.example",
    });
    expect(searchTool?.parameters).toMatchObject({
      properties: expect.objectContaining({
        query: expect.any(Object),
        queries: expect.any(Object),
      }),
    });
    expect(JSON.parse(String(searchResult))).toMatchObject({
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
    expect(JSON.parse(String(extractResult))).toMatchObject({
      provider: "firecrawl",
      operation: "research.extract",
      url: "https://example.com/acme-news",
      markdown: "# Acme\n\nRevenue operations update.",
    });
    expect(JSON.parse(String(mapResult))).toMatchObject({
      provider: "firecrawl",
      operation: "research.map",
      url: "https://example.com",
    });
    expect(JSON.parse(String(enrichResult))).toMatchObject({
      provider: "prospeo",
      operation: "enrich.email",
      found: true,
      contact: {
        address: "sam@northstar.example",
        confidence: 0.97,
        source: "prospeo",
      },
    });
    expect(JSON.parse(String(enrichNoMatch))).toMatchObject({
      provider: "prospeo",
      operation: "enrich.email",
      found: false,
      contact: null,
      raw: {
        error_code: "NO_MATCH",
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://firecrawl.test/v2/search");
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe("https://firecrawl.test/v2/scrape");
    expect(String(fetchMock.mock.calls[2]?.[0])).toBe("https://firecrawl.test/v2/map");
    expect(String(fetchMock.mock.calls[3]?.[0])).toBe("https://prospeo.test/enrich-person");
    expect(String(fetchMock.mock.calls[4]?.[0])).toBe("https://prospeo.test/enrich-person");
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

  it("falls back to safe deterministic skill output when the hidden harness fails", async () => {
    const runtime = trellis.cloudflare(trellis.agent("sdr", {
      model: "cloudflare/test-model",
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

    const flueContext = {
      init: vi.fn(async () => ({
        session: vi.fn(async () => ({
          skill: vi.fn(async () => {
            throw new Error("Cloudflare AI binding returned 400 Bad Request");
          }),
        })),
      })),
    };

    const webhook = await runtime.worker.fetch(new Request("https://example.com/webhooks/signals", {
      method: "POST",
      body: JSON.stringify({
        id: "sig_flue_fallback",
        workspaceId: "wrk_flue",
        threadId: "thr_flue_fallback",
      }),
    }), {
      TRELLIS_FLUE_CONTEXT: flueContext,
      TRELLIS_PACKS: createFakeR2({
        "skills/files/icp-qualification/SKILL.md": "# ICP Qualification",
      }),
    });

    expect(webhook.status).toBe(202);
    await expect(webhook.json()).resolves.toMatchObject({
      ok: true,
      prospects: [
        {
          id: "prospect_sig_flue_fallback",
          status: "needs_review",
        },
      ],
      auditEvents: expect.arrayContaining([
        expect.objectContaining({ type: "skill.fallback" }),
        expect.objectContaining({
          type: "skill.completed",
          metadata: expect.objectContaining({ harness: false }),
        }),
      ]),
    });
  });

  it("exposes native mail and browser capabilities through neutral Trellis names", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      new Response(JSON.stringify({
        ok: true,
        received: init?.body ? JSON.parse(String(init.body)) : null,
      }), { headers: { "content-type": "application/json" } })
    );
    const flueContext = {
      init: vi.fn(async (options: Record<string, unknown>) => ({
        options,
        session: vi.fn(async () => ({
          skill: vi.fn(async () => ({
            data: {
              decision: "qualified",
              summary: "ok",
              confidence: 0.9,
              matchedEvidence: [],
              missingEvidence: [],
            },
          })),
        })),
      })),
    };
    const runtime = trellis.cloudflare(trellis.agent("sdr", {
      mail: {
        id: "mail",
        kind: "mail",
        displayName: "Trellis Email",
      },
      browser: {
        id: "browser",
        kind: "browser",
        displayName: "Trellis Browser",
        config: {
          defaultProfile: "qa",
          profiles: {
            qa: {
              viewport: { width: 1280, height: 900 },
              waitFor: "networkidle",
            },
          },
        },
      },
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

    await runtime.worker.fetch(new Request("https://example.com/webhooks/signals", {
      method: "POST",
      body: JSON.stringify({ id: "sig_tools", workspaceId: "wrk_tools", threadId: "thr_tools" }),
    }), {
      TRELLIS_FETCH: fetchMock,
      TRELLIS_BROWSER_RUN_BASE_URL: "https://browser-run.test",
      TRELLIS_MAIL_ENDPOINT: "https://mail.test/send",
      TRELLIS_MAIL_FROM: "agent@example.com",
      TRELLIS_FLUE_CONTEXT: flueContext,
    });
    const initOptions = flueContext.init.mock.calls[0]?.[0] as { tools?: Array<{ name: string; execute?: (input: Record<string, unknown>) => Promise<unknown> | unknown }> };
    const browserRun = initOptions.tools?.find((tool) => tool.name === "browser.session.run");
    const mailBinding = {
      forward: vi.fn(async () => ({ id: "forwarded_msg" })),
      reject: vi.fn(async () => ({ id: "rejected_msg" })),
    };

    await browserRun?.execute?.({
      url: "https://example.com",
      task: "QA the page",
    });
    await runtime.worker.fetch(new Request("https://example.com/provider-actions/action_forward/execute", {
      method: "POST",
      body: JSON.stringify({
        input: {
          messageId: "msg_123",
          to: "owner@example.com",
        },
      }),
    }), {
      TRELLIS_DB: createProviderActionFakeD1({
        id: "action_forward",
        approvalId: "approval_forward",
        signalId: "sig_forward",
        provider: "mail",
        operation: "email.forward",
        status: "queued",
        traceId: "trace_forward",
      }),
      TRELLIS_MAIL: mailBinding,
    });
    await runtime.worker.fetch(new Request("https://example.com/provider-actions/action_reject/execute", {
      method: "POST",
      body: JSON.stringify({
        input: {
          messageId: "msg_456",
          reason: "Policy rejected.",
        },
      }),
    }), {
      TRELLIS_DB: createProviderActionFakeD1({
        id: "action_reject",
        approvalId: "approval_reject",
        signalId: "sig_reject",
        provider: "mail",
        operation: "email.reject",
        status: "queued",
        traceId: "trace_reject",
      }),
      TRELLIS_MAIL: mailBinding,
    });

    expect(browserRun).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("https://browser-run.test/session%2Frun", expect.objectContaining({
      body: expect.stringContaining("\"task\":\"QA the page\""),
    }));
    expect(mailBinding.forward).toHaveBeenCalledWith(expect.objectContaining({
      type: "forward",
      messageId: "msg_123",
    }));
    expect(mailBinding.reject).toHaveBeenCalledWith(expect.objectContaining({
      type: "reject",
      messageId: "msg_456",
    }));
  });

  it("accepts native mail webhooks as reply signals and lifecycle events", async () => {
    const fakeD1 = createFakeD1();
    const runtime = trellis.cloudflare(trellis.agent("sdr", {
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
      return app.workflow("reply").start({ signal, reply });
    }));

    const unauthorized = await runtime.worker.fetch(new Request("https://example.com/webhooks/email", {
      method: "POST",
      body: "{}",
    }), {
      TRELLIS_MAIL_WEBHOOK_SECRET: "mail-secret",
    });
    const inbound = await runtime.worker.fetch(new Request("https://example.com/webhooks/email", {
      method: "POST",
      headers: { "x-trellis-mail-webhook-secret": "mail-secret" },
      body: JSON.stringify({
        type: "message.received",
        message: {
          id: "mail_msg_1",
          threadId: "mail_thread_1",
          from: "buyer@example.com",
          subject: "Re: GTM",
          text: "Can you send pricing?",
        },
      }),
    }), {
      TRELLIS_DB: fakeD1,
      TRELLIS_MAIL_WEBHOOK_SECRET: "mail-secret",
    });
    const bounce = await runtime.worker.fetch(new Request("https://example.com/webhooks/email", {
      method: "POST",
      headers: { "x-trellis-mail-webhook-secret": "mail-secret" },
      body: JSON.stringify({
        type: "hard_bounce",
        messageId: "mail_msg_2",
        threadId: "mail_thread_2",
        reason: "Mailbox unavailable.",
      }),
    }), {
      TRELLIS_DB: fakeD1,
      TRELLIS_MAIL_WEBHOOK_SECRET: "mail-secret",
    });

    expect(unauthorized.status).toBe(401);
    await expect(inbound.json()).resolves.toMatchObject({
      ok: true,
      accepted: true,
      signal: {
        id: "sig_mail_mail_msg_1",
        provider: "mail",
        source: "reply.webhook",
      },
    });
    await expect(bounce.json()).resolves.toMatchObject({
      ok: true,
      accepted: true,
      mode: "lifecycle",
      event: expect.objectContaining({ kind: "bounce" }),
    });
    expect(traceEventsFromStatements(fakeD1).some((event) => event.type === "email.bounce")).toBe(true);
  });

  it("builds hidden runtime context through a factory after Trellis hydrates Cloudflare packs", async () => {
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
        summary: "Qualified by generated Trellis runtime factory.",
        confidence: 0.88,
        matchedEvidence: ["Generated pack"],
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
      TRELLIS_RUNTIME_CONTEXT_FACTORY: factory,
      TRELLIS_RUNTIME_CWD: "/workspace",
      TRELLIS_MODEL: "anthropic/claude-sonnet-4.6",
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
      model: "cloudflare/anthropic/claude-sonnet-4.6",
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

  it("writes ordered redacted trace events and replays them over JSON and SSE", async () => {
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
    const skill = vi.fn(async () => ({
      data: {
        decision: "qualified",
        summary: "Qualified with a mocked runtime session.",
        confidence: 0.91,
        matchedEvidence: ["Mocked runtime log"],
        missingEvidence: [],
      },
    }));
    const session = vi.fn(async () => ({ skill }));
    const flueContext = {
      subscribeEvent: vi.fn((callback: (event: Record<string, unknown>) => void | Promise<void>) => {
        void callback({
          type: "log",
          toolName: "provider.lookup",
          message: "Provider lookup finished.",
          body: "do not persist this body",
          prompt: "do not persist this prompt",
          payload: {
            raw: "do not persist provider raw payload",
            count: 2,
          },
        });
        return vi.fn();
      }),
      init: vi.fn(async () => ({ session })),
    };
    const env = {
      TRELLIS_DB: fakeD1,
      TRELLIS_RUNTIME_CONTEXT_FACTORY: vi.fn(async () => flueContext),
    };
    const request = new Request("https://example.com/webhooks/signals", {
      method: "POST",
      body: JSON.stringify({
        id: "sig_events",
        workspaceId: "wrk_events",
        threadId: "thr_events",
        provider: "unit-test",
        source: "unit.trace",
      }),
    });

    const webhook = await runtime.worker.fetch(request, env);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(webhook.status).toBe(202);
    const traceRows = traceEventsFromStatements(fakeD1).filter((event) => event.traceId === "trace_sig_events");
    expect(traceRows.map((event) => event.type)).toEqual([
      "signal.accepted",
      "provider_run.started",
      "skill.started",
      "flue.log",
      "skill.completed",
      "workflow.started",
      "draft.created",
      "approval.waiting",
      "approval.waiting",
      "run.completed",
    ]);
    const flueLog = traceRows.find((event) => event.type === "flue.log");
    expect(flueLog?.payload).toMatchObject({
      type: "log",
      toolName: "provider.lookup",
      message: "Provider lookup finished.",
    });
    expect(JSON.stringify(flueLog?.payload)).not.toContain("do not persist");

    const duplicate = await runtime.worker.fetch(new Request("https://example.com/webhooks/signals", {
      method: "POST",
      body: JSON.stringify({
        id: "sig_events",
        workspaceId: "wrk_events",
        threadId: "thr_events",
        provider: "unit-test",
        source: "unit.trace",
      }),
    }), env);
    expect(duplicate.status).toBe(202);
    const replay = await runtime.worker.fetch(new Request("https://example.com/events?traceId=trace_sig_events&limit=100"), env);
    const replayBody = await replay.json() as { events: Array<{ id: string; type: string }> };
    expect(replay.status).toBe(200);
    expect(replayBody.events.map((event) => event.type)).toEqual(traceRows.map((event) => event.type));
    expect(new Set(replayBody.events.map((event) => event.id)).size).toBe(replayBody.events.length);
    expect(replayBody.events.filter((event) => event.type === "run.completed")).toHaveLength(1);

    const stream = await runtime.worker.fetch(new Request("https://example.com/events/stream?traceId=trace_sig_events"), env);
    const streamText = await stream.text();
    expect(stream.headers.get("content-type")).toContain("text/event-stream");
    expect(streamText).toContain("event: signal.accepted");
    expect(streamText).toContain("event: run.completed");

    const firstEventId = replayBody.events[0]?.id;
    const secondEventId = replayBody.events[1]?.id;
    expect(firstEventId).toBeDefined();
    expect(secondEventId).toBeDefined();
    const afterFirst = await runtime.worker.fetch(new Request("https://example.com/events/stream?traceId=trace_sig_events", {
      headers: { "Last-Event-ID": firstEventId ?? "" },
    }), env);
    const afterFirstText = await afterFirst.text();
    expect(afterFirstText).not.toContain(`id: ${firstEventId}`);
    expect(afterFirstText).toContain(`id: ${secondEventId}`);
  });

  it("delegates Slack webhooks to ChatSDK handlers and handles status/watch/approval actions", async () => {
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
    let handlers: {
      handleSlashCommand(event: unknown): Promise<void>;
      handleAction(event: unknown): Promise<void>;
    } | undefined;
    const slackWebhook = vi.fn(async () => new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    const env = {
      TRELLIS_DB: fakeD1,
      TRELLIS_SLACK_BOT_FACTORY: vi.fn((input: Record<string, unknown>) => {
        handlers = input.handlers as NonNullable<typeof handlers>;
        return {
          webhooks: {
            slack: slackWebhook,
          },
        };
      }),
    };

    const signalWebhook = await runtime.worker.fetch(new Request("https://example.com/webhooks/signals", {
      method: "POST",
      body: JSON.stringify({
        id: "sig_slack",
        workspaceId: "wrk_slack",
        threadId: "thr_slack",
      }),
    }), env);
    const slack = await runtime.worker.fetch(new Request("https://example.com/webhooks/slack", {
      method: "POST",
      body: JSON.stringify({ type: "url_verification" }),
    }), env);

    expect(signalWebhook.status).toBe(202);
    expect(slack.status).toBe(200);
    expect(slackWebhook).toHaveBeenCalledTimes(1);
    expect(handlers).toBeDefined();

    const statusPosts: unknown[] = [];
    await handlers?.handleSlashCommand({
      text: "status trace_sig_slack",
      user: { fullName: "Operator" },
      channel: { post: vi.fn(async (message: unknown) => statusPosts.push(message)) },
    });
    expect(String(statusPosts[0])).toContain("Trellis trace trace_sig_slack");
    expect(String(statusPosts[0])).toContain("Latest: run.completed");

    const watchPosts: unknown[] = [];
    await handlers?.handleSlashCommand({
      text: "watch trace_sig_slack",
      user: { fullName: "Operator" },
      channel: { post: vi.fn(async (message: unknown) => watchPosts.push(message)) },
    });
    const chunks: string[] = [];
    for await (const chunk of watchPosts[0] as AsyncIterable<string>) {
      chunks.push(chunk);
    }
    expect(chunks.join("")).toContain("run.completed");

    const actionThreadPost = vi.fn();
    await handlers?.handleAction({
      actionId: "approve",
      value: JSON.stringify({
        approvalId: "approval_draft_sig_slack_email_send",
        traceId: "trace_sig_slack",
        signalId: "sig_slack",
        action: "email.send",
        draftId: "draft_sig_slack",
      }),
      user: { fullName: "Operator" },
      thread: { post: actionThreadPost },
    });
    expect(actionThreadPost).toHaveBeenCalledWith("Approval approval_draft_sig_slack_email_send approved.");
    expect(fakeD1.statements.some((statement) =>
      statement.sql.includes("UPDATE trellis_approvals SET status = ?")
        && statement.bindings[0] === "approved"
        && statement.bindings[2] === "approval_draft_sig_slack_email_send",
    )).toBe(true);
  });

  it("records Slack notification failures without blocking signal ingestion", async () => {
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
    const env = {
      TRELLIS_DB: fakeD1,
      SLACK_BOT_TOKEN: "xoxb-test",
      SLACK_DEFAULT_CHANNEL: "C123",
      TRELLIS_FETCH: vi.fn(async () => new Response(JSON.stringify({ ok: false, error: "channel_not_found" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })),
    };

    const webhook = await runtime.worker.fetch(new Request("https://example.com/webhooks/signals", {
      method: "POST",
      body: JSON.stringify({
        id: "sig_slack_fail",
        workspaceId: "wrk_slack_fail",
        threadId: "thr_slack_fail",
      }),
    }), env);

    expect(webhook.status).toBe(202);
    expect(traceEventsFromStatements(fakeD1).some((event) => event.type === "slack.notify.failed")).toBe(true);
  });
});

function isTestRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function traceEventsFromStatements(fakeD1: ReturnType<typeof createFakeD1>) {
  return fakeD1.statements
    .filter((statement) => statement.sql.includes("INSERT OR REPLACE INTO trellis_trace_events"))
    .map((statement) => ({
      id: String(statement.bindings[0]),
      traceId: String(statement.bindings[1]),
      signalId: statement.bindings[2] === null ? null : String(statement.bindings[2]),
      workflow: statement.bindings[3] === null ? null : String(statement.bindings[3]),
      span: String(statement.bindings[4]),
      type: String(statement.bindings[5]),
      message: String(statement.bindings[6]),
      payload: parseTestRecordJson(statement.bindings[7]),
      createdAt: String(statement.bindings[8]),
    }));
}

function parseTestRecordJson(value: unknown) {
  if (typeof value !== "string") {
    return {};
  }
  try {
    const parsed = JSON.parse(value);
    return isTestRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function createFakeD1() {
  const statements: Array<{ sql: string; bindings: unknown[] }> = [];
  const signals = new Map<string, Record<string, unknown>>();
  const prospects = new Map<string, Record<string, unknown>>();
  const stateRecords = new Map<string, Record<string, unknown>>();
  const drafts = new Map<string, Record<string, unknown>>();
  const approvals = new Map<string, Record<string, unknown>>();
  const providerRuns = new Map<string, Record<string, unknown>>();
  const providerActions = new Map<string, Record<string, unknown>>();
  const operatorControls = new Map<string, Record<string, unknown>>();
  const workflowRuns = new Map<string, Record<string, unknown>>();
  const auditEvents = new Map<string, Record<string, unknown>>();
  const traceEvents = new Map<string, Record<string, unknown>>();
  const slackThreads = new Map<string, Record<string, unknown>>();
  const smokeRuns = new Map<string, Record<string, unknown>>();
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
              if (normalized.includes("INSERT OR REPLACE INTO trellis_prospects")) {
                prospects.set(String(bindings[0]), {
                  id: bindings[0],
                  signalId: bindings[1],
                  workspaceId: bindings[2],
                  threadId: bindings[3],
                  status: bindings[4],
                  updatedAt: bindings[5],
                });
              }
              if (normalized.includes("INSERT OR REPLACE INTO trellis_state_records")) {
                stateRecords.set(String(bindings[0]), {
                  id: bindings[0],
                  entity: bindings[1],
                  recordId: bindings[2],
                  signalId: bindings[3],
                  workspaceId: bindings[4],
                  threadId: bindings[5],
                  fieldsJson: bindings[6],
                  schemaJson: bindings[7],
                  indexesJson: bindings[8],
                  relationshipsJson: bindings[9],
                  updatedAt: bindings[10],
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
              if (normalized.includes("INSERT OR REPLACE INTO trellis_approvals")) {
                approvals.set(String(bindings[0]), {
                  id: bindings[0],
                  draftId: bindings[1],
                  signalId: bindings[2],
                  action: bindings[3],
                  status: bindings[4],
                  updatedAt: bindings[5],
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
              if (normalized.includes("INSERT OR REPLACE INTO trellis_provider_runs")) {
                providerRuns.set(String(bindings[0]), {
                  id: bindings[0],
                  provider: bindings[1],
                  kind: bindings[2],
                  externalId: bindings[3],
                  status: bindings[4],
                  requestJson: bindings[5],
                  responseJson: bindings[6],
                  error: bindings[7],
                  createdAt: bindings[8],
                  updatedAt: bindings[9],
                });
              }
              if (normalized.includes("INSERT OR REPLACE INTO trellis_workflow_runs")) {
                workflowRuns.set(String(bindings[0]), {
                  id: bindings[0],
                  signalId: bindings[1],
                  workflow: bindings[2],
                  status: bindings[3],
                  paramsJson: bindings[4],
                  updatedAt: bindings[5],
                });
              }
              if (normalized.includes("INSERT OR REPLACE INTO trellis_operator_controls")) {
                operatorControls.set(String(bindings[0]), {
                  id: bindings[0],
                  scope: bindings[1],
                  targetId: bindings[2],
                  status: bindings[3],
                  reason: bindings[4],
                  actor: bindings[5],
                  updatedAt: bindings[6],
                });
              }
              if (normalized.includes("INSERT OR REPLACE INTO trellis_smoke_runs")) {
                smokeRuns.set(String(bindings[0]), {
                  id: bindings[0],
                  agent: bindings[1],
                  status: bindings[2],
                  fixtureId: bindings[3],
                  traceId: bindings[4],
                  checksJson: bindings[5],
                  resultJson: bindings[6],
                  createdAt: bindings[7],
                });
              }
              if (normalized.includes("INSERT OR REPLACE INTO trellis_audit_events")) {
                auditEvents.set(String(bindings[0]), {
                  id: bindings[0],
                  signalId: bindings[1],
                  workflow: bindings[2],
                  type: bindings[3],
                  message: bindings[4],
                  createdAt: bindings[5],
                });
              }
              if (normalized.includes("INSERT OR REPLACE INTO trellis_trace_events")) {
                traceEvents.set(String(bindings[0]), {
                  id: bindings[0],
                  traceId: bindings[1],
                  signalId: bindings[2],
                  workflow: bindings[3],
                  span: bindings[4],
                  type: bindings[5],
                  message: bindings[6],
                  payloadJson: bindings[7],
                  createdAt: bindings[8],
                });
              }
              if (normalized.includes("INSERT OR REPLACE INTO trellis_slack_threads")) {
                slackThreads.set(String(bindings[0]), {
                  traceId: bindings[0],
                  signalId: bindings[1],
                  trellisThreadId: bindings[2],
                  slackChannelId: bindings[3],
                  slackThreadTs: bindings[4],
                  updatedAt: bindings[5],
                });
              }
              if (normalized.includes("UPDATE trellis_provider_actions SET status = ?")) {
                const row = providerActions.get(String(bindings[2]));
                if (row) {
                  row.status = bindings[0];
                  row.updatedAt = bindings[1];
                }
              }
              if (normalized.includes("UPDATE trellis_approvals SET status = ?")) {
                const row = approvals.get(String(bindings[2]));
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
                if (tableName === "trellis_operator_controls") {
                  return { count: operatorControls.size };
                }
                if (tableName === "trellis_workflow_runs") {
                  return { count: workflowRuns.size };
                }
                if (tableName === "trellis_prospects") {
                  return { count: prospects.size };
                }
                if (tableName === "trellis_state_records") {
                  return { count: stateRecords.size };
                }
                if (tableName === "trellis_approvals") {
                  return { count: approvals.size };
                }
                if (tableName === "trellis_provider_runs") {
                  return { count: providerRuns.size };
                }
                if (tableName === "trellis_smoke_runs") {
                  return { count: smokeRuns.size };
                }
                if (tableName === "trellis_audit_events") {
                  return { count: auditEvents.size };
                }
                if (tableName === "trellis_trace_events") {
                  return { count: traceEvents.size };
                }
                if (tableName === "trellis_slack_threads") {
                  return { count: slackThreads.size };
                }
                const count = statements.filter((statement) =>
                  statement.sql.includes(`INSERT OR REPLACE INTO ${tableName}`),
                ).length;
                return { count };
              }
              if (normalized.includes("FROM trellis_approvals WHERE id = ?")) {
                return approvals.get(String(bindings[0])) ?? null;
              }
              if (normalized.includes("FROM trellis_trace_events WHERE trace_id = ? AND id = ?")) {
                return sortRows(traceEvents).find((row) =>
                  row.traceId === bindings[0] && row.id === bindings[1],
                ) ?? null;
              }
              if (normalized.includes("FROM trellis_trace_events WHERE id = ?")) {
                return traceEvents.get(String(bindings[0])) ?? null;
              }
              if (normalized.includes("FROM trellis_provider_actions WHERE id = ?")) {
                return providerActions.get(String(bindings[0])) ?? null;
              }
              if (normalized.includes("FROM trellis_workflow_runs WHERE id = ?")) {
                return workflowRuns.get(String(bindings[0])) ?? null;
              }
              if (normalized.includes("FROM trellis_workflow_runs WHERE signal_id = ?")) {
                return sortRows(workflowRuns).find((row) => row.signalId === bindings[0]) ?? null;
              }
              if (normalized.includes("FROM trellis_drafts WHERE id = ?")) {
                return drafts.get(String(bindings[0])) ?? null;
              }
              if (normalized.includes("FROM trellis_signals WHERE id = ? OR thread_id = ?")) {
                return sortRows(signals).find((row) =>
                  row.id === bindings[0] || row.threadId === bindings[1],
                ) ?? null;
              }
              if (normalized.includes("FROM trellis_signals WHERE id = ?")) {
                return signals.get(String(bindings[0])) ?? null;
              }
              if (normalized.includes("FROM trellis_slack_threads WHERE trace_id = ?")) {
                return slackThreads.get(String(bindings[0])) ?? null;
              }
              if (normalized.includes("FROM trellis_prospects WHERE signal_id = ?")) {
                return sortRows(prospects).find((row) => row.signalId === bindings[0]) ?? null;
              }
              if (normalized.includes("FROM trellis_operator_controls WHERE id = ?")) {
                return operatorControls.get(String(bindings[0])) ?? null;
              }
              return null;
            },
            all() {
              const normalized = sql.replace(/\s+/g, " ").trim();
              const numericBindings = bindings.filter((binding) => Number.isFinite(Number(binding)));
              const limit = Number(numericBindings[numericBindings.length - 1] ?? 20);
              const rows = rowsForSelect(normalized, {
                signals,
                prospects,
                drafts,
                approvals,
                providerActions,
                stateRecords,
                providerRuns,
                workflowRuns,
                auditEvents,
                traceEvents,
                slackThreads,
                smokeRuns,
              }).filter((row) => {
                if (normalized.includes("FROM trellis_workflow_runs") && normalized.includes("WHERE workflow = ?")) {
                  if (row.workflow !== bindings[0]) {
                    return false;
                  }
                  if (normalized.includes("status IN (?, ?)")) {
                    return row.status === bindings[1] || row.status === bindings[2];
                  }
                }
                if (normalized.includes("FROM trellis_signals") && normalized.includes("WHERE thread_id = ?")) {
                  return row.threadId === bindings[0];
                }
                if (!normalized.includes("FROM trellis_trace_events") || !normalized.includes("WHERE trace_id = ?")) {
                  return true;
                }
                if (row.traceId !== bindings[0]) {
                  return false;
                }
                if (!normalized.includes("created_at > ?")) {
                  return true;
                }
                const createdAt = String(row.createdAt ?? "");
                const afterCreatedAt = String(bindings[1] ?? "");
                const afterId = String(bindings[3] ?? "");
                return createdAt > afterCreatedAt || (createdAt === afterCreatedAt && String(row.id) > afterId);
              });
              return {
                results: rows.slice(0, Number.isFinite(limit) ? limit : 20),
              };
            },
          };
        },
      };
    },
  };
}

function rowsForSelect(
  normalizedSql: string,
  tables: Record<string, Map<string, Record<string, unknown>>>,
) {
  if (normalizedSql.includes("FROM trellis_signals")) {
    return sortRows(tables.signals);
  }
  if (normalizedSql.includes("FROM trellis_prospects")) {
    return sortRows(tables.prospects);
  }
  if (normalizedSql.includes("FROM trellis_state_records")) {
    return sortRows(tables.stateRecords);
  }
  if (normalizedSql.includes("FROM trellis_drafts")) {
    return sortRows(tables.drafts);
  }
  if (normalizedSql.includes("FROM trellis_approvals")) {
    return sortRows(tables.approvals);
  }
  if (normalizedSql.includes("FROM trellis_provider_actions")) {
    return sortRows(tables.providerActions);
  }
  if (normalizedSql.includes("FROM trellis_provider_runs")) {
    return sortRows(tables.providerRuns);
  }
  if (normalizedSql.includes("FROM trellis_workflow_runs")) {
    return sortRows(tables.workflowRuns);
  }
  if (normalizedSql.includes("FROM trellis_audit_events")) {
    return sortRows(tables.auditEvents);
  }
  if (normalizedSql.includes("FROM trellis_trace_events")) {
    return sortRows(tables.traceEvents);
  }
  if (normalizedSql.includes("FROM trellis_slack_threads")) {
    return sortRows(tables.slackThreads);
  }
  if (normalizedSql.includes("FROM trellis_smoke_runs")) {
    return sortRows(tables.smokeRuns);
  }
  return [];
}

function sortRows(rows: Map<string, Record<string, unknown>> | undefined) {
  return Array.from(rows?.values() ?? []).sort((left, right) =>
    String(right.updatedAt ?? right.createdAt ?? "").localeCompare(String(left.updatedAt ?? left.createdAt ?? "")),
  );
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
  const sleeps: Array<{ name: string; duration: string | number }> = [];
  return {
    steps,
    sleeps,
    async do<T>(name: string, callback: () => Promise<T> | T) {
      steps.push(name);
      return await callback();
    },
    async sleep(name: string, duration: string | number) {
      steps.push(name);
      sleeps.push({ name, duration });
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

function createProviderActionFakeD1(action: {
  id: string;
  approvalId: string;
  signalId: string;
  provider: string;
  operation: string;
  status: string;
  traceId: string;
}) {
  const fakeD1 = createFakeD1();
  fakeD1.prepare(`
    INSERT OR REPLACE INTO trellis_provider_actions (
      id, approval_id, signal_id, draft_id, provider, operation, status, trace_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    action.id,
    action.approvalId,
    action.signalId,
    null,
    action.provider,
    action.operation,
    action.status,
    action.traceId,
    new Date().toISOString(),
    new Date().toISOString(),
  ).run();
  fakeD1.prepare(`
    INSERT OR REPLACE INTO trellis_approvals (
      id, draft_id, signal_id, action, status, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    action.approvalId,
    null,
    action.signalId,
    action.operation,
    "approved",
    new Date().toISOString(),
  ).run();
  return fakeD1;
}
