
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bell,
  CalendarClock,
  CheckCircle2,
  ListTodo,
  Sparkles,
  Timer,
  TrendingUp,
  UserPlus
} from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createInvite, listInvites, revokeInvite } from "@/lib/invites-api";
import { createAnnouncement, getAnnouncementCapabilities, listAnnouncementAudienceOptions, markAnnouncementsSeen } from "@/lib/announcements-api";
import { formatActivityLabel, formatActivityTime } from "@/lib/activity-utils";
import { getDashboardSummary } from "@/lib/dashboard-api";
import {
  formatDueDateLabel,
  getCommentSnippet,
  getPriorityBadgeClass,
  getPriorityLabel
} from "@/pages/boards/board-detail-page.utils";
import { useActivityStore } from "@/stores/activity-store";
import { useAuthStore } from "@/stores/auth-store";
import type { DashboardCardSummary, DashboardSummary, ThreadMentionDetail } from "@/types/dashboard";
import type { AnnouncementAudience, AnnouncementAudienceOptions, AnnouncementDetail } from "@/types/announcements";
import type { CommentMentionDetail } from "@/types/mentions";
import type { InviteSummary } from "@/types/invite";

const SORT_LABELS = {
  priority: "Priority",
  dueDate: "Due date"
} as const;

type TaskSortState = {
  priority: boolean;
  dueDate: boolean;
};

type FocusMode = "focus" | "break";

type FocusSnapshot = {
  status: "idle" | "running" | "paused";
  mode: FocusMode;
  remainingSeconds: number;
};

const priorityRank: Record<DashboardCardSummary["priority"], number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3
};

const formatTimer = (totalSeconds: number): string => {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

const formatMentionLocation = (mention: CommentMentionDetail): string => {
  const parts = [mention.boardName, mention.listName, mention.cardTitle].filter(Boolean) as string[];
  return parts.join(" • ");
};

const sortCards = (cards: DashboardCardSummary[], sortState: TaskSortState): DashboardCardSummary[] => {
  const sorted = [...cards];
  sorted.sort((a, b) => {
    if (sortState.priority) {
      const rankDelta = priorityRank[a.priority] - priorityRank[b.priority];
      if (rankDelta !== 0) return rankDelta;
    }
    if (sortState.dueDate) {
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
      if (aDue !== bDue) return aDue - bDue;
    }
    const aCreated = new Date(a.createdAt).getTime();
    const bCreated = new Date(b.createdAt).getTime();
    return bCreated - aCreated;
  });
  return sorted;
};

const toggleAudienceList = (items: string[], id: string): string[] => {
  if (items.includes(id)) {
    return items.filter((value) => value !== id);
  }
  return [...items, id];
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

const getFocusSnapshot = (storageKey: string): FocusSnapshot => {
  if (typeof window === "undefined") {
    return { status: "idle", mode: "focus", remainingSeconds: 0 };
  }
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return { status: "idle", mode: "focus", remainingSeconds: 0 };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<{
      focusMinutes: number;
      breakMinutes: number;
      mode: FocusMode;
      remainingSeconds: number;
      isRunning: boolean;
      hasStarted: boolean;
      updatedAt: number;
    }>;
    const focusMinutes = typeof parsed.focusMinutes === "number" && parsed.focusMinutes > 0 ? parsed.focusMinutes : 90;
    const breakMinutes = typeof parsed.breakMinutes === "number" && parsed.breakMinutes > 0 ? parsed.breakMinutes : 10;
    const mode: FocusMode = parsed.mode === "break" ? "break" : "focus";
    const baseTotalSeconds = (mode === "focus" ? focusMinutes : breakMinutes) * 60;
    const storedRemaining = typeof parsed.remainingSeconds === "number"
      ? parsed.remainingSeconds
      : baseTotalSeconds;
    let remaining = storedRemaining;
    if (parsed.isRunning && typeof parsed.updatedAt === "number") {
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - parsed.updatedAt) / 1000));
      remaining = Math.max(0, storedRemaining - elapsedSeconds);
    }
    const progressThreshold = Math.max(0, baseTotalSeconds - 1);
    const progressMade = storedRemaining < progressThreshold || remaining < progressThreshold;
    const resetLike = !parsed.isRunning && storedRemaining >= progressThreshold && !progressMade;
    const inferredHasStarted = resetLike
      ? false
      : typeof parsed.hasStarted === "boolean"
        ? parsed.hasStarted
        : Boolean(parsed.isRunning || progressMade);
    const hasStarted = inferredHasStarted && remaining > 0;
    if (!hasStarted) {
      return { status: "idle", mode, remainingSeconds: 0 };
    }
    if (remaining <= 0) {
      return { status: "idle", mode, remainingSeconds: 0 };
    }
    return { status: parsed.isRunning ? "running" : "paused", mode, remainingSeconds: remaining };
  } catch {
    return { status: "idle", mode: "focus", remainingSeconds: 0 };
  }
};

