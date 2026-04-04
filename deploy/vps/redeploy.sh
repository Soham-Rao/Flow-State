#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/ops-common.sh"

if [[ ! -x "$BUN_BIN" ]]; then
  echo "Bun not found at $BUN_BIN"
  exit 1
fi

if [[ ! -x "$NODE_BIN" ]]; then
  echo "Node not found at $NODE_BIN"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file not found at $ENV_FILE"
  exit 1
fi

require_command curl

cd "$APP_DIR"

"$BUN_BIN" install --frozen-lockfile
"$BUN_BIN" run build
set -a
source "$ENV_FILE"
set +a
"$NODE_BIN" server/dist/db/migrate.js
sudo systemctl restart "$SERVICE_NAME"
wait_for_local_health "http://127.0.0.1:4000/api/health/ready" 20 1
sudo systemctl status "$SERVICE_NAME" --no-pager
