import { workArtifactSchema, type WorkArtifact } from "../domain/types.js";
import type { AppContext } from "../services/runtime-context.js";
import { createTurnId, runSandboxTurn } from "./sandbox-broker.js";

export async function executeWorkItemWorkflow(context: AppContext, workItemId: string) {
  const detail = await context.repository.getWorkItemDetail(workItemId);
  if (!detail) {
    throw new Error(`work item not found: ${workItemId}`);
  }

  await context.repository.updateWorkItem(workItemId, {
    status: "processing",
    stage: "intake_review",
  });

  const knowledgeContext = await context.knowledge.composeKnowledgeContext(
    [detail.item.title, detail.item.body ?? "", JSON.stringify(detail.item.metadata ?? {})].join("\n"),
    4,
  );

  const heuristicArtifact = await context.ai.buildArtifact({
    payload: {
      source: detail.item.source,
      externalId: detail.item.externalId ?? undefined,
      type: detail.item.type,
      title: detail.item.title,
      body: detail.item.body ?? undefined,
      metadata: detail.item.metadata,
    },
    knowledgeContext,
  });

  let artifact: WorkArtifact = heuristicArtifact;

  try {
    const sandboxResult = await runSandboxTurn(context, {
      turnId: createTurnId("work"),
      workItemId,
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
        JSON.stringify(detail.item, null, 2),
      ].join("\n"),
      metadata: {
        workItemId,
      },
    });

    const parsed = safeParseArtifact(sandboxResult.outputText);
    if (parsed) {
      artifact = parsed;
    }
  } catch {
    // keep heuristic artifact
  }

  await context.repository.storeArtifact(workItemId, {
    kind: "core-brief",
    title: `Artifact for ${detail.item.title}`,
    content: renderArtifactMarkdown(artifact),
    structured: artifact,
  });
  await context.repository.updateWorkItem(workItemId, {
    status: "ready",
    stage: "artifact_ready",
    summary: artifact.summary,
  });
  await context.repository.appendAuditEvent("work_item", workItemId, "ArtifactReady", {
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

