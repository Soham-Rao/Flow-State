import crypto from "node:crypto";

import { db, type DbTransaction } from "./connection.js";
import {
  inviteRoleAssignments,
  invites,
  rolePermissions,
  rolePermissionsTable,
  roles,
  userRoleAssignments,
  users,
  type RolePermission
} from "./schema.js";

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
  "view_activity_logs",
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
  "delete_threads",
  "pin_threads",
  "dm_read",
  "dm_write",
  "dm_encrypt",
  "channel_read",
  "channel_write",
  "channel_edit",
  "channel_members_add",
  "channel_members_remove",
  "channel_manage_overrides",
  "channel_delete",
  "view_settings"
] satisfies RolePermission[];

const GUEST_ROLE_PERMISSIONS = [
  "view_boards",
  "view_activity_logs",
  "dm_read",
  "dm_write"
] satisfies RolePermission[];

export async function ensureDefaultRoles(): Promise<{ adminRoleId: string; memberRoleId: string; guestRoleId: string }> {
  return db.transaction(async (tx: DbTransaction) => {
    const now = new Date();
    const existingRoles: Array<{ id: string; name: string }> = await tx.select({ id: roles.id, name: roles.name }).from(roles);
    let adminRoleId = existingRoles.find((role) => role.name === ADMIN_ROLE_NAME)?.id;
    let memberRoleId = existingRoles.find((role) => role.name === MEMBER_ROLE_NAME)?.id;
    let guestRoleId = existingRoles.find((role) => role.name === GUEST_ROLE_NAME)?.id;

    if (!adminRoleId) {
      adminRoleId = crypto.randomUUID();
      await tx
        .insert(roles)
        .values({
          id: adminRoleId,
          name: ADMIN_ROLE_NAME,
          color: ADMIN_ROLE_COLOR,
          priority: ADMIN_ROLE_PRIORITY,
          mentionable: false,
          isSystem: true,
          createdAt: now,
          updatedAt: now
        })
        .execute();
    }

    if (!memberRoleId) {
      memberRoleId = crypto.randomUUID();
      await tx
        .insert(roles)
        .values({
          id: memberRoleId,
          name: MEMBER_ROLE_NAME,
          color: MEMBER_ROLE_COLOR,
          priority: MEMBER_ROLE_PRIORITY,
          mentionable: false,
          isSystem: true,
          createdAt: now,
          updatedAt: now
        })
        .execute();
    }

    if (!guestRoleId) {
      guestRoleId = crypto.randomUUID();
      await tx
        .insert(roles)
        .values({
          id: guestRoleId,
          name: GUEST_ROLE_NAME,
          color: GUEST_ROLE_COLOR,
          priority: GUEST_ROLE_PRIORITY,
          mentionable: false,
          isSystem: true,
          createdAt: now,
          updatedAt: now
        })
        .execute();
    }

    const adminPermissions = rolePermissions.map((permission) => ({
      roleId: adminRoleId,
      permission,
      createdAt: now
    }));
    const memberPermissions = MEMBER_ROLE_PERMISSIONS.map((permission) => ({
      roleId: memberRoleId,
      permission,
      createdAt: now
    }));
    const guestPermissions = GUEST_ROLE_PERMISSIONS.map((permission) => ({
      roleId: guestRoleId,
      permission,
      createdAt: now
    }));

    await tx.insert(rolePermissionsTable).ignore().values(adminPermissions).execute();
    await tx.insert(rolePermissionsTable).ignore().values(memberPermissions).execute();
    await tx.insert(rolePermissionsTable).ignore().values(guestPermissions).execute();

    return { adminRoleId, memberRoleId, guestRoleId };
  });
}

export async function ensureUserRoleAssignments(
  adminRoleId: string,
  memberRoleId: string,
  guestRoleId: string
): Promise<void> {
  await db.transaction(async (tx: DbTransaction) => {
    const usersRows: Array<{ id: string; role: string }> = await tx.select({ id: users.id, role: users.role }).from(users);
    const roleByLegacy: Record<string, string> = { admin: adminRoleId, member: memberRoleId, guest: guestRoleId };
    const assignments = usersRows.map((user) => ({
      userId: user.id,
      roleId: roleByLegacy[user.role] ?? guestRoleId,
      createdAt: new Date()
    }));

    if (assignments.length > 0) {
      await tx.insert(userRoleAssignments).ignore().values(assignments).execute();
    }
  });
}

export async function ensureInviteRoleAssignments(
  adminRoleId: string,
  memberRoleId: string,
  guestRoleId: string
): Promise<void> {
  await db.transaction(async (tx: DbTransaction) => {
    const inviteRows: Array<{ id: string; role: string }> = await tx.select({ id: invites.id, role: invites.role }).from(invites);
    const roleByLegacy: Record<string, string> = { admin: adminRoleId, member: memberRoleId, guest: guestRoleId };
    const assignments = inviteRows.map((invite) => ({
      inviteId: invite.id,
      roleId: roleByLegacy[invite.role] ?? guestRoleId,
      createdAt: new Date()
    }));

    if (assignments.length > 0) {
      await tx.insert(inviteRoleAssignments).ignore().values(assignments).execute();
    }
  });
}

