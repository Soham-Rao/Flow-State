import crypto from "node:crypto";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { db, closePool } from "./connection.js";
import { initializeDatabase } from "./init.js";
import { users } from "./schema.js";
import { getSystemRoleIds, setUserRoles } from "../modules/roles/roles.service.js";

const DEFAULT_EMAIL = "admin@flowstate.local";
const DEFAULT_PASSWORD = "admin123";
const DEFAULT_NAME = "Flowstate Admin";

async function seed(): Promise<void> {
  await initializeDatabase();

  const email = process.env.SEED_ADMIN_EMAIL?.trim() || DEFAULT_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD || DEFAULT_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME?.trim() || DEFAULT_NAME;

  const existingRows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingRows[0]) {
    console.log(`Seed: admin user already exists for ${email}`);
    return;
  }

  const { adminRoleId } = await getSystemRoleIds();
  const now = new Date();
  const userId = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 12);

  await db
    .insert(users)
    .values({
      id: userId,
      name,
      email,
      passwordHash,
      role: "admin",
      createdAt: now,
      updatedAt: now
    })
    .execute();

  await setUserRoles(userId, [adminRoleId]);

  console.log(`Seed: created admin user ${email} (password: ${password})`);
}

seed()
  .then(() => closePool())
  .catch(async (error) => {
    console.error("Seed failed:", error);
    await closePool();
    process.exitCode = 1;
  });
