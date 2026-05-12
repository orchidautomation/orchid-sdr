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

    const health = await runtime.worker.fetch(new Request("https://example.com/healthz"), {});
    const smoke = await runtime.worker.fetch(new Request("https://example.com/smoke"), {});
    const webhook = await runtime.worker.fetch(new Request("https://example.com/webhooks/signals", {
      method: "POST",
      body: JSON.stringify({ id: "sig" }),
    }), {});
    const mcp = await runtime.worker.fetch(new Request("https://example.com/mcp/trellis"), {});
    const dashboard = await runtime.worker.fetch(new Request("https://example.com/dashboard"), {});

    await expect(health.json()).resolves.toMatchObject({
      ok: true,
      stack: "trellis-v3-cloudflare",
    });
    await expect(smoke.json()).resolves.toMatchObject({
      ok: true,
      mode: "safe-fixture",
    });
    await expect(webhook.json()).resolves.toMatchObject({
      ok: true,
      accepted: true,
      noSendsMode: true,
    });
    await expect(mcp.json()).resolves.toMatchObject({
      ok: true,
      tools: expect.arrayContaining(["trellis.smoke", "trellis.workflow.inspect"]),
    });
    await expect(dashboard.text()).resolves.toContain("v3 Cloudflare GTM runtime");
  });
});
