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
    .map((attendee) => [attendee.fullName, attendee.role, attendee.company].filter(Boolean).join(" - "))
    .join("\n");

  const knowledgeContext = await context.knowledge.composeKnowledgeContext(
    [detail.meeting.title, detail.meeting.accountName ?? "", detail.meeting.notes ?? "", attendeeContext].join("\n"),
    4,
  );

  const heuristicBrief: PrepBrief = {
    summary: `${detail.meeting.title} starts at ${detail.meeting.startsAt}.`,
    accountContext: detail.meeting.accountName ? [`Account: ${detail.meeting.accountName}`] : [],
    attendeeHighlights: detail.attendees.map((attendee) => `${attendee.fullName}${attendee.role ? ` (${attendee.role})` : ""}`),
    questionsToAsk: ["What outcome does the customer want from this meeting?"],
    risks: detail.attendees.length === 0 ? ["No attendees were provided in the booking payload."] : [],
    confidence: detail.attendees.length > 0 ? 0.7 : 0.45,
  };

  let brief = heuristicBrief;

  try {
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
