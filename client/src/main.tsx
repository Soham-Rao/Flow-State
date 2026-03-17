import React from "react";
import ReactDOM from "react-dom/client";
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
    <AppRouter />
  </React.StrictMode>
);
