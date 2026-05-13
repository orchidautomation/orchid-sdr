import { describe, expect, it } from "vitest";

import { getFrameworkRuntimeConfig } from "../src/services/framework-stack.js";
import { buildRuntimeReadinessChecks } from "../src/services/doctor-readiness.js";

describe("buildRuntimeReadinessChecks", () => {
  const framework = getFrameworkRuntimeConfig();

  it("reports boot and discovery blockers when required env is missing", () => {
    const checks = buildRuntimeReadinessChecks({
      env: {},
      framework,
    });

    expect(checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "boot readiness: Convex state plane URL",
          ok: false,
          severity: "error",
        }),
        expect.objectContaining({
          label: "boot readiness: sandbox token",
          ok: false,
          severity: "error",
        }),
        expect.objectContaining({
          label: "boot readiness: handoff webhook secret",
          ok: false,
          severity: "error",
        }),
        expect.objectContaining({
          label: "LinkedIn discovery readiness: APIFY_TOKEN",
          ok: false,
          severity: "error",
        }),
        expect.objectContaining({
          label: "LinkedIn discovery readiness: keyword search actor/task",
          ok: false,
          severity: "error",
        }),
      ]),
    );
  });

  it("treats exact-post and profile/company research as separate readiness lanes", () => {
    const checks = buildRuntimeReadinessChecks({
      env: {
        CONVEX_URL: "https://example.convex.cloud",
        TRELLIS_SANDBOX_TOKEN: "sandbox-token",
        HANDOFF_WEBHOOK_SECRET: "handoff-secret",
        APIFY_TOKEN: "apify-token",
        APIFY_LINKEDIN_ACTOR_ID: "harvestapi/linkedin-post-search",
      },
      framework,
    });

    expect(checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "LinkedIn discovery readiness: keyword search actor/task",
          ok: true,
        }),
        expect.objectContaining({
          label: "Exact LinkedIn post discovery readiness",
          ok: false,
          severity: "warning",
        }),
        expect.objectContaining({
          label: "LinkedIn profile/company research readiness",
          ok: false,
          severity: "warning",
        }),
      ]),
    );
  });

  it("passes the readiness checks when the full LinkedIn discovery stack is configured", () => {
    const checks = buildRuntimeReadinessChecks({
      env: {
        CONVEX_URL: "https://example.convex.cloud",
        TRELLIS_SANDBOX_TOKEN: "sandbox-token",
        HANDOFF_WEBHOOK_SECRET: "handoff-secret",
        APIFY_TOKEN: "apify-token",
        APIFY_LINKEDIN_ACTOR_ID: "harvestapi/linkedin-post-search",
        APIFY_LINKEDIN_POSTS_ACTOR_ID: "harvestapi/linkedin-profile-posts",
        APIFY_LINKEDIN_PROFILE_ACTOR_ID: "harvestapi/linkedin-profile-scraper",
      },
      framework,
    });

    expect(checks.every((check) => check.ok)).toBe(true);
  });

  it("downgrades Convex and discovery requirements in local smoke mode", () => {
    const checks = buildRuntimeReadinessChecks({
      env: {
        TRELLIS_LOCAL_SMOKE_MODE: "true",
        TRELLIS_SANDBOX_TOKEN: "sandbox-token",
        HANDOFF_WEBHOOK_SECRET: "handoff-secret",
      },
      framework,
    });

    expect(checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "local smoke mode",
          ok: true,
          severity: "info",
        }),
        expect.objectContaining({
          label: "LinkedIn discovery readiness: APIFY_TOKEN",
          ok: false,
          severity: "warning",
        }),
        expect.objectContaining({
          label: "LinkedIn discovery readiness: keyword search actor/task",
          ok: false,
          severity: "warning",
        }),
      ]),
    );
    expect(checks.some((check) => check.label === "boot readiness: Convex state plane URL")).toBe(false);
  });
});
