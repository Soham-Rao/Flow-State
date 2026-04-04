import { getSessionToken } from "@/lib/session";
import { usePermissionErrorStore } from "@/stores/permission-error-store";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

interface RequestOptions extends RequestInit {
  auth?: boolean;
  cacheTtlMs?: number;
  cacheKey?: string;
  cacheTags?: string[];
  invalidateTags?: string[];
  skipCache?: boolean;
}

interface ApiErrorPayload {
  message?: string;
  details?: {
    formErrors?: string[];
    fieldErrors?: Record<string, string[] | undefined>;
  };
}

type CacheEntry = {
  data: unknown;
  expiresAt: number;
  tags: string[];
};

const responseCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<unknown>>();
const tagToCacheKeys = new Map<string, Set<string>>();

function getBestErrorMessage(error: ApiErrorPayload | undefined): string {
  const message = error?.message;

  if (message && message !== "Invalid request payload") {
    return message;
  }

  const fieldErrors = error?.details?.fieldErrors;
  if (fieldErrors) {
    for (const [field, messages] of Object.entries(fieldErrors)) {
      if (messages && messages.length > 0) {
        return `${field}: ${messages[0]}`;
      }
    }
  }

  const formErrors = error?.details?.formErrors;
  if (formErrors && formErrors.length > 0) {
    return formErrors[0];
  }

  return message ?? "Request failed";
}

function normalizeTags(tags: string[] | undefined): string[] {
  return Array.from(new Set((tags ?? []).filter(Boolean))).sort();
}

function unregisterCacheKey(cacheKey: string): void {
  const existing = responseCache.get(cacheKey);
  if (!existing) {
    return;
  }

  existing.tags.forEach((tag) => {
    const keys = tagToCacheKeys.get(tag);
    if (!keys) {
      return;
    }
    keys.delete(cacheKey);
    if (keys.size === 0) {
      tagToCacheKeys.delete(tag);
    }
  });
}

function storeCacheEntry(cacheKey: string, entry: CacheEntry): void {
  unregisterCacheKey(cacheKey);
  responseCache.set(cacheKey, entry);
  entry.tags.forEach((tag) => {
    const keys = tagToCacheKeys.get(tag) ?? new Set<string>();
    keys.add(cacheKey);
    tagToCacheKeys.set(tag, keys);
  });
}

function getCacheEntry<T>(cacheKey: string): T | null {
  const existing = responseCache.get(cacheKey);
  if (!existing) {
    return null;
  }
  if (existing.expiresAt <= Date.now()) {
    invalidateApiCacheByKey(cacheKey);
    return null;
  }
  return existing.data as T;
}

function buildCacheKey(path: string, method: string, authToken: string | null, customKey?: string): string {
  const scope = authToken ? `auth:${authToken}` : "anon";
  return `${method.toUpperCase()}:${customKey ?? path}:${scope}`;
}

export function invalidateApiCacheByTag(tags: string | string[]): void {
  const tagList = Array.isArray(tags) ? tags : [tags];
  tagList.forEach((tag) => {
    const keys = tagToCacheKeys.get(tag);
    if (!keys) {
      return;
    }
    Array.from(keys).forEach((cacheKey) => {
      unregisterCacheKey(cacheKey);
      responseCache.delete(cacheKey);
      inFlightRequests.delete(cacheKey);
    });
  });
}

export function invalidateApiCacheByKey(cacheKey: string): void {
  unregisterCacheKey(cacheKey);
  responseCache.delete(cacheKey);
  inFlightRequests.delete(cacheKey);
}

export function clearApiCache(): void {
  responseCache.clear();
  inFlightRequests.clear();
  tagToCacheKeys.clear();
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const method = (options.method ?? "GET").toUpperCase();
  const cache = options.cache ?? (method === "GET" ? "no-store" : "default");
  const token = options.auth ? getSessionToken() : null;
  const cacheTtlMs = options.cacheTtlMs ?? 0;
  const cacheTags = normalizeTags(options.cacheTags);
  const cacheKey = buildCacheKey(path, method, token, options.cacheKey);
  const shouldUseCache = method === "GET" && cacheTtlMs > 0 && !options.skipCache;

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (shouldUseCache) {
    const cached = getCacheEntry<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const inFlight = inFlightRequests.get(cacheKey);
    if (inFlight) {
      return inFlight as Promise<T>;
    }
  }

  const requestPromise = (async () => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      cache
    });

    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; data?: T; error?: ApiErrorPayload }
      | null;

    if (!response.ok || !payload?.success) {
      const message = getBestErrorMessage(payload?.error);
      if (response.status === 403 || /permission/i.test(message)) {
        usePermissionErrorStore.getState().setError(message);
      }
      throw new Error(message);
    }

    const data = payload.data as T;

    if (shouldUseCache) {
      storeCacheEntry(cacheKey, {
        data,
        expiresAt: Date.now() + cacheTtlMs,
        tags: cacheTags
      });
    }

    const invalidateTags = normalizeTags(options.invalidateTags);
    if (invalidateTags.length > 0) {
      invalidateApiCacheByTag(invalidateTags);
    }

    return data;
  })();

  if (shouldUseCache) {
    inFlightRequests.set(cacheKey, requestPromise);
  }

  try {
    return await requestPromise;
  } finally {
    if (shouldUseCache) {
      inFlightRequests.delete(cacheKey);
    }
  }
}
