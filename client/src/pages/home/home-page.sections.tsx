import type { FormEvent } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CalendarClock,
  CheckCircle2,
  Dot,
  Flame,
  ListTodo,
  Sparkles,
  TrendingUp,
  UserPlus
} from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatActivityLabel, formatActivityTime } from "@/lib/activity-utils";
import { formatDueDateLabel, getCommentSnippet, getPriorityLabel } from "@/pages/boards/board-detail-page.utils";
import type { ActivityLogEntry } from "@/types/activity";
import type { AnnouncementDetail } from "@/types/announcements";
import type {
  DashboardActivityHighlight,
  DashboardCardSummary,
  DashboardMetricsSummary,
  DashboardNewJoiner,
  ThreadMentionDetail
} from "@/types/dashboard";
import type { CommentMentionDetail } from "@/types/mentions";
import {
  glassCardClass,
  glassIconClass,
  glassLabelText,
  glassMutedText,
  glassPillClass,
  glassSubtleClass
} from "@/pages/home/home-page.styles";

export type TaskSortState = {
  priority: boolean;
  dueDate: boolean;
};

type SortLabels = Record<keyof TaskSortState, string>;

type PriorityStyle = {
  band: string;
  tone: string;
  Icon: typeof AlertTriangle;
};

const priorityStyles: Record<DashboardCardSummary["priority"], PriorityStyle> = {
  urgent: { band: "bg-rose-500/80", tone: "text-rose-700 dark:text-rose-300", Icon: AlertTriangle },
  high: { band: "bg-orange-400/80", tone: "text-orange-700 dark:text-orange-300", Icon: Flame },
  medium: { band: "bg-amber-300/80", tone: "text-amber-700 dark:text-amber-300", Icon: ArrowUpRight },
  low: { band: "bg-sky-300/80", tone: "text-sky-700 dark:text-sky-300", Icon: Dot }
};

const headerIconClass = `h-4 w-4 ${glassIconClass}`;

const formatMentionLocation = (mention: CommentMentionDetail): string => {
  const parts = [mention.boardName, mention.listName, mention.cardTitle].filter(Boolean) as string[];
  return parts.join(" • ");
};

const formatMentionTimestamp = (value: number): string => {
  return new Date(value).toLocaleString();
};

const formatAnnouncementTime = (value: number): string => {
  return new Date(value).toLocaleString();
};

const getAnnouncementAuthorLabel = (announcement: AnnouncementDetail): string => {
  return announcement.author.displayName ?? announcement.author.name ?? announcement.author.email;
};

const getAnnouncementSnippet = (body: string): string => {
  const trimmed = body.trim();
  if (trimmed.length <= 140) return trimmed;
  return `${trimmed.slice(0, 140)}...`;
};

const formatJoinerDate = (value: string): string => {
  return new Date(value).toLocaleDateString();
};

const buildThreadLink = (mention: ThreadMentionDetail): string => {
  const tab = mention.conversationType === "dm" ? "dms" : "channels";
  const param = mention.conversationType === "dm" ? "dm" : "channel";
  const base = `/threads?tab=${tab}&${param}=${mention.conversationId}`;
  if (mention.mentionType === "reply" && mention.replyId) {
    return `${base}&reply=${mention.messageId}&replyMention=${mention.replyId}`;
  }
  if (mention.mentionType === "message") {
    return `${base}&mention=${mention.messageId}`;
  }
  return base;
};

