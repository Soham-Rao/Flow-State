# FlowState — Project Context & Progress

> Full project context, decisions, progress, and phase tracking.
> `instructions.md` is used for phase-specific notes and checklists.
> Last updated: 2026-03-12

---

## 1. My Role

I am the AI agent building this project. I plan, code, audit, and test directly. My responsibilities:

1. **Think and plan** — Understand requirements, design architecture, break down work.
2. **Write code phase-by-phase** — Implement **one phase at a time only**, using `instructions.md` for phase-specific notes and checklists when useful.
3. **Audit after every phase** — After completing a phase, review every file created/modified for: logical errors, missing error handling, security issues, bad practices, UI/UX issues, missing edge cases, and undesired/unexpected behavior.
4. **Fix issues** — If the audit finds issues, fix them directly.
5. **Run/write tests** — After audit and corrections, ensure automated tests exist for the completed phase (unit + integration). I will write the tests but the user will run them and provide the feedback.
6. **Advance to next phase** — Only after a phase is fully audited, corrected, and tested do I move to the next phase.

### Sub-Phase Splitting
If a phase contains too many features or is too large for a single pass, I **may split it into sub-phases**: Phase N.1, N.2, N.3, etc. Audit happens per sub-phase, while tests are run on full-phase cadence (end of each full phase, or every 2 full phases when explicitly chosen).

### The Cycle (Strictly Enforced)
```
Think → Plan phase (use instructions.md for notes if needed)
  → Implement code
  → Audit code
  → Fix issues (if any)
  → Verify fixes
  → Write tests during sub-phases as needed
  → Run tests on full-phase cadence
  → Tests pass → Phase N approved
  → Git commit (end of every completed phase/sub-phase cycle)
  → Move to Phase N+1 → Repeat
```

### Critical Rules
- **NEVER start Phase N+1 before Phase N is fully audited, corrected, and tested.**
- **Git commit at the end of every completed phase cycle.** Descriptive messages like `Phase 1: Foundation & Auth` or `Phase 3.2: Drag-and-drop implementation`.

---

## 2. Project Overview

**FlowState** is an internal team collaboration web application for 5–20 users that combines the best features of **Trello** (boards, lists, cards, drag-and-drop), **Slack** (threads, presence, reactions, real-time feed), and **Notion** (rich text, slash commands, multi-view, templates) into a single productivity hub with a beautiful modern ui similar to that of trello.

### Core Principles
- **Real-time-ish**: Updates on meaningful actions (card moved, comment posted), not every keystroke. Socket.IO with event-based broadcasting.
- **Lightweight**: Must feel instant. No loading spinners. Optimistic UI updates.
- **Beautiful**: Modern UI with shadcn/ui primitives. Premium feel. Color-coded. Responsive.
- **Storage-conscious**: Auto-cleanup of completed cards + files after configurable retention (default 7 days). Predetermined board backgrounds (no uploads). Minimal footprint.

---

## 3. Feature List (Grouped by Inspiration Source)

### From Trello
| # | Feature | Details |
|---|---------|---------|
| T1 | Kanban boards | Multiple boards per workspace, each with a topic/project |
| T2 | Lists (columns) | Customizable columns within boards (To Do, Doing, Done, custom) |
| T3 | Cards (tasks) | Tasks within lists, with full detail view |
| T4 | Drag-and-drop | Between lists + reorder within. Large grab targets, intuitive UX |
| T5 | Card assignments | Assign one or more team members to a card |
| T6 | Due dates & reminders | Set deadlines, get reminded |
| T7 | Checklists | Sub-checklists inside cards. Visible on board as collapsible sections with progress bar |
| T8 | Labels | Color-coded labels on cards. CRUD per board |
| T9 | Card cover colors | Color band on card for visual distinction at a glance |
| T10 | Board backgrounds | Predetermined backgrounds (CSS gradients/patterns, not uploaded images) |
| T11 | Priority levels | Low, Medium, High, Urgent — on each card |
| T12 | Archive system | Soft-delete cards. Auto-hard-delete after configurable retention (default 7 days) |
| T13 | Card detail modal | Full card view with all fields, checklists, comments, attachments |

