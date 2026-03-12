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

## Phase 1 Summary

- [x] Phase 1.1 implemented.
- [x] Phase 1.2 implemented.
- [x] Phase 1.3 implemented.
- [x] User reported tests pass and manual verification complete.

---

## Phase 2.1 Checklist - Board/List Backend APIs

### API and Data

- [x] Added board backgrounds constants and board/list validation schemas.
- [x] Implemented board CRUD service + routes (`/api/boards`).
- [x] Implemented list CRUD service + routes (`/api/boards/:boardId/lists`, `/api/boards/lists/:listId`).
- [x] Implemented list ordering endpoint (`/api/boards/:boardId/lists/reorder`).
- [x] Added default lists on board creation (To Do, In Progress, Done).
- [x] Wired boards router in server app.

### Tests and Checks

- [x] Added integration tests for boards module (`server/tests/boards.test.ts`).
- [x] Lint/type/build checks pass for server.
- [ ] User-run server tests pending.

---

## Phase 2.2 Checklist - Board/List Frontend UI

### UI and Routing

- [x] Added boards list page (`/boards`) with board creation modal and delete action.
- [x] Added board detail page (`/boards/:boardId`) with board update/delete controls.
- [x] Added list management UI in board detail: create, rename, delete, done toggle, reorder.
- [x] Added board background presets and preview styles.
- [x] Added boards API client + board/list types.
- [x] Updated app routes and sidebar navigation to include boards.

### Quality and Checks

- [x] Client lint passes.
- [x] Client typecheck passes.
- [ ] User-run client tests pending.

---

## User-Run Test Commands

- `bun run --cwd server test`
- `bun run --cwd client test`

## User-Run Runtime Commands

- `bun run dev:server`
- `bun run dev:client`
