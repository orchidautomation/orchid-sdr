import { readFile, writeFile } from "node:fs/promises";

const [, , inputPath, outputPath, runIdInput] = process.argv;

if (!inputPath || !outputPath) {
  throw new Error("Usage: node src/scripts/build-demo-payload.mjs <input> <output> [runId]");
}

const runId = normalizeRunId(runIdInput || new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14));
const payload = JSON.parse(await readFile(inputPath, "utf8"));
const signalId = `sig_demo_bdr_pylon_${runId}`;
const traceId = `trace_demo_bdr_pylon_${runId}`;

payload.id = signalId;
payload.traceId = traceId;
payload.threadId = `lead:pylon:alex-rivera:${runId}`;
payload.sourceRef = signalId;
payload.submittedAt = new Date().toISOString();
payload.demo = {
  scenario: "common-room-bdr-pylon",
  runId,
  generatedAt: payload.submittedAt,
  note: "Demo-safe synthetic signal used to show the Trellis BDR workflow.",
};

await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);

function normalizeRunId(value) {
  const normalized = String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!normalized) {
    throw new Error("runId must contain at least one alphanumeric character.");
  }
  return normalized;
}
