#!/usr/bin/env bash
set -euo pipefail

# This script wraps the backend demo import command so it can be run from the repo root.
# Usage:
#   ./import-demo-data.sh [path/to/demo-data.json]
# If no path is provided it defaults to apps/backend/demo/demo-data.json.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_PATH="apps/backend/demo/demo-data.json"

if [[ $# -gt 1 ]]; then
  echo "Usage: $0 [path/to/demo-data.json]" >&2
  exit 1
fi

if [[ $# -eq 1 ]]; then
  if [[ $1 = /* ]]; then
    DATA_PATH="$1"
  else
    DATA_PATH="$ROOT_DIR/$1"
  fi
else
  DATA_PATH="$ROOT_DIR/$DEFAULT_PATH"
fi

if [[ ! -f "$DATA_PATH" ]]; then
  echo "Demo data file not found: $DATA_PATH" >&2
  exit 1
fi

# Run the pnpm demo import command scoped to the backend package.
cd "$ROOT_DIR"
pnpm --filter backend import:demo "$DATA_PATH"
