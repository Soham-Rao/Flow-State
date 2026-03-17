import crypto from "node:crypto";

import { rolePermissions } from "./schema.js";
import { sqlite } from "./connection.js";

const ADMIN_ROLE_NAME = "Admin";
const MEMBER_ROLE_NAME = "Member";
const GUEST_ROLE_NAME = "Guest";
const ADMIN_ROLE_PRIORITY = 100;
const MEMBER_ROLE_PRIORITY = 50;
const GUEST_ROLE_PRIORITY = 1;
const ADMIN_ROLE_COLOR = "#ef4444";
const MEMBER_ROLE_COLOR = "#64748b";
const GUEST_ROLE_COLOR = "#94a3b8";

const MEMBER_ROLE_PERMISSIONS = [
  "view_boards",
  "create_boards",
  "edit_boards",
  "manage_lists",
  "create_cards",
  "edit_cards",
  "delete_cards_own",
  "assign_members",
  "set_due_dates",
  "manage_checklists",
  "upload_files",
  "manage_labels",
  "comment",
  "edit_comments",
  "react",
  "mention_users",
  "view_threads",
  "create_threads",
  "reply_threads",
  "dm_read",
  "dm_write",
  "dm_encrypt",
  "view_settings"
];

const GUEST_ROLE_PERMISSIONS = [
  "view_boards",
  "dm_read",
  "dm_write"
];

export function ensureDefaultRoles(): { adminRoleId: string; memberRoleId: string; guestRoleId: string } {
  return sqlite.transaction(() => {
    const now = Date.now();
    const existingRoles = sqlite.prepare("SELECT id, name FROM roles").all() as Array<{ id: string; name: string }>;
    let adminRoleId = existingRoles.find((role) => role.name === ADMIN_ROLE_NAME)?.id;
    let memberRoleId = existingRoles.find((role) => role.name === MEMBER_ROLE_NAME)?.id;
    let guestRoleId = existingRoles.find((role) => role.name === GUEST_ROLE_NAME)?.id;

    if (!adminRoleId) {
      adminRoleId = crypto.randomUUID();
      sqlite.prepare("INSERT INTO roles (id, name, color, priority, mentionable, is_system, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(adminRoleId, ADMIN_ROLE_NAME, ADMIN_ROLE_COLOR, ADMIN_ROLE_PRIORITY, 0, 1, now, now);
    }

    if (!memberRoleId) {
      memberRoleId = crypto.randomUUID();
      sqlite.prepare("INSERT INTO roles (id, name, color, priority, mentionable, is_system, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(memberRoleId, MEMBER_ROLE_NAME, MEMBER_ROLE_COLOR, MEMBER_ROLE_PRIORITY, 0, 1, now, now);
    }

    if (!guestRoleId) {
      guestRoleId = crypto.randomUUID();
      sqlite.prepare("INSERT INTO roles (id, name, color, priority, mentionable, is_system, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(guestRoleId, GUEST_ROLE_NAME, GUEST_ROLE_COLOR, GUEST_ROLE_PRIORITY, 0, 1, now, now);
    }

    const insertPermission = sqlite.prepare("INSERT OR IGNORE INTO role_permissions (role_id, permission, created_at) VALUES (?, ?, ?)");
    for (const permission of rolePermissions) {
      insertPermission.run(adminRoleId, permission, now);
    }
    for (const permission of MEMBER_ROLE_PERMISSIONS) {
      insertPermission.run(memberRoleId, permission, now);
    }
    for (const permission of GUEST_ROLE_PERMISSIONS) {
      insertPermission.run(guestRoleId, permission, now);
    }

    return { adminRoleId, memberRoleId, guestRoleId };
  })();
}

export function ensureUserRoleAssignments(adminRoleId: string, memberRoleId: string, guestRoleId: string): void {
  sqlite.transaction(() => {
    const usersRows = sqlite.prepare("SELECT id, role FROM users").all() as Array<{ id: string; role: string }>;
    const roleByLegacy: Record<string, string> = { admin: adminRoleId, member: memberRoleId, guest: guestRoleId };
    const insertUserRole = sqlite.prepare("INSERT OR IGNORE INTO user_roles (user_id, role_id, created_at) VALUES (?, ?, ?)");

    for (const user of usersRows) {
      const roleId = roleByLegacy[user.role] ?? guestRoleId;
      insertUserRole.run(user.id, roleId, Date.now());
    }
  })();
}

export function ensureInviteRoleAssignments(adminRoleId: string, memberRoleId: string, guestRoleId: string): void {
  sqlite.transaction(() => {
    const inviteRows = sqlite.prepare("SELECT id, role FROM invites").all() as Array<{ id: string; role: string }>;
    const roleByLegacy: Record<string, string> = { admin: adminRoleId, member: memberRoleId, guest: guestRoleId };
    const insertInviteRole = sqlite.prepare("INSERT OR IGNORE INTO invite_roles (invite_id, role_id, created_at) VALUES (?, ?, ?)");

    for (const invite of inviteRows) {
      const roleId = roleByLegacy[invite.role] ?? guestRoleId;
      insertInviteRole.run(invite.id, roleId, Date.now());
    }
  })();
}
