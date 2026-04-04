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
ENCRYPTED_ARCHIVE_LOCAL_PATH=""
ENCRYPTED_ARCHIVE_REMOTE_PATH=""
ENCRYPTED_ARCHIVE_SHA256=""
ENCRYPTED_ARCHIVE_SIZE_BYTES=""
ENCRYPTION_ACTIVE=0

mkdir -p "$ARCHIVE_DIR" "$MANIFEST_DIR"

cleanup_on_error() {
  rm -f "$ARCHIVE_PATH" "$MANIFEST_PATH"
  if [[ -n "$ENCRYPTED_ARCHIVE_LOCAL_PATH" ]]; then
    rm -f "$ENCRYPTED_ARCHIVE_LOCAL_PATH"
  fi
}
trap cleanup_on_error ERR

flowstate_log "Creating $KIND backup at $ARCHIVE_PATH"
docker exec "$MYSQL_CONTAINER_NAME" sh -lc 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --single-transaction --quick --databases "$MYSQL_DATABASE"' \
  | zstd -T0 -19 -q -o "$ARCHIVE_PATH"

ARCHIVE_SHA256="$(sha256sum "$ARCHIVE_PATH" | awk '{print $1}')"
ensure_server_dist_entries "ops/backup-manifest-cli.js"

if r2_is_configured && backup_encryption_enabled; then
  ensure_server_dist_entries "ops/backup-encrypt-cli.js"
  ENCRYPTED_ARCHIVE_LOCAL_PATH="$(mktemp "/tmp/${BACKUP_ID}.XXXXXX.sql.zst.enc")"
  ENCRYPT_RESULT="$("$NODE_BIN" server/dist/ops/backup-encrypt-cli.js --input "$ARCHIVE_PATH" --output "$ENCRYPTED_ARCHIVE_LOCAL_PATH")"
  ENCRYPTED_ARCHIVE_SHA256="$("$NODE_BIN" -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.sha256 ?? ""));' "$ENCRYPT_RESULT")"
  ENCRYPTED_ARCHIVE_SIZE_BYTES="$("$NODE_BIN" -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.sizeBytes ?? ""));' "$ENCRYPT_RESULT")"
  ENCRYPTED_ARCHIVE_REMOTE_PATH="s3://$BACKUP_R2_BUCKET/$BACKUP_R2_PREFIX/$KIND/$BACKUP_ID.sql.zst.enc"
  ENCRYPTION_ACTIVE=1
fi

BUN_LOCK_HASH="$(sha256sum bun.lock | awk '{print $1}')"
MIGRATION_JOURNAL_HASH="$(sha256sum server/drizzle/meta/_journal.json | awk '{print $1}')"
PACKAGE_VERSION="$("$NODE_BIN" -p "require('./server/package.json').version")"

MANIFEST_ARGS=(
  --kind "$KIND"
  --archive-path "$ARCHIVE_PATH"
  --archive-sha256 "$ARCHIVE_SHA256"
  --current-sha "$CURRENT_SHA"
  --backup-id "$BACKUP_ID"
  --manifest-path "$MANIFEST_PATH"
  --package-version "$PACKAGE_VERSION"
  --bun-lock-hash "$BUN_LOCK_HASH"
  --migration-journal-hash "$MIGRATION_JOURNAL_HASH"
  --mysql-database "$MYSQL_DATABASE"
  --backup-encryption-enabled "$([[ $ENCRYPTION_ACTIVE -eq 1 ]] && printf true || printf false)"
  --backup-encryption-key-id "${BACKUP_ENCRYPTION_KEY_ID:-}"
)

if [[ -n "$TARGET_SHA" ]]; then
  MANIFEST_ARGS+=(--target-sha "$TARGET_SHA")
fi

if [[ $ENCRYPTION_ACTIVE -eq 1 ]]; then
  MANIFEST_ARGS+=(
    --encrypted-archive-path "$ENCRYPTED_ARCHIVE_REMOTE_PATH"
    --encrypted-archive-sha256 "$ENCRYPTED_ARCHIVE_SHA256"
  )
