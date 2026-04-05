# Complete Permission Reference

This page is the detailed permission catalog for FlowState. It is meant for administrators and advanced users who need to understand exactly what each permission enables.

## How permissions work in practice

A role is a bundle of permissions.

A permission is the individual capability itself.

FlowState also supports scoped overrides, which means a permission can be:

- allowed in a specific context
- denied in a specific context

Common scopes include:

- board
- section or conversation area
- card

That is why access can differ by location even when a user’s broad role stays the same.

## Workspace controls

| Permission | Meaning | What it usually enables | Notes |
| --- | --- | --- | --- |
| `manage_workspace` | Manage workspace-level settings | Broad workspace administration and metadata changes | High-impact admin permission |
| `manage_roles` | Manage roles | Create, edit, and assign roles | Changes future access patterns too |
| `invite_users` | Invite users | Create and share invite links | Controls who can join |
| `remove_users` | Remove users | Remove people from the workspace | High-impact membership action |
| `view_activity_logs` | View activity logs | Review workspace activity and audit-style history | Useful for oversight |
| `send_announcements` | Send announcements | Create targeted or workspace-wide announcements | Not an ordinary chat action |

## Boards and lists

| Permission | Meaning | What it usually enables | Notes |
| --- | --- | --- | --- |
| `view_boards` | View boards | Open boards and see their lists/cards | Can still be altered by board-scoped overrides |
| `create_boards` | Create boards | Create new boards | Structural workspace action |
| `edit_boards` | Edit boards | Rename and update board details | Often paired with list management |
| `delete_boards` | Delete or archive boards | Remove boards from active use | Destructive or semi-destructive |
| `manage_lists` | Manage lists | Create, rename, reorder, or edit lists | Board-structure control |

## Cards

| Permission | Meaning | What it usually enables | Notes |
| --- | --- | --- | --- |
| `create_cards` | Create cards | Add new cards | Can be overridden per board |
| `edit_cards` | Edit cards | Change card title, description, and metadata | Does not automatically imply delete power |
| `delete_cards_own` | Delete own cards | Delete cards you created | Own-versus-any rule matters |
| `delete_cards_any` | Delete any card | Delete cards regardless of creator | Stronger than own-delete |
| `assign_members` | Assign card members | Add or change card assignees | Important for ownership workflows |
| `set_due_dates` | Set due dates | Add or edit due dates | Planning/scheduling capability |
| `manage_checklists` | Manage checklists | Create and update checklist structure | Helpful for multi-step cards |
| `upload_files` | Upload files | Attach files to cards | Subject to storage/retention behavior |
| `manage_labels` | Manage labels | Create or edit labels | Helps classify work across a board |

## Comments and mentions

| Permission | Meaning | What it usually enables | Notes |
| --- | --- | --- | --- |
| `comment` | Post comments | Add comments in collaboration surfaces | Core collaboration ability |
| `edit_comments` | Edit comments | Edit comments, usually your own | Still tied to comment rules |
| `delete_comments` | Delete comments | Remove comments | Moderation-style power |
| `react` | React | Add emoji reactions | Lightweight collaboration signal |
| `mention_users` | Mention users | Tag individual people | Drives attention and notifications |
| `mention_roles` | Mention roles | Tag whole roles | Higher-noise, use carefully |

## Threads, DMs, and channels

| Permission | Meaning | What it usually enables | Notes |
| --- | --- | --- | --- |
| `view_threads` | View threads area | Open thread surfaces | Broad threads visibility |
| `create_threads` | Create threads | Start new thread conversations | Not identical to replying everywhere |
| `reply_threads` | Reply in threads | Reply inside thread contexts | Needed for threaded discussion |
| `delete_threads` | Delete threads/messages broadly | Remove thread content | Strong moderation action |
| `pin_threads` | Pin threads | Pin important threads | Organizational feature |
| `dm_read` | Read DMs | Open direct message conversations | Direct-message visibility |
| `dm_write` | Send DMs | Write in DMs | Needed for active DM participation |
| `dm_encrypt` | Encrypt DMs | Use encrypted DM storage path | Mostly a protected capability flag |
| `channel_read` | Read channels | View channel messages | Can be overridden per channel |
| `channel_write` | Write in channels | Send channel messages | Can be overridden per channel |
| `channel_edit` | Edit channels | Rename channels and update descriptions | Channel-structure control |
| `channel_members_add` | Add channel members | Add people to channels | Membership management |
| `channel_members_remove` | Remove channel members | Remove people from channels | Membership management |
| `channel_manage_overrides` | Manage channel overrides | Grant/revoke channel-specific overrides | Powerful and subtle permission |
| `channel_delete` | Delete channels | Delete channel spaces and history | Destructive action |

## Settings

| Permission | Meaning | What it usually enables | Notes |
| --- | --- | --- | --- |
| `view_settings` | View settings | Open settings pages | Does not imply admin controls within them |

## Channel-specific override permissions

The channel override model can directly affect these permissions in one specific channel:

- `channel_read`
- `channel_write`
- `channel_edit`
- `channel_members_add`
- `channel_members_remove`
- `channel_manage_overrides`
- `channel_delete`

That means a user may be broadly unable to do something but allowed in one specific channel, or broadly allowed but denied in one sensitive channel.

## Board-scoped override examples

Board-scoped overrides can affect permissions such as:

- `view_boards`
- `create_cards`
- `edit_cards`

This is why a user may be able to work in one board but not another even with the same role.

## Practical advice for admins

- grant the smallest set of permissions that still lets the user do their real work
- use overrides for real exceptions, not for chaotic everyday role design
- review delete, membership, and override-management permissions carefully
- remember that `view` and `edit` are different
- remember that settings visibility does not equal admin authority
