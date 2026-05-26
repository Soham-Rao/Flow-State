import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getBoardBackgroundClass, getBoardSurfaceClass } from "@/lib/board-backgrounds";
import { hasUserPermission } from "@/lib/permissions";
import { DueReminderToasts, type DueReminderItem } from "@/components/reminders/due-reminder-toast";
import {
  getBoardById
} from "@/lib/boards-api";
import type {
  ArchivedListEntry,
  BoardBackground,
  BoardCard,
  BoardComment,
  BoardDetail,
  BoardLabel,
  BoardList,
  BoardMember,
  Checklist,
  ChecklistItem,
  LabelColor,
  RetentionMode
} from "@/types/board";
import {
  MIN_RETENTION_MINUTES,
  SAVED_TOAST_SHOW_DELAY_MS,
  SAVED_TOAST_VISIBLE_MS,
  clampRetentionMinutes,
  getCardFromBoard,
  sortBoardListsWithCards,
  splitRetentionMinutes,
  toRetentionMinutes,
  BoardDraft,
  CardDraft
} from "@/pages/boards/board-detail-page.utils";
import { useBoardDetailBoardHandlers } from "@/pages/boards/board-detail-page.board-handlers";
import { useBoardDetailCardHandlers } from "@/pages/boards/board-detail-page.card-handlers";
import { useBoardDetailAutosave } from "@/pages/boards/board-detail-page.autosave";
import { useBoardDetailCommentToggles } from "@/pages/boards/board-detail-page.toggles";
import { useBoardDragAndDrop } from "@/pages/boards/board-detail-page.drag";
import { BoardDetailPageView } from "@/pages/boards/board-detail-page.view";
import { useBoardCommentMentions } from "@/pages/boards/board-detail-page.mentions";
import { useActivityStore } from "@/stores/activity-store";
import { useSocketStore } from "@/stores/socket-store";
import { usePresenceStore } from "@/stores/presence-store";
import { useMentionStore } from "@/stores/mentions-store";
import { useAuthStore } from "@/stores/auth-store";

