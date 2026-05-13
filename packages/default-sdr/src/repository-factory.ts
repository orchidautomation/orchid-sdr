import type { TrellisRepositoryPort } from "./repository-contracts.js";
import { ConvexRepository } from "./convex-repository.js";
import { LocalSmokeRepository } from "./local-smoke-repository.js";

export function shouldUseDefaultSdrLocalSmokeMode(enabled: boolean | undefined) {
  return Boolean(enabled);
}

export function createDefaultSdrRepository(input: {
  localSmokeMode: boolean;
  defaultCampaignTimezone: string;
  stateProviderId: string | null | undefined;
  convexUrl?: string | null;
}): TrellisRepositoryPort {
  if (input.localSmokeMode) {
    return new LocalSmokeRepository(input.defaultCampaignTimezone);
  }

  if (input.stateProviderId === "convex") {
    if (!input.convexUrl) {
      throw new Error("CONVEX_URL or NEXT_PUBLIC_CONVEX_URL is required when the Convex state provider is enabled.");
    }

    return new ConvexRepository(input.convexUrl, input.defaultCampaignTimezone);
  }

  throw new Error(`unsupported default SDR state provider: ${input.stateProviderId ?? "none"}`);
}
