# FlowState Resume Checkpoint

Last checkpoint update: 2026-04-04 +05:30
Purpose: Resume from this exact project state, not from zero.

## 1) Resume Snapshot (Current State)
- Recent changes since last checkpoint:
  - Phase 12.1 is now complete on the BigRock Ubuntu VPS path.
  - Production app is live at `https://flo-state.in` behind Nginx with Let's Encrypt HTTPS.
  - The VPS uses key-only SSH for `flowstate`, with `sudo` for admin work and direct root SSH disabled.
  - UFW, fail2ban, nginx, docker, Node 22, and Bun are installed and working.
  - MySQL 8.0 runs in Docker on the VPS and is bound to `127.0.0.1` only.
  - The app runs under `flowstate.service` via systemd.
  - Certbot auto-renewal is active through `certbot.timer`.
  - `Docs/vps-setup.md` now includes a cheat sheet for the exact first-time VPS setup and bug fixes.
  - `Docs/vps-operations.md` now documents the normal update/deploy workflow after local changes are pushed.
  - Build issues found during deploy were fixed locally and pushed: board header `assignedCount`, `BoardMember.bio` test mocks, thread user summary `bio`, and stale TypeScript config drift (`ignoreDeprecations` / deprecated `baseUrl`).

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
  - Phase 12.1: complete
  - Phase 12.2: complete locally (security hardening)
  - Phase 12.3, 12.4, 12.5: not started
  - Phase 13: not started (future polish + CI/CD pipeline)

- Deployment state:
  - URL: `https://flo-state.in`
  - Health endpoint works over localhost, HTTP, and HTTPS.
  - The first browser/user smoke test is intentionally deferred so the intended real first user can become admin.
  - Because first signup becomes admin, do not let the wrong user register first.

## 2) Resume-Next Priority

Recommended next order:
1. Let the intended first user perform the first signup/admin bootstrap in production.
2. Run the browser smoke test after that first signup.
3. Deploy Phase 12.2 to production when you are ready.
4. Then continue with product work in the planned order:
   - Phase 7
   - Phase 10.5
   - Phase 11

Phase 13 is future work only; do not start it now unless the user explicitly reprioritizes toward automation.

## 3) Production Update Workflow

Current deployment model is manual and straightforward:
- make changes locally
- build/check locally as needed
- push to GitHub
- on VPS: pull, build, source env, run migrations, restart `flowstate`, verify health

Primary reference:
- `Docs/vps-operations.md`

Minimal VPS command pack:

```bash
ssh flowstate-vps
cd /opt/flowstate/app
git pull origin master
bun install --frozen-lockfile
bun run build
set -a
source /etc/flowstate/flowstate.env
set +a
node server/dist/db/migrate.js
sudo systemctl restart flowstate
curl https://flo-state.in/api/health
```

## 4) User Preferences to Preserve on Resume

- Package manager: Bun
- Language: TypeScript for client and server
- Monorepo style: plain workspaces (`client/`, `server/`)
- Assistant writes tests but user runs tests unless user explicitly asks otherwise
- Progress updates must be recorded in `Docs/context.md`
- Keep in-app confirmations; avoid browser-native confirm flows
- Preserve autosave UX where already established
- Avoid destructive git/file operations unless explicitly requested

## 5) Important Production Notes

- Use `ssh flowstate-vps`, not direct root SSH.
- Use `sudo -i` if root shell is needed.
- App env file: `/etc/flowstate/flowstate.env`
- Uploads dir: `/var/lib/flowstate/uploads`
- MySQL compose dir: `/opt/flowstate/infra`
- Service name: `flowstate`
- MySQL must remain bound to `127.0.0.1` only.
- Certbot renewal is automatic; `certbot.timer` should stay enabled.
- Password reset is only backend scaffolding right now: `forgot-password` always returns a generic success response and real delivery must wait for SMTP/provider setup.
- Security audit logs are stored compactly in MySQL with retention cleanup; host request/service logs should remain bounded via journald/logrotate compression and size limits.
- For passwords used inside URLs, prefer hex values over base64.
- Changing MySQL env values does not retroactively update credentials inside an already-initialized MySQL volume.

## 6) Working Rules I Must Remember on Resume

- Do not revert unrelated user changes.
- Avoid destructive git commands unless explicitly requested.
- Prefer `rg` for searching.
- Use focused edits; do not reformat unrelated files casually.
- If unexpected file changes appear during work, stop and assess before overwriting anything.

## 7) Immediate Follow-up Item

Wait for the intended first production user/admin signup, then run the browser smoke test. Separately, deploy the completed Phase 12.2 security hardening work to production before opening broader usage:
- login/register
- board create
- list create
- card create/edit
- threads route load
- focus route load
- optional upload check

## 8) Resume Command Pack

Local build:
```bash
bun run build
```

Production app checks:
```bash
systemctl status flowstate --no-pager
journalctl -u flowstate -n 100 --no-pager
docker compose -f /opt/flowstate/infra/docker-compose.prod.yml ps
systemctl status certbot.timer --no-pager
curl https://flo-state.in/api/health
```

This file is the resume checkpoint contract for continuing FlowState safely and quickly.
