import type { AppContext } from "./runtime-context.js";

export class TrellisCoreMcpToolService {
  constructor(private readonly context: AppContext) {}

  async listMeetings(limit = 10) {
    return await this.context.repository.listMeetings(limit);
  }

  async getMeeting(meetingId: string) {
    return await this.context.repository.getMeetingDetail(meetingId);
  }

  async searchKnowledge(query: string, limit = 5) {
    return await this.context.knowledge.search(query, limit);
  }
}
