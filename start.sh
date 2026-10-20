#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
cd "$PROJECT_DIR"

PORT="${PORT:-3000}"
export PORT

WEB_DIR="${OPENCODE_WEB_DIR:-${RUNNER_TEMP:-/tmp}/omgithub-web}"
BUILD_DIR="$PROJECT_DIR/dist"
DEPLOYMENT_OUTPUT="$WEB_DIR/deployment-output.json"

timed() {
  local label="$1"
  shift
  echo "==> $label"
  /usr/bin/time -p "$@"
}

echo "==> project: $PROJECT_DIR"
echo "==> port: $PORT"

/usr/bin/time -p mkdir -p "$WEB_DIR"

if [[ ! -d node_modules ]] || [[ package-lock.json -nt node_modules ]]; then
  if [[ -f package-lock.json ]]; then
    timed "install dependencies" npm ci --no-audit --no-fund
  else
    timed "install dependencies" npm install --no-audit --no-fund
  fi
else
  echo "==> dependencies already installed"
fi

timed "build static app" npm run build

if [[ ! -f "$BUILD_DIR/index.html" ]]; then
  echo "Build did not produce dist/index.html" >&2
  exit 1
fi

timed "write deployment metadata" node -e '
const fs = require("node:fs");
const path = require("node:path");
const project = path.resolve(process.argv[1]);
const directory = path.resolve(process.argv[2]);
fs.mkdirSync(path.dirname(process.argv[3]), { recursive: true });
fs.writeFileSync(process.argv[3], JSON.stringify({ project, directory }));
' "$PROJECT_DIR" "$BUILD_DIR" "$DEPLOYMENT_OUTPUT"

echo "==> static directory: $BUILD_DIR"
echo "==> deployment metadata: $DEPLOYMENT_OUTPUT"
echo "==> serving on port $PORT"

exec /usr/bin/time -p node "$PROJECT_DIR/scripts/serve.mjs"
