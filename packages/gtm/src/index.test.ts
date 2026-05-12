import { describe, expect, it } from "vitest";

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
      requireApproval: ["email.send", "crm.update"],
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
  });

  it("runs the v3 smoke workflow as a real safe fixture", async () => {
    const result = await runTrellisSmoke();

    expect(result.ok).toBe(true);
    expect(result.externalWrites).toBe(false);
    expect(result.noSendsMode).toBe(true);
    expect(result.fixture.id).toBe("sig_smoke_001");
    expect(result.skillCalls.map((call) => call.name)).toEqual(["icp-qualification"]);
    expect(result.startedWorkflows.map((workflow) => workflow.name)).toEqual(["prospect"]);
    expect(result.prospects).toHaveLength(1);
    expect(result.drafts).toEqual([
      expect.objectContaining({
        status: "blocked_pending_approval",
        approvalRequiredFor: ["email.send", "crm.update"],
      }),
    ]);
    expect(result.approvals).toEqual([
      expect.objectContaining({ action: "email.send", status: "pending" }),
      expect.objectContaining({ action: "crm.update", status: "pending" }),
    ]);
    expect(result.auditEvents.map((event) => event.type)).toEqual([
      "signal.accepted",
      "skill.completed",
      "workflow.started",
      "draft.created",
    ]);
    expect(result.checks.every((check) => check.status === "pass")).toBe(true);
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
    const env = {
      TRELLIS_DB: fakeD1,
      TRELLIS_EVENTS: fakeQueue,
      TRELLIS_PACKS: fakeR2,
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
        },
        skills: {
          objects: 1,
        },
      },
    });
    await expect(webhook.json()).resolves.toMatchObject({
      ok: true,
      accepted: true,
      mode: "processed",
      signal: {
        id: "sig_live",
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
    expect(fakeD1.statements.some((statement) => statement.sql.includes("INSERT OR REPLACE INTO trellis_audit_events"))).toBe(true);
    expect(fakeD1.statements.some((statement) => statement.sql.includes("UPDATE trellis_approvals SET status = ?"))).toBe(true);
    expect(fakeD1.statements.some((statement) => statement.sql.includes("UPDATE trellis_provider_actions SET status = ?"))).toBe(true);
    expect(fakeQueue.messages).toEqual([
      expect.objectContaining({
        type: "trellis.signal.processed",
        signalId: "sig_live",
        workspaceId: "wrk_live",
      }),
      expect.objectContaining({
        type: "trellis.approval.decided",
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
          traceId: "trace_sig_live_approval_draft_sig_live_email_send",
        }),
      }),
      expect.objectContaining({
        type: "trellis.provider.action.failed",
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
          auditEvents: 7,
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
    expect(dashboardHtml).toContain("<dt>Knowledge Files</dt><dd>1</dd>");
    expect(dashboardHtml).toContain("<dt>Skill Files</dt><dd>1</dd>");
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
        traceId: "trace_sig_live_approval_draft_sig_live_email_send",
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
});

function createFakeD1() {
  const statements: Array<{ sql: string; bindings: unknown[] }> = [];
  return {
    statements,
    prepare(sql: string) {
      return {
        bind(...bindings: unknown[]) {
          return {
            run() {
              statements.push({
                sql: sql.replace(/\s+/g, " ").trim(),
                bindings,
              });
              return { success: true };
            },
            first() {
              const normalized = sql.replace(/\s+/g, " ").trim();
              const match = normalized.match(/^SELECT COUNT\(\*\) AS count FROM (\w+)$/i);
              const tableName = match?.[1];
              if (!tableName) {
                return null;
              }
              const count = statements.filter((statement) =>
                statement.sql.includes(`INSERT OR REPLACE INTO ${tableName}`),
              ).length;
              return { count };
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
