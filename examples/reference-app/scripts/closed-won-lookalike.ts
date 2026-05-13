import { parseArgs } from "node:util";

import { getClosedWonLookalikeExample } from "../src/examples/closed-won-lookalike.js";
import { getAppContext } from "../src/services/runtime-context.js";

const args = parseArgs({
  options: {
    mode: {
      type: "string",
      default: "blueprint",
    },
    format: {
      type: "string",
      default: "json",
    },
    limit: {
      type: "string",
      default: "8",
    },
  },
});

type OutputFormat = "json" | "markdown";
type Mode = "blueprint" | "operator";

function printMarkdown(value: ReturnType<typeof buildMarkdown>) {
  console.log(value);
}

function buildMarkdown(input: {
  headline: string;
  summary?: string;
  workflow?: Array<{ title: string; support: string; outcome: string }>;
  commands?: string[];
  notes?: string[];
}) {
  const lines = [`# ${input.headline}`];

  if (input.summary) {
    lines.push("", input.summary);
  }

  if (input.workflow?.length) {
    lines.push("", "## Workflow");
    for (const step of input.workflow) {
      lines.push(`- ${step.title} [${step.support}]: ${step.outcome}`);
    }
  }

  if (input.commands?.length) {
    lines.push("", "## Commands");
    for (const command of input.commands) {
      lines.push(`- \`${command}\``);
    }
  }

  if (input.notes?.length) {
    lines.push("", "## Notes");
    for (const note of input.notes) {
      lines.push(`- ${note}`);
    }
  }

  return lines.join("\n");
}

async function runBlueprint(format: OutputFormat) {
  const example = getClosedWonLookalikeExample();
  const result = {
    headline: example.name,
    summary: example.summary,
    manifestPath: example.manifestPath,
    knowledgePackPath: example.knowledgePackPath,
    skillsPath: example.skillsPath,
    actors: example.actors,
    state: example.state,
    mcpTools: example.mcpTools,
    workflow: example.workflow,
    gaps: example.gaps,
    operatorFlows: example.operatorFlows,
  };

  if (format === "markdown") {
    printMarkdown(
      buildMarkdown({
        headline: example.name,
        summary: example.summary,
        workflow: example.workflow.map((step) => ({
          title: step.title,
          support: step.support,
          outcome: step.outcome,
        })),
        commands: example.operatorFlows.map((flow) => flow.command),
        notes: example.gaps.map((gap) => `${gap.area}: ${gap.detail}`),
      }),
    );
    return;
  }

  console.log(JSON.stringify(result, null, 2));
}

async function runOperator(format: OutputFormat, limit: number) {
  const context = getAppContext();
  const [example, flags, discoveryHealth, summary, workflowFeed] = await Promise.all([
    context.mcpTools.handleTool("example.closedWonLookalike", { includeRuntime: true }),
    context.mcpTools.handleTool("runtime.flags", {}),
    context.mcpTools.handleTool("runtime.discoveryHealth", {}),
    context.mcpTools.handleTool("pipeline.summary", { limit }),
    context.mcpTools.handleTool("pipeline.workflowFeed", { limit }),
  ]);

  const result = {
    example,
    flags,
    discoveryHealth,
    summary,
    workflowFeed,
  };

  if (format === "markdown") {
    const typedSummary = summary as {
      headline?: string;
    };
    printMarkdown(
      buildMarkdown({
        headline: "Closed-Won Lookalike Operator View",
        summary: typedSummary.headline ?? "Live runtime summary loaded.",
        commands: [
          "pipeline.summary({\"limit\":8})",
          "pipeline.workflowFeed({\"limit\":8})",
          "pipeline.qualifiedLeads({\"limit\":8})",
          "crm.syncProspect({\"prospectId\":\"<prospect>\",\"addToList\":true})",
        ],
        notes: [
          "This mode reads the current backend, so it requires the same env and database setup as the app.",
          "Use NO_SENDS_MODE=true if you want review-only execution for this example.",
        ],
      }),
    );
    return;
  }

  console.log(JSON.stringify(result, null, 2));
}

async function main() {
  const mode = (args.values.mode === "operator" ? "operator" : "blueprint") as Mode;
  const format = (args.values.format === "markdown" ? "markdown" : "json") as OutputFormat;
  const limit = Math.max(1, Number.parseInt(args.values.limit ?? "8", 10) || 8);

  if (mode === "operator") {
    await runOperator(format, limit);
    return;
  }

  await runBlueprint(format);
}

void main();
