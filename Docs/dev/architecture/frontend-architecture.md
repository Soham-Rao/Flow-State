# Frontend Architecture

The FlowState frontend is a route-driven React application that combines reusable UI primitives, page-specific controller logic, shared stores, and API helpers. It is not organized as one giant feature dump. Several large surfaces have already been decomposed into focused page-adjacent modules.

## Main entry points

The two most useful starting files are:

- [client/src/main.tsx](d:/all_files/My_files/MyInterests/coding/2026/new/FlowState/client/src/main.tsx)
- [client/src/routes/app-router.tsx](d:/all_files/My_files/MyInterests/coding/2026/new/FlowState/client/src/routes/app-router.tsx)

From there, the app branches into:

- public routes
- protected routes inside the shell

## Route model

The router currently covers:

- home
- boards
- board detail
- focus
- threads
- settings/profile
- settings/general
- settings/advanced
- login
- register
- privacy
- terms

Lazy loading is used for major route surfaces to keep the initial bundle more controlled.

## App shell

The persistent logged-in layout lives in:

- [app-shell.tsx](d:/all_files/My_files/MyInterests/coding/2026/new/FlowState/client/src/components/layout/app-shell.tsx)

This shell owns the high-level navigation experience and shared surface behavior such as:

- page framing
- settings entry points
- admin-visible bug inbox count badge

## Public pages

Public pages use:

- [public-page-layout.tsx](d:/all_files/My_files/MyInterests/coding/2026/new/FlowState/client/src/components/public/public-page-layout.tsx)

This gives login, register, and legal pages a more consistent public-facing structure.

## Boards surface

Boards are one of the most decomposed frontend areas. The main board detail page delegates behavior into adjacent files for:

- dialog rendering
- board handlers
- card handlers
- drag behavior
- autosave behavior
- toggles
- settings
- view composition
- activity

This is good for maintainability, but it means board work rarely lives in one file.

When making a board change:

1. find the actual interaction entry point
2. identify whether it belongs to view, controller, handler, drag, or dialog code
3. follow the matching API helper

## Threads surface

The threads page similarly splits behavior into:

- main page
- controller
- actions
- media handling
- composer
- message list
- reply drawer
- sidebar
- forward modal

The page is effectively a composed messaging workspace rather than a tiny component.

## Settings surfaces

Settings are intentionally separated:

- profile for personal data
- general for workspace/role management
- advanced for operational tools such as the bug inbox

This separation helps keep high-risk administrative changes away from casual personal edits.

## API layer

The client talks to the backend through API helper modules under `client/src/lib/`.

These modules:

- shape requests
- parse responses
- normalize error behavior

The shared API client also maps common server failures into friendlier UI categories, including:

- session expiry
- permission errors
- maintenance/unavailable cases
- rate limiting
- network failure

## Shared stores

The frontend uses shared stores where global or cross-screen state makes sense, such as auth and app feedback behavior.

These stores should remain purposeful. They are not meant to become dumping grounds for every page-local concern.

## UI primitives

Reusable UI primitives and templates live under:

- `client/src/components/ui/`

Page composition code should reuse these where it improves consistency rather than rebuilding every layout or interaction from scratch.

## Error handling model

The frontend error strategy now has several layers:

- route fallback while lazy chunks load
- error boundaries for unexpected render failures
- page-level error cards for recoverable load issues
- modal/banner treatment for common API failures

This is important because a feature change that returns new error types may need corresponding UI handling to keep the experience coherent.

## Developer advice

- follow the route-to-page-to-api path first
- do not assume one huge “frontend state manager” exists for every concern
- treat boards and threads as feature systems, not just screens
- when changing UX, inspect existing feedback components before inventing new patterns
