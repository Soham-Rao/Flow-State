#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/ops-common.sh"

source_env

sudo install -d -m 0755 "$NGINX_MAINTENANCE_ROOT"
sudo install -m 0644 "$APP_DIR/deploy/vps/maintenance.html" "$NGINX_MAINTENANCE_ROOT/maintenance.html"
sudo touch "$NGINX_MAINTENANCE_FLAG"
sudo nginx -t
sudo systemctl reload nginx
flowstate_log "Maintenance mode enabled"
