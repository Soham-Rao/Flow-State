# Data, Auth, Permissions, and Overrides

This file ties together four linked concerns:

- data shape
- authentication
- authorization
- overrides

These concerns are spread across frontend expectations, backend enforcement, and database structure. A developer working on one of them usually needs awareness of the others.

## Data model at a conceptual level

The application stores several major groups of data:

- users and roles
- workspace permissions and overrides
- boards, lists, cards, and related activity
- thread conversations, replies, and media-related state
- announcements and dashboard signals
- bug reports
- migration history and operational metadata

The exact schema lives in the DB definitions and generated migrations, but the conceptual grouping above is enough to understand most feature work.

## Authentication model

Authentication establishes the identity of the caller.

Important associated concerns include:

- credential verification
- token/session handling
- expiry behavior
- reset flow
- env-backed secret validation

The frontend may know “current user” for UI purposes, but the server remains the real source of truth.

## Authorization model

Authorization answers whether an authenticated user can perform a specific action in a specific context.

In FlowState, that often means combining:

- role-granted ability
- own-versus-any behavior
- scoped access to a board or conversation
- overrides that adjust default access

## Overrides

Overrides are important enough to be treated explicitly in design and documentation.

They exist because global roles alone are not precise enough for every collaboration scenario. However, the code must preserve the override model rather than flattening it into simplistic yes/no assumptions.

This was one of the explicit goals of the 12.6 access-hardening work:

- centralize permission helpers
- preserve scoped overrides
- add more negative tests

## Practical rule for contributors

When you are adding or editing a protected feature:

- do not assume a role alone tells the full story
- inspect the existing permission resolution path
- confirm whether overrides should change the result

## Legal signup consent

Legal consent in 12.6 is enforced at registration time but intentionally not persisted as a durable acceptance table in the database for now. That means:

- client must send the required consent field
- server must reject missing consent
- developer should not assume a stored acceptance history exists yet

## Bug report access model

This is a simple but useful example:

- any signed-in user may create a report
- users may list their own reports
- only admins may list all reports or change status

This pattern is a good template for future own-versus-admin workflows.

## Testing implications

Permission-sensitive changes should usually add negative tests, not only happy paths.

Important test styles:

- unauthorized user cannot access someone else’s resource
- allowed shared resource still works
- override changes effective access correctly
- admin-only mutation remains admin-only

## Migration and data safety implications

Because permission, role, and bug report features are data-backed, schema changes in these areas should follow the additive-first migration posture introduced in 12.4 and tightened in 12.6.

That means:

- minimize destructive change
- respect risky migration detection
- verify compatibility when possible
