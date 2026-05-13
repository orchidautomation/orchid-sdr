import fs from "node:fs";
import path from "node:path";

const packageRoot = path.resolve(
  process.cwd(),
  "node_modules",
  "@rivetkit",
  "engine-runner-protocol",
);

const distRoot = path.join(packageRoot, "dist");
const esmEntry = path.join(distRoot, "index.js");
const cjsEntry = path.join(distRoot, "index.cjs");
const dtsEntry = path.join(distRoot, "index.d.ts");
const dctsEntry = path.join(distRoot, "index.d.cts");

function copyIfMissing(source, target) {
  if (!fs.existsSync(source) || fs.existsSync(target)) {
    return false;
  }

  fs.copyFileSync(source, target);
  return true;
}

if (!fs.existsSync(packageRoot)) {
  process.exit(0);
}

const wroteCjs = copyIfMissing(esmEntry, cjsEntry);
const wroteDcts = copyIfMissing(dtsEntry, dctsEntry);

if (wroteCjs || wroteDcts) {
  console.warn(
    "[postinstall] patched @rivetkit/engine-runner-protocol missing CJS export artifacts for runtime compatibility.",
  );
}
