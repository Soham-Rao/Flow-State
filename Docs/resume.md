# FlowState Resume Checkpoint

Last checkpoint update: 2026-04-04 +05:30
Purpose: Resume from this exact project state, not from zero.

## 1) Resume Snapshot (Current State)
- Recent changes since last checkpoint:
  - Phase 12.3 local implementation is now complete.
  - The client now has a global error boundary plus chunk-load recovery UI for bad post-deploy asset states.
  - The server now exposes `/api/health/live` and `/api/health/ready`, uses structured JSON logging, and shuts down gracefully on signals/fatal process events.
  - A new safe deploy path now exists under `deploy/vps/deploy-safe.sh` with maintenance mode, predeploy backup creation, readiness checks, rollback hooks, and alert hooks.
  - New ops scripts were added for maintenance toggling, compressed MySQL backups, local DB restore, and rollback.
  - `deploy/vps/redeploy.sh` remains the fast path, but now also verifies localhost readiness before finishing.
  - Cloudflare R2 upload support is coded but not configured yet; real offsite backup validation still needs the Cloudflare account, bucket, and keys.
  - `Docs/vps-operations.md` is now the canonical guide for the 12.3 rollout and future safe deploy/backup operations.

- Phase status:
  - Phase 1.1, 1.2, 1.3: complete
  - Phase 2.1, 2.2, 2.3: complete
  - Phase 3.1, 3.2, 3.3: complete
  - Phase 4, 4.1, 4.2, 4.3, 4.4: complete
  - Phase 5.1, 5.2, 5.3, 5.4, 5.5: complete
  - Phase 6.1, 6.2, 6.3, 6.4, 6.5: complete
  - Phase 7: not started
  - Phase 8: complete
  - Phase 9: not started
  - Phase 10.1, 10.2, 10.3, 10.4: complete
  - Phase 10.5: deferred
  - Phase 11: not started
  - Phase 12.0: complete
  - Phase 12.1: complete and live
  - Phase 12.2: complete and live
  - Phase 12.3: local implementation complete; Cloudflare R2 + VPS rollout pending
  - Phase 12.4, 12.5: not started
  - Phase 13: not started (future polish + CI/CD pipeline)

- Deployment state:
  - URL: `https://flo-state.in`
  - Health endpoint works over localhost and HTTPS.
  - First browser/user smoke test is still intentionally deferred so the intended real first user can become admin.
  - Because first signup becomes admin, do not let the wrong user register first.

## 2) Resume-Next Priority

Recommended next order:
1. Create the Cloudflare account + R2 bucket + R2 access keys for backup storage.
2. Add the new 12.3 backup/alert env values on the VPS.
3. Install the remaining VPS-side 12.3 prerequisites (`awscli`, `zstd`, maintenance/backup timer assets).
4. Roll out the new Nginx maintenance config, backup timers, and safe deploy scripts on the VPS.
5. Validate one manual local backup, one R2 upload, one safe deploy, and one rollback scenario on the VPS.
6. After the deployment path is proven, let the intended first user perform the first signup/admin bootstrap and then run the browser smoke test.

## 3) Production Update Workflow

There are now two production deploy paths.

Preferred Phase 12.3 path:
```bash
ssh flowstate-vps
cd /opt/flowstate/app
git pull origin master
bash deploy/vps/deploy-safe.sh
```

Fast path for low-risk updates when you intentionally do not want maintenance mode + predeploy backup:
```bash
ssh flowstate-vps
cd /opt/flowstate/app
git pull origin master
bash deploy/vps/redeploy.sh
```

Primary reference:
- `Docs/vps-operations.md`

## 4) User Preferences to Preserve on Resume

- Package manager: Bun
- Language: TypeScript for client and server
- Monorepo style: plain workspaces (`client/`, `server/`)
- Assistant may run local tests when the user explicitly allows it; otherwise default to providing commands
- Progress updates must be recorded in `Docs/context.md`
- Keep in-app confirmations; avoid browser-native confirm flows
- Preserve autosave UX where already established
- Avoid destructive git/file operations unless explicitly requested

## 5) Important Production Notes

- Use `ssh flowstate-vps`, not direct root SSH.
- Use `sudo -i` if root shell is needed.
- App env file: `/etc/flowstate/flowstate.env`
- Uploads dir: `/var/lib/flowstate/uploads`
- Backups dir (planned/default): `/var/lib/flowstate/backups`
- MySQL compose dir: `/opt/flowstate/infra`
- Service name: `flowstate`
- MySQL must remain bound to `127.0.0.1` only.
- Certbot renewal is automatic; `certbot.timer` should stay enabled.
- Password reset is only backend scaffolding right now: `forgot-password` always returns a generic success response and real delivery must wait for SMTP/provider setup.
- Security audit logs are stored compactly in MySQL with retention cleanup; host request/service logs should remain bounded via journald/logrotate compression and size limits.
- Phase 12.3 offsite backups depend on Cloudflare R2 env values and are not active until those values exist on the VPS.
- Phase 12.3 alert emails depend on SMTP settings plus `OPS_ALERT_EMAIL_TO`; until those are configured, alert hooks will safely no-op.
- Upload files are still local-only in 12.3; database backups and release manifests are the primary rollback assets.

## 6) Working Rules I Must Remember on Resume

- Do not revert unrelated user changes.
- Avoid destructive git commands unless explicitly requested.
- Prefer `rg` for searching.
- Use focused edits; do not reformat unrelated files casually.
- If unexpected file changes appear during work, stop and assess before overwriting anything.

## 7) Immediate Follow-up Item

Move Phase 12.3 from local-only to real production ops:
- create the Cloudflare/R2 side
- add the new env block on the VPS
- install `awscli` + `zstd`
- wire maintenance mode + backup timers + safe deploy assets
- verify backup, safe deploy, and rollback on the VPS

After that, resume the first-user production signup + smoke test.

## 8) Resume Command Pack

Local verification:
```bash
bun run --cwd server build
bun run --cwd client build
bun run --cwd server test
bun run --cwd client test
```

Preferred production deploy path:
```bash
ssh flowstate-vps
cd /opt/flowstate/app
git pull origin master
bash deploy/vps/deploy-safe.sh
```

Production checks:
```bash
systemctl status flowstate --no-pager
journalctl -u flowstate -n 100 --no-pager
docker compose -f /opt/flowstate/infra/docker-compose.prod.yml ps
curl http://127.0.0.1:4000/api/health/ready
curl https://flo-state.in/api/health/ready
```

This file is the resume checkpoint contract for continuing FlowState safely and quickly.
