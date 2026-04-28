import { definePlugin } from 'pluxx'

export default definePlugin({
  name: "trellis-onboarding",
  version: '0.1.0',
  description: "Trellis onboarding and setup flows for composable agentic GTM apps.",
  author: {
    name: "Orchid Automation",
  },
  license: 'MIT',

  // Skills directory (SKILL.md files following Agent Skills standard)
  skills: './skills/',

  // Target platforms to generate
  targets: ["claude-code", "cursor", "codex", "opencode"],
})