const renderTaskRow = (card: DashboardCardSummary) => {
  const dueLabel = formatDueDateLabel(card.dueDate);
  const style = priorityStyles[card.priority];
  const PriorityIcon = style.Icon;
  return (
    <Link
      key={card.id}
      to={`/boards/${card.boardId}#card-${card.id}`}
      className={`relative flex flex-wrap items-center justify-between gap-3 rounded-md px-3 py-2 pl-5 text-sm transition ${glassSubtleClass} hover:border-white/20 hover:bg-black/20`}
    >
      <span className={`absolute left-0 top-0 h-full w-1.5 rounded-l-md ${style.band}`} />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <PriorityIcon className={`h-3.5 w-3.5 ${style.tone}`} />
          <p className="truncate text-sm font-semibold text-foreground">{card.title}</p>
        </div>
        <p className={`truncate text-xs ${glassMutedText}`}>
          {card.boardName} • {card.listName}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border border-current bg-white/10 px-2 py-0.5 text-[11px] font-medium ${style.tone}`}>
          {getPriorityLabel(card.priority)}
        </span>
        {dueLabel && (
          <span className={`inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[11px] ${glassMutedText}`}>
            <CalendarClock className="h-3 w-3 text-slate-700 dark:text-white/80" />
            {dueLabel}
          </span>
        )}
      </div>
    </Link>
  );
};

export function DashboardHeader({ email }: { email?: string | null }): JSX.Element {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 ${glassCardClass}`}>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h2>
        <p className={`text-sm ${glassMutedText}`}>
          Signed in as <span className="font-medium text-foreground">{email ?? ""}</span>.
        </p>
      </div>

      <Link to="/boards">
        <Button className={glassPillClass}>Open boards</Button>
      </Link>
    </div>
  );
}

