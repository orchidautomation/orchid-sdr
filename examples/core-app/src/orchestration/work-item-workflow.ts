import { workArtifactSchema, type WorkArtifact } from "../domain/types.js";
import type { AppContext } from "../services/runtime-context.js";
import { createTurnId, runSandboxTurn } from "./sandbox-broker.js";

export async function executeWorkItemWorkflow(context: AppContext, intakeEventId: string) {
  const detail = await context.repository.getIntakeEventDetail(intakeEventId);
  if (!detail) {
    throw new Error(`intake event not found: ${intakeEventId}`);
  }
  if (!detail.workflowRun) {
    throw new Error(`workflow run not found for intake event: ${intakeEventId}`);
  }

  await context.repository.updateWorkflowRun(detail.workflowRun.id, {
    status: "processing",
    stage: "intake_review",
    error: null,
  });

  const knowledgeContext = await context.knowledge.composeKnowledgeContext(
    [detail.intakeEvent.title, detail.intakeEvent.body ?? "", JSON.stringify(detail.intakeEvent.metadata ?? {})].join("\n"),
    4,
  );

  const heuristicArtifact = await context.ai.buildArtifact({
    payload: {
      source: detail.intakeEvent.source,
      externalId: detail.intakeEvent.externalId ?? undefined,
      type: detail.intakeEvent.eventType,
      title: detail.intakeEvent.title,
      body: detail.intakeEvent.body ?? undefined,
      metadata: detail.intakeEvent.metadata,
    },
    knowledgeContext,
  });

  let artifact: WorkArtifact = heuristicArtifact;

  try {
    const sandboxResult = await runSandboxTurn(context, {
      turnId: createTurnId("work"),
      targetId: intakeEventId,
      stage: "intake_review",
      systemPrompt: [
        "You are a Trellis operator agent.",
        "Use the local knowledge files and the core-brief skill.",
        "Return only JSON matching the requested shape.",
      ].join("\n"),
      prompt: [
        "Prepare a work artifact with summary, keyFacts, nextActions, openQuestions, and confidence.",
        "",
        "Knowledge context:",
        knowledgeContext || "No matching knowledge snippets found.",
        "",
        "Item:",
        JSON.stringify(detail.intakeEvent, null, 2),
      ].join("\n"),
      metadata: {
        intakeEventId,
      },
    });

    const parsed = safeParseArtifact(sandboxResult.outputText);
    if (parsed) {
      artifact = parsed;
    }
  } catch {
    // keep heuristic artifact
  }

  await context.repository.storeArtifact("intake_event", intakeEventId, {
    kind: "core-brief",
    title: `Artifact for ${detail.intakeEvent.title}`,
    content: renderArtifactMarkdown(artifact),
    structured: artifact,
  });
  await context.repository.updateWorkflowRun(detail.workflowRun.id, {
    status: "ready",
    stage: "artifact_ready",
    summary: artifact.summary,
    error: null,
  });
  await context.repository.appendAuditEvent("intake_event", intakeEventId, "ArtifactReady", {
    summary: artifact.summary,
  });

  return artifact;
}

function safeParseArtifact(value: string) {
  try {
    const parsed = JSON.parse(value);
    return workArtifactSchema.parse(parsed);
  } catch {
    return null;
  }
}

function renderArtifactMarkdown(artifact: WorkArtifact) {
  const sections = [
    `# Summary\n${artifact.summary}`,
    `# Key Facts\n${artifact.keyFacts.length > 0 ? artifact.keyFacts.map((item) => `- ${item}`).join("\n") : "- none"}`,
    `# Next Actions\n${artifact.nextActions.length > 0 ? artifact.nextActions.map((item) => `- ${item}`).join("\n") : "- none"}`,
    `# Open Questions\n${artifact.openQuestions.length > 0 ? artifact.openQuestions.map((item) => `- ${item}`).join("\n") : "- none"}`,
    `# Confidence\n${artifact.confidence}`,
  ];
  return sections.join("\n\n");
}
