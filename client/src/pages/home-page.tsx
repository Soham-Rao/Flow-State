import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, ListTodo } from "lucide-react";

import { PageErrorState } from "@/components/feedback/page-error-state";
import { createAnnouncement, deleteAnnouncements, getAnnouncementCapabilities, listAnnouncementAudienceOptions, markAnnouncementsSeen } from "@/lib/announcements-api";
import { createInvite, listInvites, revokeInvite } from "@/lib/invites-api";
import { getDashboardSummary } from "@/lib/dashboard-api";
import { useActivityStore } from "@/stores/activity-store";
import { useAuthStore } from "@/stores/auth-store";
import { useSocketStore } from "@/stores/socket-store";
import type { AnnouncementAudience, AnnouncementAudienceOptions, AnnouncementDetail } from "@/types/announcements";
import type { DashboardCardSummary, DashboardSummary } from "@/types/dashboard";
import type { CommentMentionDetail } from "@/types/mentions";
import type { InviteSummary } from "@/types/invite";
import { FocusTimerCard } from "@/pages/home/home-page.focus";
import {
  ActivityHighlightsCard,
  AnnouncementsCard,
  BoardMentionsCard,
  DashboardHeader,
  InvitesCard,
  NewJoinersCard,
  SummaryCard,
  TaskListCard,
  TeamPulseCard,
  ThreadMentionsCard,
  TaskSortState
} from "@/pages/home/home-page.sections";
import { AnnouncementComposeModal, AnnouncementViewModal, InviteStatusModal } from "@/pages/home/home-page.modals";

const SORT_LABELS = {
  priority: "Priority",
  dueDate: "Due date"
} as const;
const priorityRank: Record<DashboardCardSummary["priority"], number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3
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

