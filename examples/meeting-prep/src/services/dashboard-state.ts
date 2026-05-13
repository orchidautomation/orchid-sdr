import type { AppContext } from "./runtime-context.js";

export class DashboardStateService {
  constructor(private readonly context: AppContext) {}

  async getState() {
    const snapshot = await this.context.repository.getRuntimeSnapshot(24);
    return {
      service: "trellis-meeting-prep",
      noSendsMode: this.context.config.NO_SENDS_MODE,
      totalMeetings: snapshot.totalMeetings,
      recentItems: snapshot.meetings,
      recentEvents: snapshot.recentAuditEvents,
    };
  }

  async getCoreState() {
    const items = await this.context.repository.listMeetings(12);
    return { items };
  }

  async getRuntimeState() {
    return {
      rivetRemote: this.context.framework.selections.runtimeActor.providerId === "rivet" && Boolean(this.context.config.RIVET_ENDPOINT),
      sandboxEnabled: this.context.framework.selections.runtimeSandbox.providerId === "vercel-sandbox",
      mcpProvider: this.context.framework.selections.mcp.providerId,
    };
  }
}
