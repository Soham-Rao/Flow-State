# API, DB, and Feature Map

This file is a compact reference map rather than a complete exhaustive API spec.

## Major client feature areas

- auth and legal routes
- dashboard/home
- boards
- threads
- focus
- settings/profile
- settings/general
- settings/advanced

## Major backend feature areas

- auth
- roles/permissions
- boards/cards
- threads/messages
- bug reports
- health/ops

## Important recent capability milestones

### 12.4

- backup encryption
- checksum-rich manifests
- restore verification
- migration locking and risky migration handling
- client caching and bundle improvement

### 12.6

- legal pages
- registration consent enforcement
- bug inbox
- centralized permission hardening
- friendlier common error UX

## DB attention areas

Hot-path data and correctness concerns currently concentrate around:

- boards and card movement
- thread messages and replies
- roles and overrides
- announcements/activity/dashboard signals
- bug reports
- migration metadata and operational backup manifests

For precise schema truth, inspect the actual Drizzle schema files and generated migrations in `server/drizzle/`.
