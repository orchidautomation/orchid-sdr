import type { MessageInsertInput, ProspectSnapshot } from "../repository.js";
import { extractJsonObject } from "../lib/json.js";
import { extractCompanyLinkedinUrl, extractCompanyResearchUrl, extractLinkedinProfileUrl } from "../lib/signal-urls.js";
import type { QualificationAssessment, ReplyClass, ResearchBrief, SandboxTurnRequest } from "../domain/types.js";
import {
  buildQualificationInput,
  heuristicIcpQualification,
  shouldRejectAtSignalTriage,
} from "../services/qualification-engine.js";
import type { WorkflowDependencies, WorkflowOutcome } from "./types.js";
import { getAutomationPauseReason } from "./workflow-control.js";

const FOLLOWUP_DELAY_MS = 3 * 24 * 60 * 60 * 1000;

interface DraftEmailOutput {
  subject: string;
  bodyText: string;
}

interface DraftReplyOutput extends DraftEmailOutput {
  action?: "reply" | "handoff";
  reason?: string;
}

interface ResearchOutput {
  summary: string;
  confidence: number;
  copyGuidance: {
    primaryAngle: string;
    bestOpeningHook: string;
    whyNow: string;
    avoidMentioning: string[];
    ctaSuggestion: string;
  } | null;
  evidence: Array<{
    title: string;
    url: string;
    note: string;
  }>;
}

export interface DraftPreview {
  kind: "first_outbound" | "follow_up" | "reply";
  subject: string;
  bodyText: string;
  generatedBy: "sandbox" | "fallback";
  action?: "reply" | "handoff";
  reason?: string;
  fallbackReason?: string;
}

interface DraftFact {
  label: string;
  detail: string;
}

type PreviewDraftResult<T> = T & {
  generatedBy: "sandbox" | "fallback";
  fallbackReason?: string;
};

async function runPreviewDraft<T extends DraftEmailOutput | DraftReplyOutput>(
  buildDraft: () => Promise<T>,
  buildFallback: () => T,
): Promise<PreviewDraftResult<T>> {
  try {
    const draft = await buildDraft();
    return {
      ...draft,
      generatedBy: "sandbox",
    };
  } catch (error) {
    return {
      ...buildFallback(),
      generatedBy: "fallback",
      fallbackReason: error instanceof Error ? error.message : String(error),
    };
  }
}

function buildFirstOutboundFallback(snapshot: ProspectSnapshot): DraftEmailOutput {
  const hook =
    snapshot.researchBrief?.copyGuidance?.bestOpeningHook
    ?? snapshot.researchBrief?.evidence[0]?.title
    ?? "your team's recent work";
  const whyNow =
    snapshot.researchBrief?.copyGuidance?.whyNow
    ?? "We help teams turn signal-driven workflow ideas into grounded, production-ready outbound systems.";
  const cta =
    snapshot.researchBrief?.copyGuidance?.ctaSuggestion
    ?? "If useful, I can send a short teardown.";

  return {
    subject: `Quick question, ${snapshot.prospect.firstName}`,
    bodyText: [
      `Hi ${snapshot.prospect.firstName},`,
      "",
      `Thought you might appreciate a quick note about ${hook}.`,
      whyNow,
      "",
      cta,
      "",
      "Best,",
      "Team",
    ].join("\n"),
  };
}

function buildFollowupFallback(snapshot: ProspectSnapshot): DraftEmailOutput {
  const cta =
    snapshot.researchBrief?.copyGuidance?.ctaSuggestion
    ?? "If you're working through outbound, research automation, or human handoff design, I can send a concrete outline instead of a pitch.";

  return {
    subject: `Following up, ${snapshot.prospect.firstName}`,
    bodyText: [
      `Hi ${snapshot.prospect.firstName},`,
      "",
      "Following up in case the earlier note was useful.",
      cta,
      "",
      "Best,",
      "Team",
    ].join("\n"),
  };
}

function buildReplyFallback(snapshot: ProspectSnapshot): DraftReplyOutput {
  return {
    action: "reply",
    subject: `Re: ${snapshot.messages.findLast((message) => message.subject)?.subject ?? "follow up"}`,
    bodyText: [
      `Hi ${snapshot.prospect.firstName},`,
      "",
      "Appreciate the reply.",
      "If helpful, I can send a tighter breakdown of how we'd approach the workflow so you can quickly see whether it fits what you're solving.",
      "",
      "Best,",
      "Team",
    ].join("\n"),
  };
}

