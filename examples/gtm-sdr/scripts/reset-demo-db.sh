#!/usr/bin/env bash
set -euo pipefail

DB_NAME="${TRELLIS_DEMO_DB_NAME:-trellis-cloud-sdr-db}"
CONFIRM="${TRELLIS_DEMO_RESET_CONFIRM:-}"
SQL_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/reset-demo-db.sql"

if [[ "${CONFIRM}" != "reset" ]]; then
  echo "Refusing to reset ${DB_NAME} without TRELLIS_DEMO_RESET_CONFIRM=reset." >&2
  echo "Run: TRELLIS_DEMO_RESET_CONFIRM=reset npm run demo:reset-db" >&2
  exit 1
fi

npx wrangler d1 execute "${DB_NAME}" --remote --file "${SQL_FILE}"
