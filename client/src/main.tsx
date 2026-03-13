import React from "react";
import ReactDOM from "react-dom/client";
import { AppRouter } from "@/routes/app-router";
import "./index.css";

const normalizeStoredFont = (value: string | null): string => {
  if (value === "dm-sans") return "plex";
  if (value === "playfair") return "merriweather";
  if (value === "plex" || value === "merriweather" || value === "serif" || value === "grotesk") return value;
  return "grotesk";
};

try {
  const storedFont = normalizeStoredFont(localStorage.getItem("flowstate:font"));
  const storedSpacing = localStorage.getItem("flowstate:spacing") ?? "default";
  document.documentElement.dataset.font = storedFont;
  document.documentElement.dataset.spacing = storedSpacing;
} catch {
  document.documentElement.dataset.font = "grotesk";
  document.documentElement.dataset.spacing = "default";
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>
);
