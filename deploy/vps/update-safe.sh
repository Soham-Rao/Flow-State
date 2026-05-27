#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/ops-common.sh"

DEPLOY_REMOTE="${DEPLOY_REMOTE:-origin}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-master}"
PUBLIC_READY_URL="${PUBLIC_READY_URL:-https://flo-state.in/api/health/ready}"
WORK_LOG_DIR="${WORK_LOG_DIR:-/tmp/flowstate-ops}"
DEPLOY_TIMEOUT_SECONDS="${DEPLOY_TIMEOUT_SECONDS:-1800}"
mkdir -p "$WORK_LOG_DIR"

source_env

step_count=0

print_ok() {
  printf '[ok] %s\n' "$1"
}

print_fail() {
  printf '[fail] %s\n' "$1" >&2
}

run_step() {
  local label="$1"
  shift
  local log_file="$WORK_LOG_DIR/step-$((++step_count)).log"
  printf '[info] %s log=%s\n' "$label" "$log_file"
  if "$@" > >(tee "$log_file") 2>&1; then
    print_ok "$label"
    return 0
  fi

  print_fail "$label"
  tail -n 120 "$log_file" >&2
  return 1
}

ensure_system_tools() {
  local -a missing_packages=()

  command -v git >/dev/null 2>&1 || missing_packages+=(git)
  command -v curl >/dev/null 2>&1 || missing_packages+=(curl)
  command -v zstd >/dev/null 2>&1 || missing_packages+=(zstd)
  command -v aws >/dev/null 2>&1 || missing_packages+=(awscli)
  command -v timeout >/dev/null 2>&1 || missing_packages+=(coreutils)

  if (( ${#missing_packages[@]} == 0 )); then
    print_ok "System tools present"
    return 0
  fi

  sudo apt-get update >/tmp/flowstate-ops/apt-update.log 2>&1
  sudo apt-get install -y "${missing_packages[@]}"
}

show_summary() {
  local current_sha target_sha
  current_sha="$(git rev-parse --short HEAD)"
  target_sha="$(git rev-parse --short "$DEPLOY_REMOTE/$DEPLOY_BRANCH")"
  printf '[info] branch=%s remote=%s current=%s target=%s\n' "$DEPLOY_BRANCH" "$DEPLOY_REMOTE" "$current_sha" "$target_sha"
  printf '[info] public-ready=%s\n' "$PUBLIC_READY_URL"
}

main() {
  run_step "Change to app directory" bash -lc "cd '$APP_DIR'"
  cd "$APP_DIR"

  run_step "Load environment" bash -lc "source '$ENV_FILE'"
  run_step "Check Bun" test -x "$BUN_BIN"
  run_step "Check Node" test -x "$NODE_BIN"
  run_step "Ensure system tools" ensure_system_tools
  run_step "Fetch latest remote state" git fetch "$DEPLOY_REMOTE" "$DEPLOY_BRANCH"
  show_summary
  run_step "Run safe deploy" timeout "${DEPLOY_TIMEOUT_SECONDS}s" bash "$SCRIPT_DIR/deploy-safe.sh"
  run_step "Verify local readiness" wait_for_local_health "http://127.0.0.1:4000/api/health/ready" 20 1
  run_step "Verify public readiness" curl -fsS "$PUBLIC_READY_URL"
  run_step "Check service status" sudo systemctl is-active --quiet "$SERVICE_NAME"
  run_step "Check daily backup timer" sudo systemctl is-active --quiet flowstate-backup-daily.timer
  run_step "Check weekly backup timer" sudo systemctl is-active --quiet flowstate-backup-weekly.timer

  printf '[done] Safe deploy finished successfully\n'
}

main "$@"
