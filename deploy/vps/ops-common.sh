#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/flowstate/app}"
ENV_FILE="${ENV_FILE:-/etc/flowstate/flowstate.env}"
BUN_BIN="${BUN_BIN:-/home/flowstate/.bun/bin/bun}"
NODE_BIN="${NODE_BIN:-/usr/bin/node}"
SERVICE_NAME="${SERVICE_NAME:-flowstate}"
NGINX_MAINTENANCE_FLAG="${NGINX_MAINTENANCE_FLAG:-/etc/nginx/flowstate-maintenance-on}"
NGINX_MAINTENANCE_ROOT="${NGINX_MAINTENANCE_ROOT:-/var/www/flowstate-maintenance}"
MYSQL_ENV_FILE_DEFAULT="/opt/flowstate/infra/mysql.env"

flowstate_log() {
  printf '[flowstate-ops] %s
' "$*"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    flowstate_log "Missing required command: $1"
    exit 1
  fi
}

source_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    flowstate_log "Env file not found: $ENV_FILE"
    exit 1
  fi

  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a

  BACKUP_LOCAL_DIR="${BACKUP_LOCAL_DIR:-/var/lib/flowstate/backups}"
  MYSQL_CONTAINER_NAME="${MYSQL_CONTAINER_NAME:-flowstate-mysql}"
  MYSQL_ENV_FILE="${MYSQL_ENV_FILE:-$MYSQL_ENV_FILE_DEFAULT}"
}

load_mysql_env() {
  if [[ ! -f "$MYSQL_ENV_FILE" ]]; then
    flowstate_log "MySQL env file not found: $MYSQL_ENV_FILE"
    exit 1
  fi

  set -a
  # shellcheck disable=SC1090
  source "$MYSQL_ENV_FILE"
  set +a
}

r2_is_configured() {
  [[ -n "${BACKUP_R2_BUCKET:-}" && -n "${BACKUP_R2_ACCESS_KEY_ID:-}" && -n "${BACKUP_R2_SECRET_ACCESS_KEY:-}" && ( -n "${BACKUP_R2_ENDPOINT:-}" || -n "${BACKUP_R2_ACCOUNT_ID:-}" ) ]]
}

resolve_r2_endpoint() {
  if [[ -n "${BACKUP_R2_ENDPOINT:-}" ]]; then
    printf '%s
' "$BACKUP_R2_ENDPOINT"
    return
  fi

  if [[ -n "${BACKUP_R2_ACCOUNT_ID:-}" ]]; then
    printf 'https://%s.r2.cloudflarestorage.com
' "$BACKUP_R2_ACCOUNT_ID"
    return
  fi

  return 1
}

aws_r2() {
  local endpoint
  endpoint="$(resolve_r2_endpoint)"
  AWS_ACCESS_KEY_ID="$BACKUP_R2_ACCESS_KEY_ID"   AWS_SECRET_ACCESS_KEY="$BACKUP_R2_SECRET_ACCESS_KEY"   AWS_DEFAULT_REGION="auto"     aws --endpoint-url "$endpoint" "$@"
}

local_keep_count() {
  case "$1" in
    predeploy) printf '%s
' "${BACKUP_RETENTION_LOCAL_PREDEPLOY:-5}" ;;
    daily) printf '%s
' "${BACKUP_RETENTION_LOCAL_DAILY:-7}" ;;
    weekly) printf '%s
' "${BACKUP_RETENTION_LOCAL_WEEKLY:-4}" ;;
    *) flowstate_log "Unknown backup kind: $1"; exit 1 ;;
  esac
}

remote_keep_count() {
  case "$1" in
    predeploy) printf '%s
' "${BACKUP_RETENTION_REMOTE_PREDEPLOY:-10}" ;;
    daily) printf '%s
' "${BACKUP_RETENTION_REMOTE_DAILY:-14}" ;;
    weekly) printf '%s
' "${BACKUP_RETENTION_REMOTE_WEEKLY:-8}" ;;
    *) flowstate_log "Unknown backup kind: $1"; exit 1 ;;
  esac
}

send_ops_alert() {
  local subject="$1"
  local message="$2"
  if [[ -x "$NODE_BIN" && -f "$APP_DIR/server/dist/ops/alert-cli.js" ]]; then
    "$NODE_BIN" "$APP_DIR/server/dist/ops/alert-cli.js" --subject "$subject" --message "$message" || true
  fi
}
