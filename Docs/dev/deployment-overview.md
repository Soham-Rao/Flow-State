# Deployment Overview

This document explains how FlowState is deployed, what environments matter, and where to go for detailed production runbooks.

## 1. Deployment model

FlowState uses a single-VPS production model:

- nginx handles public HTTPS traffic
- systemd runs the Node server
- the Node server serves both API and built frontend assets
- MySQL 8 runs in Docker on the VPS
- uploads are stored on the VPS filesystem
- backups are written locally and optionally uploaded to R2

## 2. Official runbooks

- One-time server bootstrap: [VPS setup](vps-setup.md)
- Day-to-day deploys, backup checks, restore, rollback: [VPS operations](vps-operations.md)

## 3. Environments

### Local development

- Vite client dev server
- tsx/TypeScript server dev process
- local MySQL URL via env

### Production

- built client in `client/dist`
- built server in `server/dist`
- app env file at `/etc/flowstate/flowstate.env`

## 4. Production scripts

Important scripts under `deploy/vps/`:

- `update-safe.sh` — preferred production command
- `deploy-safe.sh` — guarded deploy path
- `redeploy.sh` — simpler direct path
- `rollback.sh` — rollback helper
- `backup-now.sh` — manual backup
- `restore-verify.sh` — scratch restore verification

## 5. Safe deploy expectations

The preferred production path should:

- load env and prerequisites
- fetch latest code
- enable maintenance mode during the deploy window
- create a predeploy backup
- build client and server
- run migrations with safety guards
- restart the service
- verify readiness locally and publicly
- disable maintenance mode on success

## 6. Rollback expectations

Rollback is maintenance-window based, not blue-green.

Current protection layers include:

- predeploy backups
- rollback script
- readiness checks
- restore verification
- manifest/checksum support

## 7. Environment and secret categories

Important env families:

- app auth/secrets
- DB connection settings
- upload path settings
- alert email settings
- backup encryption settings
- scratch restore verification settings
- rate-limit/cors/public URL settings

See `server/.env.production.example` and the live VPS env file for the current deployment surface.

## 8. Production safety rules

- never point dev/test tooling at production DBs
- never use a scratch restore URL that targets production
- keep MySQL bound to localhost-only on the VPS
- prefer `update-safe.sh` over ad-hoc restarts
- keep docs and runbooks in `Docs/dev/` current when production behavior changes
