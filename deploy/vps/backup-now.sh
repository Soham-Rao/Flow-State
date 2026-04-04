#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/ops-common.sh"

KIND="${1:-}"
TARGET_SHA="${2:-}"
if [[ -z "$KIND" ]]; then
  flowstate_log "Usage: backup-now.sh <predeploy|daily|weekly> [target-sha]"
  exit 1
fi

source_env
load_mysql_env
require_command docker
require_command zstd
require_command git
require_command sha256sum

cd "$APP_DIR"
CURRENT_SHA="$(git rev-parse HEAD)"
BACKUP_ID="$(date -u +%Y%m%dT%H%M%SZ)-${KIND}-${CURRENT_SHA:0:7}"
ARCHIVE_DIR="$BACKUP_LOCAL_DIR/$KIND"
MANIFEST_DIR="$BACKUP_LOCAL_DIR/manifests/$KIND"
ARCHIVE_PATH="$ARCHIVE_DIR/$BACKUP_ID.sql.zst"
MANIFEST_PATH="$MANIFEST_DIR/$BACKUP_ID.json"

mkdir -p "$ARCHIVE_DIR" "$MANIFEST_DIR"

cleanup_on_error() {
  rm -f "$ARCHIVE_PATH" "$MANIFEST_PATH"
}
trap cleanup_on_error ERR

flowstate_log "Creating $KIND backup at $ARCHIVE_PATH"
docker exec "$MYSQL_CONTAINER_NAME" sh -lc 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --single-transaction --quick --databases "$MYSQL_DATABASE"' \
  | zstd -T0 -19 -q -o "$ARCHIVE_PATH"

BUN_LOCK_HASH="$(sha256sum bun.lock | awk '{print $1}')"
MIGRATION_JOURNAL_HASH="$(sha256sum server/drizzle/meta/_journal.json | awk '{print $1}')"
PACKAGE_VERSION="$("$NODE_BIN" -p "require('./server/package.json').version")"

MANIFEST_ARGS=(
  --kind "$KIND"
  --archive-path "$ARCHIVE_PATH"
  --current-sha "$CURRENT_SHA"
  --backup-id "$BACKUP_ID"
  --manifest-path "$MANIFEST_PATH"
  --package-version "$PACKAGE_VERSION"
  --bun-lock-hash "$BUN_LOCK_HASH"
  --migration-journal-hash "$MIGRATION_JOURNAL_HASH"
  --mysql-database "$MYSQL_DATABASE"
)

if [[ -n "$TARGET_SHA" ]]; then
  MANIFEST_ARGS+=(--target-sha "$TARGET_SHA")
fi

"$NODE_BIN" server/dist/ops/backup-manifest-cli.js "${MANIFEST_ARGS[@]}" >/dev/null

prune_local() {
  local kind="$1"
  local keep
  keep="$(local_keep_count "$kind")"
  mapfile -t archives < <(find "$BACKUP_LOCAL_DIR/$kind" -maxdepth 1 -type f -name '*.sql.zst' -printf '%f
' | sort -r)
  if (( ${#archives[@]} > keep )); then
    for archive in "${archives[@]:keep}"; do
      rm -f "$BACKUP_LOCAL_DIR/$kind/$archive"
      rm -f "$BACKUP_LOCAL_DIR/manifests/$kind/${archive%.sql.zst}.json"
    done
  fi
}

upload_and_prune_remote() {
  local kind="$1"
  local keep
  keep="$(remote_keep_count "$kind")"
  local archive_name manifest_name
  archive_name="$(basename "$ARCHIVE_PATH")"
  manifest_name="$(basename "$MANIFEST_PATH")"

  aws_r2 s3 cp "$ARCHIVE_PATH" "s3://$BACKUP_R2_BUCKET/$BACKUP_R2_PREFIX/$kind/$archive_name"
  aws_r2 s3 cp "$MANIFEST_PATH" "s3://$BACKUP_R2_BUCKET/$BACKUP_R2_PREFIX/manifests/$kind/$manifest_name"

  mapfile -t remote_archives < <(aws_r2 s3 ls "s3://$BACKUP_R2_BUCKET/$BACKUP_R2_PREFIX/$kind/" | awk '{print $4}' | sed '/^$/d' | sort -r)
  if (( ${#remote_archives[@]} > keep )); then
    for archive in "${remote_archives[@]:keep}"; do
      aws_r2 s3 rm "s3://$BACKUP_R2_BUCKET/$BACKUP_R2_PREFIX/$kind/$archive"
      aws_r2 s3 rm "s3://$BACKUP_R2_BUCKET/$BACKUP_R2_PREFIX/manifests/$kind/${archive%.sql.zst}.json" || true
    done
  fi
}

prune_local "$KIND"

if r2_is_configured; then
  require_command aws
  upload_and_prune_remote "$KIND"
fi

trap - ERR
flowstate_log "Backup created: $ARCHIVE_PATH"
printf '%s
' "$MANIFEST_PATH"
