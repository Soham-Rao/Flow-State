import React from "react";
import ReactDOM from "react-dom/client";
import { AppRouter } from "@/routes/app-router";
import "./index.css";

try {
  const storedFont = localStorage.getItem("flowstate:font") ?? "grotesk";
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
