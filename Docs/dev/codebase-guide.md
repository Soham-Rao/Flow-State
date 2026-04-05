# Codebase Guide

This document is the handoff map for someone new to the repo.

## 1. Top-level folders

- `client/` — frontend application
- `server/` — backend application
- `deploy/vps/` — deployment and operations scripts/configs
- `Docs/` — official docs
- `My_Docs/` — ignored personal docs and learning notes

## 2. Frontend map

### Routing and shell

- `client/src/routes/app-router.tsx` — lazy-loaded route map
- `client/src/routes/auth-gate.tsx` — session bootstrap before routing
- `client/src/routes/protected-route.tsx` — guest/protected route wrappers
- `client/src/components/layout/app-shell.tsx` — sidebar, top bar, settings/thread badges, global dialogs

### API and shared frontend helpers

- `client/src/lib/api-client.ts` — fetch wrapper, friendly error classification, maintenance/session handling
- `client/src/lib/*-api.ts` — resource-specific client API wrappers
- `client/src/stores/*` — Zustand state for auth, mentions, socket, presence, feedback, thread preferences

### Main product pages

- `client/src/pages/home-page.tsx` — dashboard, announcements, mentions, admin invites
- `client/src/pages/boards/boards-page.tsx` — board list and board creation/archive/delete
- `client/src/pages/boards/board-detail-page.tsx` — board workspace orchestration
- `client/src/pages/threads-page.tsx` — DMs/channels UI
- `client/src/pages/focus-page.tsx` — personal focus timer
- `client/src/pages/settings/profile-page.tsx` — profile settings
- `client/src/pages/settings/general-page.tsx` — appearance, thread badges, roles/admin settings
- `client/src/pages/settings/advanced-page.tsx` — bug reporting and admin bug inbox
- `client/src/pages/legal/*.tsx` — public legal pages

### Page decomposition conventions

Large screens are split into helper files named after responsibility:

- `*.controller.ts` for orchestration/state
- `*.view.tsx` or component files for presentation
- `*.utils.ts` for shaping state
- `*.actions.ts` / `*.handlers.ts` for grouped user actions

## 3. Backend map

### App setup and shared utilities

- `server/src/config/env.ts` — validated environment configuration
- `server/src/utils/api-error.ts` — normalized API errors
- `server/src/utils/logger.ts` — structured logging helpers
- `server/src/utils/request-context.ts` — request ids and request metadata helpers
- `server/src/utils/sanitize.ts` — content sanitization
- `server/src/utils/permissions.ts` — base permission rules
- `server/src/utils/access-control.ts` — centralized access helpers, including override-aware checks
- `server/src/utils/http-cache.ts` — cache helpers for safe read responses

### DB layer

- `server/src/db/schema.ts` — Drizzle schema and enums
- `server/src/db/migrate.ts` — migration runner
- `server/src/db/migration-guard.ts` — risky migration linting, acknowledgement detection, advisory locking
- `server/src/db/connection.ts` — DB connection and slow-query instrumentation

### Resource modules

- `server/src/modules/auth` — register/login/me/profile/password reset scaffolding
- `server/src/modules/boards` — boards, lists, cards, labels, checklists, comments, attachments, cleanup
- `server/src/modules/threads` — DMs, channels, members, overrides, messages, replies, reactions, media
- `server/src/modules/roles` — role CRUD and assignments
- `server/src/modules/invites` — admin invite workflow
- `server/src/modules/dashboard` — dashboard summaries
- `server/src/modules/activity` — activity feeds
- `server/src/modules/mentions` — board/comment mention surfaces
- `server/src/modules/announcements` — announcement creation and audience targeting
- `server/src/modules/bug-reports` — lightweight in-app bug inbox
- `server/src/modules/security` — audit logging

## 4. Deploy and ops map

- `deploy/vps/update-safe.sh` — preferred day-to-day production deploy wrapper
- `deploy/vps/deploy-safe.sh` — guarded deploy with maintenance and backup
- `deploy/vps/redeploy.sh` — simpler direct deploy path
- `deploy/vps/rollback.sh` — code rollback helper
- `deploy/vps/backup-now.sh` — manual backup creation
- `deploy/vps/restore-db.sh` — restore helper
- `deploy/vps/restore-verify.sh` — scratch-restore verification
- `deploy/vps/ops-common.sh` — shared deploy/backup helpers
- `deploy/vps/nginx.flowstate.conf` — nginx site config

## 5. Where to look first by problem type

- auth/session problems: `auth` module + `auth-store` + `api-client.ts`
- board/task problems: `boards` module + board detail page helpers
- thread/channel problems: `threads` module + threads controller files
- role/permission problems: `roles` module + `permissions.ts` + `access-control.ts`
- deploy/backup/rollback problems: `deploy/vps/*` + `Docs/dev/vps-operations.md`
- tracker/current state questions: `Docs/dev/context.md` + `Docs/dev/resume.md`