export async function executeProspectWorkflow(
  deps: WorkflowDependencies,
  prospectId: string,
  options?: {
    forceFollowup?: boolean;
  },
): Promise<WorkflowOutcome> {
  let snapshot = await deps.context.repository.getProspectSnapshot(prospectId);
  const threadId = snapshot.thread.id;
  const controlFlags = await deps.context.repository.getControlFlags();
  const sourceSignal = snapshot.prospect.sourceSignalId
    ? await deps.context.repository.getSignal(snapshot.prospect.sourceSignalId)
    : null;
  const automationPauseReason = getAutomationPauseReason(controlFlags, snapshot.prospect.campaignId);

  if (sourceSignal?.source === "linkedin_public_post" && !snapshot.campaign.sourceLinkedinEnabled) {
    await deps.context.repository.pauseThread(threadId, "linkedin source disabled");
    await deps.context.repository.appendAuditEvent("thread", threadId, "ThreadPaused", {
      reason: "linkedin source disabled",
    });
    return paused(snapshot, "linkedin source disabled");
  }

  if (automationPauseReason) {
    if (snapshot.thread.status !== "paused" || snapshot.thread.pausedReason !== automationPauseReason) {
      await deps.context.repository.pauseThread(threadId, automationPauseReason);
      await deps.context.repository.appendAuditEvent("thread", threadId, "ThreadPaused", {
        reason: automationPauseReason,
      });
      snapshot = await deps.context.repository.getProspectSnapshot(prospectId);
    }

    return paused(snapshot, automationPauseReason);
  }

  if (needsQualification(snapshot)) {
    const qualification = await qualifyProspect(deps, snapshot);
    await deps.context.repository.applyQualificationAssessment(prospectId, qualification);
    if (!qualification.ok) {
      await deps.context.repository.pauseThread(threadId, qualification.reason);
      await deps.context.repository.appendAuditEvent("thread", threadId, "ThreadPaused", {
        reason: qualification.reason,
        qualification,
      });
      return paused(snapshot, qualification.reason);
    }

    await setStage(deps, snapshot, "build_research_brief");
    await deps.context.repository.appendAuditEvent("prospect", prospectId, "LeadQualified", {
      reason: qualification.reason,
      summary: qualification.summary,
      confidence: qualification.confidence,
      engine: qualification.engine,
      matchedSegments: qualification.matchedSegments,
      matchedSignals: qualification.matchedSignals,
      checks: qualification.checks,
    });
    snapshot = await deps.context.repository.getProspectSnapshot(prospectId);
  }

  if (!snapshot.researchBrief || snapshot.prospect.stage === "build_research_brief") {
    const research = await buildResearchBrief(deps, snapshot);
    await deps.context.repository.saveResearchBrief({
      prospectId,
      campaignId: snapshot.prospect.campaignId,
      summary: research.summary,
      copyGuidance: research.copyGuidance,
      evidence: research.evidence,
      confidence: research.confidence,
      metadata: {
        generatedBy: "sandbox",
      },
    });
    await deps.context.repository.appendAuditEvent("prospect", prospectId, "ResearchReady", {
      confidence: research.confidence,
      evidenceCount: research.evidence.length,
    });
    await setStage(deps, snapshot, "first_outbound");
    snapshot = await deps.context.repository.getProspectSnapshot(prospectId);
  }

  if (controlFlags.noSendsMode) {
    if (snapshot.thread.status !== "paused" || snapshot.thread.pausedReason !== "no sends mode") {
      await deps.context.repository.pauseThread(threadId, "no sends mode");
      await deps.context.repository.appendAuditEvent("thread", threadId, "ThreadPaused", {
        reason: "no sends mode",
      });
      snapshot = await deps.context.repository.getProspectSnapshot(prospectId);
    }

    return paused(snapshot, "no sends mode");
  }

  if (!snapshot.email) {
    const enrichmentProvider = deps.context.providers.enrichment;
    if (!enrichmentProvider) {
      await deps.context.repository.pauseThread(threadId, "email enrichment provider unavailable");
      await deps.context.repository.appendAuditEvent("thread", threadId, "ThreadPaused", {
        reason: "email enrichment provider unavailable",
      });
      return paused(snapshot, "email enrichment provider unavailable");
    }

    const enriched = await deps.context.mcpTools.handleTool("email.enrich", {
      prospectId,
    });

    if (!enriched) {
      await deps.context.repository.pauseThread(threadId, "email enrichment failed");
      await deps.context.repository.appendAuditEvent("thread", threadId, "ThreadPaused", {
        reason: "email enrichment failed",
      });
      return paused(snapshot, "email enrichment failed");
    }

    await deps.context.repository.appendAuditEvent("prospect", prospectId, "EmailEnriched", {
      provider: enrichmentProvider.providerId,
    });
    snapshot = await deps.context.repository.getProspectSnapshot(prospectId);
  }

  const outboundCount = snapshot.messages.filter((message) => message.direction === "outbound").length;
  if (outboundCount === 0) {
    const draft = await draftFirstOutbound(deps, snapshot);
    const result = await deps.context.mcpTools.handleTool("mail.send", {
      threadId,
      kind: "first_outbound",
      subject: draft.subject,
      bodyText: draft.bodyText,
    });

    if ((result as { blocked?: boolean }).blocked) {
      return paused(snapshot, "outbound blocked");
    }

    await deps.context.repository.touchThreadFollowup(
      threadId,
      new Date(Date.now() + FOLLOWUP_DELAY_MS).toISOString(),
    );

    return {
      action: "sent",
      prospectId,
      threadId,
      followupDelayMs: FOLLOWUP_DELAY_MS,
    };
  }

  if (options?.forceFollowup) {
    const latestInbound = await deps.context.repository.getLatestInboundMessage(threadId);
    if (!latestInbound && snapshot.thread.status === "active") {
      const draft = await draftFollowup(deps, snapshot);
      const result = await deps.context.mcpTools.handleTool("mail.send", {
        threadId,
        kind: "follow_up",
        subject: draft.subject,
        bodyText: draft.bodyText,
      });

      if ((result as { blocked?: boolean }).blocked) {
        return paused(snapshot, "followup blocked");
      }

      await deps.context.repository.touchThreadFollowup(
        threadId,
        new Date(Date.now() + FOLLOWUP_DELAY_MS).toISOString(),
      );

      return {
        action: "sent",
        prospectId,
        threadId,
        followupDelayMs: FOLLOWUP_DELAY_MS,
      };
    }
  }

  const latestInbound = await deps.context.repository.getLatestInboundMessage(threadId);
  if (latestInbound) {
    const replyClass = snapshot.thread.lastReplyClass;
    if (replyClass && isHardStopReply(replyClass)) {
      await deps.context.repository.pauseThread(threadId, `thread blocked by ${replyClass}`);
      await deps.context.repository.appendAuditEvent("thread", threadId, "ThreadPaused", {
        reason: `thread blocked by ${replyClass}`,
      });
      return paused(snapshot, `thread blocked by ${replyClass}`);
    }

    if (replyClass && deps.context.policy.shouldHandoff(replyClass)) {
      await triggerHandoff(deps, snapshot, `reply class ${replyClass}`);
      return {
        action: "handed_off",
        prospectId,
        threadId,
        reason: `reply class ${replyClass}`,
      };
    }

    const draft = await draftReply(deps, snapshot, latestInbound.body_text as string);
    if (draft.action === "handoff") {
      await triggerHandoff(deps, snapshot, draft.reason ?? "agent requested handoff");
      return {
        action: "handed_off",
        prospectId,
        threadId,
        reason: draft.reason ?? "agent requested handoff",
      };
    }

    const result = await deps.context.mcpTools.handleTool("mail.reply", {
      threadId,
      subject: draft.subject,
      bodyText: draft.bodyText,
    });

    if ((result as { blocked?: boolean }).blocked) {
      return paused(snapshot, "reply blocked");
    }

    await deps.context.repository.touchThreadFollowup(
      threadId,
      new Date(Date.now() + FOLLOWUP_DELAY_MS).toISOString(),
    );

    return {
      action: "replied",
      prospectId,
      threadId,
      followupDelayMs: FOLLOWUP_DELAY_MS,
    };
  }

  return {
    action: "noop",
    prospectId,
    threadId,
  };
}

