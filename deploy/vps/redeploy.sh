#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/flowstate/app}"
ENV_FILE="${ENV_FILE:-/etc/flowstate/flowstate.env}"
BUN_BIN="${BUN_BIN:-/home/flowstate/.bun/bin/bun}"
NODE_BIN="${NODE_BIN:-/usr/bin/node}"
SERVICE_NAME="${SERVICE_NAME:-flowstate}"

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

cd "$APP_DIR"

"$BUN_BIN" install --frozen-lockfile
"$BUN_BIN" run build
set -a
source "$ENV_FILE"
set +a
"$NODE_BIN" server/dist/db/migrate.js
sudo systemctl restart "$SERVICE_NAME"
curl -fsS http://127.0.0.1:4000/api/health/ready >/dev/null
sudo systemctl status "$SERVICE_NAME" --no-pager