### From Slack
| # | Feature | Details |
|---|---------|---------|
| S1 | Threaded discussions | Each card hosts a Slack-like comment thread for focused conversations |
| S2 | Presence indicators | Real-time "bubbles" showing who is currently viewing a board or working on a task |
| S3 | Emoji reactions | React to tasks/comments with emojis. Quick acknowledgment without typing |
| S4 | "Pulse"/"Activity" sidebar | Real-time activity feed showing live transitions (e.g., "soham just finished 'API Design'") |
| S5 | @mentions | Mention team members in comments with autocomplete dropdown |
| S6 | Notification center | Bell icon with unread count + toast popups for real-time alerts |
| S7 | "Focused" state | When Pomodoro is active, user shows as "Focused" to the team |

### From Notion
| # | Feature | Details |
|---|---------|---------|
| N1 | Slash commands | Quick formatting inside descriptions/notes: /todo, /h1, /code, etc. (TipTap) |
| N2 | Multi-view toggle | Switch between Kanban, List, and Table views for the same board data |
| N3 | Template gallery | Pre-defined card/board templates: Feature Request, Bug Report, Meeting Notes |
| N4 | Rich text editing | Full rich text in card descriptions using TipTap (ProseMirror-based) |
| N5 | File attachments | Upload/download files on cards. Local storage. Auto-deleted on card cleanup |

### FlowState Originals & Other
| # | Feature | Details |
|---|---------|---------|
| O1 | Command palette | Cmd+K / Ctrl+K — search boards, cards, members, jump anywhere instantly |
| O2 | Keyboard shortcuts | System-wide shortcuts for common actions (new card, search, navigate, etc.) |
| O3 | Pomodoro timer | Configurable intervals (25/5, 90/10). Integrated per-card. Broadcasts "Focused" state |
| O4 | Task time tracking | Log time spent on tasks. Timer history and stats |
| O5 | Full-text search | Search across all cards, boards, descriptions. Powered by SQLite FTS5 |
| O6 | Recurring tasks | Option to set tasks to auto-recreate on a schedule |
| O7 | Task dependencies | Checkbox "Has prerequisites" → dropdown to select prerequisite cards (1 or more) |
| O8 | Pin/Star | Pin boards & cards. Personal pins per user + admin global pins |
| O9 | "My Tasks" view | Personal dashboard: all cards assigned to you across ALL boards, sorted by due date |
| O10 | Quick Add | Global shortcut → select board from dropdown → create card without navigating away |
| O11 | Weekly team pulse | In-app auto-generated summary: what was completed, pending, who was most active |
| O12 | Home dashboard | Landing page with My Tasks, recent activity, completed items feed |
| O13 | Profile / Settings | User profile editing, app-wide settings, retention period config |
| O14 | Team invitations | Admin-only invite system for adding team members |
| O15 | Role-based access | Admin (full control, invite, assign) vs Normal (view, create, comment) |
| O16 | Auto-cleanup | Cards + files in done/completed lists auto-deleted after 7 days (configurable) |
| O17 | Real-time updates | Socket.IO — updates on meaningful actions (card moved, comment posted, etc.) |
| O18 | Email notifications | Critical deadline alerts via email (deferred until SMTP/provider is set up) |

---

## 4. User's Specific UX Rules

- Completed/done cards: auto-delete card + files after 7 days (configurable in settings)
- Checklists visible on board view as collapsible sections with progress bar
- Drag targets must be large and intuitive
- Calendar events clickable → navigate directly to the card
- Done lists update a "completed" section on the dashboard/activity feed
- Calendar must have excellent navigability (month ↔ week ↔ day)
- UI must be responsive with good feedback — no loading spinners, no lag
- Storage-conscious: predetermined board backgrounds, no user-uploaded backgrounds
- Archive with timer — auto-hard-delete, don't let users archive forever

---

## 5. Auth & Permissions

- JWT-based email/password auth (Google OAuth deferred to later)
- First successful signup becomes admin automatically.
- **Admin role**: one admin account, can see everything, assign people, invite members, and delete any card. Only admin can invite.
- **Normal role**: can view, create boards/lists/cards, comment, and edit cards. Cannot invite. Cannot delete cards created by others.
- All boards visible to all team members for now (add privacy toggle foundation but no enforcement yet)

---

