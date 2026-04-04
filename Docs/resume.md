# FlowState Resume Checkpoint

Last checkpoint update: 2026-04-05 +05:30
Purpose: Resume from this exact project state, not from zero.

## 1) Resume Snapshot (Current State)
- Recent changes since last checkpoint:
  - Phase 12.3 is now live on the VPS with R2-backed backups, backup timers, maintenance mode, readiness checks, rollback tooling, and the `update-safe.sh` wrapper.
  - Phase 12.4 local implementation is now complete.
  - Backup tooling now supports optional AES-256-GCM encrypted offsite archives, checksum-rich manifests, verification metadata, and scratch restore verification.
  - The migration runner now uses advisory locking, risky-migration detection, backup-aware gating for destructive changes, and postchecks.
  - The server now logs slow queries using a bounded threshold and the schema includes new hot-path indexes for threads, mentions, activity, cards, and audit-adjacent reads.
  - Client data fetching now has short-lived cache/dedupe + invalidation for stable reads, while realtime-heavy surfaces remain freshness-first.
  - The router now lazy-loads major pages and Vite chunking is tuned to reduce the old monolithic client bundle.
  - `Docs/vps-operations.md` is now the canonical guide for the 12.3/12.4 rollout and future safe deploy/backup operations.

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
  - Phase 12.3: live on prod but still pending a real safe-deploy run + rollback drill before sign-off
  - Phase 12.4: local implementation complete; VPS rollout, encrypted backup validation, restore-verify, and sign-off pending
  - Phase 12.5: not started
  - Phase 13: not started (future polish + CI/CD pipeline)

- Deployment state:
  - URL: `https://flo-state.in`
  - Health endpoint works over localhost and HTTPS.
  - First browser/user smoke test is still intentionally deferred so the intended real first user can become admin.
  - Because first signup becomes admin, do not let the wrong user register first.

## 2) Resume-Next Priority

Recommended next order:
1. Add the new 12.4 env values on the VPS, especially `BACKUP_ENCRYPTION_*`, `BACKUP_VERIFY_SCRATCH_MYSQL_URL`, and `DB_SLOW_QUERY_THRESHOLD_MS`.
2. Pull the latest repo state on the VPS.
3. Run `bash deploy/vps/update-safe.sh` as the first real safe deploy.
4. Create one encrypted manual backup and verify the encrypted R2 object + manifest.
5. Run `bash deploy/vps/restore-verify.sh <manifest-or-archive>` against the scratch MySQL target.
6. Perform one controlled rollback drill using a real backup manifest.
7. If all of that passes, mark both Phase 12.3 and 12.4 complete, then proceed to first-user signup/admin bootstrap + browser smoke test.

## 3) Production Update Workflow

There are now two production deploy paths.

Preferred Phase 12.3/12.4 path:
```bash
ssh flowstate-vps
cd /opt/flowstate/app
git pull origin master
bash deploy/vps/update-safe.sh
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
- Phase 12.3 alert emails still depend on SMTP settings plus `OPS_ALERT_EMAIL_TO`; until those are configured, alert hooks will safely no-op.
- Phase 12.4 adds backup encryption envs: `BACKUP_ENCRYPTION_ENABLED`, `BACKUP_ENCRYPTION_KEY`, and `BACKUP_ENCRYPTION_KEY_ID`.
- Phase 12.4 adds scratch restore verification via `BACKUP_VERIFY_SCRATCH_MYSQL_URL`; this must point at a scratch database, never production.
- `DB_SLOW_QUERY_THRESHOLD_MS` now controls bounded production slow-query timing logs.
- Upload files are still local-only in 12.3/12.4; database backups and release manifests are the primary rollback assets.

## 6) Working Rules I Must Remember on Resume

- Do not revert unrelated user changes.
- Avoid destructive git commands unless explicitly requested.
- Prefer `rg` for searching.
- Use focused edits; do not reformat unrelated files casually.
- If unexpected file changes appear during work, stop and assess before overwriting anything.

## 7) Immediate Follow-up Item

Complete the shared Phase 12.3/12.4 production sign-off:
- run one real `update-safe.sh` deploy on the VPS
- verify one encrypted offsite backup + manifest
- run one scratch restore verification drill
- run one rollback drill using a real manifest

After that, mark both phases complete and resume the first-user production signup + smoke test.

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

