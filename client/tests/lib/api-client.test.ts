import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest, clearApiCache, invalidateApiCacheByTag } from "@/lib/api-client";
import { clearSessionToken, setSessionToken } from "@/lib/session";

describe("api client cache", () => {
  beforeEach(() => {
    clearApiCache();
    clearSessionToken();
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
});