export async function processInboundReply(
  deps: WorkflowDependencies,
  input: {
    providerInboxId?: string | null;
    providerThreadId: string;
    providerMessageId?: string | null;
    subject?: string | null;
    bodyText: string;
    rawPayload?: Record<string, unknown>;
  },
): Promise<WorkflowOutcome | null> {
  const threadRef = await deps.context.repository.getProspectIdByProviderThreadId(input.providerThreadId);
  if (!threadRef) {
    return null;
  }

  const classification = await deps.context.ai.classifyReply(input.bodyText);

  const message: MessageInsertInput = {
    threadId: threadRef.threadId,
    providerMessageId: input.providerMessageId ?? null,
    direction: "inbound",
    kind: "reply",
    subject: input.subject ?? null,
    bodyText: input.bodyText,
    classification: classification.classification,
    metadata: input.rawPayload ?? {},
  };

  await deps.context.repository.addMessage(message);
  await deps.context.repository.updateThreadState({
    threadId: threadRef.threadId,
    stage: "respond_or_handoff",
    status: "active",
    lastReplyClass: classification.classification,
    pausedReason: null,
    providerInboxId: input.providerInboxId ?? undefined,
  });
  await deps.context.repository.updateProspectState({
    prospectId: threadRef.prospectId,
    stage: "respond_or_handoff",
    status: "active",
    lastReplyClass: classification.classification,
    pausedReason: null,
  });
  await deps.context.repository.appendAuditEvent("thread", threadRef.threadId, "ReplyReceived", {
    providerInboxId: input.providerInboxId ?? null,
    providerThreadId: input.providerThreadId,
    providerMessageId: input.providerMessageId ?? null,
  });
  await deps.context.repository.appendAuditEvent("thread", threadRef.threadId, "ReplyClassified", {
    classification: classification.classification,
    rationale: classification.rationale,
  });
  await maybePromoteAttioAfterReply(deps, threadRef.prospectId, classification.classification);

  if (classification.classification === "unsubscribe" || classification.classification === "bounce") {
    await deps.context.repository.pauseThread(threadRef.threadId, classification.classification);
    return {
      action: "paused",
      prospectId: threadRef.prospectId,
      threadId: threadRef.threadId,
      reason: classification.classification,
    };
  }

  return executeProspectWorkflow(deps, threadRef.prospectId);
}

export async function previewDraftForProspect(
  deps: WorkflowDependencies,
  prospectId: string,
  kind: "first_outbound" | "follow_up" | "reply",
): Promise<DraftPreview> {
  const snapshot = await deps.context.repository.getProspectSnapshot(prospectId);

  if (kind === "first_outbound") {
    const draft = await runPreviewDraft(
      () => draftFirstOutbound(deps, snapshot),
      () => buildFirstOutboundFallback(snapshot),
    );
    return {
      kind,
      subject: draft.subject,
      bodyText: draft.bodyText,
      generatedBy: draft.generatedBy,
      fallbackReason: draft.fallbackReason,
    };
  }

  if (kind === "follow_up") {
    const draft = await runPreviewDraft(
      () => draftFollowup(deps, snapshot),
      () => buildFollowupFallback(snapshot),
    );
    return {
      kind,
      subject: draft.subject,
      bodyText: draft.bodyText,
      generatedBy: draft.generatedBy,
      fallbackReason: draft.fallbackReason,
    };
  }

  const latestInbound = await deps.context.repository.getLatestInboundMessage(snapshot.thread.id);
  if (!latestInbound?.body_text) {
    throw new Error(`thread ${snapshot.thread.id} has no inbound message to reply to`);
  }

  const draft = await runPreviewDraft(
    () => draftReply(deps, snapshot, String(latestInbound.body_text)),
    () => buildReplyFallback(snapshot),
  );
  return {
    kind,
    action: draft.action,
    reason: draft.reason,
    subject: draft.subject,
    bodyText: draft.bodyText,
    generatedBy: draft.generatedBy,
    fallbackReason: draft.fallbackReason,
  };
}