## 6. Confirmed Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Package Manager | Bun | Workspace management and scripts |
| Language | TypeScript (client + server) | Type safety end-to-end |
| Monorepo Tooling | Plain folders/workspaces | `client/` + `server/`, no Turbo/Nx |
| Frontend | React 18 + Vite | Fast HMR, modern bundler |
| UI Components | shadcn/ui + Tailwind CSS | User suggested shadcn |
| Design System | modern ui + shadcn primitives | Backdrop-blur, semi-transparent, color-coded |
| State Management | Zustand | Lightweight, no boilerplate |
| Backend | Node.js + Express | Same language front-to-back |
| Database | SQLite (via `better-sqlite3`) | WAL mode, single file, perfect for 5-20 users |
| ORM | Drizzle ORM | Lightweight, type-safe, excellent SQLite support |
| Real-time | Socket.IO | Rooms per board, event-based |
| Auth | JWT + bcryptjs | Stateless, simple, no native bcrypt build dependency |
| File Storage | Local filesystem | `/uploads/{boardId}/{cardId}/` structure |
| Drag & Drop | `@dnd-kit/core` | Modern, accessible, `react-beautiful-dnd` is deprecated |
| Rich Text | TipTap (ProseMirror) | Slash command support, extensible |
| Calendar | Custom built on `date-fns` | Full UI control for modern styling |
| Email | Nodemailer (deferred) | No SMTP setup yet; in-app notifications first, email later |
| Full-text Search | SQLite FTS5 | Built-in extension, fast |
| Testing | Vitest (unit) + Supertest (API) + Playwright (E2E) | Industry standard for Vite projects |

---

## 7. Data Hierarchy

```
Workspace/Team (single instance per deployment)
├── Users (admin or normal role)
├── Boards (e.g., "Marketing", "Engineering", "Product")
│   ├── background (predetermined selection)
│   ├── Lists/Columns (e.g., "To Do", "In Progress", "Done", custom)
│   │   └── Cards/Tasks
│   │       ├── Title, Description (TipTap rich text)
│   │       ├── Priority (Low, Medium, High, Urgent)
│   │       ├── Due Date
│   │       ├── Cover Color
│   │       ├── Assigned Members []
│   │       ├── Labels []
│   │       ├── Checklists []
│   │       │   └── Checklist Items []
│   │       ├── Comments/Thread []
│   │       │   └── Emoji Reactions []
│   │       ├── File Attachments []
│   │       ├── Dependencies (prerequisite cards) []
│   │       ├── Time Logs []
│   │       ├── Recurring config (optional)
│   │       └── Activity Log []
│   └── Board Members / Viewers (presence tracking)
├── Notifications (per user)
├── Pins/Stars (per user + admin global)
└── Templates (shared)
```

---

## 8. Phase Plan (All Phases Overview)

### Phase 1: Foundation & Auth
Project scaffolding (monorepo: `/client` + `/server`), database schema (core tables), JWT auth (register/login/logout), basic UI shell with modern design system and shadcn setup, login/register pages, protected routes, basic layout (sidebar + header + main area).

### Phase 2: Board & List Management
CRUD for boards and lists (columns). Board listing page, board detail page with columns rendered. Board creation modal, list ordering, board backgrounds (predetermined). No cards yet.

### Phase 3: Card Management & Drag-and-Drop
Cards within lists. Full drag-and-drop (between lists + reordering within). Card detail modal/drawer with title, description, priority, due date. Large drag handles. Optimistic position updates.

### Phase 4: Task Features (Checklists, Labels, Assignments, Attachments)
Checklists inside cards (collapsible on board view), color labels CRUD, member assignment dropdown, card cover colors, file attachments with local storage, sub-checklist items with progress bar.

### Phase 5: Team & Collaboration
Comments/threads on cards, @mentions with autocomplete, emoji reactions, team invitation system (admin only), user roles enforcement, notification center (in-app bell + toasts).

### Phase 6: Real-Time & Activity Feed
Socket.IO integration (rooms per board), presence indicators, Pulse sidebar (live activity feed), real-time board/card updates on meaningful actions.

### Phase 7: Calendar & Multi-View
Calendar view (month/week navigation, tasks by due date, clickable → card), multi-view toggle (Kanban / List / Table), responsive calendar with good navigability.

### Phase 8: Time Tracking & Focus Mode
Pomodoro timer (configurable intervals), task-level time logging, "Focused" state visible to team, timer history/stats.

