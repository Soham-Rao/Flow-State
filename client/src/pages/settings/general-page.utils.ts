import type { RolePermission } from "@/types/roles";
import type { FontOption, SpacingOption, ThemeOption } from "./general-page.constants";

export function normalizeStoredFont(value: string | null): FontOption {
  if (value === "serif" || value === "plex" || value === "merriweather" || value === "grotesk") {
    return value;
  }
  return "grotesk";
}

export function normalizeStoredTheme(value: string | null): ThemeOption {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return "system";
}

export function resolveTheme(value: ThemeOption): "light" | "dark" {
  if (value === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return value;
}

export function applyTheme(value: ThemeOption): void {
  const resolved = resolveTheme(value);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function applyFont(value: FontOption): void {
  document.documentElement.dataset.font = value;
}

export function applySpacing(value: SpacingOption): void {
  document.documentElement.dataset.spacing = value;
}

export function normalizeRoleIds(roleIds: string[]): string[] {
  return Array.from(new Set(roleIds)).sort();
}

export function normalizePermissions(permissions: RolePermission[]): RolePermission[] {
  return Array.from(new Set(permissions)).sort();
}

export function permissionsMatch(a: RolePermission[], b: RolePermission[]): boolean {
  const left = normalizePermissions(a);
  const right = normalizePermissions(b);
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

export function togglePermission(current: RolePermission[], permission: RolePermission): RolePermission[] {
  if (current.includes(permission)) {
    return current.filter((entry) => entry !== permission);
  }
  return [...current, permission];
}
