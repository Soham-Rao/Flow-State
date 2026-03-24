import { Pin, Search } from "lucide-react";

import type { ChannelConversationSummary, DmConversationSummary, ThreadUserSummary } from "@/types/threads";

import { presencePalette, type PresenceState } from "./threads-page.constants";

export type ThreadsSidebarProps = {
  activeTab: "dms" | "channels";
  dmMentionTotal: number;
  channelMentionTotal: number;
  onTabChange: (tab: "dms" | "channels") => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  loading: boolean;
  filteredDmUsers: ThreadUserSummary[];
  filteredChannels: ChannelConversationSummary[];
  pinnedUserIds: string[];
  canPinThreads: boolean;
  onTogglePinUser: (userId: string) => void;
  conversationByUserId: Map<string, DmConversationSummary>;
  presenceByUserId: Map<string, PresenceState>;
  activeConversation: DmConversationSummary | ChannelConversationSummary | null;
  onSelectUser: (user: ThreadUserSummary) => void;
  onSelectChannel: (channel: ChannelConversationSummary) => void;
  channelDraft: string;
  onChannelDraftChange: (value: string) => void;
  creatingChannel: boolean;
  onCreateChannel: () => void;
};

export function ThreadsSidebar({
  activeTab,
  dmMentionTotal,
  channelMentionTotal,
  onTabChange,
  searchTerm,
  onSearchTermChange,
  loading,
  filteredDmUsers,
  filteredChannels,
  pinnedUserIds,
  canPinThreads,
  onTogglePinUser,
  conversationByUserId,
  presenceByUserId,
  activeConversation,
  onSelectUser,
  onSelectChannel,
  channelDraft,
  onChannelDraftChange,
  creatingChannel,
  onCreateChannel
}: ThreadsSidebarProps): JSX.Element {
  return (
    <aside className="flex w-full min-h-0 max-h-[calc(100vh-9rem)] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/90 p-3 shadow-lg">
      <div className="mb-3 flex items-center gap-2 rounded-full border border-border/60 bg-background/70 p-1 text-xs">
        <button
          type="button"
          onClick={() => onTabChange("dms")}
          className={`flex-1 rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
            activeTab === "dms"
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Direct messages
          {dmMentionTotal > 0 && (
            <span className="ml-2 rounded-full bg-rose-500/90 px-2 py-0.5 text-[10px] font-semibold text-white">
              {dmMentionTotal}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => onTabChange("channels")}
          className={`flex-1 rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
            activeTab === "channels"
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Channels
          {channelMentionTotal > 0 && (
            <span className="ml-2 rounded-full bg-rose-500/90 px-2 py-0.5 text-[10px] font-semibold text-white">
              {channelMentionTotal}
            </span>
          )}
        </button>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
        <Search className="h-4 w-4" />
        <input
          className="w-full bg-transparent text-sm text-foreground outline-none"
          placeholder={activeTab === "channels" ? "Search channels" : "Search teammates"}
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
        />
      </div>

      <div className="mt-3 flex-1 min-h-0 space-y-2 overflow-y-auto pr-1">
        {activeTab === "channels" && (
          <>
            <div className="rounded-xl border border-border/60 bg-background/70 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">New channel</p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  className="h-9 w-full rounded-lg border border-border/60 bg-background/80 px-3 text-sm text-foreground outline-none"
                  placeholder="Channel name"
                  value={channelDraft}
                  onChange={(event) => onChannelDraftChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      onCreateChannel();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={onCreateChannel}
                  disabled={creatingChannel || channelDraft.trim().length === 0}
                  className={`h-9 whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition ${
                    creatingChannel || channelDraft.trim().length === 0
                      ? "cursor-not-allowed border border-border/40 bg-muted/30 text-muted-foreground"
                      : "border border-primary/50 bg-primary/10 text-primary hover:bg-primary/20"
                  }`}
                >
                  {creatingChannel ? "Creating" : "Create"}
                </button>
              </div>
            </div>

            {loading && (
              <div className="text-xs text-muted-foreground">Loading channels...</div>
            )}
            {!loading && filteredChannels.length === 0 && (
              <div className="rounded-xl border border-dashed border-border/70 p-4 text-xs text-muted-foreground">
                No channels yet. Create one to start collaborating.
              </div>
            )}
            {!loading && filteredChannels.map((channel) => {
              const isActive = activeConversation?.type === "channel" && activeConversation.id === channel.id;
              return (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => onSelectChannel(channel)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition ${
                    isActive
                      ? "border-primary/60 bg-primary/10"
                      : "border-border/60 bg-background/60 hover:border-primary/30 hover:bg-primary/5"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">#{channel.name}</p>
                    <p className="text-[11px] text-muted-foreground">{channel.memberCount} members</p>
                  </div>
                  {channel.unreadMentions > 0 && (
                    <span className="rounded-full bg-rose-500/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                      {channel.unreadMentions}
                    </span>
                  )}
                </button>
              );
            })}
          </>
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
                const isActive = activeConversation?.type === "dm" && activeConversation.otherUser.id === user.id;
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