async function buildResearchBrief(
  deps: WorkflowDependencies,
  snapshot: ProspectSnapshot,
): Promise<ResearchOutput> {
  const sourceSignal = snapshot.prospect.sourceSignalId
    ? await deps.context.repository.getSignal(snapshot.prospect.sourceSignalId)
    : null;
  const searchQuery = [
    snapshot.prospect.fullName,
    snapshot.prospect.company,
    snapshot.prospect.title,
    snapshot.prospect.companyDomain,
    snapshot.prospect.linkedinUrl,
  ]
    .filter(Boolean)
    .join(" ");

  const [searchResults, companyNewsResults, sourceExtract, knowledgeContext] = await Promise.all([
    searchQuery ? deps.context.providers.search.search(searchQuery, { limit: 5 }) : Promise.resolve([]),
    deps.context.providers.extract.searchCompanyNews(
      snapshot.prospect.company,
      snapshot.prospect.companyDomain,
      3,
    ).catch(() => []),
    sourceSignal?.url
      ? deps.context.providers.extract.extract(sourceSignal.url).catch(() => ({ url: sourceSignal.url, markdown: "" }))
      : Promise.resolve(null),
    deps.context.knowledge.composeKnowledgeContext(
      `${snapshot.prospect.company ?? ""} ${snapshot.prospect.title ?? ""} ${snapshot.prospect.fullName}`,
      4,
    ),
  ]);
  const profileUrl = extractLinkedinProfileUrl(sourceSignal?.metadata, snapshot.prospect.linkedinUrl);
  const companyLinkedinUrl =
    extractCompanyLinkedinUrl(sourceSignal?.metadata)
    ?? (sourceSignal?.url?.includes("linkedin.com/company/") ? sourceSignal.url : null);
  const [linkedinProfileResearch, linkedinCompanyResearch] = await Promise.all([
    profileUrl && deps.context.apify.hasLinkedinResearchTarget()
      ? deps.context.apify.scrapeLinkedinProfile(profileUrl).catch(() => null)
      : Promise.resolve(null),
    companyLinkedinUrl && deps.context.apify.hasLinkedinResearchTarget()
      ? deps.context.apify.scrapeLinkedinCompany(companyLinkedinUrl).catch(() => null)
      : Promise.resolve(null),
  ]);

  const turn = await deps.runSandboxTurn(
    buildTurnRequest(snapshot, "build_research_brief", [
      "Use the `research-brief` and `research-checks` skills.",
      "Use the orchid-sdr MCP tools, Parallel MCP tools, Firecrawl MCP tools, and local knowledge files when useful.",
      "Use Parallel Search MCP for broad web search and URL fetching; use Parallel Task MCP for deeper enrichment when it is available.",
      "Use Firecrawl MCP tools for company-news search and page extraction when you need page-level detail.",
      "Research the prospect and return strict JSON only.",
      'Schema: {"summary":"string","confidence":0.0,"copyGuidance":{"primaryAngle":"string","bestOpeningHook":"string","whyNow":"string","avoidMentioning":["string"],"ctaSuggestion":"string"},"evidence":[{"title":"string","url":"string","note":"string"}]}',
      "The summary should cover: fit, signal, why now, outreach angle, and risks or unknowns.",
      "The copyGuidance should tell downstream drafting exactly how to open, what angle to push, what timing matters, what to avoid mentioning, and what CTA to use.",
      "",
      `Prospect: ${snapshot.prospect.fullName}`,
      `Title: ${snapshot.prospect.title ?? "unknown"}`,
      `Company: ${snapshot.prospect.company ?? "unknown"}`,
      `Company domain: ${snapshot.prospect.companyDomain ?? "unknown"}`,
      `LinkedIn URL: ${snapshot.prospect.linkedinUrl ?? "unknown"}`,
      "",
      "Source signal:",
      JSON.stringify(
        sourceSignal
          ? {
              id: sourceSignal.id,
              url: sourceSignal.url,
              topic: sourceSignal.topic,
              authorName: sourceSignal.authorName,
              authorTitle: sourceSignal.authorTitle,
              authorCompany: sourceSignal.authorCompany,
              content: sourceSignal.content,
              metadata: sourceSignal.metadata,
            }
          : null,
        null,
        2,
      ),
      "",
      "Source page extract:",
      sourceExtract?.markdown?.slice(0, 6000) || "No extract available.",
      "",
      "LinkedIn profile research:",
      JSON.stringify(linkedinProfileResearch, null, 2),
      "",
      "LinkedIn company research:",
      JSON.stringify(linkedinCompanyResearch, null, 2),
      "",
      "Knowledge context:",
      knowledgeContext || "No knowledge matches.",
      "",
      "Initial search results:",
      JSON.stringify(searchResults, null, 2),
      "",
      "Recent company news results:",
      JSON.stringify(companyNewsResults, null, 2),
    ]),
  );

  const parsed = extractJsonObject<ResearchOutput>(turn.outputText);
  if (parsed?.summary && Array.isArray(parsed.evidence)) {
    return {
      summary: parsed.summary,
      confidence: clampConfidence(parsed.confidence),
      copyGuidance:
        parsed.copyGuidance &&
        typeof parsed.copyGuidance.primaryAngle === "string" &&
        typeof parsed.copyGuidance.bestOpeningHook === "string" &&
        typeof parsed.copyGuidance.whyNow === "string" &&
        Array.isArray(parsed.copyGuidance.avoidMentioning) &&
        typeof parsed.copyGuidance.ctaSuggestion === "string"
          ? {
              primaryAngle: parsed.copyGuidance.primaryAngle,
              bestOpeningHook: parsed.copyGuidance.bestOpeningHook,
              whyNow: parsed.copyGuidance.whyNow,
              avoidMentioning: parsed.copyGuidance.avoidMentioning
                .filter((value): value is string => typeof value === "string")
                .slice(0, 5),
              ctaSuggestion: parsed.copyGuidance.ctaSuggestion,
            }
          : null,
      evidence: parsed.evidence.slice(0, 5),
    };
  }

  return {
    summary:
      [
        linkedinProfileResearch?.headline
          ? `${linkedinProfileResearch.fullName ?? "Prospect"}: ${linkedinProfileResearch.headline}`
          : null,
        linkedinCompanyResearch?.description
          ? `${linkedinCompanyResearch.name ?? "Company"}: ${linkedinCompanyResearch.description}`
          : null,
      ]
        .filter((value): value is string => Boolean(value))
        .join("\n")
      || 
      searchResults
        .slice(0, 3)
        .map((result) => `${result.title}: ${result.excerpt}`)
        .join("\n")
      || companyNewsResults
        .slice(0, 3)
        .map((result) => `${result.title}: ${result.excerpt}`)
        .join("\n")
      || sourceSignal?.content
      || "No research summary available.",
    copyGuidance: {
      primaryAngle:
        snapshot.prospect.company && snapshot.prospect.title
          ? `${snapshot.prospect.company} appears relevant based on ${snapshot.prospect.title} context and adjacent workflow signals.`
          : "Lead with the strongest credible role or company context, not the raw acquisition source.",
      bestOpeningHook:
        snapshot.prospect.company && snapshot.prospect.title
          ? `${snapshot.prospect.company} looks close to the workflow and systems work implied by ${snapshot.prospect.title}.`
          : "Anchor on company or role context rather than mentioning the source post directly.",
      whyNow:
        companyNewsResults[0]?.excerpt
        ?? searchResults[0]?.excerpt
        ?? "Use timing carefully and only if recent company context actually supports it.",
      avoidMentioning: [
        "Do not say the prospect's post crossed our feed.",
        "Do not mention internal acquisition mechanics.",
      ],
      ctaSuggestion: "If useful, I can send a short teardown.",
    },
    confidence: sourceExtract?.markdown
      ? 0.72
      : searchResults.length > 0 || companyNewsResults.length > 0
        ? 0.68
        : 0.4,
    evidence: [
      ...(linkedinProfileResearch
        ? [
            {
              title: linkedinProfileResearch.fullName ?? "LinkedIn profile",
              url: linkedinProfileResearch.linkedinUrl,
              note: [
                linkedinProfileResearch.headline,
                linkedinProfileResearch.currentCompanyName
                  ? `Current company: ${linkedinProfileResearch.currentCompanyName}`
                  : null,
                linkedinProfileResearch.experienceSummary[0] ?? null,
              ]
                .filter((value): value is string => Boolean(value))
                .join(" | ")
                .slice(0, 240),
            },
          ]
        : []),
      ...(linkedinCompanyResearch
        ? [
            {
              title: linkedinCompanyResearch.name ?? "LinkedIn company",
              url: linkedinCompanyResearch.linkedinUrl,
              note: [
                linkedinCompanyResearch.tagline,
                linkedinCompanyResearch.employeeRange
                  ? `Employees: ${linkedinCompanyResearch.employeeRange}`
                  : null,
                linkedinCompanyResearch.specialities[0]
                  ? `Specialties: ${linkedinCompanyResearch.specialities.slice(0, 3).join(", ")}`
                  : null,
              ]
                .filter((value): value is string => Boolean(value))
                .join(" | ")
                .slice(0, 240),
            },
          ]
        : []),
      ...(sourceSignal
        ? [
            {
              title: sourceSignal.topic || "Source signal",
              url: sourceSignal.url,
              note: sourceSignal.content.slice(0, 240),
            },
          ]
        : []),
      ...companyNewsResults.map((result) => ({
        title: result.title,
        url: result.url,
        note: `[news] ${result.excerpt.slice(0, 240)}`,
      })),
      ...searchResults.slice(0, 5).map((result) => ({
        title: result.title,
        url: result.url,
        note: result.excerpt.slice(0, 240),
      })),
    ].slice(0, 5),
  };
}

