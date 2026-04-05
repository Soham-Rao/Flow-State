# Architecture Overview

FlowState is a Bun workspace monorepo with a React client and an Express + Socket.IO server backed by MySQL via Drizzle ORM.

## 1. High-level shape

- `client/` — React 18 + Vite + TypeScript frontend
- `server/` — Express API, Socket.IO realtime, Drizzle schema/migrations, auth, ops tooling
- `deploy/vps/` — production deploy, backup, restore, maintenance, rollback assets
- `Docs/` — official user and developer docs

## 2. Runtime architecture

In production:

- the React app is built into `client/dist`
- the Express server serves both `/api/*` and the static frontend
- nginx reverse-proxies public traffic to the Node service
- systemd manages the app process
- MySQL 8 runs in Docker

## 3. Client architecture

Main client pieces:

- React Router for navigation
- Zustand stores for auth, feedback, mentions, socket/presence, thread preferences
- page-centric feature organization under `client/src/pages`
- API wrappers under `client/src/lib`
- route-level lazy loading in `app-router.tsx`

Important entrypoints:

- `client/src/main.tsx`
- `client/src/routes/app-router.tsx`
- `client/src/components/layout/app-shell.tsx`
- `client/src/lib/api-client.ts`

## 4. Server architecture

Main server pieces:

- Express route modules under `server/src/modules`
- shared config/utilities under `server/src/config` and `server/src/utils`
- MySQL schema/migration code under `server/src/db`
- operational backup/verification helpers under `server/src/ops`

Important server entrypoints:

- `server/src/index.ts`
- `server/src/config/env.ts`
- `server/src/db/connection.ts`
- `server/src/db/migrate.ts`

## 5. Realtime model

Socket.IO is used for:

- workspace presence
- board activity/presence
- thread message/reply/reaction events
- refreshing event-driven surfaces without full polling dependence

The app still uses bounded polling fallbacks in some places when socket freshness is not enough or a socket is disconnected.

## 6. Persistence model

Primary persistence:

- MySQL 8.0

Data stored includes:

- users, roles, invites
- boards, lists, cards
- comments, mentions, activity logs
- thread conversations, members, messages, replies, reactions, attachments
- bug reports
- audit logs

File/media storage:

- local filesystem uploads on the VPS

Backups:

- compressed MySQL dumps
- optional encrypted offsite copies to R2
- manifest/checksum verification

## 7. Security model

Key ideas:

- JWT auth
- bcrypt password hashing
- server-side validation and sanitization
- role-based permissions plus scoped overrides
- production CORS/CSP hardening
- bounded audit/security logging

## 8. Deploy model

The production deploy flow is maintenance-window based, not blue-green.

Preferred production script:

- `bash deploy/vps/update-safe.sh`

That wrapper ultimately drives:

- safe deploy
- predeploy backup
- readiness checks
- rollback-safe workflow

## 9. Current product phase positioning

At this point:

- Phase 12.5 documentation rebuild is the official docs-system phase
- Phase 12.6 access hardening/error UX/compliance has been implemented and deployed
- Phase 12.7 remains the next production-ops/product-support phase for SMTP-backed delivery
