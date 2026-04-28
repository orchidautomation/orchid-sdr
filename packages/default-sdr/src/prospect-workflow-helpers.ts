export interface DefaultSdrProspectLike {
  prospect: {
    prospectId: string;
  };
  thread: {
    id: string;
    stage: string;
  };
}

export interface DefaultSdrPausedWorkflowOutcome {
  action: "paused";
  prospectId: string;
  threadId: string;
  reason?: string;
}

export interface DefaultSdrWorkflowRepository {
  pauseThread(threadId: string, reason: string): Promise<void>;
  appendAuditEvent(
    entityType: string,
    entityId: string,
    eventName: string,
    payload: Record<string, unknown>,
  ): Promise<void>;
  updateThreadState(input: {
    threadId: string;
    stage?: string;
    status?: string;
    pausedReason?: string | null;
  }): Promise<void>;
  updateProspectState(input: {
    prospectId: string;
    stage?: string;
    status?: string;
    pausedReason?: string | null;
  }): Promise<void>;
  touchThreadFollowup(threadId: string, dateIso: string | null): Promise<void>;
}

export async function pauseThreadWithAudit(
  repository: DefaultSdrWorkflowRepository,
  threadId: string,
  reason: string,
) {
  await repository.pauseThread(threadId, reason);
  await repository.appendAuditEvent("thread", threadId, "ThreadPaused", {
    reason,
  });
}

export async function activateProspectStage(
  repository: DefaultSdrWorkflowRepository,
  input: {
    threadId: string;
    prospectId: string;
    stage: string;
  },
) {
  await repository.updateThreadState({
    threadId: input.threadId,
    stage: input.stage,
    status: "active",
    pausedReason: null,
  });
  await repository.updateProspectState({
    prospectId: input.prospectId,
    stage: input.stage,
    status: "active",
    pausedReason: null,
  });
}

export async function scheduleFollowupAfterDelay(
  repository: DefaultSdrWorkflowRepository,
  threadId: string,
  delayMs: number,
  now = Date.now(),
) {
  await repository.touchThreadFollowup(
    threadId,
    new Date(now + delayMs).toISOString(),
  );
}

export function pausedWorkflowOutcome(
  snapshot: DefaultSdrProspectLike,
  reason: string,
): DefaultSdrPausedWorkflowOutcome {
  return {
    action: "paused",
    prospectId: snapshot.prospect.prospectId,
    threadId: snapshot.thread.id,
    reason,
  };
}
