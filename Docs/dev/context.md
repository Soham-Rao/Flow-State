# FlowState — Project Context & Progress

> Full project context, decisions, progress, and phase tracking.
> Official project tracking lives here under `Docs/dev/`. Personal scratch notes now live under ignored `My_Docs/personal/`.
> Last updated: 2026-04-05

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
- **Do not run git commands without explicit permission; read-only git show/git diff allowed.**

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
| O5 | Full-text search | Search across all cards, boards, descriptions. Powered by MySQL FULLTEXT (planned) |
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
- Calendar must have excellent navigability (month â†” week â†” day)
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
| Database | MySQL 8.0 (via `mysql2/promise`) | Primary DB; schema managed via Drizzle migrations |
| ORM | Drizzle ORM | Lightweight, type-safe, MySQL support via mysql2 |
| Real-time | Socket.IO | Rooms per board, event-based |
| Auth | JWT + bcryptjs | Stateless, simple, no native bcrypt build dependency |
| File Storage | Local filesystem | `/uploads/{boardId}/{cardId}/` structure |
| Drag & Drop | `@dnd-kit/core` | Modern, accessible, `react-beautiful-dnd` is deprecated |
| Rich Text | TipTap (ProseMirror) | Slash command support, extensible |
| Calendar | Custom built on `date-fns` | Full UI control for modern styling |
| Email | Nodemailer (deferred) | No SMTP setup yet; in-app notifications first, email later |
| Full-text Search | MySQL FULLTEXT (planned) | To be wired when search is implemented |
| Testing | Vitest (unit) + Supertest (API) + Playwright (E2E) | Industry standard for Vite projects |

---

## 7. Data Hierarchy

