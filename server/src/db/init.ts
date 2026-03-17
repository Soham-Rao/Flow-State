import { sqlite } from "./connection.js";
import { BASE_SCHEMA_SQL, CLEAR_TEST_DATA_SQL } from "./init-schema.js";
import { ensureDefaultRoles, ensureInviteRoleAssignments, ensureUserRoleAssignments } from "./init-roles.js";
import {
  applySchemaMigrations,
  ensureIndexes,
  migrateInvitesForGuest,
  migrateUsersForGuest,
  repairLegacyForeignKeys,
  tableAllowsGuest
} from "./init-migrations.js";

export function initializeDatabase(): void {
  sqlite.exec(BASE_SCHEMA_SQL);

  if (!tableAllowsGuest("users")) {
    migrateUsersForGuest();
  }
  if (!tableAllowsGuest("invites")) {
    migrateInvitesForGuest();
  }

  applySchemaMigrations();

  repairLegacyForeignKeys("users_old", "users");
  repairLegacyForeignKeys("invites_old", "invites");
  ensureIndexes();

  const roleSeeds = ensureDefaultRoles();
  ensureUserRoleAssignments(roleSeeds.adminRoleId, roleSeeds.memberRoleId, roleSeeds.guestRoleId);
  ensureInviteRoleAssignments(roleSeeds.adminRoleId, roleSeeds.memberRoleId, roleSeeds.guestRoleId);
}

export function clearDatabaseForTests(): void {
  sqlite.exec(CLEAR_TEST_DATA_SQL);

  if (!tableAllowsGuest("users")) {
    migrateUsersForGuest();
  }
  if (!tableAllowsGuest("invites")) {
    migrateInvitesForGuest();
  }

  applySchemaMigrations();

  repairLegacyForeignKeys("users_old", "users");
  repairLegacyForeignKeys("invites_old", "invites");
  ensureIndexes();

  const roleSeeds = ensureDefaultRoles();
  ensureUserRoleAssignments(roleSeeds.adminRoleId, roleSeeds.memberRoleId, roleSeeds.guestRoleId);
  ensureInviteRoleAssignments(roleSeeds.adminRoleId, roleSeeds.memberRoleId, roleSeeds.guestRoleId);
}
