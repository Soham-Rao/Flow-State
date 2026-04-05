# Auth, Roles, Permissions, and Overrides

This document explains FlowState access control as implemented, not as a theoretical future model.

## 1. Authentication model

FlowState uses:

- email/password login
- JWT-based authenticated API access
- client-side auth hydration via the auth store and auth gate

Important behavior:

- first successful signup becomes the first admin
- login/register are validated server-side
- reset-password delivery is deferred until SMTP exists

## 2. Base roles

Current foundational role identities include:

- `admin`
- `member`
- `guest`

On top of that, the app supports custom roles with explicit permission sets.

## 3. Permission model

Permissions are granular, for example:

- workspace management
- role management
- invite management
- board CRUD
- card creation/edit/delete
- label/checklist/attachment abilities
- thread read/write/delete abilities
- DM/channel abilities
- settings and announcement access

Permission strings live in `server/src/db/schema.ts`.

## 4. Effective access is not just one role

Actual access is derived from:

- base user role
- extra role assignments
- scoped overrides
- resource-specific access rules
- own-vs-any distinctions for destructive actions

That means “what can this user do?” is always contextual.

## 5. Scoped overrides

Scoped overrides are intentionally part of the product and must not be broken by refactors.

Current scope types include:

- global
- board
- section
- card

Access values:

- allow
- deny

Important rule:

- deny wins for that scope

## 6. Channel-specific permission behavior

Threads/channels also have member-level permissions and conversation-specific controls.

That is why:

- a user may generally have thread access
- but a specific channel may still behave differently

## 7. Access helper centralization

Recent hardening moved more checks into centralized access helpers.

Use those helpers rather than rebuilding ad-hoc logic in new routes/services.

This is important because it preserves:

- scoped overrides
- shared-resource behavior
- own-vs-any checks
- future testability

## 8. Shared resources vs private resources

The product intentionally supports shared resources.

So authorization does **not** mean:

- “every user can only ever access rows they personally own”

It means:

- users can access resources they are authorized to access
- shared boards/channels remain shared when policy allows them
- private or restricted actions must fail clearly

## 9. Developer rules for future changes

When adding a new protected action:

1. decide whether it is own-only, any, shared, or admin-level
2. route it through centralized permission/access helpers
3. keep scoped overrides in mind
4. add negative tests, not only happy-path tests

## 10. Tests that matter most

High-value permission tests include:

- user denied access to someone else’s destructive action
- override allows access where the base role would not
- override denies access where the base role would allow
- board/channel shared reads still work
- admin-only bug inbox/status changes stay admin-only
