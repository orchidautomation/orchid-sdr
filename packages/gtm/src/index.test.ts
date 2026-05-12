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
    };

    const health = await runtime.worker.fetch(new Request("https://example.com/healthz"), env);
    const smoke = await runtime.worker.fetch(new Request("https://example.com/smoke"), {});
    const webhook = await runtime.worker.fetch(new Request("https://example.com/webhooks/signals", {
      method: "POST",
      body: JSON.stringify({
        id: "sig_live",
        workspaceId: "wrk_live",
        threadId: "thr_live",
        provider: "test",
        source: "unit.test",
      }),
    }), env);
    const mcp = await runtime.worker.fetch(new Request("https://example.com/mcp/trellis"), env);
    const dashboard = await runtime.worker.fetch(new Request("https://example.com/dashboard"), env);
    const approval = await runtime.worker.fetch(new Request("https://example.com/approvals/approval_draft_sig_live_email_send/approve", {
      method: "POST",
      body: JSON.stringify({
        signalId: "sig_live",
        actor: "operator@example.com",
        reason: "Fixture approval.",
      }),
    }), env);

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
    await expect(webhook.json()).resolves.toMatchObject({
      ok: true,
      accepted: true,
      mode: "processed",
      signal: {
        id: "sig_live",
        workspaceId: "wrk_live",
        threadId: "thr_live",
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
      noSendsMode: true,
    });
    expect(fakeD1.statements.some((statement) => statement.sql.includes("CREATE TABLE IF NOT EXISTS trellis_signals"))).toBe(true);
    expect(fakeD1.statements.some((statement) => statement.sql.includes("INSERT OR REPLACE INTO trellis_signals"))).toBe(true);
    expect(fakeD1.statements.some((statement) => statement.sql.includes("INSERT OR REPLACE INTO trellis_prospects"))).toBe(true);
    expect(fakeD1.statements.some((statement) => statement.sql.includes("INSERT OR REPLACE INTO trellis_drafts"))).toBe(true);
    expect(fakeD1.statements.some((statement) => statement.sql.includes("INSERT OR REPLACE INTO trellis_approvals"))).toBe(true);
    expect(fakeD1.statements.some((statement) => statement.sql.includes("INSERT OR REPLACE INTO trellis_audit_events"))).toBe(true);
    expect(fakeD1.statements.some((statement) => statement.sql.includes("UPDATE trellis_approvals SET status = ?"))).toBe(true);
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
          auditEvents: 4,
        },
      },
      tools: expect.arrayContaining(["trellis.smoke", "trellis.workflow.inspect", "trellis.approval.approve"]),
    });
    const dashboardHtml = await dashboard.text();
    expect(dashboardHtml).toContain("v3 Cloudflare GTM runtime");
    expect(dashboardHtml).toContain("<dt>Signals</dt><dd>1</dd>");
    expect(dashboardHtml).toContain("<dt>Prospects</dt><dd>1</dd>");
    expect(dashboardHtml).toContain("<dt>Drafts</dt><dd>1</dd>");
    expect(dashboardHtml).toContain("<dt>Approvals</dt><dd>2</dd>");
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
