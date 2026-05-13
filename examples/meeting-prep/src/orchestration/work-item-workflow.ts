import { prepBriefSchema, type PrepBrief } from "../domain/types.js";
import type { AppContext } from "../services/runtime-context.js";
import { createTurnId, runSandboxTurn } from "./sandbox-broker.js";

export async function executeMeetingPrepWorkflow(context: AppContext, meetingId: string) {
  const detail = await context.repository.getMeetingDetail(meetingId);
  if (!detail) {
    throw new Error(`meeting not found: ${meetingId}`);
  }
  if (!detail.prepRun) {
    throw new Error(`prep run not found for meeting: ${meetingId}`);
  }

  await context.repository.updatePrepRun(detail.prepRun.id, {
    status: "processing",
    stage: "building_brief",
    error: undefined,
  });

  const attendeeContext = detail.attendees
    .map((attendee) => [attendee.fullName, attendee.role, attendee.company, attendee.notes].filter(Boolean).join(" - "))
    .join("\n");
  const companyContext = buildCompanyContext(detail);

  const knowledgeContext = await context.knowledge.composeKnowledgeContext(
    [
      detail.meeting.title,
      detail.meeting.accountName ?? "",
      detail.meeting.companyDomain ?? "",
      detail.meeting.companyWebsite ?? "",
      detail.meeting.companyIndustry ?? "",
      detail.meeting.companyDescription ?? "",
      detail.meeting.objective ?? "",
      detail.meeting.notes ?? "",
      attendeeContext,
    ].join("\n"),
    4,
  );

  const heuristicBrief = buildHeuristicBrief(detail, companyContext);

  let brief = heuristicBrief;

  try {
    if (hasSandboxCredentials(context)) {
      const sandboxResult = await runSandboxTurn(context, {
        turnId: createTurnId("meeting"),
        targetId: meetingId,
        stage: "respond_or_handoff",
        systemPrompt: [
          "You are a Trellis meeting prep agent.",
          "Use the meeting-prep-brief skill, the meeting-prep-account-research skill, and the local knowledge files.",
          "If the booking payload is thin, use available web research tools to verify company and attendee context before drafting.",
          "Return only JSON matching the requested shape.",
        ].join("\n"),
        prompt: [
          "Create a prep brief with summary, accountContext, attendeeHighlights, questionsToAsk, risks, and confidence.",
          "Use web search only when it improves the operator's understanding of the company, attendees, or likely meeting context.",
          "Do not invent pipeline history or internal account state.",
          "",
          "Payload-derived company context:",
          companyContext.length ? companyContext.map((item) => `- ${item}`).join("\n") : "- none",
          "",
          "Knowledge context:",
          knowledgeContext || "No matching knowledge snippets found.",
          "",
          "Meeting:",
          JSON.stringify(detail.meeting, null, 2),
          "",
          "Attendees:",
          JSON.stringify(detail.attendees, null, 2),
        ].join("\n"),
        metadata: {
          meetingId,
        },
      });
      const parsed = safeParseBrief(sandboxResult.outputText);
      if (parsed) {
        brief = parsed;
      }
    } else {
      brief = await context.ai.buildArtifact({
        payload: detailToPayload(detail),
        knowledgeContext: [
          companyContext.length ? `Payload-derived company context:\n${companyContext.map((item) => `- ${item}`).join("\n")}` : "",
          knowledgeContext,
        ].filter(Boolean).join("\n\n"),
      });
    }
  } catch {
    // keep heuristic brief
  }

  await context.repository.savePrepBrief(meetingId, {
    kind: "meeting-prep-brief",
    title: `Prep brief for ${detail.meeting.title}`,
    content: renderBriefMarkdown(brief),
    structured: brief,
  });
  await context.repository.updatePrepRun(detail.prepRun.id, {
    status: "ready",
    stage: "brief_ready",
    summary: brief.summary,
    error: undefined,
  });
  await context.repository.appendAuditEvent("meeting", meetingId, "PrepBriefReady", {
    summary: brief.summary,
  });

  return brief;
}

