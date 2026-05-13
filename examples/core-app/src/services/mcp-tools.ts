import type { AppContext } from "./runtime-context.js";

export class TrellisCoreMcpToolService {
  constructor(private readonly context: AppContext) {}

  async listIntakeEvents(limit = 10) {
    return await this.context.repository.listIntakeEvents(limit);
  }

  async getIntakeEvent(intakeEventId: string) {
    return await this.context.repository.getIntakeEventDetail(intakeEventId);
  }

  async searchKnowledge(query: string, limit = 5) {
    return await this.context.knowledge.search(query, limit);
  }
}
