# Hosting & Production Readiness Plan (Phase 12)

This file captures the next steps for production hosting, security hardening, update pipeline, and operational readiness for FlowState. It is the reference checklist for implementation.

## Hosting Assumptions
- Host: BigRock (HostGator family) with cPanel.
- Domain: flo-state.in
- App: Express API + React static build served from the same Node service.

## Domain Notes (www vs apex)
- Canonical domain: `https://flo-state.in`
- Redirect `https://www.flo-state.in` -> `https://flo-state.in`
- CORS should only allow the canonical domain.


## Production MySQL (Docker on Host)
> Goal: run **one** MySQL container for **prod only** on the hosting server.

**If the plan is a VPS/dedicated box with Docker support (preferred):**
1. Provision VPS (BigRock/HostGator VPS or equivalent). Install Docker + Docker Compose.
2. Create a `docker-compose.prod.yml` on the server (MySQL only):
   - `mysql:8.0` image
   - `MYSQL_ROOT_PASSWORD` (strong)
   - `MYSQL_DATABASE=flowstate_prod`
   - Volume: `mysql_prod_data:/var/lib/mysql`
   - Optional init SQL to create a non-root user
3. Bind MySQL to **localhost** or a **private network** only (avoid public exposure).
4. Start: `docker compose -f docker-compose.prod.yml up -d`
5. Set server `MYSQL_URL` to the prod DB (e.g. `mysql://USER:PASS@127.0.0.1:3306/flowstate_prod`).
6. Backups: nightly `mysqldump` + volume snapshots (or host-level backups).

**If the plan is shared cPanel (no Docker):**
- Use cPanel MySQL instead of Docker.
- Create a DB + user in cPanel and set `MYSQL_URL` to that.
- Same prod-only rule applies; do **not** point dev/test at this DB.

## Local Docker (Dev/Test)
- Local Docker Desktop runs **dev + test** DBs only.
- The current `docker-compose.yml` provisions:
  - `flowstate_dev` (default dev)
  - `flowstate_test` (tests)
- These are isolated from prod by **host separation** and **different `MYSQL_URL` values**.

## Environment Config Cheat Sheet

**Local Dev (laptop)**
- App URL: `http://localhost:5173`
- API URL: `http://localhost:4000`
- `MYSQL_URL`: `mysql://root:root@localhost:3306/flowstate_dev`
- Purpose: development data only

**Local Tests (laptop)**
- `MYSQL_URL`: `mysql://root:root@localhost:3306/flowstate_test`
- Purpose: automated tests only

**Production (hosting server)**
- App URL: `https://flo-state.in`
- API URL: `https://flo-state.in/api`
- `MYSQL_URL`: `mysql://<prod_user>:<prod_pass>@127.0.0.1:3306/flowstate_prod`
- Purpose: real production data only

**Rule**: never point local dev/test at the production DB. Each environment must have its own `MYSQL_URL`.

## Low-Cost Node Hosting (External) — Optional Path
> Use this if shared cPanel doesn’t provide “Setup Node.js App”. Keep BigRock/HostGator for domain + email, deploy the Node app elsewhere.

**Recommended low-cost options**
- Render
- Railway
- Fly.io
- DigitalOcean App Platform

### Step-by-step (generic)
1. **Create a new app** on the host and connect your GitHub repo.
2. **Set build + start commands**
   - Build client: `bun run --cwd client build`
   - Build server (if needed): `bun run --cwd server build`
   - Start server: `bun run --cwd server start` (or `node server/dist/index.js` depending on host)
3. **Set environment variables** (in host UI):
   - `NODE_ENV=production`
   - `MYSQL_URL=...` (prod DB)
   - `JWT_SECRET=...`
   - `JWT_EXPIRES_IN=7d`
   - `CLIENT_ORIGIN=https://flo-state.in`
4. **Provision a production MySQL**
   - If host offers managed MySQL, use that.
   - Otherwise use a managed MySQL service (Planetscale/Neon/MySQL on another VPS).
