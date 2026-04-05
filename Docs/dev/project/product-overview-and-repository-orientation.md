# Product Overview and Repository Orientation

FlowState is a collaborative workspace application that combines planning, communication, focus tooling, and administrative controls into a single web product. It is not a simple CRUD toy project. It has enough moving parts that a new developer should first understand the product surfaces before diving into implementation details.

## Core product surfaces

The shipped product currently centers around these major surfaces:

- home dashboard
- boards with lists and cards
- thread-based messaging with DMs and channels
- focus mode / timer
- user profile settings
- general settings for roles and permissions
- advanced settings for operational tools such as the internal bug inbox
- legal/public auth routes such as login, register, privacy, and terms

## Product philosophy in practice

The app tries to balance:

- structured work tracking through boards
- conversational coordination through threads
- user-facing polish and strong frontend interactions
- admin-level control over roles, permissions, and overrides
- production safety through backups, restore verification, maintenance mode, and rollback tooling

This means engineering work is distributed across both product features and operational reliability.

## Top-level repository structure

At the top of the repo, the most important directories are:

- `client/`
- `server/`
- `deploy/`
- `Docs/`
- `My_Docs/`

### `client/`

The frontend application.

Key responsibilities:

- route rendering
- API consumption
- auth bootstrap in the browser
- boards, threads, settings, focus, and legal pages
- friendly error handling and maintenance-aware UI behavior

### `server/`

The backend application.

Key responsibilities:

- API routing
- auth and permission enforcement
- database access through Drizzle and MySQL
- operational helpers such as migration safety, backup metadata, and restore verification CLI code

### `deploy/`

Operational shell scripts and templates, especially under `deploy/vps/`.

Key responsibilities:

- safe deploy workflow
- maintenance mode
- backup creation
- restore verification
- rollback operations

### `Docs/`

Official tracked documentation for:

- end users under `Docs/user/`
- developers under `Docs/dev/`

### `My_Docs/`

Ignored personal documentation, including:

- older personal notes
- the web development learning library

This is not the canonical collaborator handoff space.

## How the app is split conceptually

A useful mental split is:

- client handles interaction and rendering
- server enforces business rules and durability
- deploy scripts and infra keep the whole system safe in production

You will make better technical decisions if you keep those boundaries clear.

## Where to start in the codebase

For product flow:

- start with [app-router.tsx](d:/all_files/My_files/MyInterests/coding/2026/new/FlowState/client/src/routes/app-router.tsx)

For frontend shell behavior:

- [app-shell.tsx](d:/all_files/My_files/MyInterests/coding/2026/new/FlowState/client/src/components/layout/app-shell.tsx)

For backend server entry:

- [index.ts](d:/all_files/My_files/MyInterests/coding/2026/new/FlowState/server/src/index.ts)

For env and runtime safety:

- [env.ts](d:/all_files/My_files/MyInterests/coding/2026/new/FlowState/server/src/config/env.ts)

For migration safety:

- [migration-guard.ts](d:/all_files/My_files/MyInterests/coding/2026/new/FlowState/server/src/db/migration-guard.ts)

For deploy workflow:

- [update-safe.sh](d:/all_files/My_files/MyInterests/coding/2026/new/FlowState/deploy/vps/update-safe.sh)
- [deploy-safe.sh](d:/all_files/My_files/MyInterests/coding/2026/new/FlowState/deploy/vps/deploy-safe.sh)

## Feature-to-folder orientation

### Boards

Client code lives primarily under:

- [client/src/pages/boards](d:/all_files/My_files/MyInterests/coding/2026/new/FlowState/client/src/pages/boards)

This area has been split into sub-files by behavior such as:

- activity
- dialogs
- drag logic
- list rendering
- card handlers
- board handlers
- modal rendering

That means board work usually requires reading several focused files rather than one giant component.

### Threads

Thread UI lives around:

- [threads-page.tsx](d:/all_files/My_files/MyInterests/coding/2026/new/FlowState/client/src/pages/threads-page.tsx)
- related controller, composer, sidebar, reply drawer, and utils files nearby

### Settings

Settings pages live under:

- [client/src/pages/settings](d:/all_files/My_files/MyInterests/coding/2026/new/FlowState/client/src/pages/settings)

This includes:

- profile page
- general settings with role/permission management
- advanced settings with the bug inbox workflow

### Legal/public auth

Public login/register/legal pages live under:

- [client/src/pages/login-page.tsx](d:/all_files/My_files/MyInterests/coding/2026/new/FlowState/client/src/pages/login-page.tsx)
- [client/src/pages/register-page.tsx](d:/all_files/My_files/MyInterests/coding/2026/new/FlowState/client/src/pages/register-page.tsx)
- [client/src/pages/legal](d:/all_files/My_files/MyInterests/coding/2026/new/FlowState/client/src/pages/legal)

## Server module orientation

The server is broadly organized by domain modules and shared utilities.

Important areas include:

- auth
- boards
- threads and messages
- roles and permissions
- bug reports
- ops utilities
- db helpers

When debugging a feature, find:

1. the client page or API helper
2. the server route
3. the service layer
4. the schema or DB access

That trace usually explains the whole feature path.

## What not to misunderstand

- `Docs/` is official, `My_Docs/` is personal.
- The frontend can hide controls, but the server is the real permission boundary.
- The deployment scripts are part of the product’s reliability contract, not optional side material.
- Boards and threads are equally core; neither is just a side feature.

## Recommended reading order after this file

1. [Runtime and build mental model](runtime-and-build-mental-model.md)
2. [Frontend architecture](../architecture/frontend-architecture.md)
3. [Backend architecture](../architecture/backend-architecture.md)
4. [Data, auth, permissions, and overrides](../architecture/data-auth-and-permissions.md)
5. [Deploy, backup, restore, and rollback operations](../operations/deploy-backup-restore-and-rollback.md)