export function BoardDetailPage(): JSX.Element {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const [board, setBoard] = useState<BoardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [boardName, setBoardName] = useState("");
  const [boardDescription, setBoardDescription] = useState("");
  const [boardBackground, setBoardBackground] = useState<BoardBackground>("teal-gradient");
  const [retentionMode, setRetentionMode] = useState<RetentionMode>("card_and_attachments");
  const [retentionDays, setRetentionDays] = useState(7);
  const [retentionHours, setRetentionHours] = useState(0);
  const [retentionMinutesPart, setRetentionMinutesPart] = useState(0);
  const [archiveRetentionDays, setArchiveRetentionDays] = useState(7);
  const [archiveRetentionHours, setArchiveRetentionHours] = useState(0);
  const [archiveRetentionMinutesPart, setArchiveRetentionMinutesPart] = useState(0);
  const [newBoardComment, setNewBoardComment] = useState("");
  const [newListCommentDrafts, setNewListCommentDrafts] = useState<Record<string, string>>({});
  const [newCardComment, setNewCardComment] = useState("");
  const [expandedCommentIds, setExpandedCommentIds] = useState<Set<string>>(new Set());
  const [expandedListCommentGroups, setExpandedListCommentGroups] = useState<Set<string>>(new Set());
  const [expandedCardCommentGroups, setExpandedCardCommentGroups] = useState<Set<string>>(new Set());
  const [archivedLists, setArchivedLists] = useState<ArchivedListEntry[]>([]);
  const [isArchivedOpen, setIsArchivedOpen] = useState(false);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [archivedError, setArchivedError] = useState<string | null>(null);
  const [restoreConflict, setRestoreConflict] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState<LabelColor>("blue");
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>({});
  const [labelColorDrafts, setLabelColorDrafts] = useState<Record<string, LabelColor>>({});
  const [labelSavingIds, setLabelSavingIds] = useState<Set<string>>(new Set());
  const [labelToDelete, setLabelToDelete] = useState<BoardLabel | null>(null);
  const [newListName, setNewListName] = useState("");
  const [newListDone, setNewListDone] = useState(false);
  const [listNameDrafts, setListNameDrafts] = useState<Record<string, string>>({});
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [newCardTitles, setNewCardTitles] = useState<Record<string, string>>({});
  const [newCardDueDates, setNewCardDueDates] = useState<Record<string, string>>({});
  const [newCardAssigneeIds, setNewCardAssigneeIds] = useState<Record<string, string>>({});
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [cardDraft, setCardDraft] = useState<CardDraft | null>(null);
  const [cardSaveStatus, setCardSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [newChecklistItemTitles, setNewChecklistItemTitles] = useState<Record<string, string>>({});
  const [checklistTitleDrafts, setChecklistTitleDrafts] = useState<Record<string, string>>({});
  const [checklistItemTitleDrafts, setChecklistItemTitleDrafts] = useState<Record<string, string>>({});
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDeleteBoardOpen, setIsDeleteBoardOpen] = useState(false);
  const [isArchiveBoardOpen, setIsArchiveBoardOpen] = useState(false);
  const [listToDelete, setListToDelete] = useState<BoardList | null>(null);
  const [cardToDelete, setCardToDelete] = useState<BoardCard | null>(null);
  const [commentToDelete, setCommentToDelete] = useState<BoardComment | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [checklistToDelete, setChecklistToDelete] = useState<Checklist | null>(null);
  const [checklistItemToDelete, setChecklistItemToDelete] = useState<{ item: ChecklistItem; cardId: string } | null>(null);
  useBoardCommentMentions(board);

  const loadBoardActivity = useActivityStore((state) => state.loadBoard);
  const socketStatus = useSocketStore((state) => state.status);
  const joinBoard = useSocketStore((state) => state.joinBoard);
  const leaveBoard = useSocketStore((state) => state.leaveBoard);
  const subscribeBoardEvents = useSocketStore((state) => state.subscribeBoardEvents);
  const boardPresenceRaw = usePresenceStore((state) => (boardId ? state.board[boardId] : undefined));
  const boardPresence = boardPresenceRaw ?? [];
  const currentUser = useAuthStore((state) => state.user);
  const currentUserId = currentUser?.id;
  const assignmentBadgeCount = useMentionStore((state) => state.counts?.assignments ?? 0);

  const [scrollToChecklistId, setScrollToChecklistId] = useState<string | null>(null);
  const [isAutosavingBoard, setIsAutosavingBoard] = useState(false);
  const [listSavingIds, setListSavingIds] = useState<Set<string>>(new Set());
  const [showSavedNotice, setShowSavedNotice] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const listInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const checklistSectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const cardAutoSaveTimeoutRef = useRef<number | null>(null);
  const lastSyncedCardRef = useRef<CardDraft | null>(null);
  const savedShowTimeoutRef = useRef<number | null>(null);
  const savedHideTimeoutRef = useRef<number | null>(null);
  const lastSyncedBoardRef = useRef<BoardDraft | null>(null);
  const currentDraftBoardRef = useRef<BoardDraft | null>(null);
  const listSyncedNamesRef = useRef<Record<string, string>>({});
  const initializedBoardRef = useRef(false);
  const boardRefreshTimerRef = useRef<number | null>(null);
  const lastAssignmentCountRef = useRef<number | null>(null);

  const orderedLists = useMemo(() => (board ? sortBoardListsWithCards(board.lists ?? []) : []), [board]);
  const retentionTotalMinutes = useMemo(
    () => toRetentionMinutes(retentionDays, retentionHours, retentionMinutesPart),
    [retentionDays, retentionHours, retentionMinutesPart]
  );
  const archiveRetentionTotalMinutes = useMemo(
    () => toRetentionMinutes(archiveRetentionDays, archiveRetentionHours, archiveRetentionMinutesPart),
    [archiveRetentionDays, archiveRetentionHours, archiveRetentionMinutesPart]
  );
  const hasExpired = useMemo(() => {
    if (!board) return false;
    const retentionMs = clampRetentionMinutes(retentionTotalMinutes) * 60 * 1000;
    return board.lists.some((list) =>
      list.cards.some((card) => {
        if (!card.doneEnteredAt) return false;
        const enteredAtMs = new Date(card.doneEnteredAt).getTime();
        if (Number.isNaN(enteredAtMs)) return false;
        return nowMs - enteredAtMs >= retentionMs;
      })
    );
  }, [board, nowMs, retentionTotalMinutes]);
  const selectedCardWithList = useMemo(() => getCardFromBoard(board, selectedCardId), [board, selectedCardId]);
  const selectedCardChecklists = useMemo(() => selectedCardWithList?.card.checklists ?? [], [selectedCardWithList]);
  const selectedCardAttachments = useMemo(() => selectedCardWithList?.card.attachments ?? [], [selectedCardWithList]);
  const boardLabels = useMemo(() => board?.labels ?? [], [board]);
  const boardMembers = useMemo<BoardMember[]>(() => board?.members ?? [], [board]);
  const boardAssignedCount = useMemo(() => {
    if (!board || !currentUserId) return 0;
    return board.lists.reduce((total, list) => {
      if (list.isDoneList || list.archivedAt) return total;
      const listCount = list.cards.filter((card) => !card.archivedAt && card.assignees?.some((assignee) => assignee.id === currentUserId)).length;
      return total + listCount;
    }, 0);
  }, [board, currentUserId]);
  const boardDueReminders = useMemo<DueReminderItem[]>(() => {
    if (!board || !currentUserId) return [];
    const canViewAllDueReminders = hasUserPermission(currentUser, "view_all_due_date_reminders");
    return board.lists.flatMap((list) => {
      if (list.isDoneList || list.archivedAt) return [];
      return list.cards.flatMap((card) => {
        if (!card.dueDate || card.archivedAt) return [];
        return (card.assignees ?? [])
          .filter((assignee) => canViewAllDueReminders || assignee.id === currentUserId)
          .map((assignee) => ({
            id: card.id,
            title: card.title,
            priority: card.priority,
            dueDate: card.dueDate as string,
            boardId: board.id,
            boardName: board.name,
            listName: list.name,
            assignee,
            isAssignedToViewer: assignee.id === currentUserId
          }));
      });
    });
  }, [board, currentUser, currentUserId]);

  const resolvedBoardBackground = board?.background ?? boardBackground;
  const activeBannerClass = useMemo(() => getBoardBackgroundClass(resolvedBoardBackground), [resolvedBoardBackground]);
  const activeSurfaceClass = useMemo(() => getBoardSurfaceClass(resolvedBoardBackground), [resolvedBoardBackground]);
  const applyBoardBackground = useCallback((next: BoardBackground): void => {
    setBoardBackground(next);
    setBoard((current) => (current ? { ...current, background: next } : current));
  }, []);

  const focusListInput = useCallback((listId: string): void => {
    window.requestAnimationFrame(() => {
      const input = listInputRefs.current[listId];
      if (!input) return;
      input.focus({ preventScroll: true });
      const cursorAt = input.value.length;
      input.setSelectionRange(cursorAt, cursorAt);
    });
  }, []);
  useEffect(() => {
    if (!editingListId) return;
    focusListInput(editingListId);
  }, [editingListId, focusListInput]);

  const clearSavedNoticeTimers = useCallback((): void => {
    if (savedShowTimeoutRef.current !== null) {
      window.clearTimeout(savedShowTimeoutRef.current);
      savedShowTimeoutRef.current = null;
    }
    if (savedHideTimeoutRef.current !== null) {
      window.clearTimeout(savedHideTimeoutRef.current);
      savedHideTimeoutRef.current = null;
    }
  }, []);
  const clearCardAutosaveTimeout = useCallback((): void => {
    if (cardAutoSaveTimeoutRef.current !== null) {
      window.clearTimeout(cardAutoSaveTimeoutRef.current);
      cardAutoSaveTimeoutRef.current = null;
    }
  }, []);
  const triggerSavedNotice = useCallback((): void => {
    setShowSavedNotice(false);
    clearSavedNoticeTimers();
    savedShowTimeoutRef.current = window.setTimeout(() => {
      setShowSavedNotice(true);
      savedHideTimeoutRef.current = window.setTimeout(() => {
        setShowSavedNotice(false);
      }, SAVED_TOAST_VISIBLE_MS);
    }, SAVED_TOAST_SHOW_DELAY_MS);
  }, [clearSavedNoticeTimers]);

  const { activeCardId, activeCard, activeList, onDragStart, onDragOver, onDragEnd } = useBoardDragAndDrop({
    board,
    boardId,
    orderedLists,
    setBoard,
    setError,
    triggerSavedNotice,
  });



  const applyRetentionParts = useCallback((days: number, hours: number, minutes: number): void => {
    const totalMinutes = toRetentionMinutes(days, hours, minutes);
    const nextParts = splitRetentionMinutes(totalMinutes);
    setRetentionDays(nextParts.days);
    setRetentionHours(nextParts.hours);
    setRetentionMinutesPart(nextParts.minutes);
  }, []);
  const applyArchiveRetentionParts = useCallback((days: number, hours: number, minutes: number): void => {
    const totalMinutes = toRetentionMinutes(days, hours, minutes);
    const nextParts = splitRetentionMinutes(totalMinutes);
    setArchiveRetentionDays(nextParts.days);
    setArchiveRetentionHours(nextParts.hours);
    setArchiveRetentionMinutesPart(nextParts.minutes);
  }, []);

  const hydrateBoardState = useCallback((data: BoardDetail): void => {
    const sortedLists = sortBoardListsWithCards(data.lists ?? []);
    setBoard({ ...data, lists: sortedLists });
    setBoardName(data.name);
    setBoardDescription(data.description ?? "");
    setBoardBackground(data.background);
    setRetentionMode(data.retentionMode ?? "card_and_attachments");
    const retentionParts = splitRetentionMinutes(data.retentionMinutes ?? MIN_RETENTION_MINUTES);
    setRetentionDays(retentionParts.days);
    setRetentionHours(retentionParts.hours);
    setRetentionMinutesPart(retentionParts.minutes);
    const archiveRetentionParts = splitRetentionMinutes(data.archiveRetentionMinutes ?? MIN_RETENTION_MINUTES);
    setArchiveRetentionDays(archiveRetentionParts.days);
    setArchiveRetentionHours(archiveRetentionParts.hours);
    setArchiveRetentionMinutesPart(archiveRetentionParts.minutes);
    setListNameDrafts(Object.fromEntries(sortedLists.map((list) => [list.id, list.name])));
    const syncedDraft: BoardDraft = {
      name: data.name,
      description: data.description ?? "",
      background: data.background,
      retentionMode: data.retentionMode ?? "card_and_attachments",
      retentionMinutes: data.retentionMinutes ?? MIN_RETENTION_MINUTES,
      archiveRetentionMinutes: data.archiveRetentionMinutes ?? MIN_RETENTION_MINUTES,
    };
    lastSyncedBoardRef.current = syncedDraft;
    currentDraftBoardRef.current = syncedDraft;
    initializedBoardRef.current = true;
    const labels = data.labels ?? [];
    setLabelDrafts(Object.fromEntries(labels.map((label) => [label.id, label.name])));
    setLabelColorDrafts(Object.fromEntries(labels.map((label) => [label.id, label.color])));
    setLabelSavingIds(new Set());
    setNewCardTitles((current) => {
      const next = { ...current };
      for (const list of sortedLists) {
        if (next[list.id] === undefined) next[list.id] = "";
      }
      for (const key of Object.keys(next)) {
        if (!sortedLists.some((list) => list.id === key)) delete next[key];
      }
      return next;
    });
    setNewCardDueDates((current) => {
      const next = { ...current };
      for (const list of sortedLists) {
        if (next[list.id] === undefined) next[list.id] = "";
      }
      for (const key of Object.keys(next)) {
        if (!sortedLists.some((list) => list.id === key)) delete next[key];
      }
      return next;
    });
    setNewCardAssigneeIds((current) => {
      const next = { ...current };
      const memberIds = new Set((data.members ?? []).map((member) => member.id));
      const defaultAssigneeId = currentUserId && memberIds.has(currentUserId)
        ? currentUserId
        : (data.members?.[0]?.id ?? "");
      for (const list of sortedLists) {
        if (next[list.id] === undefined || (next[list.id] && !memberIds.has(next[list.id]))) {
          next[list.id] = defaultAssigneeId;
        }
      }
      for (const key of Object.keys(next)) {
        if (!sortedLists.some((list) => list.id === key)) delete next[key];
      }
      return next;
    });
    setNewListCommentDrafts((current) => {
      const next = { ...current };
      for (const list of sortedLists) {
        if (next[list.id] === undefined) next[list.id] = "";
      }
      for (const key of Object.keys(next)) {
        if (!sortedLists.some((list) => list.id === key)) delete next[key];
      }
      return next;
    });
  }, [currentUserId]);
  const {
    runListNameAutosave,
    scheduleLabelAutosave,
  } = useBoardDetailAutosave({
    boardId,
    boardName,
    boardDescription,
    boardBackground,
    retentionMode,
    retentionTotalMinutes,
    archiveRetentionTotalMinutes,
    setError,
    setIsAutosavingBoard,
    setShowSavedNotice,
    setBoard,
    setListNameDrafts,
    setListSavingIds,
    setLabelDrafts,
    setLabelColorDrafts,
    setLabelSavingIds,
    triggerSavedNotice,
    hydrateBoardState,
    clearSavedNoticeTimers,
    clearCardAutosaveTimeout,
    listSyncedNamesRef,
    lastSyncedBoardRef,
    currentDraftBoardRef,
    initializedBoardRef,
  });




  const {
    toggleListCommentGroup,
    toggleCardCommentGroup,
    toggleCommentExpanded,
  } = useBoardDetailCommentToggles({
    setExpandedCommentIds,
    setExpandedListCommentGroups,
    setExpandedCardCommentGroups,
  });

  const loadBoard = useCallback(async (showLoading: boolean): Promise<void> => {
    if (!boardId) {
      if (showLoading) setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    try {
      const data = await getBoardById(boardId);
      hydrateBoardState(data);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load board");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [boardId, hydrateBoardState]);

  const refreshBoardSilently = useCallback(async (): Promise<void> => {
    await loadBoard(false);
  }, [loadBoard]);

  useEffect(() => {
    if (!boardId) return;
    if (lastAssignmentCountRef.current === assignmentBadgeCount) return;
    lastAssignmentCountRef.current = assignmentBadgeCount;
    void refreshBoardSilently();
  }, [assignmentBadgeCount, boardId, refreshBoardSilently]);

  const scheduleBoardRefresh = useCallback((): void => {
    if (boardRefreshTimerRef.current !== null) return;
    boardRefreshTimerRef.current = window.setTimeout(() => {
      boardRefreshTimerRef.current = null;
      void refreshBoardSilently();
    }, 300);
  }, [refreshBoardSilently]);

  useEffect(() => {
    return () => {
      if (boardRefreshTimerRef.current !== null) {
        window.clearTimeout(boardRefreshTimerRef.current);
        boardRefreshTimerRef.current = null;
      }
    };
  }, []);


  const {
    onDeleteBoard,
    onCreateList,
    onToggleDone,
    closeListEditor,
    cancelListEditor,
    onToggleListEdit,
    onDeleteList,
    onCreateCard,
    onCreateLabel,
    onDeleteLabel,
    onCreateBoardComment,
    onCreateListComment,
    onToggleCommentReaction,
    onDeleteComment,
    loadArchivedLists,
    openArchivedLists,
    onArchiveBoard,
    onArchiveList,
    requestRestoreArchivedEntry,
    requestRestoreArchivedCard
  } = useBoardDetailBoardHandlers({
    boardId,
    board,
    boardMembers,
    currentUserId,
    newBoardComment,
    setNewBoardComment,
    newListCommentDrafts,
    setNewListCommentDrafts,
    newListName,
    newListDone,
    setNewListName,
    setNewListDone,
    setBoard,
    setError,
    setPermissionError,
    triggerSavedNotice,
    navigate,
    listSyncedNamesRef,
    editingListId,
    listNameDrafts,
    runListNameAutosave,
    setEditingListId,
    listToDelete,
    setListToDelete,
    setListNameDrafts,
    setListSavingIds,
    setNewCardTitles,
    setNewCardDueDates,
    setNewCardAssigneeIds,
    newCardTitles,
    newCardDueDates,
    newCardAssigneeIds,
    newLabelName,
    newLabelColor,
    setNewLabelName,
    labelToDelete,
    setLabelToDelete,
    setLabelDrafts,
    setLabelColorDrafts,
    setLabelSavingIds,
    commentToDelete,
    setCommentToDelete,
    isArchivedOpen,
    setIsArchivedOpen,
    setArchivedLoading,
    setArchivedError,
    setArchivedLists,
    setIsArchiveBoardOpen,
    hydrateBoardState,
    refreshBoardSilently,
    setRestoreConflict
  });


  useEffect(() => {
    void loadBoard(true);
  }, [loadBoard]);

  useEffect(() => {
    if (!boardId) return;
    void loadBoardActivity(boardId);
  }, [boardId, loadBoardActivity]);

  useEffect(() => {
    if (!boardId || socketStatus !== "connected") return;
    joinBoard(boardId);
    return () => {
      leaveBoard(boardId);
    };
  }, [boardId, socketStatus, joinBoard, leaveBoard]);

  useEffect(() => {
    if (!boardId) return;
    const unsubscribe = subscribeBoardEvents((events) => {
      if (events.some((event) => event.boardId === boardId)) {
        scheduleBoardRefresh();
      }
    });
    return () => {
      unsubscribe();
    };
  }, [boardId, subscribeBoardEvents, scheduleBoardRefresh]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 60 * 1000);
    return () => window.clearInterval(interval);
  }, []);
  const {
    openCardEditor,
    closeCardEditor,
    handleCardDraftChange,
    onArchiveCard,
    onDeleteCard,
    onToggleCardLabel,
    onToggleAssignee,
    onCreateCardComment,
    onCreateChecklist,
    onSaveChecklistTitle,
    onDeleteChecklist,
    onCreateChecklistItem,
    onSaveChecklistItemTitle,
    onToggleChecklistItem,
    onDeleteChecklistItem,
    onUploadAttachments,
    onDownloadAttachment,
    onDownloadAllAttachments,
    onDeleteAttachment
  } = useBoardDetailCardHandlers({
    boardMembers,
    selectedCardWithList,
    selectedCardId,
    cardDraft,
    cardToDelete,
    setBoard,
    setError,
    triggerSavedNotice,
    setSelectedCardId,
    setCardDraft,
    setCardSaveStatus,
    setNewCardComment,
    setNewChecklistTitle,
    setNewChecklistItemTitles,
    setChecklistTitleDrafts,
    setChecklistItemTitleDrafts,
    setChecklistToDelete,
    setChecklistItemToDelete,
    setAttachmentError,
    setIsUploadingAttachments,
    setScrollToChecklistId,
    setCardToDelete,
    lastSyncedCardRef,
    cardAutoSaveTimeoutRef,
    checklistSectionRefs,
    scrollToChecklistId,
    checklistTitleDrafts,
    checklistItemTitleDrafts,
    newChecklistItemTitles,
    newChecklistTitle,
    newCardComment,
    checklistToDelete,
    checklistItemToDelete,
    isArchivedOpen,
    loadArchivedLists,
    clearCardAutosaveTimeout
  });
  const viewState = {
    loading,
    board,
    error,
    permissionError,
    activeSurfaceClass,
    activeBannerClass,
    boardName,
    boardAssignedCount,
    boardDescription,
    boardBackground,
    retentionMode,
    retentionDays,
    retentionHours,
    retentionMinutesPart,
    retentionTotalMinutes,
    archiveRetentionDays,
    archiveRetentionHours,
    archiveRetentionMinutesPart,
    archiveRetentionTotalMinutes,
    newBoardComment,
    newListCommentDrafts,
    newListName,
    newListDone,
    newCardTitles,
    newCardDueDates,
    newCardAssigneeIds,
    newLabelName,
    newLabelColor,
    labelDrafts,
    labelColorDrafts,
    labelSavingIds,
    listNameDrafts,
    editingListId,
    listSavingIds,
    orderedLists,
    boardMembers,
    boardPresence,
    boardLabels,
    expandedCommentIds,
    expandedListCommentGroups,
    expandedCardCommentGroups,
    selectedCardWithList,
    cardDraft,
    cardSaveStatus,
    isUploadingAttachments,
    attachmentError,
    selectedCardAttachments,
    newCardComment,
    selectedCardChecklists,
    checklistTitleDrafts,
    checklistItemTitleDrafts,
    newChecklistItemTitles,
    newChecklistTitle,
    archivedLoading,
    archivedError,
    archivedLists,
    isArchivedOpen,
    showSavedNotice,
    restoreConflict,
    isArchiveBoardOpen,
    isDeleteBoardOpen,
    cardToDelete,
    commentToDelete,
    checklistToDelete,
    checklistItemToDelete,
    listToDelete,
    nowMs,
    activeCardId,
    activeCard,
    activeList,
    isSettingsOpen,
    isAutosavingBoard,
  };

  const viewRefs = {
    listInputRefs,
    attachmentInputRef,
    checklistSectionRefs,
  };

  const viewActions = {
    onToggleCommentExpanded: toggleCommentExpanded,
    onToggleCommentReaction,
    onSetCommentToDelete: setCommentToDelete,
    onCreateBoardComment,
    onOpenArchivedLists: openArchivedLists,
    onNewBoardCommentChange: setNewBoardComment,
    onNewListNameChange: setNewListName,
    onNewListDoneChange: setNewListDone,
    onCreateList,
    onToggleListEdit,
    onListNameDraftChange: (listId: string, value: string) => {
      setListNameDrafts((current) => ({ ...current, [listId]: value }));
    },
    closeListEditor,
    cancelListEditor,
    onArchiveList,
    onSetListToDelete: setListToDelete,
    onToggleDone,
    onToggleListCommentGroup: toggleListCommentGroup,
    onToggleCardCommentGroup: toggleCardCommentGroup,
    onListCommentDraftChange: (listId: string, value: string) => {
      setNewListCommentDrafts((current) => ({ ...current, [listId]: value }));
    },
    onCreateListComment,
    onCardTitleChange: (listId: string, value: string) => {
      setNewCardTitles((current) => ({ ...current, [listId]: value }));
    },
    onCardDueDateChange: (listId: string, value: string) => {
      setNewCardDueDates((current) => ({ ...current, [listId]: value }));
    },
    onCardAssigneeChange: (listId: string, value: string) => {
      setNewCardAssigneeIds((current) => ({ ...current, [listId]: value }));
    },
    onCreateCard,
    openCardEditor,
    onToggleChecklistItem,
    onDownloadAllAttachments,
    onDragStart,
    onDragOver,
    onDragEnd,
    onToggleSettingsOpen: () => setIsSettingsOpen((current) => !current),
    onBoardNameChange: setBoardName,
    onBoardDescriptionChange: setBoardDescription,
    onApplyBoardBackground: applyBoardBackground,
    onRetentionModeChange: setRetentionMode,
    applyRetentionParts,
    applyArchiveRetentionParts,
    onNewLabelNameChange: setNewLabelName,
    onNewLabelColorChange: setNewLabelColor,
    onLabelDraftChange: (labelId: string, value: string) => {
      setLabelDrafts((current) => ({ ...current, [labelId]: value }));
    },
    onLabelColorDraftChange: (labelId: string, value: LabelColor) => {
      setLabelColorDrafts((current) => ({ ...current, [labelId]: value }));
    },
    scheduleLabelAutosave,
    onLabelDelete: setLabelToDelete,
    onCreateLabel,
    onOpenArchiveBoard: () => setIsArchiveBoardOpen(true),
    onOpenDeleteBoard: () => setIsDeleteBoardOpen(true),
    onArchiveBoard,
    closeCardEditor,
    onArchiveCard,
    onSetCardToDelete: setCardToDelete,
    onCardDraftChange: handleCardDraftChange,
    onToggleCardLabel,
    onToggleAssignee,
    onUploadAttachments,
    onDownloadAttachment,
    onDeleteAttachment,
    onCardCommentChange: setNewCardComment,
    onCreateCardComment,
    onChecklistTitleDraftChange: (checklistId: string, value: string) => {
      setChecklistTitleDrafts((current) => ({ ...current, [checklistId]: value }));
    },
    onSaveChecklistTitle,
    onSetChecklistToDelete: setChecklistToDelete,
    onChecklistItemTitleDraftChange: (itemId: string, value: string) => {
      setChecklistItemTitleDrafts((current) => ({ ...current, [itemId]: value }));
    },
    onSaveChecklistItemTitle,
    onSetChecklistItemToDelete: setChecklistItemToDelete,
    onChecklistItemDraftChange: (checklistId: string, value: string) => {
      setNewChecklistItemTitles((current) => ({ ...current, [checklistId]: value }));
    },
    onCreateChecklistItem,
    onChecklistTitleChange: setNewChecklistTitle,
    onCreateChecklist,
    onSetIsArchivedOpen: setIsArchivedOpen,
    onRequestRestoreArchivedEntry: requestRestoreArchivedEntry,
    onRequestRestoreArchivedCard: requestRestoreArchivedCard,
    onSetRestoreConflict: setRestoreConflict,
    onSetIsArchiveBoardOpen: setIsArchiveBoardOpen,
    onSetIsDeleteBoardOpen: setIsDeleteBoardOpen,
    onDeleteBoard,
    onDeleteCard,
    onDeleteComment,
    onDeleteChecklist,
    onDeleteChecklistItem,
    onDeleteList,
    onDismissPermissionError: () => setPermissionError(null),
  };

  return (
    <>
      <BoardDetailPageView
        state={viewState}
        refs={viewRefs}
        actions={viewActions}
      />
      <DueReminderToasts
        items={boardDueReminders}
        nowMs={nowMs}
        currentUserId={currentUserId}
        surface="board"
      />
    </>
  );
}



















