import crypto from "node:crypto";

import bcrypt from "bcryptjs";
import { and, count, eq, ne } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { users, type UserRole } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { signAccessToken } from "../../utils/jwt.js";
import { consumeInvite, validateInviteForRegistration } from "../invites/invites.service.js";
import { getSystemRoleIds, setUserRoles } from "../roles/roles.service.js";
import type { LoginBody, RegisterBody, UpdateProfileBody } from "./auth.schema.js";

interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  age: number | null;
  dateOfBirth: Date | null;
  createdAt: Date;
}

interface AuthResponse {
  token: string;
  user: PublicUser;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toPublicUser(user: {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  age: number | null;
  dateOfBirth: Date | null;
  createdAt: Date;
}): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    age: user.age,
    dateOfBirth: user.dateOfBirth,
    createdAt: user.createdAt
  };
}

export async function registerUser(input: RegisterBody): Promise<AuthResponse> {
  const email = normalizeEmail(input.email);
  const inviteToken = input.inviteToken?.trim();
  const invite = inviteToken ? validateInviteForRegistration(inviteToken, email) : null;

  const existing = db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1).get();

  if (existing) {
    throw new ApiError(409, "Email is already in use");
  }

  const [{ totalUsers }] = db
    .select({ totalUsers: count(users.id) })
    .from(users)
    .all();

  const { adminRoleId, memberRoleId, guestRoleId } = getSystemRoleIds();
  const roleIds = totalUsers === 0 ? [adminRoleId] : (invite?.roleIds ?? [guestRoleId]);
  const role: UserRole = roleIds.includes(adminRoleId) ? "admin" : roleIds.includes(memberRoleId) ? "member" : "guest";
  const passwordHash = await bcrypt.hash(input.password, 12);
  const now = new Date();
  const userId = crypto.randomUUID();

  db.insert(users)
    .values({
      id: userId,
      name: input.name.trim(),
      email,
      passwordHash,
      role,
      createdAt: now,
      updatedAt: now
    })
    .run();
  setUserRoles(userId, roleIds);

  const created = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      username: users.username,
      displayName: users.displayName,
      bio: users.bio,
      age: users.age,
      dateOfBirth: users.dateOfBirth,
      createdAt: users.createdAt
    })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (!created) {
    throw new ApiError(500, "Failed to create user");
  }

  if (invite) {
    consumeInvite(invite.inviteId, userId);
  }

  const token = signAccessToken({
    sub: created.id,
    email: created.email,
    role: created.role
  });

  return {
    token,
    user: toPublicUser(created)
  };
}

export async function loginUser(input: LoginBody): Promise<AuthResponse> {
  const email = normalizeEmail(input.email);

  const user = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      passwordHash: users.passwordHash,
      role: users.role,
      username: users.username,
      displayName: users.displayName,
      bio: users.bio,
      age: users.age,
      dateOfBirth: users.dateOfBirth,
      createdAt: users.createdAt
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
    .get();

  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  const validPassword = await bcrypt.compare(input.password, user.passwordHash);

  if (!validPassword) {
    throw new ApiError(401, "Invalid email or password");
  }

  const token = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role
  });

  return {
    token,
    user: toPublicUser(user)
  };
}

export function getCurrentUser(userId: string): PublicUser {
  const user = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      username: users.username,
      displayName: users.displayName,
      bio: users.bio,
      age: users.age,
      dateOfBirth: users.dateOfBirth,
      createdAt: users.createdAt
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .get();

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return toPublicUser(user);
}

export function updateProfile(userId: string, input: UpdateProfileBody): PublicUser {
  const now = new Date();
  const updates: Partial<typeof users.$inferInsert> = {
    updatedAt: now
  };

  if (input.name !== undefined) {
    updates.name = input.name.trim();
  }

  if (input.username !== undefined) {
    if (input.username === null) {
      updates.username = null;
    } else {
      const normalized = input.username.trim();
      const existing = db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.username, normalized), ne(users.id, userId)))
        .limit(1)
        .get();

      if (existing) {
        throw new ApiError(409, "Username is already in use");
      }

      updates.username = normalized;
    }
  }

  if (input.displayName !== undefined) {
    updates.displayName = input.displayName === null ? null : input.displayName.trim();
  }

  if (input.bio !== undefined) {
    updates.bio = input.bio === null ? null : input.bio.trim();
  }

  if (input.age !== undefined) {
    updates.age = input.age;
  }

  if (input.dateOfBirth !== undefined) {
    updates.dateOfBirth = input.dateOfBirth;
  }

  db.update(users)
    .set(updates)
    .where(eq(users.id, userId))
    .run();

  const user = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      username: users.username,
      displayName: users.displayName,
      bio: users.bio,
      age: users.age,
      dateOfBirth: users.dateOfBirth,
      createdAt: users.createdAt
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .get();

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return toPublicUser(user);
}









