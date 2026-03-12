import jwt, { type SignOptions } from "jsonwebtoken";

import { env } from "../config/env.js";
import type { UserRole } from "../db/schema.js";

export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export function signAccessToken(payload: AuthTokenPayload): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"]
  };

  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);

  if (typeof decoded !== "object" || !decoded.sub || !decoded.email || !decoded.role) {
    throw new Error("Invalid token payload");
  }

  return {
    sub: String(decoded.sub),
    email: String(decoded.email),
    role: decoded.role as UserRole
  };
}
