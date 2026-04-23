import { getAppContext } from "../src/services/runtime-context.js";
import { runSandboxCompatibilityProbe } from "../src/services/sandbox-probe.js";

async function main() {
  const result = await runSandboxCompatibilityProbe(getAppContext());
  console.log(
    JSON.stringify(
      {
        ok: true,
        turnId: result.turnId,
        outputText: result.outputText,
      },
      null,
      2,
    ),
  );
}

void main();
