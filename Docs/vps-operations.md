# FlowState VPS Operations Guide

This guide is for ongoing deploys and routine maintenance after the one-time VPS bootstrap in `Docs/vps-setup.md` is already complete.

## Purpose

Use this document for:
- normal code updates after local development
- safe production deploys on the VPS
- maintenance mode usage
- backup, restore, and rollback operations
- Cloudflare R2 setup for offsite backups
- production health checks and retention checks

Use `Docs/vps-setup.md` only for first-time server setup or disaster rebuilds.

## Current Production Shape

- Host: BigRock Ubuntu 22.04 VPS
- App URL: `https://flo-state.in`
- Reverse proxy: Nginx on host
- App runtime: `flowstate.service` under systemd
- Database: MySQL 8.0 in Docker
- Uploads: `/var/lib/flowstate/uploads`
- App repo: `/opt/flowstate/app`
- App env: `/etc/flowstate/flowstate.env`
- Infra compose dir: `/opt/flowstate/infra`
- Preferred 12.3 backup dir: `/var/lib/flowstate/backups`

## Deploy Paths

### Preferred safe deploy path

Use this once Phase 12.3 VPS wiring is in place:

```bash
ssh flowstate-vps
cd /opt/flowstate/app
git pull origin master
bash deploy/vps/deploy-safe.sh
```

What it does:
- enables maintenance mode
- creates a compressed predeploy MySQL backup
- optionally uploads backup + manifest to R2
- rebuilds and migrates
- restarts the app
- verifies localhost readiness
- disables maintenance mode on success
- attempts rollback on failure

### Fast redeploy path

Use this only when you intentionally want the simpler flow without maintenance mode and predeploy backup:

```bash
ssh flowstate-vps
cd /opt/flowstate/app
git pull origin master
bash deploy/vps/redeploy.sh
```

That script now does:
- install dependencies
- build the app
- load production env
- run migrations
- restart `flowstate`
- verify localhost readiness
- print service status

## Phase 12.3 VPS Prerequisites

Before the first safe deploy on the VPS:

```bash
sudo apt update
sudo apt install -y awscli zstd
sudo install -d -m 0750 -o flowstate -g flowstate /var/lib/flowstate/backups
sudo install -d -m 0755 /var/www/flowstate-maintenance
```

Then refresh the deployed ops assets from the repo:

```bash
cd /opt/flowstate/app
sudo cp deploy/vps/nginx.flowstate.conf /etc/nginx/sites-available/flowstate
sudo ln -sf /etc/nginx/sites-available/flowstate /etc/nginx/sites-enabled/flowstate
sudo cp deploy/vps/flowstate-backup-daily.service /etc/systemd/system/flowstate-backup-daily.service
sudo cp deploy/vps/flowstate-backup-daily.timer /etc/systemd/system/flowstate-backup-daily.timer
sudo cp deploy/vps/flowstate-backup-weekly.service /etc/systemd/system/flowstate-backup-weekly.service
sudo cp deploy/vps/flowstate-backup-weekly.timer /etc/systemd/system/flowstate-backup-weekly.timer
sudo systemctl daemon-reload
sudo systemctl enable --now flowstate-backup-daily.timer
sudo systemctl enable --now flowstate-backup-weekly.timer
sudo nginx -t
sudo systemctl reload nginx
```

## Cloudflare R2 Setup Checklist

1. Create or sign in to your Cloudflare account.
2. Open R2 and create a bucket for backups.
3. Create an R2 access key pair scoped to that bucket.
4. Copy these values:
   - account id
   - bucket name
   - access key id
   - secret access key
5. Build the endpoint:
   - `https://<account-id>.r2.cloudflarestorage.com`
6. Add the values to `/etc/flowstate/flowstate.env`.

Recommended env block:

```env
BACKUP_LOCAL_DIR=/var/lib/flowstate/backups
BACKUP_R2_BUCKET=your-r2-bucket-name
BACKUP_R2_PREFIX=flowstate
BACKUP_R2_ACCOUNT_ID=your-cloudflare-account-id
BACKUP_R2_ACCESS_KEY_ID=your-r2-access-key-id
BACKUP_R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
BACKUP_R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
BACKUP_RETENTION_LOCAL_PREDEPLOY=5
BACKUP_RETENTION_LOCAL_DAILY=7
BACKUP_RETENTION_LOCAL_WEEKLY=4
BACKUP_RETENTION_REMOTE_PREDEPLOY=10
BACKUP_RETENTION_REMOTE_DAILY=14
BACKUP_RETENTION_REMOTE_WEEKLY=8
OPS_ALERT_EMAIL_TO=you@example.com
OPS_ALERT_EMAIL_FROM=FlowState Ops <ops@flo-state.in>
```

