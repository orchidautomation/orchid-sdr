export const lifecycleStages = [
  "capture_signal",
  "qualify",
  "enrich_email",
  "build_research_brief",
  "first_outbound",
  "await_reply",
  "classify_reply",
  "respond_or_handoff",
  "schedule_followup",
] as const;

export type LifecycleStage = (typeof lifecycleStages)[number];

export const replyClasses = [
  "positive",
  "soft_interest",
  "objection",
  "referral",
  "not_now",
  "ooo",
  "wrong_person",
  "unsubscribe",
  "bounce",
  "spam_risk",
  "needs_human",
] as const;

export type ReplyClass = (typeof replyClasses)[number];

export type SignalSource = "linkedin_public_post" | "x_public_post" | "manual" | "other" | (string & {});

export type DiscoverySource = Extract<SignalSource, "linkedin_public_post" | "x_public_post">;

export type ThreadStatus = "active" | "paused" | "completed";

export type SendKind = "first_outbound" | "reply" | "follow_up";

export type InternalEventName =
  | "SignalCaptured"
  | "LeadQualified"
  | "EmailEnriched"
  | "ResearchReady"
  | "OutboundSent"
  | "ReplyReceived"
  | "ReplyClassified"
  | "HandoffRequested"
  | "ThreadPaused";

export interface SignalRecord {
  id: string;
  source: SignalSource;
  sourceRef: string;
  actorRunId?: string | null;
  url: string;
  authorName: string;
  authorTitle?: string | null;
  authorCompany?: string | null;
  companyDomain?: string | null;
  topic: string;
  content: string;
  capturedAt: number;
  metadata: Record<string, unknown>;
}

export interface ProspectContext {
  prospectId: string;
  accountId: string | null;
  campaignId: string;
  fullName: string;
  firstName: string;
  title: string | null;
  company: string | null;
  companyDomain: string | null;
  linkedinUrl: string | null;
  sourceSignalId: string | null;
  status: ThreadStatus;
  stage: LifecycleStage;
  lastReplyClass: ReplyClass | null;
  pausedReason: string | null;
}

export interface ResearchBrief {
  id: string;
  prospectId: string;
  campaignId: string;
  summary: string;
  evidence: Array<{
    title: string;
    url: string;
    note: string;
  }>;
  confidence: number;
  createdAt: number;
}

export interface ContactEmail {
  address: string;
  confidence: number;
  source: string;
}

export interface QualificationCheck {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
  kind: "required" | "fit" | "supporting" | "negative";
}

export interface QualificationAssessment {
  engine: string;
  ruleVersion: string;
  decision: "qualified" | "rejected";
  ok: boolean;
  reason: string;
  summary: string;
  confidence: number;
  matchedSegments: string[];
  matchedSignals: string[];
  disqualifiers: string[];
  dimensions?: {
    personQualified: boolean;
    companyQualified: boolean;
    signalQualified: boolean;
    negativeSignalsPresent: boolean;
  };
  missingEvidence?: string[];
  checks: QualificationCheck[];
}

export interface SendAuthorityResult {
  allowed: boolean;
  reasons: string[];
  policyPass: boolean;
}

export interface SandboxTurnRequest {
  turnId: string;
  prospectId: string;
  campaignId: string;
  stage:
    | Exclude<LifecycleStage, "capture_signal" | "enrich_email" | "schedule_followup">
    | "discovery";
  systemPrompt: string;
  prompt: string;
  metadata: Record<string, unknown>;
}

export interface SandboxTurnResponse {
  turnId: string;
  outputText: string;
  transcript: unknown[];
  usage?: Record<string, unknown>;
}