export function TaskListCard({
  title,
  description,
  icon: Icon,
  sortState,
  sortLabels,
  onToggleSort,
  cards,
  isLoading,
  loadingText,
  emptyText
}: {
  title: string;
  description: string;
  icon: typeof ListTodo;
  sortState: TaskSortState;
  sortLabels: SortLabels;
  onToggleSort: (key: keyof TaskSortState) => void;
  cards: DashboardCardSummary[];
  isLoading: boolean;
  loadingText: string;
  emptyText: string;
}): JSX.Element {
  return (
    <Card className={glassCardClass}>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Icon className={headerIconClass} />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Sort</span>
            {Object.entries(sortLabels).map(([key, label]) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={sortState[key as keyof TaskSortState] ? "secondary" : "ghost"}
                onClick={() => onToggleSort(key as keyof TaskSortState)}
                aria-pressed={sortState[key as keyof TaskSortState]}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && cards.length === 0 ? (
          <p className="text-xs text-muted-foreground">{loadingText}</p>
        ) : cards.length === 0 ? (
          <p className="text-xs text-muted-foreground">{emptyText}</p>
        ) : (
          <div className={`space-y-2 max-h-72 overflow-y-auto pr-1 rounded-lg p-2 ${glassSubtleClass} dark:bg-black/22 dark:border-white/12`}>
            {cards.map((card) => renderTaskRow(card))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function BoardMentionsCard({
  mentions,
  isLoading
}: {
  mentions: CommentMentionDetail[];
  isLoading: boolean;
}): JSX.Element {
  return (
    <Card className={glassCardClass}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className={headerIconClass} />
          Board mentions
        </CardTitle>
        <CardDescription>Unread mentions from boards, lists, and cards.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && mentions.length === 0 ? (
          <p className="text-xs text-muted-foreground">Loading mentions...</p>
        ) : mentions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No board mentions.</p>
        ) : (
          <div className={`space-y-2 max-h-72 overflow-y-auto pr-1 rounded-lg p-2 ${glassSubtleClass} dark:bg-black/22 dark:border-white/12`}>
            {mentions.map((mention) => (
              <Link
                key={mention.commentId}
                to={`/boards/${mention.boardId}#comment-${mention.commentId}`}
                className={`relative block rounded-md border-l-4 border-cyan-400/60 px-3 py-2 text-xs transition ${glassSubtleClass} hover:border-white/20 hover:bg-black/20`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Bell className="h-3.5 w-3.5 text-cyan-700 dark:text-cyan-200" />
                    <p className="text-sm font-semibold text-foreground">{mention.boardName}</p>
                  </div>
                  <span className={`text-[10px] ${glassLabelText}`}>
                    {formatMentionTimestamp(mention.createdAt)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{formatMentionLocation(mention)}</p>
                <p className="mt-1 text-xs text-foreground">{getCommentSnippet(mention.body)}</p>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ThreadMentionsCard({
  mentions,
  isLoading
}: {
  mentions: ThreadMentionDetail[];
  isLoading: boolean;
}): JSX.Element {
  return (
    <Card className={glassCardClass}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className={headerIconClass} />
          Thread mentions
        </CardTitle>
        <CardDescription>Unread mentions from DMs and channels.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && mentions.length === 0 ? (
          <p className="text-xs text-muted-foreground">Loading mentions...</p>
        ) : mentions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No thread mentions.</p>
        ) : (
          <div className={`space-y-2 max-h-72 overflow-y-auto pr-1 rounded-lg p-2 ${glassSubtleClass} dark:bg-black/22 dark:border-white/12`}>
            {mentions.map((mention) => (
              <Link
                key={mention.id}
                to={buildThreadLink(mention)}
                className={`relative block rounded-md border-l-4 border-indigo-400/60 px-3 py-2 text-xs transition ${glassSubtleClass} hover:border-white/20 hover:bg-black/20`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-700 dark:text-indigo-200" />
                    <p className="text-sm font-semibold text-foreground">{mention.conversationLabel}</p>
                  </div>
                  <span className={`text-[10px] ${glassLabelText}`}>
                    {formatMentionTimestamp(mention.createdAt)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {mention.mentionType === "reply" ? "Reply mention" : "Message mention"}
                </p>
                {mention.body && (
                  <p className="mt-1 text-xs text-foreground">{getCommentSnippet(mention.body)}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function InvitesCard({
  isAdmin,
  inviteEmail,
  onInviteEmailChange,
  inviteLoading,
  inviteError,
  inviteLink,
  copiedInviteLink,
  canShare,
  invitesCount,
  onCreateInvite,
  onCopyInvite,
  onShareInvite,
  onOpenInviteStatus
}: {
  isAdmin: boolean;
  inviteEmail: string;
  onInviteEmailChange: (value: string) => void;
  inviteLoading: boolean;
  inviteError: string | null;
  inviteLink: string | null;
  copiedInviteLink: boolean;
  canShare: boolean;
  invitesCount: number;
  onCreateInvite: (event: FormEvent<HTMLFormElement>) => void;
  onCopyInvite: (inviteUrl: string) => void;
  onShareInvite: (inviteUrl: string) => void;
  onOpenInviteStatus: () => void;
}): JSX.Element | null {
  if (!isAdmin) return null;

  return (
    <Card className={glassCardClass}>
      <CardHeader>
        <CardTitle>Team invitations</CardTitle>
        <CardDescription>Invite teammates by email or share a link.</CardDescription>
      </CardHeader>
      <CardContent className="max-h-[70vh] space-y-4 overflow-y-auto pr-2">
        {inviteError && (
          <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {inviteError}
          </p>
        )}

        <form className="space-y-2" onSubmit={onCreateInvite}>
          <div className="flex flex-wrap gap-2">
            <Input
              value={inviteEmail}
              onChange={(event) => onInviteEmailChange(event.target.value)}
              type="email"
              placeholder="Email (optional)"
              className="min-w-[220px] flex-1"
            />
            <Button type="submit" disabled={inviteLoading} className={glassPillClass}>
              {inviteLoading ? "Creating..." : "Create invite"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Leave email blank to generate a shareable link.</p>
        </form>

        {inviteLink && (
          <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-primary">Invite link ready</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => onCopyInvite(inviteLink)}>
                  {copiedInviteLink ? "Copied" : "Copy link"}
                </Button>
                {canShare && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => onShareInvite(inviteLink)}>
                    Share
                  </Button>
                )}
              </div>
            </div>
            <p className="mt-2 break-all text-xs text-muted-foreground">{inviteLink}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" onClick={onOpenInviteStatus}>
            View invite status
          </Button>
          <p className="text-xs text-muted-foreground">{invitesCount} total invites</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function SummaryCard({
  weekly,
  monthly
}: {
  weekly: DashboardMetricsSummary;
  monthly: DashboardMetricsSummary;
}): JSX.Element {
  return (
    <Card className={glassCardClass}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CheckCircle2 className={headerIconClass} />
          Weekly + Monthly summary
        </CardTitle>
        <CardDescription>High level throughput across the workspace.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {[
          { label: "Last 7 days", metrics: weekly },
          { label: "Last 30 days", metrics: monthly }
        ].map((group) => (
          <div key={group.label} className={`rounded-lg p-3 ${glassSubtleClass}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {group.label}
            </p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Cards completed</span>
                <span className="font-semibold">{group.metrics.cardsCompleted}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Cards archived</span>
                <span className="font-semibold">{group.metrics.cardsArchived}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Cards deleted</span>
                <span className="font-semibold">{group.metrics.cardsDeleted}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>New cards</span>
                <span className="font-semibold">{group.metrics.newCards}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>New lists</span>
                <span className="font-semibold">{group.metrics.newLists}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>New boards</span>
                <span className="font-semibold">{group.metrics.newBoards}</span>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function ActivityHighlightsCard({
  items,
  isLoading
}: {
  items: DashboardActivityHighlight[];
  isLoading: boolean;
}): JSX.Element {
  return (
    <Card className={glassCardClass}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className={headerIconClass} />
          Activity highlights
        </CardTitle>
        <CardDescription>Boards with the most activity this week.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Loading highlights...</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground">No recent activity yet.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.boardId} className={`rounded-md px-3 py-2 ${glassSubtleClass}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{item.boardName}</p>
                  <span className="text-xs font-semibold text-muted-foreground">{item.eventCount}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">events in last 7 days</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TeamPulseCard({
  activity,
  status,
  currentUserId
}: {
  activity: ActivityLogEntry[];
  status: "idle" | "loading" | "ready" | "error";
  currentUserId: string | null;
}): JSX.Element {
  const items = activity.slice(0, 6);
  const isLoading = status === "loading" && items.length === 0;

  return (
    <Card className={glassCardClass}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className={headerIconClass} />
          Team pulse
        </CardTitle>
        <CardDescription>Recent activity across the workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading activity...</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground">No recent activity yet.</p>
        ) : (
          <div className={`space-y-2 max-h-72 overflow-y-auto pr-1 rounded-lg p-2 ${glassSubtleClass} dark:bg-black/22 dark:border-white/12`}>
            {items.map((entry) => (
              <div key={entry.id} className={`rounded-md px-3 py-2 ${glassSubtleClass}`}>
                <p className="text-sm font-semibold text-foreground">
                  {formatActivityLabel(entry, currentUserId ?? undefined)}
                </p>
                <p className="text-[11px] text-muted-foreground">{formatActivityTime(entry)}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AnnouncementsCard({
  announcements,
  isLoading,
  canSend,
  selectionMode,
  selectedAnnouncementIds,
  listError,
  onToggleSelectionMode,
  onToggleSelection,
  onDeleteSelected,
  onDeleteAnnouncement,
  onOpenCompose,
  onOpenView
}: {
  announcements: AnnouncementDetail[];
  isLoading: boolean;
  canSend: boolean;
  selectionMode: boolean;
  selectedAnnouncementIds: Set<string>;
  listError: string | null;
  onToggleSelectionMode: (next: boolean) => void;
  onToggleSelection: (id: string) => void;
  onDeleteSelected: () => void;
  onDeleteAnnouncement: (id: string) => void;
  onOpenCompose: () => void;
  onOpenView: (announcement: AnnouncementDetail) => void;
}): JSX.Element {
  const selectedCount = selectedAnnouncementIds.size;
  const canSelect = announcements.length > 0;

  return (
    <Card className={glassCardClass}>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bell className={headerIconClass} />
              Announcements
            </CardTitle>
            <CardDescription>Updates from workspace leaders.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {announcements.length > 0 && (
              <span className="rounded-full border border-black/10 bg-black/5 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-600 dark:border-white/20 dark:bg-white/10 dark:text-white/70">
                {announcements.length}
              </span>
            )}
            {selectionMode ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onToggleSelectionMode(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-rose-500/90 text-white hover:bg-rose-500 disabled:opacity-60"
                  disabled={selectedCount === 0}
                  onClick={onDeleteSelected}
                >
                  Delete {selectedCount > 0 ? `(${selectedCount})` : ""}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!canSelect}
                onClick={() => onToggleSelectionMode(true)}
              >
                Select
              </Button>
            )}
            {canSend && (
              <Button type="button" size="sm" variant="secondary" className={glassPillClass} onClick={onOpenCompose}>
                New announcement
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {listError && (
          <p className="mb-3 rounded-md border border-rose-200/60 bg-rose-50/70 px-3 py-2 text-xs text-rose-700">
            {listError}
          </p>
        )}
        {isLoading && announcements.length === 0 ? (
          <p className="text-xs text-muted-foreground">Loading announcements...</p>
        ) : announcements.length === 0 ? (
          <p className="text-xs text-muted-foreground">No announcements yet.</p>
        ) : (
          <div className={`space-y-2 max-h-72 overflow-y-auto pr-1 rounded-lg p-2 ${glassSubtleClass} dark:bg-black/22 dark:border-white/12`}>
            {announcements.map((announcement) => {
              const isUnread = !announcement.seenAt;
              const isSelected = selectedAnnouncementIds.has(announcement.id);
              const itemGlow = isUnread
                ? "border-l-4 border-emerald-400/70 bg-white/20 dark:bg-black/35"
                : "opacity-80";

              return (
                <button
                  key={announcement.id}
                  type="button"
                  onClick={() => {
                    if (selectionMode) {
                      onToggleSelection(announcement.id);
                      return;
                    }
                    onOpenView(announcement);
                  }}
                  className={`w-full rounded-md px-3 py-2 text-left text-xs transition ${glassSubtleClass} dark:bg-black/24 dark:border-white/12 hover:border-white/20 hover:bg-black/20 dark:hover:bg-black/40 ${itemGlow} ${isSelected ? "ring-2 ring-emerald-400/60" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      {selectionMode && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleSelection(announcement.id)}
                          onClick={(event) => event.stopPropagation()}
                          className="mt-1 h-4 w-4 accent-emerald-500"
                        />
                      )}
                      <div>
                        <p className="text-sm font-semibold text-foreground">{announcement.subject}</p>
                        <p className="text-[11px] text-muted-foreground">
                          By {getAnnouncementAuthorLabel(announcement)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isUnread && (
                        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 dark:border-emerald-400/60 dark:bg-emerald-400/15 dark:text-emerald-200">New</span>
                      )}
                      {!isUnread && !selectionMode && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteAnnouncement(announcement.id);
                          }}
                          className="rounded-full border border-rose-400/50 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-600 hover:text-rose-700"
                        >
                          Delete
                        </button>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {formatAnnouncementTime(announcement.createdAt)}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{getAnnouncementSnippet(announcement.body)}</p>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
export function NewJoinersCard({
  joiners,
  isLoading
}: {
  joiners: DashboardNewJoiner[];
  isLoading: boolean;
}): JSX.Element {
  return (
    <Card className={glassCardClass}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <UserPlus className={headerIconClass} />
          New joiners
        </CardTitle>
        <CardDescription>Recently added teammates.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && joiners.length === 0 ? (
          <p className="text-xs text-muted-foreground">Loading new joiners...</p>
        ) : joiners.length === 0 ? (
          <p className="text-xs text-muted-foreground">No new teammates yet.</p>
        ) : (
          <div className={`space-y-2 max-h-56 overflow-y-auto pr-1 rounded-lg p-2 ${glassSubtleClass}`}>
            {joiners.map((member) => (
              <div key={member.id} className={`rounded-md px-3 py-2 ${glassSubtleClass}`}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {member.displayName ?? member.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{member.role}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {formatJoinerDate(member.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}









