#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/ops-common.sh"

INPUT_PATH="${1:-}"
if [[ -z "$INPUT_PATH" ]]; then
  flowstate_log "Usage: restore-verify.sh <manifest-path|local-archive-path>"
  exit 1
fi

source_env
load_mysql_env
require_command docker
require_command zstd
require_command perl
ensure_server_dist_entries "ops/backup-verify-cli.js" "ops/restore-verify-cli.js"

if [[ -z "${BACKUP_VERIFY_SCRATCH_MYSQL_URL:-}" ]]; then
  flowstate_log "BACKUP_VERIFY_SCRATCH_MYSQL_URL is not configured"
  exit 1
fi

ARCHIVE_PATH="$INPUT_PATH"
SOURCE_DB_NAME="${MYSQL_DATABASE:-}"
if [[ "$INPUT_PATH" == *.json ]]; then
  ARCHIVE_PATH="$("$NODE_BIN" "$APP_DIR/server/dist/ops/backup-verify-cli.js" --manifest-path "$INPUT_PATH")"
  SOURCE_DB_NAME="$("$NODE_BIN" -e 'const fs = require("node:fs"); const manifest = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(String(manifest.mysqlDatabase ?? ""));' "$INPUT_PATH")"
fi

if [[ ! -f "$ARCHIVE_PATH" ]]; then
  flowstate_log "Archive not found: $ARCHIVE_PATH"
  exit 1
fi

SCRATCH_DB_NAME="$("$NODE_BIN" -e 'const url = new URL(process.argv[1]); process.stdout.write(url.pathname.replace(/^\//, ""));' "$BACKUP_VERIFY_SCRATCH_MYSQL_URL")"
SCRATCH_DB_USER="$("$NODE_BIN" -e 'const url = new URL(process.argv[1]); process.stdout.write(decodeURIComponent(url.username || ""));' "$BACKUP_VERIFY_SCRATCH_MYSQL_URL")"
if [[ -z "$SCRATCH_DB_NAME" ]]; then
  flowstate_log "Could not resolve scratch database name from BACKUP_VERIFY_SCRATCH_MYSQL_URL"
  exit 1
fi

if [[ -z "$SCRATCH_DB_USER" ]]; then
  flowstate_log "Could not resolve scratch database user from BACKUP_VERIFY_SCRATCH_MYSQL_URL"
  exit 1
fi

SQL="DROP DATABASE IF EXISTS \`$SCRATCH_DB_NAME\`; CREATE DATABASE \`$SCRATCH_DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL PRIVILEGES ON \`$SCRATCH_DB_NAME\`.* TO '$SCRATCH_DB_USER'@'%'; FLUSH PRIVILEGES;"
flowstate_log "Preparing scratch database $SCRATCH_DB_NAME"
docker exec "$MYSQL_CONTAINER_NAME" sh -lc "MYSQL_PWD=\"\$MYSQL_ROOT_PASSWORD\" mysql -uroot -e '$SQL'"

flowstate_log "Restoring scratch database from $ARCHIVE_PATH"
if [[ -n "$SOURCE_DB_NAME" && "$SOURCE_DB_NAME" != "$SCRATCH_DB_NAME" ]]; then
  flowstate_log "Rewriting backup database name from $SOURCE_DB_NAME to $SCRATCH_DB_NAME for scratch restore"
  zstd -dc "$ARCHIVE_PATH" \
    | env SOURCE_DB_NAME="$SOURCE_DB_NAME" SCRATCH_DB_NAME="$SCRATCH_DB_NAME" perl -pe 'my $source = quotemeta($ENV{SOURCE_DB_NAME}); my $target = $ENV{SCRATCH_DB_NAME}; s/`$source`/`$target`/g;' \
    | docker exec -i "$MYSQL_CONTAINER_NAME" sh -lc "MYSQL_PWD=\"\$MYSQL_ROOT_PASSWORD\" mysql -uroot '$SCRATCH_DB_NAME'"
else
  zstd -dc "$ARCHIVE_PATH" | docker exec -i "$MYSQL_CONTAINER_NAME" sh -lc "MYSQL_PWD=\"\$MYSQL_ROOT_PASSWORD\" mysql -uroot '$SCRATCH_DB_NAME'"
fi

VERIFY_RESULT="$("$NODE_BIN" "$APP_DIR/server/dist/ops/restore-verify-cli.js" --mysql-url "$BACKUP_VERIFY_SCRATCH_MYSQL_URL")"
flowstate_log "Restore verification passed: $VERIFY_RESULT"
