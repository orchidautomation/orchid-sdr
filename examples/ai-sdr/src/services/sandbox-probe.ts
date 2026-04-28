import type { AppContext } from "./runtime-context.js";
import { runSandboxTurn } from "../orchestration/sandbox-broker.js";

export async function runSandboxCompatibilityProbe(context: AppContext) {
  const result = await runSandboxTurn(context, {
    turnId: "sandbox-compat-probe",
    prospectId: "probe",
    campaignId: "probe",
    stage: "respond_or_handoff",
    systemPrompt: "Reply with the single word ok.",
    prompt: context.config.SANDBOX_COMPAT_PROBE_PROMPT,
    metadata: {
      probe: true,
    },
  });

  if (!/\bok\b/i.test(result.outputText)) {
    throw new Error(`sandbox compatibility probe failed: unexpected output "${result.outputText}"`);
  }

  return result;
}
