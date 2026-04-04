#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/ops-common.sh"

ARCHIVE_PATH="${1:-}"
if [[ -z "$ARCHIVE_PATH" ]]; then
  flowstate_log "Usage: restore-db.sh <local-archive-path>"
  exit 1
fi

source_env
load_mysql_env
require_command docker
require_command zstd

if [[ ! -f "$ARCHIVE_PATH" ]]; then
  flowstate_log "Archive not found: $ARCHIVE_PATH"
  exit 1
fi

flowstate_log "Restoring database from $ARCHIVE_PATH"
zstd -dc "$ARCHIVE_PATH" | docker exec -i "$MYSQL_CONTAINER_NAME" sh -lc 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot "$MYSQL_DATABASE"'
flowstate_log "Database restore complete"
