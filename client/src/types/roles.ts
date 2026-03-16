export const rolePermissions = [
  "manage_workspace",
  "manage_roles",
  "invite_users",
  "remove_users",
  "view_activity_logs",
  "view_boards",
  "create_boards",
  "edit_boards",
  "delete_boards",
  "manage_lists",
  "create_cards",
  "edit_cards",
  "delete_cards_any",
  "delete_cards_own",
  "assign_members",
  "set_due_dates",
  "manage_checklists",
  "upload_files",
  "manage_labels",
  "comment",
  "edit_comments",
  "delete_comments",
  "react",
  "mention_users",
  "mention_roles",
  "view_threads",
  "create_threads",
  "reply_threads",
  "delete_threads",
  "pin_threads",
  "dm_read",
  "dm_write",
  "dm_encrypt",
  "channel_read",
  "channel_write",
  "view_settings"
] as const;

export type RolePermission = (typeof rolePermissions)[number];

export interface RoleSummary {
  id: string;
  name: string;
  color: string;
  priority: number;
  mentionable: boolean;
  isSystem: boolean;
  permissions: RolePermission[];
}

export interface UserRoleAssignment {
  id: string;
  name: string;
  email: string;
  username: string | null;
  displayName: string | null;
  role: "admin" | "member" | "guest";
  roleIds: string[];
}