export function HomePage(): JSX.Element {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === "admin";
  const socketStatus = useSocketStore((state) => state.status);

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
  const [announcementSelectionMode, setAnnouncementSelectionMode] = useState(false);
  const [selectedAnnouncementIds, setSelectedAnnouncementIds] = useState<string[]>([]);
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
  const [announcementListError, setAnnouncementListError] = useState<string | null>(null);
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

  const selectedAnnouncementSet = useMemo(() => new Set(selectedAnnouncementIds), [selectedAnnouncementIds]);
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

  const onCreateInvite = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
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
      const options = await listAnnouncementAudienceOptions({ skipCache: true });
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
    setAnnouncementAudience((prev) => ({
      ...prev,
      includeRoleIds: source === "include" ? toggleAudienceList(prev.includeRoleIds, roleId) : prev.includeRoleIds,
      excludeRoleIds: source === "exclude" ? toggleAudienceList(prev.excludeRoleIds, roleId) : prev.excludeRoleIds
    }));
  };

  const handleSendAnnouncement = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
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
  const toggleAnnouncementSelection = (id: string): void => {
    setSelectedAnnouncementIds((prev) => (
      prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]
    ));
  };

  const setAnnouncementSelection = (next: boolean): void => {
    setAnnouncementSelectionMode(next);
    if (!next) {
      setSelectedAnnouncementIds([]);
    }
  };

  const handleDeleteAnnouncements = async (ids: string[]): Promise<void> => {
    const normalized = Array.from(new Set(ids.filter(Boolean)));
    if (normalized.length === 0) return;
    setAnnouncementListError(null);
    try {
      await deleteAnnouncements(normalized);
      setSummary((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          announcements: prev.announcements.filter((entry) => !normalized.includes(entry.id))
        };
      });
      setSelectedAnnouncementIds((prev) => prev.filter((entry) => !normalized.includes(entry)));
      setAnnouncementSelectionMode(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete announcements.";
      setAnnouncementListError(message);
    }
  };
  const openAnnouncementView = (announcement: AnnouncementDetail): void => {
    setAnnouncementView(announcement);
    if (!announcement.seenAt) {
      const now = Date.now();
      setSummary((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          announcements: prev.announcements.map((entry) => (
            entry.id === announcement.id ? { ...entry, seenAt: now } : entry
          ))
        };
      });
      void markAnnouncementsSeen([announcement.id]);
    }
  };

  const closeAnnouncementView = (): void => {
    setAnnouncementView(null);
  };

  useEffect(() => {
    if (!user) return;
    void loadAnnouncementCapabilities();
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    void loadSummary();
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      void loadSummary();
    }, 7000);
    return () => window.clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
    if (!announcementComposeOpen) return;
    void loadAnnouncementOptions();
  }, [announcementComposeOpen, announcementCapabilities?.canSend]);
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
    if (socketStatus === "connected") {
      return;
    }
    const workspaceInterval = window.setInterval(() => {
      if (document.hidden) return;
      void loadWorkspaceActivity();
    }, 4000);
    return () => window.clearInterval(workspaceInterval);
  }, [user, loadWorkspaceActivity, socketStatus]);

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
    <div className="min-h-[calc(100vh-5.25rem)] space-y-6 bg-transparent p-6 text-slate-900 [&_.text-foreground]:text-slate-900 [&_.text-muted-foreground]:text-slate-600 dark:text-white/90 dark:[&_.text-foreground]:text-white dark:[&_.text-muted-foreground]:text-white/70">
      <DashboardHeader email={user?.email} />

      {summaryError && (
        <PageErrorState
          title="Unable to load dashboard"
          message={summaryError}
          onRetry={() => {
            void loadSummary();
          }}
        />
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-5">
          <TaskListCard
            title="Assigned to me"
            description="Cards you are currently responsible for."
            icon={ListTodo}
            sortState={assignedSort}
            sortLabels={SORT_LABELS}
            onToggleSort={(key) =>
              setAssignedSort((prev) => ({
                ...prev,
                [key]: !prev[key]
              }))
            }
            cards={assignedSorted}
            isLoading={summaryStatus === "loading"}
            loadingText="Loading assigned tasks..."
            emptyText="No assigned cards yet."
          />

          <TaskListCard
            title="Created by me"
            description="Cards you created that are still active."
            icon={CheckCircle2}
            sortState={createdSort}
            sortLabels={SORT_LABELS}
            onToggleSort={(key) =>
              setCreatedSort((prev) => ({
                ...prev,
                [key]: !prev[key]
              }))
            }
            cards={createdSorted}
            isLoading={summaryStatus === "loading"}
            loadingText="Loading your cards..."
            emptyText="No created cards yet."
          />

          <div className="grid gap-4 md:grid-cols-2">
            <BoardMentionsCard mentions={boardMentions} isLoading={summaryStatus === "loading"} />
            <ThreadMentionsCard mentions={threadMentions} isLoading={summaryStatus === "loading"} />
          </div>

          <AnnouncementsCard
            announcements={announcements}
            isLoading={summaryStatus === "loading"}
            canSend={Boolean(announcementCapabilities?.canSend)}
            selectionMode={announcementSelectionMode}
            selectedAnnouncementIds={selectedAnnouncementSet}
            listError={announcementListError}
            onToggleSelectionMode={setAnnouncementSelection}
            onToggleSelection={toggleAnnouncementSelection}
            onDeleteSelected={() => {
              void handleDeleteAnnouncements(selectedAnnouncementIds);
            }}
            onDeleteAnnouncement={(id) => {
              void handleDeleteAnnouncements([id]);
            }}
            onOpenCompose={openAnnouncementCompose}
            onOpenView={openAnnouncementView}
          />

          <InvitesCard
            isAdmin={isAdmin}
            inviteEmail={inviteEmail}
            onInviteEmailChange={setInviteEmail}
            inviteLoading={inviteLoading}
            inviteError={inviteError}
            inviteLink={inviteLink}
            copiedInviteLink={copiedInviteLink}
            canShare={canShare}
            invitesCount={invites.length}
            onCreateInvite={onCreateInvite}
            onCopyInvite={(inviteUrl) => {
              void onCopyInvite(inviteUrl);
            }}
            onShareInvite={(inviteUrl) => {
              void onShareInvite(inviteUrl);
            }}
            onOpenInviteStatus={() => setIsInviteModalOpen(true)}
          />
        </div>

        <div className="space-y-5">
          <FocusTimerCard storageKey={storageKey} />
          <SummaryCard weekly={weeklyMetrics} monthly={monthlyMetrics} />
          <ActivityHighlightsCard items={activityHighlights} isLoading={summaryStatus === "loading"} />
          <TeamPulseCard activity={activity} status={activityStatus} currentUserId={user?.id ?? null} />
          <NewJoinersCard joiners={newJoiners} isLoading={summaryStatus === "loading"} />
        </div>
      </div>

      <InviteStatusModal
        open={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        pendingInvites={pendingInvites}
        acceptedInvites={acceptedInvites}
        revokedInvites={revokedInvites}
        expiredInvites={expiredInvites}
        copiedInviteId={copiedInviteId}
        canShare={canShare}
        onCopyInvite={onCopyInvite}
        onShareInvite={onShareInvite}
        onRevokeInvite={onRevokeInvite}
      />

      <AnnouncementComposeModal
        open={announcementComposeOpen}
        onClose={closeAnnouncementCompose}
        onSend={handleSendAnnouncement}
        error={announcementError}
        sending={announcementSending}
        subject={announcementSubject}
        onSubjectChange={setAnnouncementSubject}
        body={announcementBody}
        onBodyChange={setAnnouncementBody}
        audience={announcementAudience}
        onAudienceChange={setAnnouncementAudience}
        options={announcementOptions}
        optionsStatus={announcementOptionsStatus}
        toggleRoleAudience={toggleRoleAudience}
        toggleIncludeUser={(userId) =>
          setAnnouncementAudience((prev) => ({
            ...prev,
            includeUserIds: toggleAudienceList(prev.includeUserIds, userId)
          }))
        }
        toggleExcludeUser={(userId) =>
          setAnnouncementAudience((prev) => ({
            ...prev,
            excludeUserIds: toggleAudienceList(prev.excludeUserIds, userId)
          }))
        }
      />

      <AnnouncementViewModal announcement={announcementView} onClose={closeAnnouncementView} />
    </div>
  );
}



























