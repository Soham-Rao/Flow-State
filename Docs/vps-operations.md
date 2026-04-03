# FlowState VPS Operations Guide

This guide is for ongoing deploys and routine maintenance after the one-time VPS bootstrap in `Docs/vps-setup.md` is already complete.

## Purpose

Use this document for:
- normal code updates after local development
- routine production deploys on the VPS
- health checks after deploys
- light maintenance tasks
- future automation planning

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

## Normal Update Flow

### Local machine

1. Make code changes locally.
2. Run local checks as needed:

```bash
bun run build
```

3. Commit and push to GitHub.

### VPS deploy

```bash
ssh flowstate-vps
cd /opt/flowstate/app
git status --short
git pull origin master
bun install --frozen-lockfile
bun run build
set -a
source /etc/flowstate/flowstate.env
set +a
node server/dist/db/migrate.js
sudo systemctl restart flowstate
sudo systemctl status flowstate --no-pager
curl https://flo-state.in/api/health
```

If `git status --short` is not empty, stop and inspect before pulling.

## Fast Path

If the repo is clean and you want the standard path:

```bash
ssh flowstate-vps
cd /opt/flowstate/app
bash deploy/vps/redeploy.sh
```

That script currently does:
- install dependencies
- build the app
- load production env
- run migrations
- restart `flowstate`
- print service status

Phase 12.2 note:
- if you add the new security env values (`ALLOWED_ORIGINS`, reset/rate-limit/audit retention settings), update `/etc/flowstate/flowstate.env` before running the redeploy
- password reset remains scaffold-only until SMTP/provider delivery is configured

## Post-Deploy Checks

Run these after any production update:

```bash
systemctl status flowstate --no-pager
journalctl -u flowstate -n 100 --no-pager
curl http://127.0.0.1:4000/api/health
curl https://flo-state.in/api/health
docker compose -f /opt/flowstate/infra/docker-compose.prod.yml ps
```

## Common Operations

### Restart the app only

```bash
sudo systemctl restart flowstate
sudo systemctl status flowstate --no-pager
```

### Reload Nginx after config changes

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Check MySQL container

```bash
cd /opt/flowstate/infra
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=100 mysql
```

### Check TLS renewal setup

```bash
systemctl status certbot.timer --no-pager
sudo certbot renew --dry-run
```

## Files To Be Careful With

- `/etc/flowstate/flowstate.env`
- `/opt/flowstate/infra/mysql.env`
- `/etc/nginx/sites-available/flowstate`
- `/etc/systemd/system/flowstate.service`

Rules:
- do not commit secrets into GitHub
- do not change MySQL credentials in env files without understanding whether the DB volume was already initialized
- do not delete `/var/lib/flowstate/uploads` unless you are intentionally deleting production uploads

## When Migrations Are Safe

Normal rule:
- if code changes touch schema or server data assumptions, run migrations every deploy
- if there are no new migrations, `node server/dist/db/migrate.js` should exit quietly

## Rollback Mindset

There is no full automated rollback yet.

Current manual rollback approach:
1. identify the last known good commit
2. on the VPS:

```bash
cd /opt/flowstate/app
git log --oneline -n 5
```

3. checkout or reset only if you intentionally want to roll back and understand the consequences
4. rebuild, rerun migrations only if appropriate, restart the service, and verify health again

Do not use destructive git commands casually on the VPS.

## Future CI/CD Direction

Later, this manual flow can become a Phase 13 pipeline:
- trigger on `git push`
- run build/test checks automatically
- optionally deploy only from a protected branch
- optionally add a staging environment first
- optionally add backup + rollback hooks around deploys

For now, the production deployment model is still:
- local changes
- push to GitHub
- pull/build/migrate/restart on VPS

## Logging, Retention, and Reset Notes

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
- keep journald compression/retention bounded on the VPS (for example `Compress=yes` and a sane `SystemMaxUse`) so logs do not grow without limit

Useful checks:

```bash
journalctl --disk-usage
sudo journalctl -u flowstate -n 200 --no-pager
sudo grep -E "^(SystemMaxUse|Compress)=" /etc/systemd/journald.conf
ls /etc/logrotate.d
```
