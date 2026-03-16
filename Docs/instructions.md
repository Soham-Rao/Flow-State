# FlowState - Execution Checklist

> Working checklist for active implementation.
> Update this file during a phase.
> Update `Docs/context.md` at the end of each implementation cycle.
> Last updated: 2026-03-14

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

## Phase 5.1 Plan - @ Mentions (App-wide)

1. Add a shared mentions trigger that activates on `@` in comment inputs and uses a single user search source.
2. Build a reusable mentions suggestion popover component (keyboard + mouse selection).
3. Store mentions in content (`@Full Name`) and persist mention userIds on create/update.
4. Use board members as the mention source for now; no new backend endpoints yet.
5. Add small unit tests for mention parsing and insertion behavior.

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
- [x] User-run server tests passed.

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
- [x] User-run client tests passed.

---

## Phase 2.3 Checklist - UX Polish on Boards

- [x] Replaced browser confirm prompts with in-app confirmation modals.
- [x] Removed board interaction refresh/jump feel by avoiding full board refetch on each action.
- [x] Added drag-and-drop list reordering on board detail page.
- [x] Moved board settings to a collapsible section at the bottom.
- [x] Made board background preview update live while selecting settings.
- [x] Applied selected board gradient to the full board content area (excluding sidebar and top header), only while viewing that board.
- [x] Removed `sunset-grid` from selectable presets and added additional smooth gradient options.
- [x] Converted board settings to debounced autosave (no Save button; avoids save-on-every-keystroke).
- [x] Kept delayed floating Saved confirmation and inline Saving... status for board settings.
- [x] Switched list-name editing to pencil-toggle mode with debounced autosave (no list Save button).
- [x] Prevented edit focus scroll jump and made editor auto-close on Enter or blur/click-away.
- [x] Moved list delete action next to edit as a red trash icon button (same delete behavior).

---

## Phase 3 Checklist - Card Management & Drag-and-Drop

### Phase 3.1 - Backend Card APIs

- [x] Added card schemas and board routes for card CRUD + move (`createCard`, `updateCard`, `moveCard`, `deleteCard`).
- [x] Implemented service-layer card lifecycle logic, including done-list countdown semantics (`doneEnteredAt`).
- [x] Added backend integration coverage for cards (`server/tests/cards.test.ts`) including delete permission enforcement.

### Phase 3.2 - Frontend Card UI + DnD

- [x] Extended board types and API client with card operations.
- [x] Implemented per-list card rendering on board detail page.
- [x] Implemented quick-add card form in each list.
- [x] Implemented card edit modal (title, description, priority, due date).
- [x] Implemented card delete flow with in-app confirmation dialog.
- [x] Implemented card drag-and-drop within list and across lists with optimistic UI + rollback on failure.
- [x] Preserved existing list/board autosave flows and delayed Saved feedback.

### Phase 3.3 - Client Tests & Docs

- [x] Added frontend card workflow tests (`client/src/pages/boards/board-detail-page.test.tsx`).
- [x] Updated `Docs/context.md` progress tracker and updates log for Phase 3 subphases.
- [x] Updated this checklist with Phase 3 completion details.

---
## User-Run Test Commands

- `bun run --cwd server test`
- `bun run --cwd client test`

## User-Run Runtime Commands

- `bun run dev:server`
- `bun run dev:client`


## Phase 4.1 Checklist - Checklists

- [x] Added checklists + checklist items tables and indices.
- [x] Implemented checklist CRUD services + API routes.
- [x] Board detail hydration now includes checklists + items.
- [x] Card modal checklist UI + board-view collapsible previews with progress bars.
- [x] Client API + types updated for checklists.
- [x] Added client + server checklist tests (user-run pending).

---

## Phase 5.4 Plan - Threads (DMs First)

Scope: Deliver the Threads foundation with **DMs only**, channel groundwork (no channels yet), one-level reply threads, mention counters, placeholder presence UI, and permission/override scaffolding. DMs should use **basic encryption at rest** (not full E2E yet). Prioritize low-latency UX and minimal payloads.

### A. Data Model & Schema (Server)
1. **Thread containers**
   - `thread_conversations`: id, type (`dm` | `channel`), name (nullable), createdAt, updatedAt, lastMessageAt.
   - `thread_members`: conversationId, userId, role (member/admin), createdAt.
2. **Messages**
   - `thread_messages`: id, conversationId, authorId, body, bodyEncrypted (nullable), bodyFormat (`plain` for now), createdAt, updatedAt, deletedAt (nullable).
   - `thread_attachments`: id, messageId, filename, mimeType, size, storagePath, createdAt.
   - `thread_voice_notes`: id, messageId, durationSec, storagePath, createdAt.