async function draftFirstOutbound(
  deps: WorkflowDependencies,
  snapshot: ProspectSnapshot,
): Promise<DraftEmailOutput> {
  const draftFacts = await buildDraftFacts(deps, snapshot);
  const turn = await deps.runSandboxTurn(
    buildTurnRequest(snapshot, "first_outbound", [
      "Use the `sdr-copy` skill.",
      "Use the orchid-sdr MCP tools and local knowledge files when useful.",
      "Ground the message in `knowledge/product.md`, `knowledge/usp.md`, and `knowledge/icp.md`.",
      "Use the actual product described in those knowledge files, not the repo or control-plane name.",
      "Draft the first outbound email for this prospect and return strict JSON only.",
      'Schema: {"subject":"string","bodyText":"string"}',
      "Keep it concise, grounded in the research brief, and avoid hype.",
      "Use one concrete reason for reaching out and one low-friction CTA.",
      "Do not use em dashes or en dashes anywhere.",
      "Do not overtly mention that we saw the prospect's post or that it crossed our feed unless there is no stronger anchor.",
      "Prefer anchoring on role, company context, company research, and recent news over the raw source post.",
      "Use the source signal as an internal clue for relevance, not the main line of the opener.",
      "If the research brief includes copyGuidance, follow it closely.",
      "",
      "Verified facts for copy:",
      JSON.stringify(draftFacts, null, 2),
      "",
      JSON.stringify(snapshot, null, 2),
    ]),
  );

  const parsed = extractJsonObject<DraftEmailOutput>(turn.outputText);
  if (parsed?.subject && parsed.bodyText) {
    return parsed;
  }

  return buildFirstOutboundFallback(snapshot);
}

