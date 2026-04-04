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
  printf '%s\n' "[flowstate-ops] $*"
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

wait_for_local_health() {
  local url="${1:-http://127.0.0.1:4000/api/health/ready}"
  local timeout_seconds="${2:-20}"
  local interval_seconds="${3:-1}"
  local elapsed=0

  while (( elapsed < timeout_seconds )); do
    if curl -fsS "$url" >/dev/null; then
      return 0
    fi
    sleep "$interval_seconds"
    elapsed=$((elapsed + interval_seconds))
  done

  flowstate_log "Timed out waiting for local health endpoint: $url"
  return 1
}

backup_encryption_enabled() {
  [[ "${BACKUP_ENCRYPTION_ENABLED:-false}" == "true" ]]
}

r2_is_configured() {
  [[ -n "${BACKUP_R2_BUCKET:-}" ]] || return 1
  [[ -n "${BACKUP_R2_ACCESS_KEY_ID:-}" ]] || return 1
  [[ -n "${BACKUP_R2_SECRET_ACCESS_KEY:-}" ]] || return 1
  [[ -n "${BACKUP_R2_ENDPOINT:-}" || -n "${BACKUP_R2_ACCOUNT_ID:-}" ]]
}

resolve_r2_endpoint() {
  if [[ -n "${BACKUP_R2_ENDPOINT:-}" ]]; then
    printf '%s\n' "$BACKUP_R2_ENDPOINT"
    return
  fi

  if [[ -n "${BACKUP_R2_ACCOUNT_ID:-}" ]]; then
    printf 'https://%s.r2.cloudflarestorage.com\n' "$BACKUP_R2_ACCOUNT_ID"
    return
  fi

  return 1
}

aws_r2() {
  local endpoint
  endpoint="$(resolve_r2_endpoint)"
  AWS_ACCESS_KEY_ID="$BACKUP_R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$BACKUP_R2_SECRET_ACCESS_KEY" AWS_DEFAULT_REGION="auto" aws --endpoint-url "$endpoint" "$@"
}

local_keep_count() {
  case "$1" in
    predeploy) printf '%s\n' "${BACKUP_RETENTION_LOCAL_PREDEPLOY:-5}" ;;
    daily) printf '%s\n' "${BACKUP_RETENTION_LOCAL_DAILY:-7}" ;;
    weekly) printf '%s\n' "${BACKUP_RETENTION_LOCAL_WEEKLY:-4}" ;;
    *) flowstate_log "Unknown backup kind: $1"; exit 1 ;;
  esac
}

remote_keep_count() {
  case "$1" in
    predeploy) printf '%s\n' "${BACKUP_RETENTION_REMOTE_PREDEPLOY:-10}" ;;
    daily) printf '%s\n' "${BACKUP_RETENTION_REMOTE_DAILY:-14}" ;;
    weekly) printf '%s\n' "${BACKUP_RETENTION_REMOTE_WEEKLY:-8}" ;;
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