Notes:
- `BACKUP_R2_ENDPOINT` is optional if `BACKUP_R2_ACCOUNT_ID` is set, but storing it explicitly is fine.
- Alert email envs only matter once SMTP is configured.
- Uploads are still local-only in 12.3; R2 currently covers DB archives and backup manifests.

## Maintenance Mode

Manual maintenance controls:

```bash
cd /opt/flowstate/app
bash deploy/vps/maintenance-enable.sh
bash deploy/vps/maintenance-disable.sh
```

Behavior:
- maintenance mode is controlled by `/etc/nginx/flowstate-maintenance-on`
- users receive a branded `503` maintenance page instead of raw `502` errors during planned maintenance

## Backup Commands

Create a backup manually:

```bash
cd /opt/flowstate/app
bash deploy/vps/backup-now.sh daily
```

Kinds:
- `predeploy`
- `daily`
- `weekly`

Output:
- compressed SQL archive: `<BACKUP_LOCAL_DIR>/<kind>/<backup-id>.sql.zst`
- manifest JSON: `<BACKUP_LOCAL_DIR>/manifests/<kind>/<backup-id>.json`

If R2 is configured, the script also uploads both files and prunes old remote backups by retention.

## Restore and Rollback

### Restore a local DB archive

```bash
cd /opt/flowstate/app
bash deploy/vps/restore-db.sh /var/lib/flowstate/backups/predeploy/<backup-id>.sql.zst
```

### Roll back code and optionally DB

```bash
cd /opt/flowstate/app
bash deploy/vps/rollback.sh <target-sha> <manifest-path> [auto|always|never]
```

Examples:

```bash
bash deploy/vps/rollback.sh abc1234 /var/lib/flowstate/backups/manifests/predeploy/20260404T120000Z-predeploy-abc1234.json always
bash deploy/vps/rollback.sh abc1234 /var/lib/flowstate/backups/manifests/predeploy/20260404T120000Z-predeploy-abc1234.json never
```

Rules of thumb:
- use `never` for code-only rollback when schema/data compatibility is clearly safe
- use `always` when a failed migration or incompatible schema change may have touched production data
- `auto` currently restores when a manifest is provided through the safe deploy path

## Health and Verification

### App health

```bash
curl http://127.0.0.1:4000/api/health/live
curl http://127.0.0.1:4000/api/health/ready
curl https://flo-state.in/api/health
curl https://flo-state.in/api/health/ready
```

### Service checks

```bash
systemctl status flowstate --no-pager
journalctl -u flowstate -n 100 --no-pager
docker compose -f /opt/flowstate/infra/docker-compose.prod.yml ps
```

### Backup timer checks

```bash
systemctl status flowstate-backup-daily.timer --no-pager
systemctl status flowstate-backup-weekly.timer --no-pager
```

## SMTP / Alert Notes

Ops alerts are sent by the server-side alert helper and require SMTP to be configured.

Relevant env:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=flowstate
SMTP_PASS=change-me
SMTP_FROM=FlowState <no-reply@flo-state.in>
SMTP_SECURE=false
OPS_ALERT_EMAIL_TO=you@example.com
OPS_ALERT_EMAIL_FROM=FlowState Ops <ops@flo-state.in>
```

Current behavior:
- if SMTP or `OPS_ALERT_EMAIL_TO` is missing, alert hooks safely no-op
- alerts are intended for backup/deploy/rollback failures, not every application error

## Logging and Retention

### Password reset status

Phase 12.2 only adds backend scaffolding:
- `POST /api/auth/forgot-password` always returns a generic success response
- no user enumeration is exposed
- reset delivery is not complete until SMTP/provider wiring is added later

### Audit log retention

Security audit rows live in MySQL and are intentionally compact:
- no raw passwords, tokens, auth headers, or large request bodies
- compact metadata only
- retention cleanup is controlled by app env (`AUDIT_LOG_RETENTION_DAYS`)

### Host log retention

Application stdout/stderr and service logs remain host-managed:
- `flowstate` logs go through systemd/journald
- Nginx logs remain under host logrotate policy
- keep journald compression/retention bounded on the VPS so logs do not grow without limit

Useful checks:

```bash
journalctl --disk-usage
sudo journalctl -u flowstate -n 200 --no-pager
sudo grep -E "^(SystemMaxUse|Compress)=" /etc/systemd/journald.conf
ls /etc/logrotate.d
```

## Current Limitations

- Upload files are not yet backed up offsite.
- Restore currently expects a local archive path; R2 download helpers can be added later if needed.
- Safe deploy/rollback assumes one app service and one MySQL container on the single VPS.
- The first production browser smoke test is still pending because the intended real first admin has not signed up yet.
