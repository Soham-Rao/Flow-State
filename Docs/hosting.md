# Hosting & Production Readiness Plan (Phase 12)

This file now tracks the single production path we are actually using for FlowState.

## Production Direction
- Host: BigRock Ubuntu 22.04 VPS
- Domain: `flo-state.in`
- Canonical URL: `https://flo-state.in`
- Redirect: `https://www.flo-state.in` -> `https://flo-state.in`
- Reverse proxy: Nginx on the host
- App runtime: FlowState server as a `systemd` service on the host
- Database: MySQL 8.0 in Docker, bound to `127.0.0.1` only
- Frontend delivery: Express serves `client/dist` from the same Node app

## Current Repo Status
- Express serves the built React app in production.
- Invite links use `PUBLIC_APP_URL`.
- Upload storage is configurable via `FLOWSTATE_UPLOADS_DIR`.
- Production env examples exist for both server and client.
- VPS deployment assets live under `deploy/vps/`.
- One-time Ubuntu setup and deploy steps live in `Docs/vps-setup.md`.

## Environment Split

### Local Dev
- URL: `http://localhost:5173`
- API: `http://localhost:4000`
- DB: `flowstate_dev`
- `MYSQL_URL`: `mysql://root:root@localhost:3306/flowstate_dev`
- Purpose: normal development work only

### Local Test
- DB: `flowstate_test`
- `MYSQL_URL`: `mysql://root:root@localhost:3306/flowstate_test`
- Purpose: automated tests only
- Tests reset/truncate this DB and re-run migrations as needed

### Production
- URL: `https://flo-state.in`
- API: `https://flo-state.in/api`
- DB: `flowstate_prod`
- `MYSQL_URL`: `mysql://flowstate:<password>@127.0.0.1:3306/flowstate_prod`
- `PUBLIC_APP_URL`: `https://flo-state.in`
- `FLOWSTATE_UPLOADS_DIR`: `/var/lib/flowstate/uploads`
- Purpose: real user data only

Rule: dev, test, and prod must never share a database.

## Phase 12.1 Scope

### Repo-owned work
- Production static serving from Express
- Public app URL support for invite links
- Configurable uploads root
- Production env examples
- VPS deployment assets:
  - `deploy/vps/docker-compose.prod.yml`
  - `deploy/vps/mysql.env.example`
  - `deploy/vps/flowstate.service`
  - `deploy/vps/nginx.flowstate.conf`
  - `deploy/vps/redeploy.sh`
- One-time VPS runbook in `Docs/vps-setup.md`

### Host-owned work
- Create SSH keys and non-root user
- Disable root/password SSH after key login is verified
- Install base packages, Docker, Node, Bun, Nginx, UFW, fail2ban
- Create `/etc/flowstate/flowstate.env`
- Start MySQL Docker container
- Build app and run migrations with production env loaded
- Install systemd service and Nginx config
- Point DNS and issue Let's Encrypt certificates
- Run production smoke tests

## Phase 12.1 Execution Order
1. Complete steps 1-4 in `Docs/vps-setup.md`.
2. Clone the public repo to `/opt/flowstate/app`.
3. Start production MySQL from `deploy/vps/docker-compose.prod.yml`.
4. Create `/etc/flowstate/flowstate.env` from `server/.env.production.example`.
5. Build the app and run `node server/dist/db/migrate.js` with production env loaded.
6. Install and start `flowstate.service`.
7. Install the Nginx site config and reload Nginx.
8. Verify DNS, issue SSL certs, and smoke test the app.

## Why This Architecture
- Nginx handles public HTTP/HTTPS, TLS termination, and websocket proxying cleanly.
- systemd keeps the Node app alive, restarts it on failure, and gives us logs through `journalctl`.
- MySQL in Docker keeps the DB isolated and easy to back up without over-containerizing the whole app.
- Keeping Node on the host is simpler to debug on a small VPS than full app-container orchestration.

## Operational Notes
- MySQL must not be exposed publicly; keep it bound to `127.0.0.1`.
- Uploads must live outside the public web root.
- Use `bash deploy/vps/redeploy.sh` for normal deploy updates after the server is bootstrapped.
- After the first successful deploy, the next work should move directly into Phase 12.2 hardening.

## References
- One-time server bootstrap: `Docs/vps-setup.md`
- Production env template: `server/.env.production.example`
- MySQL Docker template: `deploy/vps/docker-compose.prod.yml`
- systemd service: `deploy/vps/flowstate.service`
- Nginx config: `deploy/vps/nginx.flowstate.conf`
- Redeploy script: `deploy/vps/redeploy.sh`
