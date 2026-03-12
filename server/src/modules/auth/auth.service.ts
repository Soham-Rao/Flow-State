import crypto from "node:crypto";

import bcrypt from "bcryptjs";
import { count, eq } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { users, type UserRole } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { signAccessToken } from "../../utils/jwt.js";
import type { LoginBody, RegisterBody } from "./auth.schema.js";

interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
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
  createdAt: Date;
}): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt
  };
}

export async function registerUser(input: RegisterBody): Promise<AuthResponse> {
  const email = normalizeEmail(input.email);

  const existing = db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1).get();

  if (existing) {
    throw new ApiError(409, "Email is already in use");
  }

  const [{ totalUsers }] = db
    .select({ totalUsers: count(users.id) })
    .from(users)
    .all();

  const role: UserRole = totalUsers === 0 ? "admin" : "member";
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

  const created = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt
    })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (!created) {
    throw new ApiError(500, "Failed to create user");
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
