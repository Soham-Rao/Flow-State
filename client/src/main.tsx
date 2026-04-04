import React from "react";
import ReactDOM from "react-dom/client";
import { AppErrorBoundary } from "@/components/layout/app-error-boundary";
import { AppRouter } from "@/routes/app-router";
import "./index.css";

const normalizeStoredTheme = (value: string | null): "light" | "dark" | "system" => {
  if (value === "light" || value === "dark" || value === "system") return value;
  return "system";
};

const resolveTheme = (value: "light" | "dark" | "system"): "light" | "dark" => {
  if (value === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return value;
};

const applyThemePreference = (value: "light" | "dark" | "system"): void => {
  const resolved = resolveTheme(value);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.classList.toggle("dark", resolved == "dark");
};

const normalizeStoredFont = (value: string | null): string => {
  if (value === "dm-sans") return "plex";
  if (value === "playfair") return "merriweather";
  if (value === "plex" || value === "merriweather" || value === "serif" || value === "grotesk") return value;
  return "grotesk";
};

function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /Loading chunk/i.test(message) || /Failed to fetch dynamically imported module/i.test(message);
}

function renderChunkRecoveryFallback(): void {
  const root = document.getElementById("root");
  if (!root) return;

  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:linear-gradient(180deg,rgba(240,253,250,.85),rgba(240,249,255,1));font-family:Space Grotesk,Segoe UI,sans-serif;">
      <div style="max-width:640px;width:100%;border:1px solid rgba(203,213,225,.8);background:rgba(255,255,255,.92);backdrop-filter:blur(12px);border-radius:20px;padding:32px;box-shadow:0 24px 60px rgba(15,23,42,.12);">
        <h1 style="margin:0 0 12px;font-size:28px;color:#0f172a;">FlowState needs a refresh</h1>
        <p style="margin:0 0 16px;color:#475569;line-height:1.6;">A new deploy likely replaced one of the app chunks while your browser still had the older version cached.</p>
        <button id="flowstate-reload" style="border:none;border-radius:10px;padding:12px 18px;background:#0891b2;color:white;font-weight:600;cursor:pointer;">Reload FlowState</button>
      </div>
    </div>
  `;

  document.getElementById("flowstate-reload")?.addEventListener("click", () => {
    window.location.reload();
  });
}

window.addEventListener("error", (event) => {
  if (isChunkLoadError(event.error ?? event.message)) {
    event.preventDefault();
    renderChunkRecoveryFallback();
  }
});

window.addEventListener("unhandledrejection", (event) => {
  if (isChunkLoadError(event.reason)) {
    event.preventDefault();
    renderChunkRecoveryFallback();
  }
});

try {
  const storedFont = normalizeStoredFont(localStorage.getItem("flowstate:font"));
  const storedSpacing = localStorage.getItem("flowstate:spacing") ?? "default";
  const storedTheme = normalizeStoredTheme(localStorage.getItem("flowstate:theme"));
  document.documentElement.dataset.font = storedFont;
  document.documentElement.dataset.spacing = storedSpacing;
  applyThemePreference(storedTheme);

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const handleSystemChange = () => {
    const currentTheme = normalizeStoredTheme(localStorage.getItem("flowstate:theme"));
    if (currentTheme === "system") {
      const resolved = media.matches ? "dark" : "light";
      document.documentElement.dataset.theme = resolved;
      document.documentElement.classList.toggle("dark", resolved == "dark");
    }
  };
  media.addEventListener("change", handleSystemChange);
} catch {
  document.documentElement.dataset.font = "grotesk";
  document.documentElement.dataset.spacing = "default";
  applyThemePreference("system");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <AppRouter />
    </AppErrorBoundary>
  </React.StrictMode>
);
