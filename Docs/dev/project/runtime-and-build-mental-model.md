# Runtime and Build Mental Model

FlowState is easiest to work on when you understand that it is not one process. It is a set of build steps, runtimes, and deployment surfaces working together.

## The practical split

At a high level:

- the client is authored in React + TypeScript and built by Vite
- the server is authored in TypeScript and built for Bun execution
- production serves the built frontend and built backend
- nginx fronts the app on the VPS

This means every task should start with the question:

- am I changing authoring-time code
- build-time behavior
- runtime behavior
- or deployment behavior

## Client build path

The client source lives under `client/src/`.

The client build process:

1. reads the route/component source tree
2. type-checks/transforms TypeScript and TSX
3. bundles code with Vite
4. outputs production assets into `client/dist`

The browser never receives `client/src/...` directly in production.

## Server build path

The server source lives under `server/src/`.

The server build process:

1. compiles TypeScript using the server build config
2. outputs runnable JS into `server/dist`
3. production starts from the built server entry

Operational CLI helpers also end up in `server/dist/ops/...`, which matters for backup and restore flows.

## Why build artifacts matter operationally

Several production scripts expect built server CLI files to exist. That is why safe deploy flow has to ensure build output is present before certain operational steps. This was tightened during the 12.4/12.6 work after first-run edge cases were discovered in production.

## Runtime boundaries

### Browser runtime

Runs:

- route logic
- components
- stores
- UI error handling
- API requests

### Bun server runtime

Runs:

- Express app
- auth and permission checks
- route handlers
- operational helpers
- DB access

### MySQL runtime

Persists:

- users
- roles
- boards
- messages
- bug reports
- migration history

### nginx runtime

Handles:

- public entrypoint
- reverse proxying
- maintenance page routing
- static serving behavior

## Local development versus production

Local development typically uses:

- client dev server
- server watch mode
- rapid feedback loops

Production uses:

- built assets
- system services
- health checks
- deploy scripts
- maintenance behavior

Do not assume local behavior is a perfect mirror of production, especially around asset serving, maintenance, startup timing, and deployment edge cases.

## Important commands mental model

Useful repo-level commands usually map to:

- develop
- build
- test
- lint
- start

But operational safety also depends on VPS scripts under `deploy/vps/`, which are a separate class of commands:

- deploy
- update
- backup
- restore verify
- rollback

## Environment boundaries

There are several classes of env values:

- client build-time values
- server runtime values
- production ops values
- secrets and credentials

The most important thing is not to confuse:

- browser-exposed values
- server-only secrets

## Mental checklist when debugging

When something goes wrong, ask:

1. did the source code change correctly
2. did it build correctly
3. did the correct runtime load the new build
4. is production using the intended env/config
5. is the issue in browser, server, database, or proxy behavior

This framing avoids a lot of wasted time.
