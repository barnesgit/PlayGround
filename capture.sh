#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
: "${CAPTURE_URL:?Set CAPTURE_URL.}"
: "${CAPTURE_DIR:?Set CAPTURE_DIR.}"

export PROJECT_DIR CAPTURE_URL CAPTURE_DIR
export OMGITHUB_PLAYWRIGHT_ROOT="${OMGITHUB_PLAYWRIGHT_ROOT:-$HOME/.local/share/omgithub-playwright}"

timed() {
  local label="$1"
  shift
  echo "==> $label"
  /usr/bin/time -p "$@"
}

project_real="$(realpath -m "$PROJECT_DIR")"
capture_real="$(realpath -m "$CAPTURE_DIR")"
if [[ "$capture_real" == "$project_real" || "$capture_real" == "$project_real"/* ]]; then
  echo "CAPTURE_DIR must be outside the project: $CAPTURE_DIR" >&2
  exit 1
fi

echo "==> capture URL: $CAPTURE_URL"
echo "==> capture directory: $CAPTURE_DIR"

timed "prepare capture directory" mkdir -p "$CAPTURE_DIR"
timed "capture desktop and mobile views" node "$PROJECT_DIR/scripts/capture.mjs"
