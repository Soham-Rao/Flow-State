# Backend Architecture

The backend is an Express-based API and realtime service layer running on Bun, with domain-oriented modules, shared validation and utility layers, and operational code living alongside the main server source.

## Server entry and configuration

Start here for the backend boot path:

- [server/src/index.ts](d:/all_files/My_files/MyInterests/coding/2026/new/FlowState/server/src/index.ts)
- [server/src/config/env.ts](d:/all_files/My_files/MyInterests/coding/2026/new/FlowState/server/src/config/env.ts)

These files define:

- startup
- env parsing and validation
- production safety constraints

## Module structure

The server is organized around domain modules plus shared helpers. Typical module responsibilities include:

- route definitions
- schema validation
- service logic
- DB interaction or queries

This keeps domain changes more localized than a giant route-only file would.

## Shared backend concerns

Important cross-cutting concerns include:

- auth
- permission helpers
- request validation
- structured logging
- rate limiting
- health/readiness reporting
- migration safety
- operational backup/restore helpers

These concerns are intentionally not reimplemented ad hoc in every feature module.

## Operational code inside the server tree

One detail that matters operationally is that the server tree also contains CLI-oriented ops logic, such as:

- backup metadata
- verification tools
- restore verification helpers

These are built into `server/dist/ops/...` and are consumed by VPS shell scripts.

That means backend changes can affect both:

- HTTP behavior
- operational script behavior

## Logging strategy

The backend uses structured logging so production output is still machine-readable and useful without becoming huge or chaotic.

Log categories now include things like:

- migrations prepare/complete
- deploy/ops events
- alerts skipped
- health-oriented signals

Be careful not to add noisy logs that dump excess payload data or secrets.

## Route-to-service flow

A healthy path for a backend feature usually looks like:

1. route receives the request
2. auth and middleware establish context
3. schema validates input
4. service layer applies business rules
5. DB layer reads/writes durable state
6. route returns a safe response payload

If a change bypasses those layers carelessly, it is usually a smell.

## Bug report module as a recent example

The bug report workflow is a useful recent example because it shows:

- authenticated creation
- own-versus-admin visibility rules
- admin-only status updates
- UI-facing summary output

It is a good reference for how newer features should combine:

- schema validation
- permission checks
- explicit service logic

## Backend pitfalls to watch

- putting permission checks only in the client
- adding route logic without shared validation
- mixing operational scripts and app runtime assumptions carelessly
- returning raw internals to end users
- forgetting that prod deploy scripts depend on built backend helper files