function buildHeuristicBrief(detail: Awaited<ReturnType<AppContext["repository"]["getMeetingDetail"]>>, companyContext: string[]): PrepBrief {
  if (!detail) {
    throw new Error("meeting detail is required");
  }
  const attendeeHighlights = detail.attendees.map((attendee) => {
    const parts = [
      attendee.fullName,
      attendee.role ? `(${attendee.role})` : "",
      attendee.company && attendee.company !== detail.meeting.accountName ? `at ${attendee.company}` : "",
      attendee.notes ? `- ${attendee.notes}` : "",
    ].filter(Boolean);
    return parts.join(" ").replace(/\s+-\s+/, " - ");
  });

  const questionsToAsk = uniqueStrings([
    detail.meeting.objective ? `How should we define success for ${detail.meeting.objective.toLowerCase()}?` : "What outcome does the customer want from this meeting?",
    detail.attendees.some((attendee) => /ops|operations|revenue/i.test(attendee.role ?? ""))
      ? "What operational bottlenecks are the team trying to remove right now?"
      : undefined,
    detail.meeting.companyIndustry
      ? `What constraints are specific to ${detail.meeting.companyIndustry.toLowerCase()} that we should account for?`
      : undefined,
  ]);

  const risks = uniqueStrings([
    detail.attendees.length === 0 ? "No attendees were provided in the booking payload." : undefined,
    !detail.meeting.companyWebsite && !detail.meeting.companyDomain ? "No company website or domain was provided, so external account verification will depend on search." : undefined,
    detail.attendees.some((attendee) => !attendee.role) ? "At least one attendee is missing a role, which weakens stakeholder-specific prep." : undefined,
    !detail.meeting.objective ? "No explicit meeting objective was provided in the booking payload." : undefined,
  ]);

  const summaryParts = [
    detail.meeting.title,
    `starts at ${detail.meeting.startsAt}`,
    detail.meeting.objective ? `with the stated objective: ${detail.meeting.objective}` : null,
    detail.meeting.accountName ? `for ${detail.meeting.accountName}` : null,
  ].filter(Boolean);

  return {
    summary: `${summaryParts.join(" ")}.`,
    accountContext: companyContext,
    attendeeHighlights,
    questionsToAsk,
    risks,
    confidence: risks.length === 0 ? 0.82 : detail.attendees.length > 0 ? 0.68 : 0.45,
  };
}

function buildCompanyContext(detail: NonNullable<Awaited<ReturnType<AppContext["repository"]["getMeetingDetail"]>>>) {
  return uniqueStrings([
    detail.meeting.accountName ? `Account: ${detail.meeting.accountName}` : undefined,
    detail.meeting.companyDescription ? `Company: ${detail.meeting.companyDescription}` : undefined,
    detail.meeting.companyIndustry ? `Industry: ${detail.meeting.companyIndustry}` : undefined,
    detail.meeting.companyDomain ? `Domain: ${detail.meeting.companyDomain}` : undefined,
    detail.meeting.companyWebsite ? `Website: ${detail.meeting.companyWebsite}` : undefined,
    detail.meeting.sourceUrl ? `Booking source: ${detail.meeting.sourceUrl}` : undefined,
    detail.meeting.objective ? `Meeting objective: ${detail.meeting.objective}` : undefined,
    detail.meeting.notes ? `Operator notes: ${detail.meeting.notes}` : undefined,
  ]);
}

function uniqueStrings(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))];
}

function hasSandboxCredentials(context: AppContext) {
  return Boolean(
    (context.config.VERCEL_TOKEN || context.config.VERCEL_OIDC_TOKEN)
    && context.config.VERCEL_PROJECT_ID
    && context.config.VERCEL_TEAM_ID,
  );
}

function detailToPayload(detail: NonNullable<Awaited<ReturnType<AppContext["repository"]["getMeetingDetail"]>>>) {
  return {
    source: detail.meeting.source,
    externalId: detail.meeting.externalId ?? undefined,
    meeting: {
      id: detail.meeting.id,
      title: detail.meeting.title,
      startsAt: detail.meeting.startsAt,
      endsAt: detail.meeting.endsAt ?? undefined,
      organizerEmail: detail.meeting.organizerEmail ?? undefined,
      accountName: detail.meeting.accountName ?? undefined,
      objective: detail.meeting.objective ?? undefined,
      notes: detail.meeting.notes ?? undefined,
      sourceUrl: detail.meeting.sourceUrl ?? undefined,
      company: {
        name: detail.meeting.accountName ?? undefined,
        domain: detail.meeting.companyDomain ?? undefined,
        website: detail.meeting.companyWebsite ?? undefined,
        industry: detail.meeting.companyIndustry ?? undefined,
        description: detail.meeting.companyDescription ?? undefined,
        linkedinUrl: detail.meeting.companyLinkedinUrl ?? undefined,
      },
      attendees: detail.attendees.map((attendee) => ({
        fullName: attendee.fullName,
        email: attendee.email ?? undefined,
        company: attendee.company ?? undefined,
        role: attendee.role ?? undefined,
        linkedinUrl: attendee.linkedinUrl ?? undefined,
        notes: attendee.notes ?? undefined,
      })),
    },
  };
}

function safeParseBrief(value: string) {
  try {
    return prepBriefSchema.parse(JSON.parse(value));
  } catch {
    return null;
  }
}

function renderBriefMarkdown(brief: PrepBrief) {
  return [
    `# Summary\n${brief.summary}`,
    `# Account Context\n${brief.accountContext.length ? brief.accountContext.map((item) => `- ${item}`).join("\n") : "- none"}`,
    `# Attendee Highlights\n${brief.attendeeHighlights.length ? brief.attendeeHighlights.map((item) => `- ${item}`).join("\n") : "- none"}`,
    `# Questions To Ask\n${brief.questionsToAsk.length ? brief.questionsToAsk.map((item) => `- ${item}`).join("\n") : "- none"}`,
    `# Risks\n${brief.risks.length ? brief.risks.map((item) => `- ${item}`).join("\n") : "- none"}`,
    `# Confidence\n${brief.confidence}`,
  ].join("\n\n");
}
