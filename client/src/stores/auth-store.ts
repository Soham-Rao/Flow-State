import { create } from "zustand";

import * as authApi from "@/lib/auth-api";
import { clearSessionToken, getSessionToken, setSessionToken } from "@/lib/session";
import type { AuthUser } from "@/types/auth";

type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

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

interface AuthState {
  hydrated: boolean;
  status: AuthStatus;
  user: AuthUser | null;
  error: string | null;
  hydrate: () => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (input: UpdateProfileInput) => Promise<void>;
  clearError: () => void;
}

function setAuthenticated(user: AuthUser): Pick<AuthState, "status" | "user" | "error"> {
  return {
    status: "authenticated",
    user,
    error: null
  };
}

function setUnauthenticated(error: string | null = null): Pick<AuthState, "status" | "user" | "error"> {
  return {
    status: "unauthenticated",
    user: null,
    error
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  hydrated: false,
  status: "idle",
  user: null,
  error: null,

  hydrate: async () => {
    if (get().hydrated) {
      return;
    }

    const token = getSessionToken();
    if (!token) {
      set({ ...setUnauthenticated(), hydrated: true });
      return;
    }

    set({ status: "loading", error: null });

    try {
      const user = await authApi.getCurrentUser();
      set({ ...setAuthenticated(user), hydrated: true });
    } catch {
      clearSessionToken();
      set({ ...setUnauthenticated(), hydrated: true });
    }
  },

  register: async (input) => {
    set({ status: "loading", error: null });

    try {
      const response = await authApi.register(input);
      setSessionToken(response.token);
      set(setAuthenticated(response.user));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to register";
      set(setUnauthenticated(message));
      throw error;
    }
  },

  login: async (input) => {
    set({ status: "loading", error: null });

    try {
      const response = await authApi.login(input);
      setSessionToken(response.token);
      set(setAuthenticated(response.user));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to login";
      set(setUnauthenticated(message));
      throw error;
    }
  },

  updateProfile: async (input) => {
    try {
      const updated = await authApi.updateProfile(input);
      set((state) => ({
        user: state.user ? { ...state.user, ...updated } : updated
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update profile";
      set({ error: message });
      throw error;
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout network errors and clear local session regardless.
    }

    clearSessionToken();
    set(setUnauthenticated());
  },

  clearError: () => {
    set({ error: null });
  }
}));
