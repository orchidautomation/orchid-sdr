import type { DashboardProspectRow, DashboardProviderRunRow } from "../repository.js";

export const DASHBOARD_BURST_WINDOW_MS = 15 * 60 * 1000;

export type OperatorState =
  | "qualifying"
  | "progressing"
  | "paused"
  | "failed"
  | "rejected"
  | "completed";

export interface DecoratedDashboardProspectRow extends DashboardProspectRow {
  operatorState: OperatorState;
  operatorLabel: string;
  operatorTone: "success" | "warn" | "danger" | "";
  workflowLabel: string;
  workflowDetail: string | null;
  sourceLabel: string;
  sourceCapturedAt: string | null;
  rowTimestamp: string;
  isFresh: boolean;
  freshnessLabel: string;
}

export interface DashboardWorkflowStats {
  freshRows: number;
  qualifyingRows: number;
  progressingRows: number;
  pausedRows: number;
  failedRows: number;
  rejectedRows: number;
  completedRows: number;
  providerFailures: number;
}

export function decorateDashboardProspects(
  prospects: DashboardProspectRow[],
  providerRuns: DashboardProviderRunRow[],
  now = new Date(),
): {
  rows: DecoratedDashboardProspectRow[];
  stats: DashboardWorkflowStats;
  burstWindowStart: string | null;
  freshestTimestamp: string | null;
} {
  const newestTimestampMs = prospects.reduce<number>((latest, prospect) => {
    const value = getRowTimestampMs(prospect);
    return value > latest ? value : latest;
  }, 0);
  const freshCutoffMs = newestTimestampMs > 0 ? newestTimestampMs - DASHBOARD_BURST_WINDOW_MS : 0;

  const rows = prospects
    .map((prospect) => decorateProspect(prospect, freshCutoffMs))
    .sort((left, right) => {
      if (left.isFresh !== right.isFresh) {
        return left.isFresh ? -1 : 1;
      }
      return Date.parse(right.rowTimestamp) - Date.parse(left.rowTimestamp);
    });

  return {
    rows,
    stats: {
      freshRows: rows.filter((row) => row.isFresh).length,
      qualifyingRows: rows.filter((row) => row.operatorState === "qualifying").length,
      progressingRows: rows.filter((row) => row.operatorState === "progressing").length,
      pausedRows: rows.filter((row) => row.operatorState === "paused").length,
      failedRows: rows.filter((row) => row.operatorState === "failed").length,
      rejectedRows: rows.filter((row) => row.operatorState === "rejected").length,
      completedRows: rows.filter((row) => row.operatorState === "completed").length,
      providerFailures: providerRuns.filter((run) => isProviderFailure(run.status)).length,
    },
    burstWindowStart: freshCutoffMs > 0 ? new Date(freshCutoffMs).toISOString() : null,
    freshestTimestamp: newestTimestampMs > 0 ? new Date(newestTimestampMs).toISOString() : null,
  };
}

function decorateProspect(
  prospect: DashboardProspectRow,
  freshCutoffMs: number,
): DecoratedDashboardProspectRow {
  const operatorState = classifyOperatorState(prospect);
  const sourceTimestamp = prospect.sourceCapturedAt ?? null;
  const rowTimestamp = new Date(getRowTimestampMs(prospect)).toISOString();
  const isFresh = freshCutoffMs > 0 && Date.parse(rowTimestamp) >= freshCutoffMs;

  return {
    ...prospect,
    operatorState,
    operatorLabel: operatorStateLabel(operatorState),
    operatorTone: operatorStateTone(operatorState),
    workflowLabel: workflowStageLabel(prospect.threadStage ?? prospect.stage),
    workflowDetail: buildWorkflowDetail(prospect),
    sourceLabel: buildSourceLabel(prospect.source),
    sourceCapturedAt: sourceTimestamp,
    rowTimestamp,
    isFresh,
    freshnessLabel: isFresh ? "Fresh burst row" : "Older row",
  };
}

function classifyOperatorState(prospect: DashboardProspectRow): OperatorState {
  const status = prospect.threadStatus ?? prospect.status;
  const stage = prospect.threadStage ?? prospect.stage;
  const pausedReason = prospect.threadPausedReason ?? prospect.pausedReason ?? "";
  const qualificationReason = prospect.qualification?.reason ?? prospect.qualificationReason ?? "";

  if (status === "completed") {
    return "completed";
  }

  if (isRejectedReason(pausedReason) || isRejectedReason(qualificationReason) || prospect.qualification?.decision === "rejected") {
    return "rejected";
  }

  if (status === "paused") {
    return isFailureReason(pausedReason) ? "failed" : "paused";
  }

  if (stage === "capture_signal" || stage === "qualify") {
    return "qualifying";
  }

  return "progressing";
}

function getRowTimestampMs(prospect: DashboardProspectRow) {
  return Date.parse(prospect.sourceCapturedAt ?? prospect.updatedAt);
}

function buildWorkflowDetail(prospect: DashboardProspectRow) {
  const pausedReason = prospect.threadPausedReason ?? prospect.pausedReason;
  if (pausedReason) {
    return pausedReason;
  }
  if (prospect.qualification?.summary) {
    return prospect.qualification.summary;
  }
  if (prospect.qualificationReason) {
    return prospect.qualificationReason;
  }
  return null;
}

function buildSourceLabel(source: string | null | undefined) {
  if (!source) {
    return "Unknown source";
  }

  if (source === "linkedin_public_post") {
    return "LinkedIn";
  }

  if (source === "x_public_post") {
    return "X";
  }

  return source.replaceAll("_", " ");
}

function workflowStageLabel(stage: string) {
  switch (stage) {
    case "capture_signal":
      return "Signal capture";
    case "qualify":
      return "Qualification";
    case "enrich_email":
      return "Email enrichment";
    case "build_research_brief":
      return "Research brief";
    case "first_outbound":
      return "First outbound";
    case "await_reply":
      return "Awaiting reply";
    case "classify_reply":
      return "Reply classification";
    case "respond_or_handoff":
      return "Respond or handoff";
    case "schedule_followup":
      return "Schedule follow-up";
    default:
      return stage.replaceAll("_", " ");
  }
}

function operatorStateLabel(state: OperatorState) {
  switch (state) {
    case "qualifying":
      return "Qualifying";
    case "progressing":
      return "Progressing";
    case "paused":
      return "Paused";
    case "failed":
      return "Failed";
    case "rejected":
      return "Rejected";
    case "completed":
      return "Completed";
  }
}

function operatorStateTone(state: OperatorState): "success" | "warn" | "danger" | "" {
  switch (state) {
    case "completed":
      return "success";
    case "progressing":
    case "qualifying":
      return "warn";
    case "paused":
      return "";
    case "failed":
    case "rejected":
      return "danger";
  }
}

function isRejectedReason(reason: string) {
  return reason.startsWith("poor fit:");
}

function isFailureReason(reason: string) {
  if (!reason) {
    return false;
  }

  const normalized = reason.toLowerCase();
  if (
    normalized === "no sends mode"
    || normalized.startsWith("handoff:")
    || normalized.includes("campaign is paused")
    || normalized.includes("thread is paused")
    || normalized.includes("linkedin source disabled")
  ) {
    return false;
  }

  return /(fail|error|blocked|missing|disabled|invalid|timeout|timed out)/i.test(reason);
}

function isProviderFailure(status: string) {
  return status === "failed" || status === "aborted" || status === "timed_out";
}
