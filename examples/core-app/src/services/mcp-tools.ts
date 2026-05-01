import type { AppContext } from "./runtime-context.js";

export class TrellisCoreMcpToolService {
  constructor(private readonly context: AppContext) {}

  async listWorkItems(limit = 10) {
    return await this.context.repository.listWorkItems(limit);
  }

  async getWorkItem(workItemId: string) {
    return await this.context.repository.getWorkItemDetail(workItemId);
  }

  async searchKnowledge(query: string, limit = 5) {
    return await this.context.knowledge.search(query, limit);
  }
}

