import { describe, expect, it } from "vitest";

import {
  listDefaultSdrMcpToolGroups,
  listDefaultSdrMcpToolNames,
  selectDefaultSdrMcpTools,
} from "../../../packages/default-sdr/src/mcp-tool-catalog.js";

describe("default SDR MCP tool catalog", () => {
  it("lists stable normalized tool groups", () => {
    expect(listDefaultSdrMcpToolGroups()).toEqual([
      "knowledge",
      "lead",
      "crm",
      "email",
      "research",
      "pipeline",
      "runtime",
      "thread",
      "control",
      "mail",
      "handoff",
    ]);
  });

  it("can select a subset by tool group", () => {
    const selected = selectDefaultSdrMcpTools({
      toolGroups: ["knowledge", "research"],
    }).map((tool) => tool.name);

    expect(selected).toEqual([
      "knowledge.search",
      "research.search",
      "research.extract",
    ]);
  });

  it("can explicitly exclude or include individual tools", () => {
    const allTools = new Set(listDefaultSdrMcpToolNames());
    expect(allTools.has("mail.send")).toBe(true);

    const selected = selectDefaultSdrMcpTools({
      toolGroups: ["mail"],
      excludeTools: ["mail.send"],
      includeTools: ["runtime.flags"],
    }).map((tool) => tool.name);

    expect(selected).toEqual([
      "runtime.flags",
      "mail.preview",
      "mail.reply",
      "mail.pause",
    ]);
  });
});
