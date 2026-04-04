#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/ops-common.sh"

DEPLOY_REMOTE="${DEPLOY_REMOTE:-origin}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-master}"
source_env
require_command git
require_command curl

cd "$APP_DIR"
CURRENT_SHA="$(git rev-parse HEAD)"
ROLLBACK_MANIFEST=""
DB_CHANGED=0
FAILED_STAGE="init"

rollback_on_failure() {
  local status=$?
  if (( status == 0 )); then
    return
  fi

  flowstate_log "Deploy failed at stage: $FAILED_STAGE"
  send_ops_alert "FlowState deploy failed" "Stage: $FAILED_STAGE
Current SHA: $CURRENT_SHA
Manifest: $ROLLBACK_MANIFEST"

  local disable_maintenance=1
  if [[ -n "$ROLLBACK_MANIFEST" ]]; then
    local restore_mode="never"
    if (( DB_CHANGED == 1 )); then
      restore_mode="always"
    fi

    if bash "$SCRIPT_DIR/rollback.sh" "$CURRENT_SHA" "$ROLLBACK_MANIFEST" "$restore_mode"; then
      send_ops_alert "FlowState rollback succeeded" "Rolled back to $CURRENT_SHA after deploy failure at stage: $FAILED_STAGE"
    else
      disable_maintenance=0
      send_ops_alert "FlowState rollback failed" "Rollback to $CURRENT_SHA failed after deploy failure at stage: $FAILED_STAGE"
    fi
  fi

  if (( disable_maintenance == 1 )); then
    bash "$SCRIPT_DIR/maintenance-disable.sh" || true
  else
    flowstate_log "Keeping maintenance mode enabled because rollback was not successful"
  fi

  exit $status
}
trap rollback_on_failure EXIT

FAILED_STAGE="maintenance-enable"
bash "$SCRIPT_DIR/maintenance-enable.sh"

FAILED_STAGE="git-fetch"
git fetch "$DEPLOY_REMOTE" "$DEPLOY_BRANCH"
TARGET_SHA="$(git rev-parse "$DEPLOY_REMOTE/$DEPLOY_BRANCH")"

FAILED_STAGE="predeploy-backup"
ROLLBACK_MANIFEST="$(bash "$SCRIPT_DIR/backup-now.sh" predeploy "$TARGET_SHA")"

FAILED_STAGE="git-reset"
git reset --hard "$DEPLOY_REMOTE/$DEPLOY_BRANCH"

FAILED_STAGE="bun-install"
"$BUN_BIN" install --frozen-lockfile

FAILED_STAGE="build"
"$BUN_BIN" run build

FAILED_STAGE="migrate"
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
DB_CHANGED=1
"$NODE_BIN" server/dist/db/migrate.js

FAILED_STAGE="restart"
sudo systemctl restart "$SERVICE_NAME"

FAILED_STAGE="readiness-check"
curl -fsS http://127.0.0.1:4000/api/health/ready >/dev/null

FAILED_STAGE="maintenance-disable"
bash "$SCRIPT_DIR/maintenance-disable.sh"
trap - EXIT
flowstate_log "Safe deploy complete: $TARGET_SHA"
