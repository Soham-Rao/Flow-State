import { useEffect, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { PermissionItem } from "./general-page.constants";

export function SettingsModal({
  open,
  title,
  description,
  onClose,
  children
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}): JSX.Element | null {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <Card className="w-full max-w-4xl" onMouseDown={(event) => event.stopPropagation()}>
        <CardHeader className="space-y-1">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent className="max-h-[70vh] space-y-4 overflow-y-auto">
          {children}
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function PermissionToggleRow({
  item,
  enabled,
  disabled,
  onToggle
}: {
  item: PermissionItem;
  enabled: boolean;
  disabled?: boolean;
  onToggle: () => void;
}): JSX.Element {
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-card/80 p-3 ${
        disabled ? "opacity-60" : ""
      }`}
    >
      <div className="space-y-1">
        <p className="text-sm font-semibold">{item.title}</p>
        <p className={`text-xs font-medium ${enabled ? "text-emerald-600" : "text-rose-500"}`}>
          {enabled ? item.enabledLabel : item.disabledLabel}
        </p>
        <p className="text-xs text-muted-foreground">{item.description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={disabled}
        onClick={onToggle}
        className={`flex h-6 w-12 items-center rounded-full px-0.5 transition-colors ${
          enabled ? "bg-emerald-500" : "bg-rose-500"
        } ${enabled ? "justify-end" : "justify-start"} ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span className="h-5 w-5 rounded-full bg-white transition-transform" />
      </button>
    </div>
  );
}
