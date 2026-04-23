import type { MessageInsertInput, ProspectSnapshot } from "../repository.js";
import { extractJsonObject } from "../lib/json.js";
import { extractCompanyResearchUrl, extractLinkedinProfileUrl } from "../lib/signal-urls.js";
import type { QualificationAssessment, ReplyClass, ResearchBrief, SandboxTurnRequest } from "../domain/types.js";
import { buildQualificationInput } from "../services/qualification-engine.js";
import type { WorkflowDependencies, WorkflowOutcome } from "./types.js";

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
  evidence: Array<{
    title: string;
    url: string;
    note: string;
  }>;
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

  if (sourceSignal?.source === "linkedin_public_post" && !snapshot.campaign.sourceLinkedinEnabled) {
    await deps.context.repository.pauseThread(threadId, "linkedin source disabled");
    await deps.context.repository.appendAuditEvent("thread", threadId, "ThreadPaused", {
      reason: "linkedin source disabled",
    });
    return paused(snapshot, "linkedin source disabled");
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
      provider: "prospeo",
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
  });
  await deps.context.repository.updateProspectState({
    prospectId: threadRef.prospectId,
    stage: "respond_or_handoff",
    status: "active",
    lastReplyClass: classification.classification,
    pausedReason: null,
  });
  await deps.context.repository.appendAuditEvent("thread", threadRef.threadId, "ReplyReceived", {
    providerThreadId: input.providerThreadId,
    providerMessageId: input.providerMessageId ?? null,
  });
  await deps.context.repository.appendAuditEvent("thread", threadRef.threadId, "ReplyClassified", {
    classification: classification.classification,
    rationale: classification.rationale,
  });

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
    searchQuery ? deps.context.parallel.search(searchQuery, 5) : Promise.resolve([]),
    deps.context.firecrawl.searchCompanyNews(
      snapshot.prospect.company,
      snapshot.prospect.companyDomain,
      3,
    ).catch(() => []),
    sourceSignal?.url
      ? deps.context.firecrawl.extract(sourceSignal.url).catch(() => ({ url: sourceSignal.url, markdown: "" }))
      : Promise.resolve(null),
    deps.context.knowledge.composeKnowledgeContext(
      `${snapshot.prospect.company ?? ""} ${snapshot.prospect.title ?? ""} ${snapshot.prospect.fullName}`,
      4,
    ),
  ]);

  const turn = await deps.runSandboxTurn(
    buildTurnRequest(snapshot, "build_research_brief", [
      "Use the `research-brief` and `research-checks` skills.",
      "Use the orchid-sdr MCP tools, Firecrawl MCP tools, and local knowledge files when useful.",
      "If recent company context would help, use the Firecrawl MCP search tool `firecrawl_search` to look for company-related news.",
      "Research the prospect and return strict JSON only.",
      'Schema: {"summary":"string","confidence":0.0,"evidence":[{"title":"string","url":"string","note":"string"}]}',
      "The summary should cover: fit, signal, why now, outreach angle, and risks or unknowns.",
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
      evidence: parsed.evidence.slice(0, 5),
    };
  }

  return {
    summary:
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
    confidence: sourceExtract?.markdown
      ? 0.72
      : searchResults.length > 0 || companyNewsResults.length > 0
        ? 0.68
        : 0.4,
    evidence: [
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
  const turn = await deps.runSandboxTurn(
    buildTurnRequest(snapshot, "first_outbound", [
      "Use the `sdr-copy` skill.",
      "Use the orchid-sdr MCP tools and local knowledge files when useful.",
      "Draft the first outbound email for this prospect and return strict JSON only.",
      'Schema: {"subject":"string","bodyText":"string"}',
      "Keep it concise, grounded in the research brief, and avoid hype.",
      "Use one concrete reason for reaching out and one low-friction CTA.",
      "",
      JSON.stringify(snapshot, null, 2),
    ]),
  );

  const parsed = extractJsonObject<DraftEmailOutput>(turn.outputText);
  if (parsed?.subject && parsed.bodyText) {
    return parsed;
  }

  return {
    subject: `Quick question, ${snapshot.prospect.firstName}`,
    bodyText: [
      `Hi ${snapshot.prospect.firstName},`,
      "",
      `Saw your recent activity around ${snapshot.researchBrief?.evidence[0]?.title ?? "your team's recent work"}.`,
      "Thought it might be relevant because Orchid builds agent systems that handle research, routing, and human handoff without turning outreach into brittle automation.",
      "",
      "If useful, I can send a short teardown of how we would structure that workflow for your team.",
      "",
      "Best,",
      "Orchid",
    ].join("\n"),
  };
}

async function draftFollowup(
  deps: WorkflowDependencies,
  snapshot: ProspectSnapshot,
): Promise<DraftEmailOutput> {
  const turn = await deps.runSandboxTurn(
    buildTurnRequest(snapshot, "respond_or_handoff", [
      "Use the `sdr-copy` skill.",
      "Draft a short follow-up email and return strict JSON only.",
      'Schema: {"subject":"string","bodyText":"string"}',
      "Keep it under 90 words.",
      "Do not repeat the full pitch. Add one incremental angle only.",
      "",
      JSON.stringify(snapshot, null, 2),
    ]),
  );

  const parsed = extractJsonObject<DraftEmailOutput>(turn.outputText);
  if (parsed?.subject && parsed.bodyText) {
    return parsed;
  }

  return {
    subject: `Following up, ${snapshot.prospect.firstName}`,
    bodyText: [
      `Hi ${snapshot.prospect.firstName},`,
      "",
      "Following up in case the earlier note was useful.",
      "If you're working through outbound, research automation, or human handoff design, I can send a concrete outline instead of a pitch.",
      "",
      "Best,",
      "Orchid",
    ].join("\n"),
  };
}

async function draftReply(
  deps: WorkflowDependencies,
  snapshot: ProspectSnapshot,
  inboundBody: string,
): Promise<DraftReplyOutput> {
  const turn = await deps.runSandboxTurn(
    buildTurnRequest(snapshot, "respond_or_handoff", [
      "Use the `sdr-copy`, `reply-policy`, and `handoff-policy` skills.",
      "Use the orchid-sdr MCP tools and local knowledge files when useful.",
      "Draft the next reply for this inbound email and return strict JSON only.",
      'Schema: {"action":"reply"|"handoff","reason":"string","subject":"string","bodyText":"string"}',
      "Choose action=handoff if the response should be escalated to a human.",
      "If the thread becomes commercially important or ambiguous, hand off instead of bluffing.",
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
      "Orchid",
    ].join("\n"),
  };
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
      "You are Orchid SDR running inside a controlled sandbox.",
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
      ? deps.context.firecrawl.extract(sourceSignal.url).catch(() => ({ url: sourceSignal.url, markdown: "" }))
      : Promise.resolve(null),
    profileUrl && profileUrl !== sourceSignal?.url
      ? deps.context.firecrawl.extract(profileUrl).catch(() => ({ url: profileUrl, markdown: "" }))
      : Promise.resolve(null),
    companyUrl
      ? deps.context.firecrawl.extract(companyUrl).catch(() => ({ url: companyUrl, markdown: "" }))
      : Promise.resolve(null),
  ]);

  const turn = await deps.runSandboxTurn(
    buildTurnRequest(snapshot, "qualify", [
      "Use the `icp-qualification` skill.",
      "Decide whether this prospect actually matches the current ICP in icp.md.",
      "Follow a generic ICP methodology: identity, source provenance, person fit, company fit, pain or trigger fit, and negative signals.",
      "Evaluate whether the person is qualified, whether the company is qualified, and whether the observed signal shows relevant pain, timing, or buying intent.",
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
