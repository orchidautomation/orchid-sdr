#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${TRELLIS_DEMO_BASE_URL:?Set TRELLIS_DEMO_BASE_URL to your deployed Trellis app URL}"
PAYLOAD="${TRELLIS_DEMO_PAYLOAD:-reference/inputs/demo-form-payload.json}"
TOKEN="${TRELLIS_API_KEY:-${TRELLIS_MCP_TOKEN:-}}"
RUN_ID="${TRELLIS_DEMO_RUN_ID:-$(date -u +%Y%m%d%H%M%S)}"

if [[ ! -f "${PAYLOAD}" ]]; then
  echo "Demo payload not found: ${PAYLOAD}" >&2
  exit 1
fi

TMP_PAYLOAD="$(mktemp)"
trap 'rm -f "${TMP_PAYLOAD}"' EXIT

node scripts/build-demo-payload.mjs "${PAYLOAD}" "${TMP_PAYLOAD}" "${RUN_ID}"

headers=(-H "content-type: application/json")
if [[ -n "${TOKEN}" ]]; then
  headers+=(-H "Authorization: Bearer ${TOKEN}")
fi

curl -sS \
  -X POST "${BASE_URL}/webhooks/signals" \
  "${headers[@]}" \
  --data @"${TMP_PAYLOAD}"
