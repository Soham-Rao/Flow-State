import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UserHoverCard } from "@/components/users/user-hover-card";
import type { ThreadMessageSummary, ThreadUserSummary } from "@/types/threads";
import { getInitial } from "./threads-page.utils";

type ThreadsForwardModalProps = {
  open: boolean;
  forwardTarget: ThreadMessageSummary | null;
  forwardSearch: string;
  onForwardSearchChange: (value: string) => void;
  filteredForwardUsers: ThreadUserSummary[];
  forwarding: boolean;
  forwardError: string | null;
  onClose: () => void;
  onSelectUser: (member: ThreadUserSummary) => void;
};

export function ThreadsForwardModal({
  open,
  forwardTarget,
  forwardSearch,
  onForwardSearchChange,
  filteredForwardUsers,
  forwarding,
  forwardError,
  onClose,
  onSelectUser
}: ThreadsForwardModalProps): JSX.Element | null {
  if (!open || !forwardTarget) return null;

  return (
    <div className="absolute inset-0 z-30">
      <div className="absolute inset-0 bg-background/40" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border/70 bg-card/95 p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Forward message</p>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Select a DM to forward this message.</p>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
          <Search className="h-4 w-4" />
          <input
            className="w-full bg-transparent text-sm text-foreground outline-none"
            placeholder="Search teammates"
            value={forwardSearch}
            onChange={(event) => onForwardSearchChange(event.target.value)}
          />
        </div>
        <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
          {filteredForwardUsers.length === 0 && (
            <p className="text-xs text-muted-foreground">No teammates found.</p>
          )}
          {filteredForwardUsers.map((member) => (
            <button
              key={`forward-${member.id}`}
              type="button"
              onClick={() => onSelectUser(member)}
              disabled={forwarding}
              className="flex w-full items-center gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-left text-sm transition hover:border-primary/30 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <UserHoverCard user={member}>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-transparent text-sm font-semibold">
                  {getInitial(member.displayName ?? member.username ?? member.name)}
                </div>
              </UserHoverCard>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{member.displayName ?? member.name}</p>
                <p className="truncate text-xs text-muted-foreground">@{member.username ?? "username"}</p>
              </div>
            </button>
          ))}
        </div>
        {forwardError && <p className="mt-2 text-xs text-rose-500">{forwardError}</p>}
      </div>
    </div>
  );
}
