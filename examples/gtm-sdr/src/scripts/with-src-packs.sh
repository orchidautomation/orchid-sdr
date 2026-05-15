#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CREATED_LINKS=()

cleanup() {
  for name in "${CREATED_LINKS[@]}"; do
    local link="${ROOT}/${name}"
    if [[ -L "${link}" && "$(readlink "${link}")" == "src/${name}" ]]; then
      rm "${link}"
    fi
  done
}

ensure_pack_link() {
  local name="$1"
  local link="${ROOT}/${name}"
  local target="src/${name}"

  if [[ -e "${link}" && ! -L "${link}" ]]; then
    echo "Refusing to shadow existing ${name} directory at ${link}" >&2
    exit 1
  fi

  if [[ ! -e "${link}" ]]; then
    ln -s "${target}" "${link}"
    CREATED_LINKS+=("${name}")
  fi
}

if [[ "$#" -eq 0 ]]; then
  echo "Usage: bash src/scripts/with-src-packs.sh <command> [args...]" >&2
  exit 1
fi

trap cleanup EXIT

ensure_pack_link "knowledge"
ensure_pack_link "skills"

"$@"