async function draftFollowup(
  deps: WorkflowDependencies,
  snapshot: ProspectSnapshot,
): Promise<DraftEmailOutput> {
  const draftFacts = await buildDraftFacts(deps, snapshot);
  const turn = await deps.runSandboxTurn(
    buildTurnRequest(snapshot, "respond_or_handoff", [
      "Use the `sdr-copy` skill.",
      "Ground the message in `knowledge/product.md`, `knowledge/usp.md`, and `knowledge/icp.md`.",
      "Use the actual product described in those knowledge files, not the repo or control-plane name.",
      "Draft a short follow-up email and return strict JSON only.",
      'Schema: {"subject":"string","bodyText":"string"}',
      "Keep it under 90 words.",
      "Do not repeat the full pitch. Add one incremental angle only.",
      "Do not use em dashes or en dashes anywhere.",
      "Do not overtly mention that we saw the prospect's post or that it crossed our feed unless there is no stronger anchor.",
      "Prefer anchoring on role, company context, company research, and recent news over the raw source post.",
      "If the research brief includes copyGuidance, follow it closely.",
      "",
      "Verified facts for copy:",
      JSON.stringify(draftFacts, null, 2),
      "",
      JSON.stringify(snapshot, null, 2),
    ]),
  );

  const parsed = extractJsonObject<DraftEmailOutput>(turn.outputText);
  if (parsed?.subject && parsed.bodyText) {
    return parsed;
  }

  return buildFollowupFallback(snapshot);
}

async function draftReply(
  deps: WorkflowDependencies,
  snapshot: ProspectSnapshot,
  inboundBody: string,
): Promise<DraftReplyOutput> {
  const draftFacts = await buildDraftFacts(deps, snapshot);
  const turn = await deps.runSandboxTurn(
    buildTurnRequest(snapshot, "respond_or_handoff", [
      "Use the `sdr-copy`, `reply-policy`, and `handoff-policy` skills.",
      "Use the orchid-sdr MCP tools and local knowledge files when useful.",
      "Ground the message in `knowledge/product.md`, `knowledge/usp.md`, and `knowledge/icp.md`.",
      "Use the actual product described in those knowledge files, not the repo or control-plane name.",
      "Draft the next reply for this inbound email and return strict JSON only.",
      'Schema: {"action":"reply"|"handoff","reason":"string","subject":"string","bodyText":"string"}',
      "Choose action=handoff if the response should be escalated to a human.",
      "If the thread becomes commercially important or ambiguous, hand off instead of bluffing.",
      "Do not use em dashes or en dashes anywhere.",
      "If the research brief includes copyGuidance, use it to stay consistent with the original angle.",
      "",
      "Verified facts for copy:",
      JSON.stringify(draftFacts, null, 2),
      "",
      "Current prospect/thread snapshot:",
      JSON.stringify(snapshot, null, 2),
      "",
      "Inbound message:",
      inboundBody,
    ]),
  );

  const parsed = extractJsonObject<DraftReplyOutput>(turn.outputText);
  if (parsed?.action === "handoff") {
    return parsed;
  }

  if (parsed?.subject && parsed.bodyText) {
    return {
      action: "reply",
      subject: parsed.subject,
      bodyText: parsed.bodyText,
    };
  }

  return buildReplyFallback(snapshot);
}

async function triggerHandoff(
  deps: WorkflowDependencies,
  snapshot: ProspectSnapshot,
  reason: string,
) {
  await deps.context.mcpTools.handleTool("handoff.slack", {
    threadId: snapshot.thread.id,
    reason,
    payload: {
      prospectId: snapshot.prospect.prospectId,
      fullName: snapshot.prospect.fullName,
      company: snapshot.prospect.company,
    },
  });
  await deps.context.mcpTools.handleTool("handoff.webhook", {
    threadId: snapshot.thread.id,
    reason,
    payload: {
      prospectId: snapshot.prospect.prospectId,
      fullName: snapshot.prospect.fullName,
      company: snapshot.prospect.company,
    },
  });
}

function buildTurnRequest(
  snapshot: ProspectSnapshot,
  stage: SandboxTurnRequest["stage"],
  promptLines: string[],
): SandboxTurnRequest {
  return {
    turnId: `${snapshot.thread.id}:${stage}:${Date.now()}`,
    prospectId: snapshot.prospect.prospectId,
    campaignId: snapshot.prospect.campaignId,
    stage,
    systemPrompt: [
      "You are the SDR agent for the product described in the local knowledge files.",
      "You can use orchid-sdr MCP tools for CRM context, research, enrichment, email, and handoff.",
      "Be factual, concise, and operationally safe.",
    ].join("\n"),
    prompt: promptLines.join("\n"),
    metadata: {
      threadId: snapshot.thread.id,
      prospectId: snapshot.prospect.prospectId,
    },
  };
}

