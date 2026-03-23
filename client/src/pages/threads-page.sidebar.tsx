import { Pin, Search } from "lucide-react";

import type { DmConversationSummary, ThreadUserSummary } from "@/types/threads";

import { presencePalette, type PresenceState } from "./threads-page.constants";

export type ThreadsSidebarProps = {
  activeTab: "dms" | "channels";
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  loading: boolean;
  filteredDmUsers: ThreadUserSummary[];
  pinnedUserIds: string[];
  canPinThreads: boolean;
  onTogglePinUser: (userId: string) => void;
  conversationByUserId: Map<string, DmConversationSummary>;
  presenceByUserId: Map<string, PresenceState>;
  activeConversation: DmConversationSummary | null;
  onSelectUser: (user: ThreadUserSummary) => void;
};

export function ThreadsSidebar({
  activeTab,
  searchTerm,
  onSearchTermChange,
  loading,
  filteredDmUsers,
  pinnedUserIds,
  canPinThreads,
  onTogglePinUser,
  conversationByUserId,
  presenceByUserId,
  activeConversation,
  onSelectUser
}: ThreadsSidebarProps): JSX.Element {
  return (
    <aside className="flex w-full flex-col rounded-2xl border border-border/70 bg-card/90 p-3 shadow-lg">
      <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
        <Search className="h-4 w-4" />
        <input
          className="w-full bg-transparent text-sm text-foreground outline-none"
          placeholder={activeTab === "channels" ? "Search channels" : "Search teammates"}
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
        />
      </div>

      <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
        {activeTab === "channels" && (
          <div className="rounded-xl border border-dashed border-border/70 p-4 text-xs text-muted-foreground">
            Channels are coming next. You will see shared spaces here soon.
          </div>
        )}

        {activeTab === "dms" && (
          <>
            {loading && (
              <div className="text-xs text-muted-foreground">Loading direct messages...</div>
            )}
            {!loading && filteredDmUsers.length === 0 && (
              <div className="text-xs text-muted-foreground">No teammates yet.</div>
            )}
            {!loading &&
              filteredDmUsers.map((user) => {
                const conversation = conversationByUserId.get(user.id);
                const presence = presenceByUserId.get(user.id) ?? "online";
                const isActive = activeConversation?.otherUser.id === user.id;
                const isPinned = pinnedUserIds.includes(user.id);
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => onSelectUser(user)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition ${
                      isActive
                        ? "border-primary/60 bg-primary/10"
                        : "border-border/60 bg-background/60 hover:border-primary/30 hover:bg-primary/5"
                    }`}
                  >
                    <div className="relative">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-transparent text-sm font-semibold">
                        {user.displayName?.[0] ?? user.username?.[0] ?? "U"}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${
                          presencePalette[presence]
                        }`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{user.displayName ?? user.name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (!canPinThreads) return;
                        onTogglePinUser(user.id);
                      }}
                      disabled={!canPinThreads}
                      className={`rounded-full border px-1.5 py-1 text-xs transition ${
                        !canPinThreads
                          ? "cursor-not-allowed border-border/40 text-muted-foreground/60"
                          : isPinned
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-border/60 text-muted-foreground hover:text-foreground"
                      }`}
                      aria-label={isPinned ? "Unpin user" : "Pin user"}
                    >
                      <Pin className="h-3 w-3" />
                    </button>
                    {conversation && conversation.unreadMentions > 0 && (
                      <span className="rounded-full bg-rose-500/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                        {conversation.unreadMentions}
                      </span>
                    )}
                  </button>
                );
              })}
          </>
        )}
      </div>
    </aside>
  );
}
