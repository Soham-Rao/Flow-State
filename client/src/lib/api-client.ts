import { getSessionToken } from "@/lib/session";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

interface RequestOptions extends RequestInit {
  auth?: boolean;
}

interface ApiErrorPayload {
  message?: string;
  details?: {
    formErrors?: string[];
    fieldErrors?: Record<string, string[] | undefined>;
  };
}

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

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (options.auth) {
    const token = getSessionToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; data?: T; error?: ApiErrorPayload }
    | null;

  if (!response.ok || !payload?.success) {
    throw new Error(getBestErrorMessage(payload?.error));
  }

  return payload.data as T;
}
