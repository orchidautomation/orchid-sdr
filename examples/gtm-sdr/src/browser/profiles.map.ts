import type { TrellisBrowserProfileMap } from "@trellis/gtm";

const browserProfiles = {
  defaultProfile: "research",
  profiles: {
    research: {
      viewport: {
        width: 1440,
        height: 1200,
      },
      locale: "en-US",
      timezoneId: "America/New_York",
      blockedResourceTypes: ["font", "media"],
    },
    qa: {
      viewport: {
        width: 1280,
        height: 900,
      },
      locale: "en-US",
      waitFor: "networkidle",
    },
  },
} satisfies TrellisBrowserProfileMap;

export default browserProfiles;
