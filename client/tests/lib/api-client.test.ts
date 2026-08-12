import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  __setMaintenanceRedirectHandlerForTests,
  apiRequest,
  clearApiCache,
  invalidateApiCacheByTag
} from "@/lib/api-client";
import {
  clearActiveWorkspaceId,
  clearSessionToken,
  setActiveWorkspaceId,
  setSessionToken
} from "@/lib/session";
import { useAppFeedbackStore } from "@/stores/app-feedback-store";
import { usePermissionErrorStore } from "@/stores/permission-error-store";

describe("api client cache", () => {
  beforeEach(() => {
    clearApiCache();
    clearSessionToken();
    clearActiveWorkspaceId();
    usePermissionErrorStore.getState().clear();
    useAppFeedbackStore.getState().clearDialog();
    __setMaintenanceRedirectHandlerForTests(null);
    vi.restoreAllMocks();
  });

  it("reuses short-lived GET responses from memory cache", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { value: 42 } })
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = await apiRequest<{ value: number }>("/dashboard/summary", {
      method: "GET",
      auth: true,
      cacheTtlMs: 10_000,
      cacheTags: ["dashboard:summary"]
    });
    const second = await apiRequest<{ value: number }>("/dashboard/summary", {
      method: "GET",
      auth: true,
      cacheTtlMs: 10_000,
      cacheTags: ["dashboard:summary"]
    });

    expect(first.value).toBe(42);
    expect(second.value).toBe(42);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("dedupes in-flight GET requests", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => ({
      ok: true,
      json: async () => ({ success: true, data: ["a", "b"] })
    }));
    vi.stubGlobal("fetch", fetchMock);
    setSessionToken("token-123");

    const [first, second] = await Promise.all([
      apiRequest<string[]>("/threads/dms", {
        method: "GET",
        auth: true,
        cacheTtlMs: 5_000,
        cacheTags: ["threads:dms"]
      }),
      apiRequest<string[]>("/threads/dms", {
        method: "GET",
        auth: true,
        cacheTtlMs: 5_000,
        cacheTags: ["threads:dms"]
      })
    ]);

    expect(first).toEqual(["a", "b"]);
    expect(second).toEqual(["a", "b"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends the active workspace and keeps workspace caches separate", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { workspace: "one" } })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { workspace: "two" } })
      });
    vi.stubGlobal("fetch", fetchMock);
    setSessionToken("token-123");

    setActiveWorkspaceId("workspace-one");
    const first = await apiRequest<{ workspace: string }>("/boards", {
      method: "GET",
      auth: true,
      cacheTtlMs: 10_000
    });

    setActiveWorkspaceId("workspace-two");
    const second = await apiRequest<{ workspace: string }>("/boards", {
      method: "GET",
      auth: true,
      cacheTtlMs: 10_000
    });

    expect(first.workspace).toBe("one");
    expect(second.workspace).toBe("two");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).toEqual(
      expect.objectContaining({})
    );
    expect(((fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Headers).get("X-Workspace-Id"))
      .toBe("workspace-one");
    expect(((fetchMock.mock.calls[1]?.[1] as RequestInit).headers as Headers).get("X-Workspace-Id"))
      .toBe("workspace-two");
  });

  it("invalidates cache entries by tag after a mutation", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { count: 1 } })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { ok: true } })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { count: 2 } })
      });
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest<{ count: number }>("/dashboard/summary", {
      method: "GET",
      auth: true,
      cacheTtlMs: 10_000,
      cacheTags: ["dashboard:summary"]
    });

    await apiRequest<{ ok: boolean }>("/announcements", {
      method: "POST",
      auth: true,
      body: JSON.stringify({ subject: "hello" }),
      invalidateTags: ["dashboard:summary"]
    });

    const refreshed = await apiRequest<{ count: number }>("/dashboard/summary", {
      method: "GET",
      auth: true,
      cacheTtlMs: 10_000,
      cacheTags: ["dashboard:summary"]
    });

    expect(refreshed.count).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("supports manual tag invalidation", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { value: "first" } })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { value: "second" } })
      });
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest<{ value: string }>("/announcements/capabilities", {
      method: "GET",
      auth: true,
      cacheTtlMs: 30_000,
      cacheTags: ["announcements:capabilities"]
    });
    invalidateApiCacheByTag("announcements:capabilities");
    const result = await apiRequest<{ value: string }>("/announcements/capabilities", {
      method: "GET",
      auth: true,
      cacheTtlMs: 30_000,
      cacheTags: ["announcements:capabilities"]
    });

    expect(result.value).toBe("second");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("opens the permission modal for 403 responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ success: false, error: { message: "Permission denied" } })
    }));

    await expect(apiRequest("/boards", { auth: true })).rejects.toThrow(/permission/i);
    expect(usePermissionErrorStore.getState().message).toMatch(/permission/i);
    expect(useAppFeedbackStore.getState().dialog).toBeNull();
  });

  it("opens a session-expired dialog for 401 auth responses", async () => {
    setSessionToken("token-123");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ success: false, error: { message: "Expired token" } })
    }));

    await expect(apiRequest("/auth/me", { auth: true })).rejects.toThrow(/expired token/i);

    const dialog = useAppFeedbackStore.getState().dialog;
    expect(dialog?.title).toBe("Session expired");
    expect(dialog?.confirmLabel).toBe("Sign in again");
  });

  it("opens a friendly rate-limit dialog for 429 responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ success: false, error: { message: "Too many requests" } })
    }));

    await expect(apiRequest("/auth/login", { method: "POST", body: JSON.stringify({}) })).rejects.toThrow(/too many requests/i);

    const dialog = useAppFeedbackStore.getState().dialog;
    expect(dialog?.title).toBe("Too many requests");
  });

  it("opens a friendly network dialog when fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(apiRequest("/dashboard/summary", { auth: true })).rejects.toThrow(/offline/i);

    const dialog = useAppFeedbackStore.getState().dialog;
    expect(dialog?.title).toBe("Connection problem");
  });

  it("redirects once when maintenance mode returns 503 without opening the permission modal", async () => {
    const redirectSpy = vi.fn();
    __setMaintenanceRedirectHandlerForTests(redirectSpy);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => null
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/activity", { auth: true })).rejects.toThrow(/maintenance/i);
    await expect(apiRequest("/mentions/unread", { auth: true })).rejects.toThrow(/maintenance/i);

    expect(redirectSpy).toHaveBeenCalledTimes(1);
    expect(usePermissionErrorStore.getState().message).toBeNull();
    expect(useAppFeedbackStore.getState().dialog).toBeNull();
  });
});
