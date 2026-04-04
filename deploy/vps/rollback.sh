#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/ops-common.sh"

TARGET_SHA="${1:-}"
MANIFEST_PATH="${2:-}"
RESTORE_MODE="${3:-auto}"

if [[ -z "$TARGET_SHA" ]]; then
  flowstate_log "Usage: rollback.sh <target-sha> [manifest-path] [auto|always|never]"
  exit 1
fi

source_env
require_command git
require_command curl

cd "$APP_DIR"
flowstate_log "Rolling back code to $TARGET_SHA"
git reset --hard "$TARGET_SHA"
"$BUN_BIN" install --frozen-lockfile
"$BUN_BIN" run build

should_restore=0
case "$RESTORE_MODE" in
  always) should_restore=1 ;;
  never) should_restore=0 ;;
  auto)
    if [[ -n "$MANIFEST_PATH" ]]; then
      should_restore=1
    fi
    ;;
  *) flowstate_log "Unknown restore mode: $RESTORE_MODE"; exit 1 ;;
esac

if (( should_restore == 1 )); then
  if [[ -z "$MANIFEST_PATH" ]]; then
    flowstate_log "Restore requested but manifest path missing"
    exit 1
  fi

  KIND="$(basename "$(dirname "$MANIFEST_PATH")")"
  BACKUP_ID="$(basename "$MANIFEST_PATH" .json)"
  ARCHIVE_PATH="$BACKUP_LOCAL_DIR/$KIND/$BACKUP_ID.sql.zst"
  bash "$SCRIPT_DIR/restore-db.sh" "$ARCHIVE_PATH"
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
"$NODE_BIN" server/dist/db/migrate.js
sudo systemctl restart "$SERVICE_NAME"
curl -fsS http://127.0.0.1:4000/api/health/ready >/dev/null
flowstate_log "Rollback complete"