### Phase 9: Rich Text, Search & Keyboard Shortcuts
TipTap editor with slash commands (/todo, /h1, /code), full-text search (FTS5), command palette (Cmd+K), keyboard shortcuts system.

### Phase 10: Dashboard, Analytics & Templates
Home dashboard ("My Tasks", recent activity, completed items feed), weekly team pulse summary, template gallery, profile/settings page, pin/star system.

### Phase 11: Polish, Advanced Features & Final Testing
Recurring tasks, task dependencies, archive system with timer, auto-cleanup cron, email notifications for critical deadlines, responsive design pass, full regression + E2E test suite, performance optimization.

---

## 9. Deployment Considerations

> **SQLite + Render Free Tier WARNING**: Render's free tier uses an ephemeral filesystem — the SQLite file gets wiped on every deploy/restart. Options:
> 1. Use Render's paid tier with persistent disk (~$7/mo)
> 2. Use **Turso** (SQLite-compatible cloud DB, free tier available) — drop-in replacement via `@libsql/client`
> 3. Use **Hostgator** (traditional hosting with persistent filesystem) — SQLite works natively
> 4. Use **Railway** or **Fly.io** which have persistent volumes on free/cheap tiers
>
> **Recommendation**: Build with standard SQLite via `better-sqlite3` locally. When deploying, if on Render free tier, swap to Turso with minimal code changes (Drizzle ORM abstracts the connection). If on Hostgator, SQLite works as-is.

### Deployment Architecture
- **Single-service deployment**: Express serves both the API (`/api/*`) and the built React frontend (`/*` as static files).
- Build step: `cd client && bun run build` → output to `client/dist/` → Express serves this as static.
- This keeps it to one process, one port, one service.

---

## 10. Progress Tracker

| Phase | Status | Date Started | Date Completed | Notes |
|-------|--------|--------------|----------------|-------|
| Phase 1.1: Scaffolding & Design System | ✅ Completed | 2026-03-12 | 2026-03-12 | Workspace + client/server scaffolding completed, lint/type/build checks done (runtime verification occurs in user environment) |
| Phase 1.2: Database Schema & JWT Auth | ✅ Completed | 2026-03-12 | 2026-03-12 | Drizzle+SQLite core schema and JWT auth routes implemented; user-run runtime/tests verified |
| Phase 1.3: Auth UI & Layout Shell | ✅ Completed | 2026-03-12 | 2026-03-12 | Auth flow wired to backend with Zustand store/guards; login/register payload validation UX fixed and user-verified |
| Phase 2.1: Board & List Backend APIs | ✅ Completed | 2026-03-12 | 2026-03-12 | Boards/lists CRUD + reorder APIs, default lists on board creation, boards module integration tests added |
| Phase 2.2: Board & List Frontend UI | ✅ Completed | 2026-03-12 | 2026-03-12 | Boards page, board detail page, background presets, list management UI and routing/navigation updates implemented; user-run tests passed |
| Phase 3: Card Management & DnD | ⬜ Not Started | — | — | — |
| Phase 4: Task Features | ⬜ Not Started | — | — | — |
| Phase 5: Team & Collaboration | ⬜ Not Started | — | — | — |
| Phase 6: Real-Time & Activity | ⬜ Not Started | — | — | — |
| Phase 7: Calendar & Multi-View | ⬜ Not Started | — | — | — |
| Phase 8: Time Tracking & Focus | ⬜ Not Started | — | — | — |
| Phase 9: Rich Text, Search, Shortcuts | ⬜ Not Started | — | — | — |
| Phase 10: Dashboard & Templates | ⬜ Not Started | — | — | — |
| Phase 11: Polish & Advanced | ⬜ Not Started | — | — | — |

---

## 11. Notes

- `instructions.md` can be used for phase-specific notes, checklists, and implementation details when planning a phase. It serves as a scratchpad for detailed specifications.
- **Test policy**: Write tests during implementation; user runs them on full-phase cadence (or every 2 full phases) and reports output.
- **Execution preference**: Assistant provides test commands and does not execute tests unless user explicitly requests execution.
- **Progress logging policy**: At the end of each implementation cycle, update both the Progress Tracker and the Updates table in this file.

---

