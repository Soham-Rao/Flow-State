# FlowState - Execution Checklist

> Working checklist for active implementation.
> Update this file during a phase.
> Update `Docs/context.md` at the end of each implementation cycle.
> Last updated: 2026-03-12

---

## Global Rules (Active)

- Use Bun as package manager and workspace runner.
- Use TypeScript for both client and server.
- Monorepo style: plain `client/` and `server/` workspaces (no Turborepo/Nx).
- First successful signup becomes admin automatically.
- Permissions: normal users can edit tasks, but cannot delete tasks created by others; admins can delete.
- Cleanup countdown starts when a card enters a Done list.
- Team invitations use email invite links.
- End-of-cycle requirement: update progress tracker and updates log in `Docs/context.md`.
- Test cadence update: run tests after full phases (or every 2 full phases), not after each sub-phase.
- Execution preference update: assistant does not run tests unless user explicitly asks; assistant provides commands for user-run tests.

---

## Phase 1.1 Checklist - Scaffolding & Design System

### Status

- [x] Implemented scaffolding and design-system baseline.
- [ ] Runtime verification pending user-run checks.

---

## Phase 1.2 Checklist - Database Schema & JWT Auth

### Status

- [x] Fixed runtime blocker by pinning `zod` to `3.24.1`.
- [x] Implemented DB foundation: SQLite connection, Drizzle schema, startup table initialization.
- [x] Implemented auth backend: register/login/logout/me, first-signup auto-admin, auth middleware, JWT helpers.
- [x] Added auth integration tests.
- [ ] Runtime verification and tests pending user-run checks.

---

## Phase 1.3 Checklist - Auth UI & Layout Shell

### Client Auth Wiring

- [x] Added API client and auth API wrappers for backend auth endpoints.
- [x] Added session token helpers.
- [x] Added Zustand auth store (`hydrate/login/register/logout`).
- [x] Added auth route guards (`AuthGate`, `ProtectedRoute`, `GuestOnlyRoute`).

### UI and Routing

- [x] Updated login/register pages to call real backend auth and show loading/error states.
- [x] Updated app shell header with authenticated user context and logout action.
- [x] Updated home page to show authenticated user context.
- [x] Added Vite `/api` proxy and `.env.example` client API base value.

### Validation (No Test Execution)

- [x] Dependency update and lockfile sync completed.
- [x] Lint passes:
  - `bun run --cwd client lint`
  - `bun run --cwd server lint`
- [x] Type checks pass:
  - `bunx tsc -b client/tsconfig.json`
  - `bunx tsc -p server/tsconfig.json --noEmit`
- [x] Server build passes:
  - `bun run --cwd server build`
- [ ] Tests not executed by assistant (per user instruction).
- [x] Applied feedback fix for user-run server tests: enabled `globals: true` in `server/vitest.config.ts`.

### User-Run Test Commands

- `bun run --cwd server test`
- `bun run --cwd client test`

### User-Run Runtime Commands

- `bun install`
- `bun run dev:server`
- `bun run dev:client`