async function buildDraftFacts(
  deps: WorkflowDependencies,
  snapshot: ProspectSnapshot,
): Promise<DraftFact[]> {
  const facts: DraftFact[] = [];
  const sourceSignal = snapshot.prospect.sourceSignalId
    ? await deps.context.repository.getSignal(snapshot.prospect.sourceSignalId).catch(() => null)
    : null;

  if (snapshot.prospect.title) {
    facts.push({
      label: "role",
      detail: `${snapshot.prospect.fullName} is ${snapshot.prospect.title}${snapshot.prospect.company ? ` at ${snapshot.prospect.company}` : ""}.`,
    });
  }

  if (snapshot.qualificationReason) {
    facts.push({
      label: "qualification_reason",
      detail: snapshot.qualificationReason,
    });
  }

  for (const segment of snapshot.qualification?.matchedSegments ?? []) {
    facts.push({
      label: "matched_segment",
      detail: segment,
    });
  }

  for (const signal of snapshot.qualification?.matchedSignals ?? []) {
    facts.push({
      label: "matched_signal",
      detail: signal,
    });
  }

  for (const check of snapshot.qualification?.checks ?? []) {
    if (check.passed && (check.kind === "fit" || check.kind === "supporting")) {
      facts.push({
        label: check.key,
        detail: check.detail,
      });
    }
  }

  if (snapshot.researchBrief?.copyGuidance?.primaryAngle) {
    facts.push({
      label: "primary_angle",
      detail: snapshot.researchBrief.copyGuidance.primaryAngle,
    });
  }
  if (snapshot.researchBrief?.copyGuidance?.bestOpeningHook) {
    facts.push({
      label: "best_opening_hook",
      detail: snapshot.researchBrief.copyGuidance.bestOpeningHook,
    });
  }
  if (snapshot.researchBrief?.copyGuidance?.whyNow) {
    facts.push({
      label: "why_now",
      detail: snapshot.researchBrief.copyGuidance.whyNow,
    });
  }

  for (const evidence of snapshot.researchBrief?.evidence ?? []) {
    facts.push({
      label: "evidence",
      detail: `${evidence.title}: ${evidence.note}`,
    });
  }

  const profileUrl = extractLinkedinProfileUrl(sourceSignal?.metadata, snapshot.prospect.linkedinUrl);
  if (profileUrl && profileUrl !== sourceSignal?.url) {
    facts.push({
      label: "profile_url",
      detail: profileUrl,
    });
  }

  if (sourceSignal?.authorTitle) {
    facts.push({
      label: "source_author_title",
      detail: sourceSignal.authorTitle,
    });
  }

  if (sourceSignal?.metadata && typeof sourceSignal.metadata === "object") {
    const metadata = sourceSignal.metadata as Record<string, unknown>;
    const featuredValues = [
      metadata.headline,
      metadata.about,
      metadata.experienceSummary,
      metadata.featuredSummary,
    ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

    for (const value of featuredValues.slice(0, 4)) {
      facts.push({
        label: "profile_fact",
        detail: value,
      });
    }
  }

  return dedupeDraftFacts(facts).slice(0, 16);
}

function dedupeDraftFacts(facts: DraftFact[]): DraftFact[] {
  const seen = new Set<string>();
  const deduped: DraftFact[] = [];

  for (const fact of facts) {
    const detail = fact.detail.trim();
    if (!detail) {
      continue;
    }
    const key = `${fact.label}:${detail.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push({ label: fact.label, detail });
  }

  return deduped;
}

async function setStage(
  deps: WorkflowDependencies,
  snapshot: ProspectSnapshot,
  stage: ProspectSnapshot["thread"]["stage"],
) {
  await deps.context.repository.updateThreadState({
    threadId: snapshot.thread.id,
    stage,
    status: "active",
    pausedReason: null,
  });
  await deps.context.repository.updateProspectState({
    prospectId: snapshot.prospect.prospectId,
    stage,
    status: "active",
    pausedReason: null,
  });
}

async function qualifyProspect(
  deps: WorkflowDependencies,
  snapshot: ProspectSnapshot,
): Promise<QualificationAssessment> {
  const sourceSignal = snapshot.prospect.sourceSignalId
    ? await deps.context.repository.getSignal(snapshot.prospect.sourceSignalId)
    : null;
  const icpMarkdown = await deps.context.knowledge.getDocumentContent("icp.md");
  const shallowAssessment = heuristicIcpQualification(
    buildQualificationInput(snapshot, sourceSignal),
    icpMarkdown ?? "",
  );
  if (shouldRejectAtSignalTriage(shallowAssessment)) {
    return {
      ...shallowAssessment,
      engine: "heuristic_signal_triage_v1",
      ruleVersion: "icp_doc_v2",
      summary: `Rejected at low-cost signal triage before deep profile, company, and news research because ${shallowAssessment.reason}.`,
    };
  }

  const profileUrl = extractLinkedinProfileUrl(
    sourceSignal?.metadata,
    snapshot.prospect.linkedinUrl,
  );
  const companyUrl = extractCompanyResearchUrl({
    metadata: sourceSignal?.metadata,
    companyDomain: sourceSignal?.companyDomain ?? snapshot.prospect.companyDomain,
  });

  const [postExtract, profileExtract, companyExtract] = await Promise.all([
    sourceSignal?.url
      ? deps.context.providers.extract.extract(sourceSignal.url).catch(() => ({ url: sourceSignal.url, markdown: "" }))
      : Promise.resolve(null),
    profileUrl && profileUrl !== sourceSignal?.url
      ? deps.context.providers.extract.extract(profileUrl).catch(() => ({ url: profileUrl, markdown: "" }))
      : Promise.resolve(null),
    companyUrl
      ? deps.context.providers.extract.extract(companyUrl).catch(() => ({ url: companyUrl, markdown: "" }))
      : Promise.resolve(null),
  ]);

  const turn = await deps.runSandboxTurn(
    buildTurnRequest(snapshot, "qualify", [
      "Use the `icp-qualification` skill.",
      "Decide whether this prospect actually matches the current ICP in icp.md.",
      "This lead already passed shallow signal triage, so use the richer post, profile, and company evidence to confirm or reject.",
      "Follow a generic ICP methodology: identity, source provenance, person fit, company fit, pain or trigger fit, and negative signals.",
      "Evaluate whether the person is qualified, whether the company is qualified, and whether the observed signal shows relevant pain, timing, or buying intent.",
      "Use Parallel Search MCP for broad current web context when you need it; use Parallel Task MCP for deeper enrichment when it is available.",
      "If timing context is unclear, you may use the Firecrawl MCP search tool `firecrawl_search` for recent company news.",
      "Do not qualify someone on topical adjacency alone.",
      "Return strict JSON only.",
      'Schema: {"decision":"qualified|rejected","reason":"string","summary":"string","confidence":0.0,"matchedSegments":["string"],"matchedSignals":["string"],"disqualifiers":["string"],"dimensions":{"personQualified":true,"companyQualified":true,"signalQualified":true,"negativeSignalsPresent":false},"missingEvidence":["string"],"checks":[{"key":"string","label":"string","passed":true,"detail":"string","kind":"required|fit|supporting|negative"}]}',
      "",
      "ICP markdown:",
      icpMarkdown ?? "No ICP markdown available.",
      "",
      `Prospect: ${snapshot.prospect.fullName}`,
      `Title: ${snapshot.prospect.title ?? sourceSignal?.authorTitle ?? "unknown"}`,
      `Company: ${snapshot.prospect.company ?? sourceSignal?.authorCompany ?? "unknown"}`,
      `Company domain: ${snapshot.prospect.companyDomain ?? sourceSignal?.companyDomain ?? "unknown"}`,
      `Source signal URL: ${sourceSignal?.url ?? "unknown"}`,
      `Profile URL: ${profileUrl ?? "unknown"}`,
      `Company research URL: ${companyUrl ?? "unknown"}`,
      "",
      "Source signal:",
      JSON.stringify(
        sourceSignal
          ? {
              topic: sourceSignal.topic,
              content: sourceSignal.content,
              authorName: sourceSignal.authorName,
              authorTitle: sourceSignal.authorTitle,
              authorCompany: sourceSignal.authorCompany,
            }
          : null,
        null,
        2,
      ),
      "",
      "Source post extract:",
      postExtract?.markdown?.slice(0, 5000) || "No post extract available.",
      "",
      "Author profile extract:",
      profileExtract?.markdown?.slice(0, 5000) || "No author profile extract available.",
      "",
      "Company extract:",
      companyExtract?.markdown?.slice(0, 5000) || "No company extract available.",
    ]),
  );

  const parsed = extractJsonObject<{
    decision?: "qualified" | "rejected";
    reason?: string;
    summary?: string;
    confidence?: number;
    matchedSegments?: string[];
    matchedSignals?: string[];
    disqualifiers?: string[];
    dimensions?: QualificationAssessment["dimensions"];
    missingEvidence?: string[];
    checks?: QualificationAssessment["checks"];
  }>(turn.outputText);

  if (parsed?.decision && parsed.reason && parsed.summary && Array.isArray(parsed.checks)) {
    return {
      engine: "sandbox_icp_qualification_v1",
      ruleVersion: "icp_doc_v2",
      decision: parsed.decision,
      ok: parsed.decision === "qualified",
      reason: parsed.reason,
      summary: parsed.summary,
      confidence: clampConfidence(parsed.confidence),
      matchedSegments: Array.isArray(parsed.matchedSegments) ? parsed.matchedSegments.slice(0, 4) : [],
      matchedSignals: Array.isArray(parsed.matchedSignals) ? parsed.matchedSignals.slice(0, 6) : [],
      disqualifiers: Array.isArray(parsed.disqualifiers) ? parsed.disqualifiers.slice(0, 4) : [],
      dimensions: parsed.dimensions,
      missingEvidence: Array.isArray(parsed.missingEvidence) ? parsed.missingEvidence.slice(0, 6) : [],
      checks: parsed.checks.slice(0, 8),
    };
  }

  return deps.context.ai.qualifyProspectAgainstIcp({
    icpMarkdown: icpMarkdown ?? "",
    candidate: buildQualificationInput(snapshot, sourceSignal, {
      sourcePostExtract: postExtract?.markdown ?? null,
      profileExtract: profileExtract?.markdown ?? null,
      companyExtract: companyExtract?.markdown ?? null,
      profileUrl,
      companyUrl,
    }),
  });
}

async function maybePromoteAttioAfterReply(
  deps: WorkflowDependencies,
  prospectId: string,
  replyClass: ReplyClass,
) {
  const crmProvider = deps.context.providers.crm;
  if (!crmProvider?.isConfigured()) {
    return;
  }

  const listStage = attioStageForReplyClass(deps, replyClass);
  if (!listStage) {
    return;
  }

  try {
    await deps.context.mcpTools.handleTool("crm.syncProspect", {
      prospectId,
      createNote: false,
      addToList: true,
      listStage,
    });
  } catch (error) {
    console.error(
      `[${crmProvider.providerId}] automatic reply-stage promotion failed for prospect ${prospectId} after ${replyClass}`,
      error,
    );
  }
}

function attioStageForReplyClass(
  deps: WorkflowDependencies,
  replyClass: ReplyClass,
) {
  switch (replyClass) {
    case "positive":
    case "soft_interest":
    case "objection":
    case "referral":
    case "needs_human":
      return deps.context.config.ATTIO_AUTO_POSITIVE_REPLY_STAGE;
    case "not_now":
    case "wrong_person":
    case "unsubscribe":
    case "bounce":
    case "spam_risk":
      return deps.context.config.ATTIO_AUTO_NEGATIVE_REPLY_STAGE;
    case "ooo":
    default:
      return null;
  }
}

function needsQualification(snapshot: ProspectSnapshot) {
  return snapshot.prospect.stage === "capture_signal" || snapshot.prospect.stage === "qualify";
}

function isHardStopReply(replyClass: ReplyClass) {
  return replyClass === "unsubscribe"
    || replyClass === "bounce"
    || replyClass === "wrong_person"
    || replyClass === "spam_risk";
}

function paused(snapshot: ProspectSnapshot, reason: string): WorkflowOutcome {
  return {
    action: "paused",
    prospectId: snapshot.prospect.prospectId,
    threadId: snapshot.thread.id,
    reason,
  };
}

function clampConfidence(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0.5;
  }

  return Math.max(0, Math.min(1, value));
}