```
Workspace/Team (single instance per deployment)
â”œâ”€â”€ Users (admin or normal role)
â”œâ”€â”€ Boards (e.g., "Marketing", "Engineering", "Product")
â”‚   â”œâ”€â”€ background (predetermined selection)
â”‚   â”œâ”€â”€ Lists/Columns (e.g., "To Do", "In Progress", "Done", custom)
â”‚   â”‚   â””â”€â”€ Cards/Tasks
â”‚   â”‚       â”œâ”€â”€ Title, Description (TipTap rich text)
â”‚   â”‚       â”œâ”€â”€ Priority (Low, Medium, High, Urgent)
â”‚   â”‚       â”œâ”€â”€ Due Date
â”‚   â”‚       â”œâ”€â”€ Cover Color
â”‚   â”‚       â”œâ”€â”€ Assigned Members []
â”‚   â”‚       â”œâ”€â”€ Labels []
â”‚   â”‚       â”œâ”€â”€ Checklists []
â”‚   â”‚       â”‚   â””â”€â”€ Checklist Items []
â”‚   â”‚       â”œâ”€â”€ Comments/Thread []
â”‚   â”‚       â”‚   â””â”€â”€ Emoji Reactions []
â”‚   â”‚       â”œâ”€â”€ File Attachments []
â”‚   â”‚       â”œâ”€â”€ Dependencies (prerequisite cards) []
â”‚   â”‚       â”œâ”€â”€ Time Logs []
â”‚   â”‚       â”œâ”€â”€ Recurring config (optional)
â”‚   â”‚       â””â”€â”€ Activity Log []
â”‚   â””â”€â”€ Board Members / Viewers (presence tracking)
â”œâ”€â”€ Notifications (per user)
â”œâ”€â”€ Pins/Stars (per user + admin global)
â””â”€â”€ Templates (shared)
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

### Phase 6: Real-Time & Activity Feed (split into 6.1–6.5)
Socket.IO integration (rooms per board), presence indicators, Pulse sidebar (live activity feed), real-time board/card updates on meaningful actions.

### Phase 7: Calendar & Multi-View
Calendar view (month/week navigation, tasks by due date, clickable → card), multi-view toggle (Kanban / List / Table), responsive calendar with good navigability.

### Phase 8: Time Tracking & Focus Mode
Pomodoro timer (configurable intervals), task-level time logging, "Focused" state visible to team, timer history/stats.

### Phase 9: Rich Text, Search & Keyboard Shortcuts
TipTap editor with slash commands (/todo, /h1, /code), full-text search (FTS5), command palette (Cmd+K), keyboard shortcuts system.

### Phase 10: Dashboard, Analytics & Templates (split into 10.1–10.x)
Home dashboard ("My Tasks", recent activity, completed items feed), weekly team pulse summary, template gallery, profile/settings page, pin/star system.

### Phase 11: Polish, Advanced Features & Final Testing
Recurring tasks, task dependencies, archive system with timer, auto-cleanup cron, email notifications for critical deadlines, responsive design pass, full regression + E2E test suite, performance optimization.

### Phase 12: Hosting & Production Readiness
Production hosting, deployment setup, hardening, observability, durability, and user-facing deployment documentation.

### Phase 12.5: Documentation System Rebuild
Official tracked docs rebuilt into `Docs/user` and `Docs/dev`, with personal docs moved under ignored `My_Docs/`, plus comprehensive user guidance, developer handoff docs, and personal web-dev learning references.

### Phase 12.6: Access Hardening, Error UX & Public-Facing Compliance
Follow-up production polish focused on stronger authorization centralization and negative testing, better user-facing error states/modals for common failures, privacy/terms/legal surface area for a publicly hosted app, and lightweight bug-diagnostics/feedback flows that help support without turning the product into a tracked public analytics platform.

### Phase 12.7: SMTP, Support & Account Recovery
SMTP-backed production communication: password-reset delivery, support/contact email workflows, operational alert delivery, optional account verification/email workflows, and other mail-dependent product/support features.

### Phase 13: Polish and CI/CD Pipeline
Future deployment automation and repo polish: build pipeline triggered on push, deploy automation, quality gates, branch protections, staging strategy, and long-term maintenance ergonomics.

---

## 9. Deployment Considerations

> MySQL 8.0 is required. Use separate databases for dev/test/prod via MYSQL_URL.
> Run db:migrate against prod during deploys; never point dev/test at prod.
> Configure DB backups at the host level (daily + PITR if available).

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
| Phase 2.2: Board & List Frontend UI | ✅ Completed | 2026-03-12 | 2026-03-12 | Boards UI complete with custom in-app confirmations, drag-and-drop list reorder, collapsible bottom settings, live background preview, board-scoped content gradients, and user-run tests passed |
| Phase 2.3: Board UX & Autosave Polish | ✅ Completed | 2026-03-12 | 2026-03-12 | In-app confirmations, drag-drop list reorder, board-scoped gradients with new smooth presets, darker tuning, board settings debounced autosave, list-name debounced autosave with pencil edit mode, and delayed Saved feedback |
| Phase 3: Card Management & DnD | ✅ Completed | 2026-03-12 | 2026-03-12 | User-run tests passed; card drag-and-drop finalized with dnd-kit and phase verified |
| Phase 3.1: Card Backend APIs & Rules | ✅ Completed | 2026-03-12 | 2026-03-12 | Card CRUD + move endpoints/services, done-list countdown transitions, and server integration tests (`server/tests/cards.test.ts`) |
| Phase 3.2: Card Frontend UI & Drag-and-Drop | ✅ Completed | 2026-03-12 | 2026-03-12 | Board detail now renders cards, supports quick add, card modal edit/delete, and card DnD within and across lists with optimistic updates |
| Phase 3.3: Card Tests & Docs | ✅ Completed | 2026-03-12 | 2026-03-12 | Added client card workflow tests and updated implementation checklists/progress docs; pending user-run test execution |
| Phase 4: Task Features | ✅ Completed | 2026-03-12 | 2026-03-13 | Checklists, attachments, labels, assignments, cover colors, comments, archive/restore, and retention UI completed |
| Phase 4.1: Checklists | ✅ Completed | 2026-03-12 | 2026-03-12 | Checklist data model + API, board card preview with collapsible progress, and card modal CRUD + progress |
| Phase 4.2: Attachments | ✅ Completed | 2026-03-13 | 2026-03-13 | Added attachments API + UI, retention settings, and cleanup support |
| Phase 4.3: Labels + Assignments + Cover Colors | ✅ Completed | 2026-03-13 | 2026-03-13 | Labels/assignees/cover colors wired end-to-end with schema + API + UI and polish fixes |
| Phase 4.4: Comments + Due Dates + Archive/Restore | ✅ Completed | 2026-03-13 | 2026-03-13 | Comments with mentions/reactions, archive/restore flows, and retention countdown badges |
| Phase 5: Team & Collaboration | ✅ Completed | 2026-03-13 | 2026-03-24 | Phase 5.5 completed: channels + overrides |
| Phase 5.1: @ Mentions Autocomplete (App-wide) | ✅ Completed | 2026-03-13 | 2026-03-13 | Autocomplete on `@` anywhere + mention notifications |
| Phase 5.2: Invitation System | ✅ Completed | 2026-03-13 | 2026-03-14 | Admin invite flow + shareable links |
| Phase 5.3: Roles & Permissions | ✅ Completed | 2026-03-14 | 2026-03-14 | Roles/permissions system, management UI, and permission gating |
| Phase 5.4: Threads Section | ✅ Completed | 2026-03-14 | 2026-03-16 | DMs implemented with reply threads, reactions, mentions, encryption, and UX polish |
| Phase 5.5: Channels & Overrides | ✅ Completed | 2026-03-24 | 2026-03-24 | Channel chat + permission overrides, manage/view gating |
| Phase 6: Real-Time & Activity | ✅ Completed | 2026-03-24 | 2026-03-25 | Socket infra + activity + presence + realtime boards/threads |
| Phase 6.1: Socket.IO Infrastructure | ✅ Completed | 2026-03-24 | 2026-03-24 | Socket server + auth, workspace/board rooms, client socket store |
| Phase 6.2: Activity Log + Pulse UI | ✅ Completed | 2026-03-24 | 2026-03-24 | Activity logs + API, Team Pulse card, board activity panel, mention logging |
| Phase 6.3: Presence (Workspace + Board) | ✅ Completed | 2026-03-25 | 2026-03-25 | Presence tracking (online/AFK/offline), last-seen tracking, and UI indicators in boards/threads |
| Phase 6.4: Board Realtime Updates | ✅ Completed | 2026-03-25 | 2026-03-25 | Board updates via socket events + batched refresh |
| Phase 6.5: Threads Realtime | ✅ Completed | 2026-03-25 | 2026-03-25 | Thread rooms + message/reply/reaction realtime with polling fallback |
| Phase 7: Calendar & Multi-View | ⬜ Not Started | — | — | — |
| Phase 8: Time Tracking & Focus | ✅ Completed | 2026-03-14 | 2026-03-14 | Focus mode Pomodoro UI with personal history/stats (local only) |
| Phase 9: Rich Text, Search, Shortcuts | ⬜ Not Started | — | — | — |
| Phase 10: Dashboard & Templates | 🟡 In Progress | 2026-03-25 | — | Split into 10.1–10.x; dashboard overhaul planned |
| Phase 10.1: Dashboard foundation (Team Pulse + invites + stat shell) | ✅ Completed | 2026-03-24 | 2026-03-25 | Team Pulse feed + admin invites panel + dashboard stat cards shell |
| Phase 10.2: Personal workspace summary | ✅ Completed | 2026-03-27 | 2026-03-27 | My tasks, mentions, timers, assignments, unread summaries |
| Phase 10.3: Team insights + summaries | ✅ Completed | 2026-03-27 | 2026-03-27 | Weekly/monthly summaries, activity highlights, new joiners, announcements |
| Phase 10.4: Dashboard UI overhaul | ✅ Completed | 2026-03-27 | 2026-03-27 | Glassmorphism redesign, two-column layout, priority/alert styling, visual polish only |
| Phase 10.5: Templates + pins + settings polish | 🟡 Deferred | 2026-03-30 | — | Deferred by request; revisit later (templates/polish + pins/templates gallery) |
| Phase 11: Polish & Advanced | ⬜ Not Started | — | — | — |
| Phase 12: Hosting & Production Readiness | 🟡 In Progress | 2026-03-31 | — | Phase 12.0–12.6 are now completed and signed off; the remaining planned follow-up is 12.7 SMTP-backed support/recovery features |
| Phase 12.0: Database Platform Switch | ✅ Completed | 2026-03-31 | 2026-03-31 | MySQL switch + Drizzle migrations + test infra |
| Phase 12.1: Hosting + Deployment Setup | ✅ Completed | 2026-04-03 | 2026-04-04 | BigRock VPS bootstrap completed: SSH hardening, UFW/fail2ban, Node+Bun, MySQL Docker, production env, systemd app, Nginx, DNS, HTTPS, and auto-renewing Certbot setup |
| Phase 12.2: Security Hardening | ✅ Completed | 2026-04-04 | 2026-04-04 | Input sanitization, explicit CORS/CSP/trust-proxy hardening, rate limits, password-reset scaffolding, audit logs, and bounded log retention policies |
| Phase 12.3: Reliability + Observability | ✅ Completed | 2026-04-04 | 2026-04-05 | Completed on the VPS with real safe deploys, structured prod logging, health splits, maintenance mode, compressed MySQL backups, R2 upload, backup timers, rollback tooling, and the `update-safe.sh` wrapper verified in production |
| Phase 12.4: Data Durability + Performance | ✅ Completed | 2026-04-05 | 2026-04-05 | Completed locally and validated operationally with encrypted offsite backups, checksum-rich manifests, scratch restore verification, migration advisory locking and risky-migration gating, slow-query timing, hot-path indexes, bounded pagination, short-lived client caching, route lazy-loading, and bundle splitting |
| Phase 12.5: Documentation System Rebuild | ✅ Completed | 2026-04-05 | 2026-04-05 | Rebuilt official docs into `Docs/user` + `Docs/dev`, moved prior notes to ignored `My_Docs/personal`, added comprehensive user manuals, developer handoff docs, and personal web-dev learning docs under `My_Docs/webdev` |
| Phase 12.6: Access Hardening, Error UX & Public-Facing Compliance | ✅ Completed | 2026-04-05 | 2026-04-05 | Risky-migration linting + acknowledgements, formal privacy/terms pages with required signup consent, in-app bug inbox flows, centralized override-aware access helpers, and friendlier common error UX have been implemented and deployed |
| Phase 12.7: SMTP, Support & Account Recovery | ⬜ Not Started | — | — | SMTP-backed password reset, support/contact flows, alert delivery, optional email verification, and other mail-dependent account/support features |
| Phase 13: Polish and CI/CD Pipeline | ⬜ Not Started | — | — | build/deploy automation on push, pipeline quality gates, staging strategy, repo polish, and maintenance ergonomics |

---

## 11. Notes

- **Permission resolution is additive** across roles; scoped overrides can explicitly allow/deny per board (deny wins for that scope).
- **Assigned-task badges are blue** and exclude done lists; counts update from mentions refresh.
- **Permission errors now surface in a modal** (topmost z-index) instead of inline text only.
- **Password reset is scaffold-only in Phase 12.2**: `forgot-password` always returns a generic success response and must be completed later when SMTP-backed delivery is available.
- **Logging is intentionally bounded**: security audit rows use compact metadata with retention cleanup, while host logs remain journald/logrotate-managed and should stay compressed/size-limited at the VPS level.
- **Phase 12.3 is signed off in production**: the VPS now has maintenance mode, readiness checks, compressed MySQL dump backups, R2 upload, backup timers, alert hooks, rollback scripts, and a one-command `update-safe.sh` wrapper, all exercised in real deploy/rollback flow.
- **Phase 12.4 is also signed off**: encrypted offsite backups, checksum verification, scratch restore verification, migration advisory locking, risky-migration backup gating, slow-query timing, hot-path indexes, bounded pagination, short-lived client caching/invalidation, route/code splitting, and smoother maintenance UX have all been implemented and verified through the final VPS pass.
- **Phase 12.5 is now complete**: official tracked docs live in `Docs/user/` and `Docs/dev/`, while old personal docs were moved under ignored `My_Docs/personal/` and a separate `My_Docs/webdev/` learning set now explains web-development concepts from first principles.
- **Phase 12.6 is signed off in production**: risky-migration linting + acknowledgement checks, formal privacy/terms pages, required signup consent, the in-app bug inbox, override-aware authorization helper centralization, and friendlier common-error UX are now live.
- **SMTP-dependent work stays deferred to Phase 12.7**: password reset delivery, support email flows, ops alert emails, and optional verification/invite mail behavior should all wait for real SMTP/provider setup.

- Legacy scratchpad material now lives in `My_Docs/personal/`; official planning, tracking, and handoff docs should stay in `Docs/dev/`.
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
| Database | MySQL 8.0 (via `mysql2/promise`) | Primary DB; schema managed via Drizzle migrations |
| ORM | Drizzle | Lighter than Prisma, MySQL support via mysql2 |
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
| 2026-04-05 | Phase 12.6 is now complete and deployed. The live app now includes risky-migration linting + acknowledgement checks, required legal-consent gating on signup, public privacy/terms pages, a lightweight in-app bug inbox, override-aware authorization helper centralization, and friendlier common error UX. |
| 2026-04-05 | Phase 12.5 completed the documentation-system rebuild: the old tracked docs were moved into ignored `My_Docs/personal/`, a new tracked `Docs/user/` manual now explains the product end to end for non-technical users, a new tracked `Docs/dev/` set now acts as the canonical developer handoff, and `My_Docs/webdev/` now holds broad web-development learning notes. |
| 2026-04-05 | Phase 12.3 and 12.4 are now complete. Final VPS verification succeeded with `update-safe.sh`, encrypted backup creation + R2 upload, a rollback drill, return-to-latest deploy, and follow-up smoothing for maintenance UX and restore/deploy scripts so the production path no longer needs the earlier manual workarounds. |
| 2026-04-05 | Phase 12.4 local implementation completed: backup encryption env validation, encrypted offsite archive support, manifest checksums and verification metadata, restore-verify tooling for a scratch MySQL target, migration advisory locking + risky-migration gating, slow-query timing, hot-path MySQL indexes, tighter thread pagination, short-lived client cache/dedupe with invalidation, route-level lazy loading, and Vite chunk splitting are now in the repo. The next VPS rollout will also be used to complete the pending 12.3 safe-deploy and rollback drills. |
| 2026-04-04 | Phase 12.3 advanced from local-only to real VPS ops: Cloudflare R2 is configured, compressed local and remote backups are working, backup timers are enabled, health/readiness checks pass in production, and a new `deploy/vps/update-safe.sh` wrapper now provides a one-command safe update path with concise output. The only remaining 12.3 sign-off items are one real safe-deploy run and one rollback drill. |
| 2026-04-04 | Phase 12.3 local implementation completed: added a global React error boundary + chunk-load recovery UI, structured JSON request/app logs, graceful shutdown and process guards, /api/health/live + /api/health/ready, Nginx maintenance-mode support, deploy-safe.sh with predeploy backup/readiness/rollback flow, compressed MySQL backup + restore scripts, backup manifest helpers, SMTP-backed ops alert plumbing, and new local tests for health/logging/ops behavior. Cloudflare R2 wiring and VPS rollout are the next step. |
| 2026-04-04 | Phase 12.2 completed locally: added strict server-side plain-text sanitization for user-authored content, explicit production CORS allowlisting + CSP + trust-proxy handling, route-scoped rate limits for auth/invite/health endpoints, password-reset scaffolding with generic `forgot-password` responses, MySQL-backed `audit_logs` and `password_reset_tokens`, request-id based security logging, and bounded retention rules so audit/system logs do not grow without limit. Password reset remains scaffold-only until SMTP delivery is implemented. |
| 2026-04-04 | Phase 12.1 completed on the BigRock VPS path: SSH was hardened with key-only access, UFW/fail2ban/nginx/docker were enabled, Node 22 and Bun were installed, MySQL 8.0 was provisioned in Docker, production env and uploads paths were configured, the app now runs under systemd behind Nginx, DNS points to the VPS, HTTPS is live via Let's Encrypt with certbot auto-renewal, and `Docs/dev/vps-setup.md` now includes a practical cheat sheet. First-user browser smoke testing is intentionally deferred so the intended first admin can sign up. |
| 2026-04-03 | Phase 12.1 advanced for the BigRock Ubuntu VPS path: Express now serves client/dist in production, invite links use PUBLIC_APP_URL, uploads storage is fully configurable via FLOWSTATE_UPLOADS_DIR (including thread cleanup paths), production env examples were added, VPS deploy assets were created for MySQL Docker, systemd, Nginx, redeploy flow, one-time server setup, and `Docs/dev/deployment-overview.md` was narrowed to the single VPS production plan. |
| 2026-04-03 | Permission checks for card actions are now board-scoped (edit/assign/comment/move/create/archive/delete), so board-level overrides allow non-admin edits/assignments as intended. |
| 2026-04-03 | Assigned-task badges added to board cards, board header, and list headers; assignment counts exclude done lists; badges refresh when assignment counts change. |
| 2026-04-03 | Global permission error modal added (ConfirmDialog) with topmost z-index; API client routes 403/permission errors into the modal. |
| 2026-04-03 | ConfirmDialog now accepts `overlayClassName` for z-index control. |
| 2026-03-31 | Phase 12.0 completed: MySQL switch (mysql2 + Drizzle migrations), test DB reset speedups (truncate + single-worker Vitest), and user-run server tests passing. |
| 2026-03-31 | Phase 12 planning updated: canonical domain flo-state.in (www redirect), added Phase 12.0 DB switch (MySQL, DDL-only), and expanded hosting plan sections in `Docs/dev/deployment-overview.md`. |
| 2026-03-31 | Phase 12 planning: moved hosting plan to `Docs/dev/deployment-overview.md`, set domain to flo-state.in, and split Phase 12 into subphases (12.1–12.5). |
| 2026-03-31 | Phase 12 started: production readiness checklist + hosting plan (`Docs/dev/deployment-overview.md`) drafted; no implementation changes yet. |
| 2026-03-30 | Deferred Phase 10.5 templates/polish work by request; to be revisited later. |
| 2026-03-30 | Settings templates implemented (panel/form/list/modal), a11y focus/hover polish across settings, and client tests run. |
| 2026-03-27 | Phase 10.4 completed: dashboard visual overhaul with glassmorphism, two-column layout, priority bands, and alert styling; no backend changes. |
| 2026-03-27 | Announcement audience roles now auto-complement between include/exclude with user overrides; compose/view modals scroll; home-page tests updated. |
| 2026-03-27 | Announcements now fully wired: dashboard unread list + compose modal (subject/body + role/user audience targeting), permission gating, and mark-seen flow. |
| 2026-03-25 | Phase 10 split into subphases; 10.1 completed (dashboard foundation: Team Pulse + admin invites + stat card shell). Phase 10 marked in progress; remaining dashboard overhaul + analytics + templates planned. |
| 2026-03-25 | Phase 6.4 + 6.5 completed: board realtime refresh on socket events, thread rooms for messages/replies/reactions/media, and polling fallback when sockets are disconnected. |
| 2026-03-25 | Phase 6.3 completed: workspace/board presence, AFK status, last-seen tracking, and presence indicators wired into threads + channel member lists; threads selection + manage view now persist in URL; channel permission overrides use dropdown with clear-override controls. |
| 2026-03-24 | Phase 6.1 + 6.2 completed: Socket.IO infra (auth + rooms + client store) plus activity logs + API + Team Pulse + board activity panel, with mentions logged to activity. |
| 2026-03-24 | Phase 5.5 completed: channels + overrides, manage/view panel, per-channel permission overrides. |
| 2026-03-16 | Phase 5.4 completed: DM threads with reactions, reply threads, mention counters, encryption, attachments, voice notes, and UI polish; Phase 5.5 created for channels + overrides. |
| 2026-03-14 | Phase 5.4 started: drafted detailed threads (DM-first) plan with encryption, mentions, and permission/override scaffolding. |
| 2026-03-14 | Phase 8 completed: focus mode Pomodoro with configurable sessions, animated backgrounds, partial-session tracking, and client tests. |
| 2026-03-14 | Phase 8 started: focus mode Pomodoro page with configurable session lengths and local-only history/stats. |
| 2026-03-14 | Phase 5.3 completed: roles/permissions system with admin/member/guest defaults, role assignment + management UI, permission gating, and migration hardening; user-run tests pass. |
| 2026-03-13 | Phase 4.4 completed: comments with reactions/mentions and delete, archive/restore for boards/lists/cards, retention countdown badges, and UI polish for comments/cards; Phase 4 marked complete. |
| 2026-03-13 | Phase 4.2 verified complete (attachments, retention settings, list DnD, card autosave, due-date normalization); Phase 4.3 started with labels/assignments/cover colors (schema + API + UI work in progress). |
| 2026-03-13 | Phase 4.3 completed: labels CRUD, assignee toggles, and cover colors integrated end-to-end with schema/type fixes and polish passes. |
| 2026-03-12 | Phase 3 verified complete after user-run tests; card drag-and-drop finalized with dnd-kit and docs updated. |
| 2026-03-12 | Confirmed implementation defaults: Bun, TypeScript for client/server, plain workspace structure, first-signup auto-admin, edit yes/delete restricted, done-list cleanup trigger, email invite flow. Added execution checklist to the legacy planning notes and added progress logging policy. |
| 2026-03-12 | Implemented Phase 1.1 scaffold: Bun workspaces, client React+Vite+Tailwind+shadcn-style shell, server Express+TS health API, lint configs, and baseline tests. Lint and TypeScript checks passed. Client build/test execution in sandbox hit `spawn EPERM`; runtime/build/test verification deferred to user environment and full-phase test cadence. |
| 2026-03-12 | Fixed server startup blocker by pinning `zod` to `3.24.1`. Implemented Phase 1.2 backend foundation: Drizzle schema (users/boards/lists/cards), SQLite initialization, JWT auth (`register/login/logout/me`), auto-admin on first signup, auth middleware, and auth integration tests. |
| 2026-03-12 | Implemented Phase 1.3 client auth integration: Zustand auth store, API-backed login/register/logout/me flow, route guards, session hydration, authenticated app-shell header, and Vite API proxy setup. Lint/type/build checks executed; tests intentionally not executed per user instruction. |
| 2026-03-12 | User-run tests reported server failure: beforeAll is not defined. Fixed by enabling globals: true in server/vitest.config.ts. Awaiting user re-run of server tests. |
| 2026-03-12 | Fixed login/register blocker by improving validation feedback end-to-end: backend now returns specific Zod field messages, client parses field-level details, and forms validate email/password rules before submit. |
| 2026-03-12 | User confirmed full Phase 1 verification complete: tests passed and manual runtime validation succeeded. |
| 2026-03-12 | Implemented Phase 2.1 backend: new boards module (`/api/boards`) with board/list CRUD, list reorder endpoint, schema validation, and automatic default lists (To Do / In Progress / Done). Added `server/tests/boards.test.ts`. |
| 2026-03-12 | Implemented Phase 2.2 frontend: `/boards` and `/boards/:boardId` pages with create/edit/delete board controls, background preset selection, list create/rename/delete/toggle/reorder, plus route and sidebar wiring. Client/server lint + type checks pass; user-run tests pending. |
| 2026-03-12 | User ran the full test suite and confirmed all tests pass for Phase 2. Added router-aware HomePage unit test rendering (wrapped in `MemoryRouter`) after introducing `Link` usage. Phase 2.2 marked complete. |
| 2026-03-12 | Phase 2 UX polish: replaced browser confirm prompts with in-app confirmation modals, removed board action refresh/jump behavior by using local state updates, added list drag-and-drop reordering, moved board settings to a collapsible bottom section, and made background preview update live while editing. |
| 2026-03-12 | Phase 2 gradient polish: board content area now inherits selected board gradient while inside `/boards/:boardId` only (sidebar/header unchanged). Updated gradient presets to remove `sunset-grid` from selectable options and added smooth options (`mint-breeze`, `rose-aurora`, `cobalt-dawn`) with legacy `sunset-grid` compatibility retained for existing boards. |
| 2026-03-12 | Phase 2 visual tuning: darkened board-surface gradients slightly for better board identity contrast and added inline tuning guidance in `client/src/lib/board-backgrounds.ts` (adjust linear alpha `0.90` for lighter/darker). |
| 2026-03-12 | Phase 2 save-feedback polish: board settings now show explicit save feedback (Saving... while request is in flight and a floating Saved label on success) to reduce uncertainty about persisted changes. |
| 2026-03-12 | Phase 2 autosave polish: removed manual Save board action and switched board settings (name, description, background) to debounced autosave (750ms pause). Added inline Saving... status and preserved delayed floating Saved confirmation after successful persistence. |
| 2026-03-12 | Phase 2.3 completed summary: delivered board UX polish bundle including in-app confirmations, no-refresh interactions, drag-drop list ordering, board-only gradient backgrounds with expanded smooth presets, board and list debounced autosave flows, pencil-to-edit list names, and consistent delayed Saved confirmation feedback. |
| 2026-03-12 | Phase 2 list-editor polish: entering list edit now focuses input without scroll reposition; editor closes on Enter and on blur/click-away while persisting pending debounced autosave changes. |
| 2026-03-12 | Phase 2 list-editor stability fix: removed unintended board reload coupling when toggling list edit mode, eliminating page jump-to-top behavior on edit/save while keeping Enter/blur close-and-save flows. |
| 2026-03-12 | Phase 2 focus-fix: resolved list-name editor regression where repeated focus/select on rerender replaced text each keystroke; editor now focuses once on open with caret at end and no repeated reselection. |
| 2026-03-12 | Phase 2 list-delete UI tweak: moved per-list delete action from bottom text button to header icon row beside edit, using a red trash icon while preserving the same confirmation and delete flow. |
| 2026-03-12 | Implemented Phase 3.1 backend card foundation: card schemas/routes, service methods for create/update/delete/move, board detail card hydration, done-list countdown transitions, and permissions for delete (admin or creator). |
| 2026-03-12 | Implemented Phase 3.2 frontend card workflows on board detail: per-list card rendering, quick add, card edit modal (title/description/priority/due date), in-app card delete confirmation, and drag-and-drop within/across lists with optimistic state + rollback. |
| 2026-03-12 | Added Phase 3.3 client tests (`client/src/pages/boards/board-detail-page.test.tsx`) for card create/edit/delete flows; client lint + typecheck pass; awaiting user-run `client` and `server` tests for full Phase 3 verification. |
| 2026-03-12 | Phase 4.1 delivered: checklists data model + API, board card collapsible checklist previews with progress bars, card modal checklist CRUD, and new client/server checklist tests (user-run pending). |
| 2026-03-13 | Phase 4.2 delivered: attachments (upload/download/delete), board-level retention settings (day/hour/min + mode toggle), retention-aware time-left labels, attachment cleanup on card deletion, and new attachments API test. User to run tests. |


































