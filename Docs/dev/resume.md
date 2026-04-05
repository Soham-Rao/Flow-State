# FlowState Resume Checkpoint

Last checkpoint update: 2026-04-05 +05:30  
Purpose: Resume from this exact project state, not from zero.

## 1) Resume Snapshot

- Phase 12.3 through 12.6 are now implemented and signed off.
- Production is live at `https://flo-state.in`.
- The official documentation system now lives in:
  - `Docs/user/` for end users
  - `Docs/dev/` for developers
- The old scratch docs now live in ignored `My_Docs/personal/`.
- Personal web-development learning notes now live in ignored `My_Docs/webdev/`.

## 2) Current Phase Status

- Phase 1.1 through 6.5: complete
- Phase 7: not started
- Phase 8: complete
- Phase 9: not started
- Phase 10.1 through 10.4: complete
- Phase 10.5: deferred
- Phase 11: not started
- Phase 12.0 through 12.6: complete
- Phase 12.7: not started
- Phase 13: not started

## 3) Canonical References

- Tracker and history: `Docs/dev/context.md`
- Project orientation: `Docs/dev/project/product-overview-and-repository-orientation.md`
- Runtime/build model: `Docs/dev/project/runtime-and-build-mental-model.md`
- Frontend architecture: `Docs/dev/architecture/frontend-architecture.md`
- Backend architecture: `Docs/dev/architecture/backend-architecture.md`
- Data/auth/permissions: `Docs/dev/architecture/data-auth-and-permissions.md`
- Deploy/backup/rollback ops: `Docs/dev/operations/deploy-backup-restore-and-rollback.md`
- VPS/environment reference: `Docs/dev/operations/vps-and-environment-reference.md`
- Testing/debugging cheat sheet: `Docs/dev/quality/testing-debugging-and-dev-cheatsheet.md`
- Feature/API/DB map: `Docs/dev/reference/api-db-and-feature-map.md`

## 4) Production Update Workflow

Preferred production path:

```bash
ssh flowstate-vps
cd /opt/flowstate/app
git pull origin master
bash deploy/vps/update-safe.sh
```

Faster/simple path when intentionally skipping maintenance + predeploy backup:

```bash
ssh flowstate-vps
cd /opt/flowstate/app
git pull origin master
bash deploy/vps/redeploy.sh
```

## 5) Important Production Notes

- Use `ssh flowstate-vps`, not direct root SSH.
- App env file: `/etc/flowstate/flowstate.env`
- Uploads dir: `/var/lib/flowstate/uploads`
- Backups dir: `/var/lib/flowstate/backups`
- Service name: `flowstate`
- MySQL stays localhost-bound on the VPS.
- Backup encryption envs are live in production.
- Scratch restore verification must never target production DBs.

## 6) Working Rules

- Do not revert unrelated user changes.
- Avoid destructive git commands unless explicitly requested.
- Prefer `rg` for search.
- Keep docs updated in `Docs/dev/` when product or deploy behavior changes.
- Treat `My_Docs/` as personal/reference-only, not canonical team docs.

## 7) Suggested Next Step

The next major follow-up is Phase 12.7:

- SMTP-backed password reset delivery
- support/contact email
- alert delivery
- optional verification/invite mail improvements

## 8) Command Pack

Local verification:

```bash
bun run --cwd server build
bun run --cwd client build
bun run --cwd server test
bun run --cwd client test
```

Production checks:

```bash
systemctl status flowstate --no-pager
journalctl -u flowstate -n 100 --no-pager
curl http://127.0.0.1:4000/api/health/ready
curl https://flo-state.in/api/health/ready
```
