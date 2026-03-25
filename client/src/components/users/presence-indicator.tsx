import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import type { PresenceState, PresenceStatus } from "@/types/presence";

const presenceClasses: Record<PresenceState, string> = {
  online: "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.85)]",
  afk: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]",
  offline: "bg-rose-500/80"
};

const menuOptions: { label: string; value: PresenceStatus }[] = [
  { label: "Show online", value: "online" },
  { label: "Show AFK", value: "afk" }
];

function formatRelativeTime(timestamp: number, nowMs: number): string {
  const diffMs = Math.max(0, nowMs - timestamp);
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export interface PresenceIndicatorProps {
  status: PresenceState;
  lastSeenAt?: number;
  isSelf?: boolean;
  onSetStatus?: (status: PresenceStatus) => void;
  className?: string;
  size?: "sm" | "md";
}

export function PresenceIndicator({
  status,
  lastSeenAt,
  isSelf = false,
  onSetStatus,
  className,
  size = "md"
}: PresenceIndicatorProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const rootRef = useRef<HTMLDivElement | null>(null);

  const label = useMemo(() => {
    if (status === "online") return "Currently online";
    if (status === "afk") return "Away from keyboard";
    if (lastSeenAt) {
      return `Last online ${formatRelativeTime(lastSeenAt, nowTick)} ago`;
    }
    return "Offline";
  }, [lastSeenAt, nowTick, status]);

  useEffect(() => {
    if (status !== "offline" || !lastSeenAt) return;
    const interval = window.setInterval(() => {
      setNowTick(Date.now());
    }, 60 * 1000);
    return () => window.clearInterval(interval);
  }, [lastSeenAt, status]);

  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!isSelf) return;
    setOpen((prev) => !prev);
  };

  const handleSelect = (nextStatus: PresenceStatus) => {
    onSetStatus?.(nextStatus);
    setOpen(false);
  };

  const sizeClass = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={handleToggle}
        aria-label={label}
        title={label}
        aria-haspopup={isSelf ? "menu" : undefined}
        aria-expanded={isSelf ? open : undefined}
        tabIndex={isSelf ? 0 : -1}
        className={cn("flex items-center justify-center", isSelf ? "cursor-pointer" : "cursor-default")}
      >
        <span
          className={cn("block rounded-full border-2 border-background", sizeClass, presenceClasses[status])}
        />
      </button>
      {open && isSelf && (
        <div className="absolute left-full bottom-full z-30 mb-2 ml-2 w-36 rounded-lg border border-border/70 bg-card/95 p-1 text-[11px] shadow-lg backdrop-blur">
          {menuOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleSelect(option.value);
              }}
              title={
                option.value === "online"
                  ? "Show others that you're online."
                  : "Show others that you're away from your keyboard."
              }
              aria-label={
                option.value === "online"
                  ? "Show others that you're online"
                  : "Show others that you're away from your keyboard"
              }
              className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left transition hover:bg-muted/60"
            >
              <span className={status === option.value ? "text-foreground" : "text-muted-foreground"}>
                {option.label}
              </span>
              {status === option.value && <span className="text-[10px] uppercase text-muted-foreground">Active</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

