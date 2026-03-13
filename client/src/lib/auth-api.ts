import { apiRequest } from "@/lib/api-client";
import type { AuthResponse, AuthUser } from "@/types/auth";

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  inviteToken?: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface UpdateProfileInput {
  name?: string;
  username?: string | null;
  displayName?: string | null;
  bio?: string | null;
  age?: number | null;
  dateOfBirth?: string | null;
}

export function register(input: RegisterInput): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function login(input: LoginInput): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function logout(): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/auth/logout", {
    method: "POST",
    auth: true
  });
}

export function getCurrentUser(): Promise<AuthUser> {
  return apiRequest<AuthUser>("/auth/me", {
    method: "GET",
    auth: true
  });
}

export function updateProfile(input: UpdateProfileInput): Promise<AuthUser> {
  return apiRequest<AuthUser>("/auth/me", {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(input)
  });
}