const formatMentionTimestamp = (value: number): string => {
  return new Date(value).toLocaleString();
};

const formatJoinerDate = (value: string): string => {
  return new Date(value).toLocaleDateString();
};

const DISMISSED_BOARD_MENTIONS_KEY = "flowstate:board:mention-dismissed";

const getBoardMentionKey = (mention: CommentMentionDetail): string => {
  return `${mention.boardId}:${mention.commentId}`;
};

const readDismissedBoardMentions = (): Set<string> => {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DISMISSED_BOARD_MENTIONS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    const entries = Object.entries(parsed).flatMap(([boardId, commentIds]) =>
      commentIds.map((commentId) => `${boardId}:${commentId}`)
    );
    return new Set(entries);
  } catch {
    return new Set();
  }
};

const mergeBoardMentions = (
  prev: CommentMentionDetail[],
  next: CommentMentionDetail[]
): CommentMentionDetail[] => {
  const merged = new Map<string, CommentMentionDetail>();
  next.forEach((mention) => merged.set(getBoardMentionKey(mention), mention));
  prev.forEach((mention) => {
    const key = getBoardMentionKey(mention);
    if (!merged.has(key)) merged.set(key, mention);
  });
  return Array.from(merged.values()).sort((a, b) => b.createdAt - a.createdAt).slice(0, 50);
};

function FocusTimerCard({ storageKey }: { storageKey: string }): JSX.Element {
  const [tick, setTick] = useState(0);
  const focusSnapshot = useMemo(() => getFocusSnapshot(storageKey), [storageKey, tick]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTick((value) => value + 1);
    }, 500);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Timer className="h-4 w-4" />
          Pomodoro
        </CardTitle>
        <CardDescription>Your personal focus timer.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {focusSnapshot.status === "idle" ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Do you want to start focus mode?</p>
            <Link to="/focus">
              <Button size="sm">Start focus</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                {focusSnapshot.mode === "focus" ? "Focus" : "Break"} session
              </p>
              <span className="rounded-full border border-border/70 bg-secondary/70 px-2 py-0.5 text-[11px] text-muted-foreground">
                {focusSnapshot.status === "running" ? "Running" : "Paused"}
              </span>
            </div>
            <p className="text-2xl font-semibold tracking-tight">
              {formatTimer(focusSnapshot.remainingSeconds)} left
            </p>
            <Link to={focusSnapshot.status === "paused" ? "/focus?resume=1" : "/focus"}>
              <Button size="sm" variant="secondary">
                {focusSnapshot.status === "paused" ? "Resume focus" : "Open focus"}
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


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
  return (
    <Link
      key={card.id}
      to={`/boards/${card.boardId}#card-${card.id}`}
      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 bg-background/70 px-3 py-2 text-sm transition hover:border-primary/40 hover:bg-background"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{card.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {card.boardName} • {card.listName}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${getPriorityBadgeClass(card.priority)}`}>
          {getPriorityLabel(card.priority)}
        </span>
        {dueLabel && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-secondary/70 px-2 py-0.5 text-[11px] text-muted-foreground">
            <CalendarClock className="h-3 w-3" />
            {dueLabel}
          </span>
        )}
      </div>
    </Link>
  );
};

