import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

export interface HoverCardUser {
  id: string;
  name: string;
  displayName?: string | null;
  username?: string | null;
  email?: string | null;
}

interface UserHoverCardProps {
  user: HoverCardUser;
  children: React.ReactNode;
  align?: "left" | "right";
  side?: "top" | "bottom";
  className?: string;
}

function getInitial(value: string | null | undefined): string {
  if (!value) return "U";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed[0].toUpperCase() : "U";
}

export function UserHoverCard({
  user,
  children,
  align = "left",
  side = "top",
  className
}: UserHoverCardProps): JSX.Element {
  const [open, setOpen] = useState(false);

  const displayName = useMemo(() => {
    return user.displayName || user.name || user.username || "Member";
  }, [user.displayName, user.name, user.username]);

  const handle = useMemo(() => {
    if (user.username) {
      return `@${user.username}`;
    }
    return user.email ?? "";
  }, [user.email, user.username]);

  const alignmentClass = align === "right" ? "right-0" : "left-0";
  const sideClass = side === "bottom" ? "top-full mt-2" : "bottom-full mb-2";

  return (
    <span
      className={cn("relative inline-flex items-center", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={() => setOpen(true)}
    >
      {children}
      {open && (
        <span
          className={cn(
            "pointer-events-none absolute z-50 min-w-[180px] rounded-lg border border-border/70 bg-card/95 p-3 text-xs shadow-lg backdrop-blur",
            alignmentClass,
            sideClass
          )}
        >
          <span className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-transparent text-sm font-semibold">
              {getInitial(displayName)}
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">{displayName}</span>
              {handle && <span className="text-[11px] text-muted-foreground">{handle}</span>}
            </span>
          </span>
        </span>
      )}
    </span>
  );
}