fi

"$NODE_BIN" server/dist/ops/backup-manifest-cli.js "${MANIFEST_ARGS[@]}" >/dev/null

prune_local() {
  local kind="$1"
  local keep
  keep="$(local_keep_count "$kind")"
  mapfile -t manifests < <(find "$BACKUP_LOCAL_DIR/manifests/$kind" -maxdepth 1 -type f -name '*.json' -printf '%f
' | sort -r)
  if (( ${#manifests[@]} > keep )); then
    for manifest in "${manifests[@]:keep}"; do
      local backup_id
      backup_id="${manifest%.json}"
      rm -f "$BACKUP_LOCAL_DIR/manifests/$kind/$manifest"
      rm -f "$BACKUP_LOCAL_DIR/$kind/$backup_id.sql.zst"
      rm -f "$BACKUP_LOCAL_DIR/$kind/$backup_id.sql.zst.enc"
    done
  fi
}

upload_and_prune_remote() {
  local kind="$1"
  local keep
  keep="$(remote_keep_count "$kind")"
  local manifest_name upload_path upload_name
  manifest_name="$(basename "$MANIFEST_PATH")"

  if [[ $ENCRYPTION_ACTIVE -eq 1 ]]; then
    upload_path="$ENCRYPTED_ARCHIVE_LOCAL_PATH"
    upload_name="$BACKUP_ID.sql.zst.enc"
  else
    upload_path="$ARCHIVE_PATH"
    upload_name="$(basename "$ARCHIVE_PATH")"
  fi

  aws_r2 s3 cp "$upload_path" "s3://$BACKUP_R2_BUCKET/$BACKUP_R2_PREFIX/$kind/$upload_name"
  aws_r2 s3 cp "$MANIFEST_PATH" "s3://$BACKUP_R2_BUCKET/$BACKUP_R2_PREFIX/manifests/$kind/$manifest_name"

  mapfile -t remote_manifests < <(aws_r2 s3 ls "s3://$BACKUP_R2_BUCKET/$BACKUP_R2_PREFIX/manifests/$kind/" | awk '{print $4}' | sed '/^$/d' | sort -r)
  if (( ${#remote_manifests[@]} > keep )); then
    for manifest in "${remote_manifests[@]:keep}"; do
      local backup_id
      backup_id="${manifest%.json}"
      aws_r2 s3 rm "s3://$BACKUP_R2_BUCKET/$BACKUP_R2_PREFIX/manifests/$kind/$manifest" || true
      aws_r2 s3 rm "s3://$BACKUP_R2_BUCKET/$BACKUP_R2_PREFIX/$kind/$backup_id.sql.zst" || true
      aws_r2 s3 rm "s3://$BACKUP_R2_BUCKET/$BACKUP_R2_PREFIX/$kind/$backup_id.sql.zst.enc" || true
    done
  fi
}

prune_local "$KIND"

if r2_is_configured; then
  require_command aws
  upload_and_prune_remote "$KIND"
fi

RATIO_ESTIMATE="$(zstd -lv "$ARCHIVE_PATH" 2>/dev/null | awk 'END {print $7}')"
LOCAL_FOOTPRINT="$(du -sh "$BACKUP_LOCAL_DIR" 2>/dev/null | awk '{print $1}')"

if [[ -n "$ENCRYPTED_ARCHIVE_LOCAL_PATH" ]]; then
  rm -f "$ENCRYPTED_ARCHIVE_LOCAL_PATH"
fi

trap - ERR
flowstate_log "Backup created: $ARCHIVE_PATH"
flowstate_log "Backup stats: archive=$(stat -c%s "$ARCHIVE_PATH")B encrypted=${ENCRYPTED_ARCHIVE_SIZE_BYTES:-n/a}B ratio=${RATIO_ESTIMATE:-n/a} local_footprint=${LOCAL_FOOTPRINT:-unknown}"
printf '%s
' "$MANIFEST_PATH"
