import { Search } from "lucide-react";

import type { DmConversationSummary, ThreadUserSummary } from "@/types/threads";

import { formatPreview } from "./threads-page.utils";
import { presencePalette, type PresenceState } from "./threads-page.constants";

export type ThreadsSidebarProps = {
  activeTab: "dms" | "channels";
  totalMentions: number;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onSelectTab: (tab: "dms" | "channels") => void;
  loading: boolean;
  filteredDmUsers: ThreadUserSummary[];
  conversationByUserId: Map<string, DmConversationSummary>;
  presenceByUserId: Map<string, PresenceState>;
  activeConversation: DmConversationSummary | null;
  onSelectUser: (user: ThreadUserSummary) => void;
};

export function ThreadsSidebar({
  activeTab,
  totalMentions,
  searchTerm,
  onSearchTermChange,
  onSelectTab,
  loading,
  filteredDmUsers,
  conversationByUserId,
  presenceByUserId,
  activeConversation,
  onSelectUser
}: ThreadsSidebarProps): JSX.Element {
  return (
    <aside className="flex w-full flex-col rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm lg:max-w-[320px] lg:h-full">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {activeTab === "channels" ? "Channels" : "Direct messages"}
        </p>
        {totalMentions > 0 && activeTab === "dms" && (
          <span className="rounded-full bg-rose-500/90 px-2 py-0.5 text-[10px] font-semibold text-white">
            {totalMentions}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
        <Search className="h-4 w-4" />
        <input
          className="w-full bg-transparent text-sm text-foreground outline-none"
          placeholder={activeTab === "channels" ? "Search channels" : "Search teammates"}
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
        />
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs">
        <button
          type="button"
          className={`flex-1 rounded-full border px-3 py-1 font-semibold transition ${
            activeTab === "dms"
              ? "border-primary/50 bg-primary/10 text-primary"
              : "border-border/60 text-muted-foreground hover:border-primary/30"
          }`}
          onClick={() => onSelectTab("dms")}
        >
          DMs
        </button>
        <button
          type="button"
          className={`flex-1 rounded-full border px-3 py-1 font-semibold transition ${
            activeTab === "channels"
              ? "border-primary/50 bg-primary/10 text-primary"
              : "border-border/60 text-muted-foreground hover:border-primary/30"
          }`}
          onClick={() => onSelectTab("channels")}
        >
          Channels
        </button>
      </div>

      <div className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
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
                      <p className="truncate text-xs text-muted-foreground">
                        {conversation ? formatPreview(conversation.lastMessagePreview) : "Start a DM"}
                      </p>
                    </div>
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