## 12. Key Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Package manager | Bun | Faster installs and workspace-first workflow |
| Language | TypeScript on client and server | Safer refactors and better long-term maintainability |
| Monorepo tooling | Plain folders/workspaces | Simpler setup; user runs commands per workspace |
| Frontend framework | React + Vite | Industry standard, fast, huge ecosystem |
| UI library | shadcn/ui + Tailwind | User suggested, great primitives + customizable |
| Database | SQLite | Perfect for 5-20 users, zero config, easy backup |
| ORM | Drizzle | Lighter than Prisma, great SQLite support |
| Real-time | Socket.IO | Battle-tested, handles reconnection, rooms/namespaces |
| Auth | JWT + bcryptjs | Simple, no native bcrypt addon dependency, Google OAuth later |
| Drag & drop | @dnd-kit | Modern, accessible, react-beautiful-dnd deprecated |
| Rich text | TipTap | Slash commands, extensible, ProseMirror-based |
| State | Zustand | Tiny, fast, no Redux boilerplate |
| Testing | Vitest + Supertest + Playwright | Industry standard for Vite stack |
| Board backgrounds | Predetermined CSS/gradients | User has limited storage |
| File cleanup | 7 days after card completion | Configurable in settings |
| Cleanup countdown trigger | On entering Done list | Matches workflow semantics for completion |
| Invite system | Email invite links | Supports admin-only team onboarding |
| First admin provisioning | First signup becomes admin | Fast bootstrap without manual seeding |
| Delete permissions | Admin can delete; normal users cannot delete others' cards | Prevent accidental destructive actions |
| Test cadence | Full phase (or every 2 full phases), not each sub-phase | Matches user preference and sandbox constraints for repeated runtime checks |
| Zod version pin | `zod@3.24.1` | Avoids broken package layout seen in `3.25.76` with Node+tsx runtime import path |
| Email | Deferred (Nodemailer later) | No SMTP setup yet |
| Deployment | Single Express service | API + static frontend from one process |

---

## 13. Updates

| Date | Update |
|------|--------|
| 2026-03-12 | Confirmed implementation defaults: Bun, TypeScript for client/server, plain workspace structure, first-signup auto-admin, edit yes/delete restricted, done-list cleanup trigger, email invite flow. Added execution checklist to `Docs/instructions.md` and added progress logging policy. |
| 2026-03-12 | Implemented Phase 1.1 scaffold: Bun workspaces, client React+Vite+Tailwind+shadcn-style shell, server Express+TS health API, lint configs, and baseline tests. Lint and TypeScript checks passed. Client build/test execution in sandbox hit `spawn EPERM`; runtime/build/test verification deferred to user environment and full-phase test cadence. |
| 2026-03-12 | Fixed server startup blocker by pinning `zod` to `3.24.1`. Implemented Phase 1.2 backend foundation: Drizzle schema (users/boards/lists/cards), SQLite initialization, JWT auth (`register/login/logout/me`), auto-admin on first signup, auth middleware, and auth integration tests. |
| 2026-03-12 | Implemented Phase 1.3 client auth integration: Zustand auth store, API-backed login/register/logout/me flow, route guards, session hydration, authenticated app-shell header, and Vite API proxy setup. Lint/type/build checks executed; tests intentionally not executed per user instruction. |
| 2026-03-12 | User-run tests reported server failure: beforeAll is not defined. Fixed by enabling globals: true in server/vitest.config.ts. Awaiting user re-run of server tests. |
| 2026-03-12 | Fixed login/register blocker by improving validation feedback end-to-end: backend now returns specific Zod field messages, client parses field-level details, and forms validate email/password rules before submit. |
| 2026-03-12 | User confirmed full Phase 1 verification complete: tests passed and manual runtime validation succeeded. |
| 2026-03-12 | Implemented Phase 2.1 backend: new boards module (`/api/boards`) with board/list CRUD, list reorder endpoint, schema validation, and automatic default lists (To Do / In Progress / Done). Added `server/tests/boards.test.ts`. |
| 2026-03-12 | Implemented Phase 2.2 frontend: `/boards` and `/boards/:boardId` pages with create/edit/delete board controls, background preset selection, list create/rename/delete/toggle/reorder, plus route and sidebar wiring. Client/server lint + type checks pass; user-run tests pending. |
| 2026-03-12 | User ran the full test suite and confirmed all tests pass for Phase 2. Added router-aware HomePage unit test rendering (wrapped in `MemoryRouter`) after introducing `Link` usage. Phase 2.2 marked complete. |