5. **Run migrations**
   - Trigger `bun run --cwd server db:migrate` during deploy or as a post-deploy command.
6. **Point the domain**
   - In BigRock/HostGator DNS, set `flo-state.in` A/CNAME to the host’s provided endpoint.
7. **Verify**
   - Open `https://flo-state.in`
   - Hit `/api/health`
   - Confirm DB reads/writes and auth flows.

**Note:** This keeps prod data isolated. Local dev/test continue using local Docker DBs.
## Phase 12 Subphases (Well-defined)

### 12.0 Database Platform Switch (Pre‑Prod)
- Decide and switch DB platform **before production** (test data only).
- Perform **DDL-only migrations** (schema/constraints/indexes). No DML/data transfer.
- Remove any SQLite-specific assumptions and update Drizzle config + connection.
- Validate that schema matches existing constraints and indices.

### 12.1 Hosting + Deployment Setup
- Confirm plan supports Node.js apps and Git Version Control in cPanel (enable shell access if required).
- DNS: point `flo-state.in` to hosting (A/AAAA records), enable SSL (AutoSSL if available).
- Optional: add `www.flo-state.in` and 301 redirect to the canonical domain.
- Set production `.env` (server + client build). Remove defaults for secrets.
- Use cPanel Git Version Control to pull from GitHub; add `.cpanel.yml` deploy script.
- Configure Node app entrypoint, environment variables, and restart behavior in cPanel.
- Ensure database files and uploads live in persistent storage outside public web root.
- Backups: define frequency + verify restore process.
- Enable HostGator/BigRock firewall/WAF options + optional SiteLock protection.

### 12.2 Security Hardening
- **Sanitization**: add server-side sanitizers for all user text fields (XSS/HTML/SQL injection vectors).
- **CORS**: lock to `https://flo-state.in` (canonical) + keep auth required.
- **Auth**: keep strict auth middleware on all protected routes (already in place).
- **Rate limits**: per-route rate limits (login/register, uploads, mentions, etc).
- **Password reset**: add reset token flow with 30‑minute expiry.
- **CSRF**: if cookies are used, add CSRF protection; otherwise document token-only flow.
- **Bruteforce protection**: throttle failed logins and suspicious auth endpoints.
- **CSP**: add a strict Content Security Policy.
- **Audit logging**: central audit log for admin/privileged actions.

### 12.3 Reliability + Observability
- **Frontend errors**: app-level ErrorBoundary + per-route fallbacks (no stack traces to users).
- **Logging**: reduce production logging, add request IDs, log errors only.
- **Alerts**: configure error alerts + uptime monitoring.
- **Rollback**: define rollback process (blue/green, snapshot + restore, or tag-based rollback).

### 12.4 Data Durability + Performance
- **Encryption at rest**: encrypt all stored data (not just DM messages).
- **Compression**: lossless compression for old/sensitive data (define policy).
- **Atomic migrations**: wrap migrations in transactions.
- **Caching**: add response caching where safe, plus compression middleware.
- **Polling reduction**: remove duplicate polling and consolidate intervals.

### 12.5 User-Facing Docs
- Create beginner-friendly user tutorials for core flows (boards, cards, comments, mentions).
- Simple onboarding for first-time computer users.