export function HomePage(): JSX.Element {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === "admin";

  const activity = useActivityStore((state) => state.workspace);
  const activityStatus = useActivityStore((state) => state.workspaceStatus);
  const loadWorkspaceActivity = useActivityStore((state) => state.loadWorkspace);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [invites, setInvites] = useState<InviteSummary[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [copiedInviteLink, setCopiedInviteLink] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [announcementCapabilities, setAnnouncementCapabilities] = useState<{ canSend: boolean } | null>(null);
  const [announcementOptions, setAnnouncementOptions] = useState<AnnouncementAudienceOptions | null>(null);
  const [announcementOptionsStatus, setAnnouncementOptionsStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [announcementComposeOpen, setAnnouncementComposeOpen] = useState(false);
  const [announcementView, setAnnouncementView] = useState<AnnouncementDetail | null>(null);
  const [announcementSubject, setAnnouncementSubject] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [announcementAudience, setAnnouncementAudience] = useState<AnnouncementAudience>({
    sendToAll: true,
    includeRoleIds: [],
    excludeRoleIds: [],
    includeUserIds: [],
    excludeUserIds: []
  });
  const [announcementError, setAnnouncementError] = useState<string | null>(null);
  const [announcementSending, setAnnouncementSending] = useState(false);
  const [summaryStatus, setSummaryStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [assignedSort, setAssignedSort] = useState<TaskSortState>({ priority: false, dueDate: false });
  const [createdSort, setCreatedSort] = useState<TaskSortState>({ priority: false, dueDate: false });

  const dismissedBoardMentionsRef = useRef<Set<string>>(new Set());

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const storageKey = user?.id ? `flowstate:focus:${user.id}` : "flowstate:focus:guest";
  const pendingInvites = invites.filter((invite) => invite.status === "pending");
  const acceptedInvites = invites.filter((invite) => invite.status === "accepted");
  const revokedInvites = invites.filter((invite) => invite.status === "revoked");
  const expiredInvites = invites.filter((invite) => invite.status === "expired");

  const teamPulseItems = activity.slice(0, 6);
  const hasTeamPulse = teamPulseItems.length > 0;
  const isTeamPulseLoading = activityStatus === "loading" && !hasTeamPulse;

  const assignedCards = summary?.assignedCards ?? [];
  const createdCards = summary?.createdCards ?? [];
  const boardMentions = summary?.boardMentions ?? [];
  const threadMentions = summary?.threadMentions ?? [];
  const announcements = summary?.announcements ?? [];
  const activityHighlights = summary?.activityHighlights ?? [];
  const newJoiners = summary?.newJoiners ?? [];

  const assignedSorted = useMemo(
    () => sortCards(assignedCards, assignedSort),
    [assignedCards, assignedSort]
  );
  const createdSorted = useMemo(
    () => sortCards(createdCards, createdSort),
    [createdCards, createdSort]
  );

  const weeklyMetrics = summary?.metrics.weekly ?? {
    cardsCompleted: 0,
    cardsArchived: 0,
    cardsDeleted: 0,
    newCards: 0,
    newLists: 0,
    newBoards: 0
  };
  const monthlyMetrics = summary?.metrics.monthly ?? weeklyMetrics;

  const loadInvites = async (): Promise<void> => {
    if (!isAdmin) return;
    setInviteError(null);
    try {
      const data = await listInvites();
      setInvites(data);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load invites";
      setInviteError(message);
    }
  };

  const onCreateInvite = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!isAdmin) return;
    setInviteLoading(true);
    setInviteError(null);
    try {
      const payload = inviteEmail.trim() ? { email: inviteEmail.trim() } : {};
      const created = await createInvite(payload);
      setInviteLink(created.inviteUrl);
      setInviteEmail("");
      await loadInvites();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create invite";
      setInviteError(message);
    } finally {
      setInviteLoading(false);
    }
  };

  const onRevokeInvite = async (inviteId: string): Promise<void> => {
    if (!isAdmin) return;
    try {
      await revokeInvite(inviteId);
      await loadInvites();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to revoke invite";
      setInviteError(message);
    }
  };

  const onCopyInvite = async (inviteUrl: string, inviteId?: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      if (inviteId) {
        setCopiedInviteId(inviteId);
        setTimeout(() => setCopiedInviteId(null), 1500);
      } else {
        setCopiedInviteLink(true);
        setTimeout(() => setCopiedInviteLink(false), 1500);
      }
    } catch {
      window.prompt("Copy invite link:", inviteUrl);
    }
  };

  const onShareInvite = async (inviteUrl: string): Promise<void> => {
    if (typeof navigator === "undefined" || !navigator.share) {
      await onCopyInvite(inviteUrl);
      return;
    }
    try {
      await navigator.share({ title: "FlowState invite", url: inviteUrl });
    } catch {
      // Ignore share cancellation.
    }
  };

  const loadSummary = async (): Promise<void> => {
    if (!user) return;
    try {
      setSummaryError(null);
      if (summaryStatus === "idle") {
        setSummaryStatus("loading");
      }
      const data = await getDashboardSummary();
      setSummary((prev) => {
        const mergedBoardMentions = mergeBoardMentions(prev?.boardMentions ?? [], data.boardMentions);
        const dismissed = dismissedBoardMentionsRef.current;
        const filteredBoardMentions = mergedBoardMentions.filter((mention) => !dismissed.has(getBoardMentionKey(mention)));
        return { ...data, boardMentions: filteredBoardMentions };
      });
      setSummaryStatus("ready");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load dashboard";
      setSummaryError(message);
      setSummaryStatus("error");
    }
  };

  const resetAnnouncementDraft = (): void => {
    setAnnouncementSubject("");
    setAnnouncementBody("");
    setAnnouncementAudience({
      sendToAll: true,
      includeRoleIds: [],
      excludeRoleIds: [],
      includeUserIds: [],
      excludeUserIds: []
    });
    setAnnouncementError(null);
  };

  const loadAnnouncementCapabilities = async (): Promise<void> => {
    if (!user) return;
    try {
      const data = await getAnnouncementCapabilities();
      setAnnouncementCapabilities(data);
    } catch {
      setAnnouncementCapabilities({ canSend: false });
    }
  };

  const loadAnnouncementOptions = async (): Promise<void> => {
    if (!announcementCapabilities?.canSend) return;
    if (announcementOptionsStatus === "loading") return;
    setAnnouncementOptionsStatus("loading");
    try {
      const options = await listAnnouncementAudienceOptions();
      setAnnouncementOptions(options);
      setAnnouncementOptionsStatus("ready");
    } catch {
      setAnnouncementOptionsStatus("error");
    }
  };

  const openAnnouncementCompose = (): void => {
    setAnnouncementComposeOpen(true);
    setAnnouncementError(null);
  };

  const closeAnnouncementCompose = (): void => {
    setAnnouncementComposeOpen(false);
    setAnnouncementError(null);
  };

  const toggleRoleAudience = (roleId: string, source: "include" | "exclude"): void => {
    if (!announcementOptions) return;
    const allRoleIds = announcementOptions.roles.map((role) => role.id);
    if (allRoleIds.length === 0) return;

    setAnnouncementAudience((prev) => {
      const includeSet = new Set(prev.includeRoleIds);
      const excludeSet = new Set(prev.excludeRoleIds);

      if (source === "include") {
        if (includeSet.has(roleId)) {
          includeSet.delete(roleId);
        } else {
          includeSet.add(roleId);
        }
        const nextExclude = allRoleIds.filter((id) => !includeSet.has(id));
        return {
          ...prev,
          includeRoleIds: Array.from(includeSet),
          excludeRoleIds: nextExclude
        };
      }

      if (excludeSet.has(roleId)) {
        excludeSet.delete(roleId);
      } else {
        excludeSet.add(roleId);
      }
      const nextInclude = allRoleIds.filter((id) => !excludeSet.has(id));
      return {
        ...prev,
        includeRoleIds: nextInclude,
        excludeRoleIds: Array.from(excludeSet)
      };
    });
  };

  const handleSendAnnouncement = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!announcementCapabilities?.canSend) return;
    const subject = announcementSubject.trim();
    const body = announcementBody.trim();
    if (!subject || !body) {
      setAnnouncementError("Subject and body are required.");
      return;
    }
    setAnnouncementSending(true);
    setAnnouncementError(null);
    try {
      await createAnnouncement({ subject, body, audience: announcementAudience });
      closeAnnouncementCompose();
      resetAnnouncementDraft();
      await loadSummary();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send announcement";
      setAnnouncementError(message);
    } finally {
      setAnnouncementSending(false);
    }
  };

  const openAnnouncementView = (announcement: AnnouncementDetail): void => {
    setAnnouncementView(announcement);
    setSummary((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        announcements: prev.announcements.filter((item) => item.id !== announcement.id)
      };
    });
    void markAnnouncementsSeen([announcement.id]);
  };

  const closeAnnouncementView = (): void => {
    setAnnouncementView(null);
  };

  useEffect(() => {
    if (!user) return;
    void loadAnnouncementCapabilities();
  }, [user?.id]);

  useEffect(() => {
    if (!announcementComposeOpen) return;
    if (!announcementCapabilities?.canSend) return;
    if (announcementOptionsStatus === "idle" || announcementOptionsStatus === "error") {
      void loadAnnouncementOptions();
    }
  }, [announcementComposeOpen, announcementCapabilities?.canSend, announcementOptionsStatus]);

  useEffect(() => {
    if (!announcementComposeOpen) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAnnouncementCompose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [announcementComposeOpen]);

  useEffect(() => {
    if (!isAdmin) {
      setInvites([]);
      return;
    }
    void loadInvites();
  }, [isAdmin]);

  useEffect(() => {
    if (!user) return;
    void loadSummary();
    const interval = window.setInterval(() => {
      void loadSummary();
    }, 1000);
    return () => window.clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    dismissedBoardMentionsRef.current = readDismissedBoardMentions();
    const handleDismiss = (event: Event) => {
      const detail = (event as CustomEvent<{ boardId: string; commentId: string }>).detail;
      if (!detail) return;
      const key = `${detail.boardId}:${detail.commentId}`;
      dismissedBoardMentionsRef.current.add(key);
      setSummary((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          boardMentions: prev.boardMentions.filter((mention) => getBoardMentionKey(mention) !== key)
        };
      });
    };
    window.addEventListener("board-mention-dismissed", handleDismiss as EventListener);
    return () => window.removeEventListener("board-mention-dismissed", handleDismiss as EventListener);
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadWorkspaceActivity();
    const workspaceInterval = window.setInterval(() => {
      void loadWorkspaceActivity();
    }, 2000);
    return () => window.clearInterval(workspaceInterval);
  }, [user, loadWorkspaceActivity]);

  useEffect(() => {
    if (!isInviteModalOpen) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsInviteModalOpen(false);
      }
    };
    void loadInvites();
    const interval = window.setInterval(() => {
      void loadInvites();
    }, 5000);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.clearInterval(interval);
    };
  }, [isInviteModalOpen]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{user?.email}</span>.
          </p>
        </div>

        <Link to="/boards">
          <Button>Open boards</Button>
        </Link>
      </div>

      {summaryError && (
        <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {summaryError}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ListTodo className="h-4 w-4" />
                    Assigned to me
                  </CardTitle>
                  <CardDescription>Cards you are currently responsible for.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Sort</span>
                  {Object.entries(SORT_LABELS).map(([key, label]) => (
                    <Button
                      key={key}
                      type="button"
                      size="sm"
                      variant={assignedSort[key as keyof TaskSortState] ? "secondary" : "ghost"}
                      onClick={() =>
                        setAssignedSort((prev) => ({
                          ...prev,
                          [key]: !prev[key as keyof TaskSortState]
                        }))
                      }
                      aria-pressed={assignedSort[key as keyof TaskSortState]}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {summaryStatus === "loading" && assignedCards.length === 0 ? (
                <p className="text-xs text-muted-foreground">Loading assigned tasks...</p>
              ) : assignedSorted.length === 0 ? (
                <p className="text-xs text-muted-foreground">No assigned cards yet.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {assignedSorted.map((card) => renderTaskRow(card))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CheckCircle2 className="h-4 w-4" />
                    Created by me
                  </CardTitle>
                  <CardDescription>Cards you created that are still active.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Sort</span>
                  {Object.entries(SORT_LABELS).map(([key, label]) => (
                    <Button
                      key={key}
                      type="button"
                      size="sm"
                      variant={createdSort[key as keyof TaskSortState] ? "secondary" : "ghost"}
                      onClick={() =>
                        setCreatedSort((prev) => ({
                          ...prev,
                          [key]: !prev[key as keyof TaskSortState]
                        }))
                      }
                      aria-pressed={createdSort[key as keyof TaskSortState]}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {summaryStatus === "loading" && createdCards.length === 0 ? (
                <p className="text-xs text-muted-foreground">Loading your cards...</p>
              ) : createdSorted.length === 0 ? (
                <p className="text-xs text-muted-foreground">No created cards yet.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {createdSorted.map((card) => renderTaskRow(card))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Bell className="h-4 w-4" />
                  Board mentions
                </CardTitle>
                <CardDescription>Unread mentions from boards, lists, and cards.</CardDescription>
              </CardHeader>
              <CardContent>
                {summaryStatus === "loading" && boardMentions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Loading mentions...</p>
                ) : boardMentions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No board mentions.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {boardMentions.map((mention) => (
                      <Link
                        key={mention.commentId}
                        to={`/boards/${mention.boardId}#comment-${mention.commentId}`}
                        className="block rounded-md border border-border/60 bg-background/70 px-3 py-2 text-xs transition hover:border-primary/40"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground">{mention.boardName}</p>
                          <span className="text-[10px] text-muted-foreground">
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

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Bell className="h-4 w-4" />
                  Thread mentions
                </CardTitle>
                <CardDescription>Unread mentions from DMs and channels.</CardDescription>
              </CardHeader>
              <CardContent>
                {summaryStatus === "loading" && threadMentions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Loading mentions...</p>
                ) : threadMentions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No thread mentions.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {threadMentions.map((mention) => (
                      <Link
                        key={mention.id}
                        to={buildThreadLink(mention)}
                        className="block rounded-md border border-border/60 bg-background/70 px-3 py-2 text-xs transition hover:border-primary/40"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground">{mention.conversationLabel}</p>
                          <span className="text-[10px] text-muted-foreground">
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
          </div>
        </div>

        <div className="space-y-5">
          <FocusTimerCard storageKey={storageKey} />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle2 className="h-4 w-4" />
                Weekly + Monthly summary
              </CardTitle>
              <CardDescription>High level throughput across the workspace.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {[
                { label: "Last 7 days", metrics: weeklyMetrics },
                { label: "Last 30 days", metrics: monthlyMetrics }
              ].map((group) => (
                <div key={group.label} className="rounded-lg border bg-card/60 p-3">
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-4 w-4" />
                Activity highlights
              </CardTitle>
              <CardDescription>Boards with the most activity this week.</CardDescription>
            </CardHeader>
            <CardContent>
              {summaryStatus === "loading" && activityHighlights.length === 0 ? (
                <p className="text-xs text-muted-foreground">Loading highlights...</p>
              ) : activityHighlights.length === 0 ? (
                <p className="text-xs text-muted-foreground">No recent activity yet.</p>
              ) : (
                <div className="space-y-2">
                  {activityHighlights.map((item) => (
                    <div key={item.boardId} className="rounded-md border border-border/60 bg-background/70 px-3 py-2">
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserPlus className="h-4 w-4" />
                New joiners
              </CardTitle>
              <CardDescription>Teammates who joined in the last 30 days.</CardDescription>
            </CardHeader>
            <CardContent>
              {summaryStatus === "loading" && newJoiners.length === 0 ? (
                <p className="text-xs text-muted-foreground">Loading new joiners...</p>
              ) : newJoiners.length === 0 ? (
                <p className="text-xs text-muted-foreground">No new teammates yet.</p>
              ) : (
                <div className="space-y-2">
                  {newJoiners.map((user) => (
                    <div key={user.id} className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background/70 px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold">{user.displayName ?? user.name}</p>
                        <p className="text-[11px] text-muted-foreground">{user.role}</p>
                      </div>
                      <span className="text-[11px] text-muted-foreground">Joined {formatJoinerDate(user.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-4 w-4" />
                Team pulse
              </CardTitle>
              <CardDescription>Recent activity across your workspace.</CardDescription>
            </CardHeader>
            <CardContent>
              {isTeamPulseLoading ? (
                <p className="text-xs text-muted-foreground">Loading...</p>
              ) : teamPulseItems.length === 0 ? (
                <p className="text-xs text-muted-foreground">No events yet.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {teamPulseItems.map((entry) => (
                    <div key={entry.id} className="rounded-md border border-border/60 bg-background/70 px-3 py-2">
                      <p className="text-xs font-semibold text-foreground">{formatActivityLabel(entry, user?.id)}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">{formatActivityTime(entry)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="h-4 w-4" />
                    Announcements
                  </CardTitle>
                  <CardDescription>Workspace-wide updates and notices.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {announcements.length > 0 && (
                    <span className="rounded-full border border-border/60 bg-secondary/70 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {announcements.length}
                    </span>
                  )}
                  {announcementCapabilities?.canSend && (
                    <Button type="button" size="sm" variant="secondary" onClick={openAnnouncementCompose}>
                      New announcement
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {summaryStatus === "loading" && announcements.length === 0 ? (
                <p className="text-xs text-muted-foreground">Loading announcements...</p>
              ) : announcements.length === 0 ? (
                <p className="text-xs text-muted-foreground">No announcements yet.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {announcements.map((announcement) => (
                    <button
                      key={announcement.id}
                      type="button"
                      onClick={() => openAnnouncementView(announcement)}
                      className="w-full rounded-md border border-border/60 bg-background/70 px-3 py-2 text-left text-xs transition hover:border-primary/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{announcement.subject}</p>
                          <p className="text-[11px] text-muted-foreground">
                            From {getAnnouncementAuthorLabel(announcement)}
                          </p>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {formatAnnouncementTime(announcement.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{getAnnouncementSnippet(announcement.body)}</p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {isAdmin && (
        <Card>
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
                  onChange={(event) => setInviteEmail(event.target.value)}
                  type="email"
                  placeholder="Email (optional)"
                  className="min-w-[220px] flex-1"
                />
                <Button type="submit" disabled={inviteLoading}>
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
                    <Button type="button" size="sm" variant="secondary" onClick={() => { void onCopyInvite(inviteLink); }}>{copiedInviteLink ? "Copied" : "Copy link"}</Button>
                    {canShare && (
                      <Button type="button" size="sm" variant="ghost" onClick={() => { void onShareInvite(inviteLink); }}>Share</Button>
                    )}
                  </div>
                </div>
                <p className="mt-2 break-all text-xs text-muted-foreground">{inviteLink}</p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" onClick={() => setIsInviteModalOpen(true)}>
                View invite status
              </Button>
              <p className="text-xs text-muted-foreground">{invites.length} total invites</p>
            </div>
          </CardContent>
        </Card>
      )}
      {isInviteModalOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsInviteModalOpen(false);
            }
          }}
        >
          <Card className="w-full max-w-3xl" onMouseDown={(event) => event.stopPropagation()}>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Invite status</CardTitle>
                <CardDescription>Track pending and completed invitations.</CardDescription>
              </div>
              <Button type="button" variant="ghost" onClick={() => setIsInviteModalOpen(false)}>
                Close
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              {[
                { label: "Pending", items: pendingInvites },
                { label: "Accepted", items: acceptedInvites },
                { label: "Revoked", items: revokedInvites },
                { label: "Expired", items: expiredInvites }
              ].map((section) => (
                <div key={section.label} className="rounded-lg border bg-card/60 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{section.label}</p>
                    <span className="rounded-full border border-muted-foreground/20 bg-muted/60 px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                      {section.items.length}
                    </span>
                  </div>
                  {section.items.length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">No {section.label.toLowerCase()} invites.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {section.items.map((invite) => (
                        <div key={invite.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card/70 px-3 py-2">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{invite.email ?? "Anyone with link"}</p>
                            <p className="text-xs text-muted-foreground">
                              Expires {new Date(invite.expiresAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => { void onCopyInvite(invite.inviteUrl, invite.id); }}
                            >
                              {copiedInviteId === invite.id ? "Copied" : "Copy link"}
                            </Button>
                            {canShare && (
                              <Button type="button" size="sm" variant="ghost" onClick={() => { void onShareInvite(invite.inviteUrl); }}>Share</Button>
                            )}
                            {section.label === "Pending" && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="text-amber-600 hover:text-amber-700"
                                onClick={() => { void onRevokeInvite(invite.id); }}
                              >
                                Revoke
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
      {announcementComposeOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeAnnouncementCompose();
            }
          }}
        >
          <Card className="w-full max-w-4xl" onMouseDown={(event) => event.stopPropagation()}>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>New announcement</CardTitle>
                <CardDescription>Write a workspace-wide update.</CardDescription>
              </div>
              <Button type="button" variant="ghost" onClick={closeAnnouncementCompose}>
                Close
              </Button>
            </CardHeader>
            <CardContent className="max-h-[70vh] overflow-y-auto pr-2">
              <form className="space-y-4" onSubmit={handleSendAnnouncement}>
                {announcementError && (
                  <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {announcementError}
                  </p>
                )}
                <label className="grid gap-1 text-sm font-medium">
                  Subject
                  <Input
                    value={announcementSubject}
                    onChange={(event) => setAnnouncementSubject(event.target.value)}
                    placeholder="Announcement subject"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  Body
                  <textarea
                    className="min-h-[140px] rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-sm text-foreground outline-none"
                    value={announcementBody}
                    onChange={(event) => setAnnouncementBody(event.target.value)}
                    placeholder="Write your announcement..."
                  />
                </label>
                <div className="space-y-3 rounded-lg border border-border/60 bg-card/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">Audience</p>
                    <span className="text-[11px] text-muted-foreground">Choose who receives this announcement.</span>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={announcementAudience.sendToAll}
                      onChange={(event) =>
                        setAnnouncementAudience((prev) => ({
                          ...prev,
                          sendToAll: event.target.checked
                        }))
                      }
                    />
                    Send to everyone in the workspace
                  </label>
                  {announcementOptionsStatus === "loading" && (
                    <p className="text-xs text-muted-foreground">Loading audience options...</p>
                  )}
                  {announcementOptionsStatus === "error" && (
                    <p className="text-xs text-destructive">Unable to load audience options.</p>
                  )}
                  {announcementOptions && (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-md border border-border/60 bg-background/70 p-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Include roles</p>
                        <div className="mt-2 space-y-1 max-h-32 overflow-y-auto pr-1">
                          {announcementOptions.roles.length === 0 && (
                            <p className="text-[11px] text-muted-foreground">No roles available.</p>
                          )}
                          {announcementOptions.roles.map((role) => (
                            <label key={role.id} className="flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                className="h-3.5 w-3.5 accent-primary"
                                checked={announcementAudience.includeRoleIds.includes(role.id)}
                                onChange={() => toggleRoleAudience(role.id, "include")}
                              />
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: role.color }} />
                              <span>{role.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-md border border-border/60 bg-background/70 p-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Exclude roles</p>
                        <div className="mt-2 space-y-1 max-h-32 overflow-y-auto pr-1">
                          {announcementOptions.roles.length === 0 && (
                            <p className="text-[11px] text-muted-foreground">No roles available.</p>
                          )}
                          {announcementOptions.roles.map((role) => (
                            <label key={role.id} className="flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                className="h-3.5 w-3.5 accent-primary"
                                checked={announcementAudience.excludeRoleIds.includes(role.id)}
                                onChange={() => toggleRoleAudience(role.id, "exclude")}
                              />
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: role.color }} />
                              <span>{role.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {announcementOptions && (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-md border border-border/60 bg-background/70 p-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Include teammates</p>
                        <div className="mt-2 space-y-1 max-h-36 overflow-y-auto pr-1">
                          {announcementOptions.users.length === 0 && (
                            <p className="text-[11px] text-muted-foreground">No teammates available.</p>
                          )}
                          {announcementOptions.users.map((person) => (
                            <label key={person.id} className="flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                className="h-3.5 w-3.5 accent-primary"
                                checked={announcementAudience.includeUserIds.includes(person.id)}
                                onChange={() =>
                                  setAnnouncementAudience((prev) => ({
                                    ...prev,
                                    includeUserIds: toggleAudienceList(prev.includeUserIds, person.id)
                                  }))
                                }
                              />
                              <span>{person.displayName ?? person.name}</span>
                              <span className="text-[11px] text-muted-foreground">@{person.username ?? person.email} • {person.role}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-md border border-border/60 bg-background/70 p-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Exclude teammates</p>
                        <div className="mt-2 space-y-1 max-h-36 overflow-y-auto pr-1">
                          {announcementOptions.users.length === 0 && (
                            <p className="text-[11px] text-muted-foreground">No teammates available.</p>
                          )}
                          {announcementOptions.users.map((person) => (
                            <label key={person.id} className="flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                className="h-3.5 w-3.5 accent-primary"
                                checked={announcementAudience.excludeUserIds.includes(person.id)}
                                onChange={() =>
                                  setAnnouncementAudience((prev) => ({
                                    ...prev,
                                    excludeUserIds: toggleAudienceList(prev.excludeUserIds, person.id)
                                  }))
                                }
                              />
                              <span>{person.displayName ?? person.name}</span>
                              <span className="text-[11px] text-muted-foreground">@{person.username ?? person.email} • {person.role}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={closeAnnouncementCompose}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={announcementSending}>
                    {announcementSending ? "Sending..." : "Send announcement"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {announcementView && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeAnnouncementView();
            }
          }}
        >
          <Card className="w-full max-w-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>{announcementView.subject}</CardTitle>
                <CardDescription>
                  From {getAnnouncementAuthorLabel(announcementView)} • {formatAnnouncementTime(announcementView.createdAt)}
                </CardDescription>
              </div>
              <Button type="button" variant="ghost" onClick={closeAnnouncementView}>
                Close
              </Button>
            </CardHeader>
            <CardContent className="max-h-[70vh] space-y-4 overflow-y-auto pr-2">
              <div className="rounded-md border border-border/60 bg-background/70 p-4">
                <p className="whitespace-pre-wrap text-sm text-foreground">{announcementView.body}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}