3. **One-level reply threads**
   - `thread_replies`: id, parentMessageId, authorId, body/bodyEncrypted, createdAt, updatedAt.
   - **Rule**: replies are only attached to a **parent message**. Replies **cannot** create subthreads. Replies inside a reply mention the user but remain within same reply list.
4. **Mentions + counters**
   - `thread_mentions`: id, messageId, mentionedUserId, createdAt, seenAt (nullable).
   - `thread_reply_mentions`: id, replyId, mentionedUserId, createdAt, seenAt (nullable).
   - Optional: `thread_mention_counters`: userId, unreadCount, updatedAt (for fast badge).
5. **DM encryption (basic)**
   - For `dm` conversations only: store body in `bodyEncrypted` and leave `body` empty.
   - Add `encryption_version` on messages (or table-level default) for future upgrades.
6. **Permissions & overrides groundwork**
   - Extend role permissions with thread actions:
     - view_threads, create_threads, reply_threads, delete_threads
     - dm_read, dm_write, dm_encrypt (placeholder)
     - channel_read, channel_write (placeholders for later)
   - Add `thread_scope_overrides` (existing overrides table or new) with subject + allow/deny.

### B. Service Layer & API (Server)
1. **Conversation discovery**
   - List all DMs for current user; include the other participant and last message snippet.
   - Also expose list of users to start DM (including self).
2. **Message CRUD**
   - Create DM message (encrypt if dm).
   - Create reply (single-level only).
   - Edit/delete message and reply (soft delete now).
3. **Mentions**
   - Parse mentions from body; insert mention rows.
   - Mark mentions seen on read (decrement counters).
4. **Counters**
   - Return unread mention count in `/me` or a dedicated endpoint.
5. **Latency**
   - Use indexed queries (conversationId + createdAt).
   - Cursor pagination for messages (latest N).
   - Avoid N+1 by joining minimal user fields.

### C. Client Architecture & State
1. **Threads UI layout**
   - Left panel: tabs **DMs** (active), **Channels** (placeholder).
   - DM list: all users; allow self DM.
   - Main panel: conversation header, message list, reply thread drawer.
2. **Message composition**
   - Text input, attachments, voice note (UI placeholder).
   - Reply button on message opens 1-level reply panel.
3. **Reply thread UX**
   - Show parent message + reply list; replies tagged with @mention to user being replied to.
4. **Presence placeholders**
   - Badge on avatar (green/empty/red). No real-time yet.
5. **Mention counters**
   - Badge on sidebar Threads section and per conversation.
   - Decrement when user opens that DM/thread.

### D. Basic DM Encryption (Not Full E2E)
1. Server-side encryption util (symmetric, env-based key).
2. Encrypt on write, decrypt on read (DM only).
3. Store `bodyEncrypted`, set `body` null.
4. Keep channels unencrypted for now.
5. Add version tag for future upgrades.

### E. Permissions + Overrides (Wire-up)
1. Gate DM list and message creation by role permissions.
2. Thread overrides: allow explicit access to a DM/channel even if base role denies.
3. UI: hide actions if permissions missing.

### F. Tests (Server + Client)
1. API tests: create DM, post message, reply, mentions, counters, decrypt.
2. Client tests: thread UI renders, reply panel opens, mention badge decrements.

---

## Phase 5.4 Checklist - Threads (DMs First)

### Schema & Data
- [ ] Add `thread_conversations`, `thread_members`, `thread_messages`, `thread_replies` tables.
- [ ] Add mentions tables + indexes.
- [ ] Add DM encryption fields + version marker.
- [ ] Add overrides table or extend existing overrides schema.

### Backend API
- [ ] List DM conversations for user.
- [ ] List all users for DM picker (including self).
- [ ] Create DM message with encryption.
- [ ] Create reply for a message (single level only).
- [ ] Parse mentions + create mention records.
- [ ] Mark mentions as seen when viewing DM/thread.
- [ ] Return mention count for badges.

### Client UI
- [ ] Threads page layout with DMs list and placeholders for Channels.
- [ ] DM conversation view with message list + compose input.
- [ ] Reply thread panel (one level).
- [ ] Presence badge placeholders (online/idle/dnd/focus).
- [ ] Mention counter badges (threads + per DM).

### Permissions
- [ ] Add role permissions for DM/thread actions.
- [ ] Enforce permission gating for DM view + send.
- [ ] Wire overrides to allow access per conversation.

### Tests
- [ ] Server tests for DM message encryption + reply thread rules.
- [ ] Server tests for mention counters (increment + decrement).
- [ ] Client tests for Threads UI render + reply panel + badge decrement.