## Security + Reliability Checklist (16 Points)
1. Boards visibility: ACCEPTED — boards are global by design. Optional future: private boards with board-level overrides (similar to channels).
2. Input sanitization: TODO — add server-side sanitization for XSS/HTML/SQL injection vectors before DB writes.
3. CORS strictness: TODO — lock to `flo-state.in` (canonical) + keep auth required. Document HostGator firewall/WAF usage.
4. Rate limiting: TODO — add per-route rate limits (auth, uploads, mentions, etc.).
5. Password reset: TODO — add reset tokens + 30-minute expiry.
6. Frontend error boundaries: TODO — add per-route + app-level error boundaries and fallback UIs.
7. Indexing: DONE — indexes already present for common query paths.
8. Logging: TODO — reduce prod logging, add request IDs + error-only logs.
9. Alerts: TODO — add uptime + error alerts (Sentry/UptimeRobot/etc).
10. Rollbacks: TODO — define rollback strategy (blue/green or snapshot + restore).
11. Extra security: TODO — CSRF (if cookies), brute-force protection, CSP, central audit logging.
12. Costs: TODO — add compression, caching, reduce polling, and avoid duplicate fetches.
13. Prod DB reset: DONE — production DB should never be cleared; test reset path only.
14. Encryption + compression: TODO — encrypt all stored data; compress with lossless methods.
15. Migrations atomic: TODO — wrap migrations in transactions and verify ACID behavior.
16. Secrets in env: TODO — remove fallback secrets and require env vars in production.

## DB Choice & Migration Planning (DDL-only)
- Current decision: move to **MySQL** (cPanel-native, no external account required).
- Perform **DDL-only migration first** (schema/constraints/indexes), no data migration.
- Ensure schema parity with existing SQLite constraints and indices.

## Update Pipeline (GitHub -> Prod)
1. Work in feature branches; open PRs for review.
2. Run tests and type checks in CI.
3. On merge to main: build client, run migrations, deploy to cPanel-managed repo.
4. Deploy using `.cpanel.yml` tasks (build, copy assets, restart app).
5. Post-deploy: smoke test critical flows (auth, boards, threads, uploads).
6. If failure: rollback to previous commit (or restore backup snapshot).

TODO: Create user-facing docs/tutorials (assume first-time computer users).




## Server Setup & Maintenance (Ubuntu 22.04 VPS)
> Production VPS, Docker-based deployment, MySQL + Node, Nginx reverse proxy.

### 1) Base Access + SSH Hardening
1. **Create a non-root user** (e.g. `flowstate`) and add to sudo.
2. **SSH keys only**: disable password login.
3. **Change SSH port** (optional) and allow only from your IP range if possible.
4. **Install fail2ban** to block brute-force attempts.

### 2) Firewall + Network
1. Enable UFW:
   - Allow `22` (SSH), `80` (HTTP), `443` (HTTPS).
   - Deny all other inbound ports.
2. Verify SSH access before locking down.

### 3) Docker + Docker Compose
1. Install Docker Engine + Docker Compose plugin.
2. Add your user to the `docker` group.
3. Create a dedicated docker network: `flowstate-net`.

### 4) MySQL (Docker, prod only)
1. Run MySQL 8.0 container with:
   - volume: `mysql_prod_data:/var/lib/mysql`
   - DB: `flowstate_prod`
   - strong root password + app user
2. Bind MySQL to **localhost** only (no public exposure).
3. Backups: nightly `mysqldump` + volume snapshot.

### 5) App Container (Node)
1. Build + run the Node server container.
2. Set env vars:
   - `MYSQL_URL` (prod DB)
   - `JWT_SECRET`
   - `JWT_EXPIRES_IN`
   - `CLIENT_ORIGIN=https://flo-state.in`
   - `NODE_ENV=production`
3. Run `db:migrate` on deploys when schema changes.

### 6) Reverse Proxy + SSL (Nginx)
1. Install Nginx on the host.
2. Configure:
   - `flo-state.in` -> app container
   - `www` -> redirect to apex
3. TLS:
   - Use Certbot (Let’s Encrypt) for HTTPS
   - Auto-renew certificates

### 7) Email (Postfix / Brevo)
1. Prefer **Brevo SMTP** (easier + deliverability).
2. If Postfix is required:
   - Configure SPF/DKIM/DMARC DNS
   - Lock relaying to app only

### 8) Monitoring + Updates
1. Enable automatic security updates.
2. Set up basic uptime monitoring.
3. Log rotation + disk usage alerts.

### 9) Maintenance Checklist
- Verify backups + restore monthly
- Patch OS + Docker monthly
- Rotate secrets every 90 days
- Review access logs weekly
