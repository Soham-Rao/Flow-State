export type UserRole = "admin" | "member" | "guest";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  age: number | null;
  dateOfBirth: string | null;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

