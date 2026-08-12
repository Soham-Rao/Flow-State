# API and Data Reference

This is the practical developer reference for FlowState’s backend surface and main data model.

## 1. API families

FlowState organizes routes by module rather than one giant route file.

Main route families:

- `auth`
- `boards`
- `threads`
- `roles`
- `invites`
- `dashboard`
- `activity`
- `mentions`
- `announcements`
- `bug-reports`

## 2. Auth API

Auth covers:

- register
- login
- logout
- current user (`me`)
- profile updates
- forgot/reset password scaffolding

Notable behavior:

- normal registration creates a workspace-less account
- workspace membership and roles are added only by accepting an invite, joining with a workspace code, or creating a workspace
- registration now requires legal consent flag on the request
- password reset delivery is still SMTP-dependent future work

## 3. Boards API

Boards routes include:

- board CRUD
- list CRUD/reorder
- card CRUD/move/archive/delete
- labels CRUD and label assignment
- checklist CRUD and item state updates
- comments and comment reactions
- attachments upload/download/delete
- archived content restore flows

Card creation requires a title, a due date, and at least one assignee. The backend enforces the same rule as the board-list form, so API clients must send `dueDate` and `assigneeIds` when posting to `POST /api/boards/lists/:listId/cards`.

## 4. Threads API

Threads routes include:

- DM list and selection
- channel list and selection
- channel creation/edit/delete
- channel membership updates
- channel permission overrides
- message create/edit/delete
- replies
- reactions
- attachments and voice notes
- forwarding flows
- unread/mention surfaces

## 5. Roles and permission API

Roles routes include:

- role creation
- role updates
- role deletion
- role assignment updates
- role listing and permission inspection

The effective access model combines:

- global role permissions
- multiple role assignments
- scoped overrides
- resource-specific access helpers

## 6. Dashboard, activity, mentions, and announcements

These APIs drive:

- home dashboard summaries
- due-date reminder payloads for assigned cards and manager check-ins
- board and workspace activity feeds
- unread board comment mentions
- announcement composition and audience targeting

## 7. Bug reports API

Current short-term support surface:

- submit a bug report
- list your own reports
- admin list of all reports with filtering
- admin status updates (`open`, `triaged`, `closed`)

## 8. Core database entities

### Identity and access

- `users`
- `roles`
- `role_permissions`
- `user_roles`
- `role_scope_overrides`
- `invites`
- `invite_roles`
- `password_reset_tokens`

### Boards/task planning

- `boards`
- `lists`
- `cards`
- `checklists`
- `checklist_items`
- `labels`
- `card_labels`
- `card_assignees`
- `attachments`
- `comments`
- `comment_reactions`
- `comment_mentions`

### Threads/messaging

- `thread_conversations`
- `thread_members`
- `thread_member_permissions`
- `thread_messages`
- `thread_replies`
- `thread_attachments`
- `thread_reply_attachments`
- `thread_voice_notes`
- `thread_reply_voice_notes`
- `thread_mentions`
- `thread_reply_mentions`
- `thread_message_reactions`
- `thread_reply_reactions`
- `thread_message_deletions`
- `thread_reply_deletions`

### Summaries and operations

- `activity_logs`
- `announcements`
- `announcement_recipients`
- `audit_logs`
- `bug_reports`

## 9. Migration model

Schema changes are managed through Drizzle SQL migrations under `server/drizzle/`.

Important 12.x behavior:

- additive-first posture
- risky migration linting
- explicit acknowledgement comment for risky SQL
- advisory locking during migrations
- backup-aware gating in production

## 10. Data handling notes

- user-authored content is sanitized server-side before persistence
- sensitive thread/DM content can use encryption helpers where applicable
- production backups use compressed dumps and optionally encrypted offsite archives
- uploads remain local-host stored files, not part of the DB itself
