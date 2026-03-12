import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, ChevronDown, ChevronUp, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { boardBackgroundPresets, getBoardBackgroundClass, getBoardSurfaceClass } from "@/lib/board-backgrounds";
import {
  createCard,
  createList,
  deleteBoard,
  deleteCard,
  deleteList,
  getBoardById,
  moveCard,
  reorderLists,
  updateBoard,
  updateCard,
  updateList
} from "@/lib/boards-api";
import type { BoardBackground, BoardCard, BoardDetail, BoardList, CardPriority } from "@/types/board";

interface BoardDraft {
  name: string;
  description: string;
  background: BoardBackground;
}

interface CardDraft {
  title: string;
  description: string;
  priority: CardPriority;
  dueDate: string;
}

const AUTO_SAVE_DELAY_MS = 750;
const SAVED_TOAST_SHOW_DELAY_MS = 250;
const SAVED_TOAST_VISIBLE_MS = 1500;

function sortCardsByPosition(cards: BoardCard[]): BoardCard[] {
  return [...cards].sort((a, b) => a.position - b.position);
}

function sortListsByPosition(values: BoardList[]): BoardList[] {
  return [...values].sort((a, b) => a.position - b.position);
}

function sortBoardListsWithCards(values: BoardList[]): BoardList[] {
  return sortListsByPosition(values).map((list) => ({
    ...list,
    cards: sortCardsByPosition(list.cards)
  }));
}

function moveListIds(listIds: string[], sourceId: string, targetId: string): string[] {
  const sourceIndex = listIds.indexOf(sourceId);
  const targetIndex = listIds.indexOf(targetId);

  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return listIds;
  }

  const nextIds = [...listIds];
  const [source] = nextIds.splice(sourceIndex, 1);
  nextIds.splice(targetIndex, 0, source);

  return nextIds;
}

function formatDueDateForInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function toIsoFromDateTimeInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatDueDateLabel(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function getPriorityBadgeClass(priority: CardPriority): string {
  switch (priority) {
    case "low":    return "border-emerald-400/50 bg-emerald-100/75 text-emerald-900";
    case "medium": return "border-sky-400/50 bg-sky-100/75 text-sky-900";
    case "high":   return "border-amber-400/50 bg-amber-100/75 text-amber-900";
    case "urgent": return "border-rose-400/50 bg-rose-100/75 text-rose-900";
    default:       return "border-border bg-secondary text-secondary-foreground";
  }
}

function getPriorityLabel(priority: CardPriority): string {
  switch (priority) {
    case "low":    return "Low";
    case "medium": return "Medium";
    case "high":   return "High";
    case "urgent": return "Urgent";
    default:       return priority;
  }
}

function trimOrNull(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildCardDraft(card: BoardCard): CardDraft {
  return {
    title: card.title,
    description: card.description ?? "",
    priority: card.priority,
    dueDate: formatDueDateForInput(card.dueDate)
  };
}

function getCardFromBoard(
  board: BoardDetail | null,
  cardId: string | null
): { card: BoardCard; list: BoardList } | null {
  if (!board || !cardId) return null;
  for (const list of board.lists) {
    const card = list.cards.find((item) => item.id === cardId);
    if (card) return { card, list };
  }
  return null;
}

// ---------------------------------------------------------------------------
// CardSummary — pure display, no drag logic
// ---------------------------------------------------------------------------
function CardSummary({ card }: { card: BoardCard }): JSX.Element {
  const dueLabel = formatDueDateLabel(card.dueDate);
  return (
    <>
      <p className="line-clamp-2 text-sm font-medium text-foreground">{card.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${getPriorityBadgeClass(card.priority)}`}>
          {getPriorityLabel(card.priority)}
        </span>
        {dueLabel && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-secondary/70 px-2 py-0.5 text-[11px] text-muted-foreground">
            <CalendarClock className="h-3 w-3" />
            {dueLabel}
          </span>
        )}
        {card.doneEnteredAt && (
          <span className="rounded-full border border-emerald-300/70 bg-emerald-50/80 px-2 py-0.5 text-[11px] text-emerald-700">
            Done timer started
          </span>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// SortableCard — wraps a card with dnd-kit drag handle
// ---------------------------------------------------------------------------
function SortableCard({
  card,
  onEdit,
  onDeleteRequest,
}: {
  card: BoardCard;
  onEdit: (card: BoardCard) => void;
  onDeleteRequest: (card: BoardCard) => void;
}): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} data-card-id={card.id}>
      <div
        className={`group flex items-start gap-2 rounded-md border border-border/70 bg-background/90 px-3 py-2 transition-all duration-150 ${
          isDragging ? "opacity-30 ring-2 ring-primary/25 shadow-md" : "hover:shadow-sm"
        }`}
      >
        {/* Clickable content area */}
        <div
          className="flex-1 min-w-0 cursor-pointer text-left"
          role="button"
          tabIndex={0}
          aria-label={`Open card ${card.title}`}
          onClick={() => onEdit(card)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onEdit(card);
            }
          }}
        >
          <CardSummary card={card} />
        </div>

        {/* Drag handle — only this area initiates drag */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="mt-0.5 shrink-0 cursor-grab active:cursor-grabbing rounded p-0.5 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100 touch-none"
          tabIndex={-1}
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ListDropZone — makes an empty list accept drops
// ---------------------------------------------------------------------------
function ListDropZone({ listId }: { listId: string }): JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id: listId });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground transition-colors ${
        isOver ? "border-primary/50 bg-primary/5" : "border-border/50 bg-background/70"
      }`}
    >
      {isOver ? "Drop here" : "No cards yet. Add one below."}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BoardDetailPage
// ---------------------------------------------------------------------------
export function BoardDetailPage(): JSX.Element {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();

  const [board, setBoard] = useState<BoardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [boardName, setBoardName] = useState("");
  const [boardDescription, setBoardDescription] = useState("");
  const [boardBackground, setBoardBackground] = useState<BoardBackground>("teal-gradient");

  const [newListName, setNewListName] = useState("");
  const [newListDone, setNewListDone] = useState(false);
  const [listNameDrafts, setListNameDrafts] = useState<Record<string, string>>({});
  const [editingListId, setEditingListId] = useState<string | null>(null);

  const [newCardTitles, setNewCardTitles] = useState<Record<string, string>>({});
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [cardDraft, setCardDraft] = useState<CardDraft | null>(null);
  const [isCardSaving, setIsCardSaving] = useState(false);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDeleteBoardOpen, setIsDeleteBoardOpen] = useState(false);
  const [listToDelete, setListToDelete] = useState<BoardList | null>(null);
  const [cardToDelete, setCardToDelete] = useState<BoardCard | null>(null);

  // List drag (HTML5 DnD — kept as-is since it works)
  const [draggingListId, setDraggingListId] = useState<string | null>(null);
  const [dragOverListId, setDragOverListId] = useState<string | null>(null);

  // Card drag (dnd-kit)
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const preDragListsRef = useRef<BoardList[] | null>(null);

  const [isAutosavingBoard, setIsAutosavingBoard] = useState(false);
  const [listSavingIds, setListSavingIds] = useState<Set<string>>(new Set());
  const [showSavedNotice, setShowSavedNotice] = useState(false);

  const autoSaveTimeoutRef = useRef<number | null>(null);
  const listAutoSaveTimeoutsRef = useRef<Record<string, number>>({});
  const listInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const savedShowTimeoutRef = useRef<number | null>(null);
  const savedHideTimeoutRef = useRef<number | null>(null);

  const lastSyncedBoardRef = useRef<BoardDraft | null>(null);
  const currentDraftBoardRef = useRef<BoardDraft | null>(null);
  const listSyncedNamesRef = useRef<Record<string, string>>({});
  const initializedBoardRef = useRef(false);

  // dnd-kit sensors — require 5px movement so clicks still work normally
  const cardSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const orderedLists = useMemo(() => {
    return board ? sortBoardListsWithCards(board.lists) : [];
  }, [board]);

  const selectedCardWithList = useMemo(
    () => getCardFromBoard(board, selectedCardId),
    [board, selectedCardId]
  );

  // The card currently being dragged (for the DragOverlay ghost)
  const activeCard = useMemo(
    () => (activeCardId ? board?.lists.flatMap((l) => l.cards).find((c) => c.id === activeCardId) ?? null : null),
    [board, activeCardId]
  );

  const activeBannerClass = useMemo(() => getBoardBackgroundClass(boardBackground), [boardBackground]);
  const activeSurfaceClass = useMemo(() => getBoardSurfaceClass(boardBackground), [boardBackground]);

  const focusListInput = useCallback((listId: string): void => {
    window.requestAnimationFrame(() => {
      const input = listInputRefs.current[listId];
      if (!input) return;
      input.focus({ preventScroll: true });
      const cursorAt = input.value.length;
      input.setSelectionRange(cursorAt, cursorAt);
    });
  }, []);

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

  const clearListAutosaveTimeout = (listId: string): void => {
    const timeout = listAutoSaveTimeoutsRef.current[listId];
    if (timeout !== undefined) {
      window.clearTimeout(timeout);
      delete listAutoSaveTimeoutsRef.current[listId];
    }
  };

  const clearAllListAutosaveTimeouts = (): void => {
    Object.values(listAutoSaveTimeoutsRef.current).forEach((t) => window.clearTimeout(t));
    listAutoSaveTimeoutsRef.current = {};
  };

  const hydrateBoardState = useCallback((data: BoardDetail): void => {
    const sortedLists = sortBoardListsWithCards(data.lists);
    setBoard({ ...data, lists: sortedLists });
    setBoardName(data.name);
    setBoardDescription(data.description ?? "");
    setBoardBackground(data.background);
    setListNameDrafts(Object.fromEntries(sortedLists.map((list) => [list.id, list.name])));

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

    listSyncedNamesRef.current = Object.fromEntries(sortedLists.map((list) => [list.id, list.name]));
    const syncedDraft: BoardDraft = {
      name: data.name.trim(),
      description: (data.description ?? "").trim(),
      background: data.background
    };
    lastSyncedBoardRef.current = syncedDraft;
    currentDraftBoardRef.current = syncedDraft;
    initializedBoardRef.current = true;
    setListSavingIds(new Set());
    setEditingListId((current) => {
      if (!current) return current;
      return sortedLists.some((list) => list.id === current) ? current : null;
    });
  }, []);

  const loadBoard = useCallback(async (): Promise<void> => {
    if (!boardId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getBoardById(boardId);
      hydrateBoardState(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load board");
    } finally {
      setLoading(false);
    }
  }, [boardId, hydrateBoardState]);

  useEffect(() => { void loadBoard(); }, [loadBoard]);

  useEffect(() => {
    if (!editingListId) return;
    focusListInput(editingListId);
  }, [editingListId, focusListInput]);

  useEffect(() => {
    if (!selectedCardId) return;
    if (!selectedCardWithList) {
      setSelectedCardId(null);
      setCardDraft(null);
    }
  }, [selectedCardId, selectedCardWithList]);

  const runBoardAutosave = useCallback(async (): Promise<void> => {
    if (!boardId) return;
    const draft = currentDraftBoardRef.current;
    const synced = lastSyncedBoardRef.current;
    if (!draft || !synced) return;
    const hasChanges =
      draft.name !== synced.name ||
      draft.description !== synced.description ||
      draft.background !== synced.background;
    if (!hasChanges) return;
    if (draft.name.length < 2) { setError("Board name must be at least 2 characters."); return; }
    setIsAutosavingBoard(true);
    try {
      const updated = await updateBoard(boardId, {
        name: draft.name,
        description: draft.description,
        background: draft.background
      });
      hydrateBoardState(updated);
      setError(null);
      triggerSavedNotice();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update board");
    } finally {
      setIsAutosavingBoard(false);
    }
  }, [boardId, hydrateBoardState, triggerSavedNotice]);

  const runListNameAutosave = useCallback(async (listId: string, rawName: string): Promise<void> => {
    const name = rawName.trim();
    const syncedName = listSyncedNamesRef.current[listId];
    if (syncedName === undefined) return;
    if (name.length < 1) { setError("List name cannot be empty."); return; }
    if (name === syncedName) return;
    setListSavingIds((c) => new Set(c).add(listId));
    try {
      const updated = await updateList(listId, { name });
      listSyncedNamesRef.current[updated.id] = updated.name;
      setBoard((current) => {
        if (!current) return current;
        return {
          ...current,
          lists: current.lists.map((list) =>
            list.id === updated.id ? { ...updated, cards: list.cards } : list
          )
        };
      });
      setListNameDrafts((c) => ({ ...c, [updated.id]: updated.name }));
      setError(null);
      triggerSavedNotice();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update list");
    } finally {
      setListSavingIds((c) => { const n = new Set(c); n.delete(listId); return n; });
    }
  }, [triggerSavedNotice]);

  const scheduleListNameAutosave = useCallback((listId: string, draftName: string): void => {
    clearListAutosaveTimeout(listId);
    listAutoSaveTimeoutsRef.current[listId] = window.setTimeout(() => {
      void runListNameAutosave(listId, draftName);
    }, AUTO_SAVE_DELAY_MS);
  }, [runListNameAutosave]);

  useEffect(() => {
    if (!initializedBoardRef.current || !boardId) return;
    const nextDraft: BoardDraft = {
      name: boardName.trim(),
      description: boardDescription.trim(),
      background: boardBackground
    };
    currentDraftBoardRef.current = nextDraft;
    const synced = lastSyncedBoardRef.current;
    const hasChanges =
      synced !== null &&
      (nextDraft.name !== synced.name ||
        nextDraft.description !== synced.description ||
        nextDraft.background !== synced.background);
    if (!hasChanges) return;
    setShowSavedNotice(false);
    clearSavedNoticeTimers();
    if (autoSaveTimeoutRef.current !== null) window.clearTimeout(autoSaveTimeoutRef.current);
    autoSaveTimeoutRef.current = window.setTimeout(() => { void runBoardAutosave(); }, AUTO_SAVE_DELAY_MS);
    return () => {
      if (autoSaveTimeoutRef.current !== null) {
        window.clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
    };
  }, [boardId, boardName, boardDescription, boardBackground, runBoardAutosave, clearSavedNoticeTimers]);

  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current !== null) window.clearTimeout(autoSaveTimeoutRef.current);
      clearAllListAutosaveTimeouts();
      clearSavedNoticeTimers();
    };
  }, [clearSavedNoticeTimers]);

  // -------------------------------------------------------------------------
  // dnd-kit card drag handlers
  // -------------------------------------------------------------------------

  const onCardDragStart = useCallback((event: DragStartEvent): void => {
    setActiveCardId(event.active.id as string);
    // Snapshot the board before any drag changes so we can revert on error
    preDragListsRef.current = board?.lists ?? null;
  }, [board]);

  /**
   * Fires while dragging over a different list — move the card there optimistically
   * so the SortableContext in the destination list re-renders immediately.
   */
  const onCardDragOver = useCallback((event: DragOverEvent): void => {
    const { active, over } = event;
    if (!over || !board) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    const sourceList = board.lists.find((l) => l.cards.some((c) => c.id === activeId));
    // over.id can be a card ID or a list ID (ListDropZone)
    const destList = board.lists.find(
      (l) => l.id === overId || l.cards.some((c) => c.id === overId)
    );

    if (!sourceList || !destList || sourceList.id === destList.id) return;

    const movingCard = sourceList.cards.find((c) => c.id === activeId);
    if (!movingCard) return;

    const overCardIndex = destList.cards.findIndex((c) => c.id === overId);
    // If hovering directly over the list zone (not a card), append to end
    const insertAt = overCardIndex >= 0 ? overCardIndex : destList.cards.length;

    setBoard((current) => {
      if (!current) return current;

      const newSourceCards = sourceList.cards
        .filter((c) => c.id !== activeId)
        .map((c, i) => ({ ...c, position: i }));

      const newDestCards = [...destList.cards];
      newDestCards.splice(insertAt, 0, { ...movingCard, listId: destList.id });
      const normalizedDestCards = newDestCards.map((c, i) => ({ ...c, position: i }));

      return {
        ...current,
        lists: current.lists.map((l) => {
          if (l.id === sourceList.id) return { ...l, cards: newSourceCards };
          if (l.id === destList.id) return { ...l, cards: normalizedDestCards };
          return l;
        })
      };
    });
  }, [board]);

  /**
   * Fires when the user releases the card.
   * - Same-list: uses arrayMove to finalise ordering, then calls the API.
   * - Cross-list: card already moved optimistically; just call the API.
   */
  const onCardDragEnd = useCallback(async (event: DragEndEvent): Promise<void> => {
    const { active, over } = event;
    const prevLists = preDragListsRef.current;

    setActiveCardId(null);
    preDragListsRef.current = null;

    if (!over || !board || !boardId) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find which list has this card right now (may have changed in onCardDragOver)
    const currentList = board.lists.find((l) => l.cards.some((c) => c.id === activeId));
    if (!currentList) return;

    // Handle same-list reordering (cross-list was already done in onCardDragOver)
    let finalCards = currentList.cards;
    const activeIndex = currentList.cards.findIndex((c) => c.id === activeId);
    const overIndex = currentList.cards.findIndex((c) => c.id === overId);

    if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
      finalCards = arrayMove(currentList.cards, activeIndex, overIndex).map((c, i) => ({
        ...c,
        position: i
      }));
      setBoard((current) => {
        if (!current) return current;
        return {
          ...current,
          lists: current.lists.map((l) =>
            l.id === currentList.id ? { ...l, cards: finalCards } : l
          )
        };
      });
    }

    // Figure out original source list from pre-drag snapshot
    const originalSourceList = prevLists?.find((l) => l.cards.some((c) => c.id === activeId));
    if (!originalSourceList) return;

    const destinationIndex = finalCards.findIndex((c) => c.id === activeId);
    if (destinationIndex < 0) return;

    // Skip API call if nothing actually changed
    const originalIndex = originalSourceList.cards.findIndex((c) => c.id === activeId);
    if (originalSourceList.id === currentList.id && originalIndex === destinationIndex) return;

    try {
      const moved = await moveCard({
        cardId: activeId,
        sourceListId: originalSourceList.id,
        destinationListId: currentList.id,
        destinationIndex,
      });

      setBoard((current) => {
        if (!current) return current;
        return {
          ...current,
          lists: current.lists.map((list) => {
            if (list.id === moved.sourceListId && list.id === moved.destinationListId) {
              return { ...list, cards: sortCardsByPosition(moved.sourceCards) };
            }
            if (list.id === moved.sourceListId) {
              return { ...list, cards: sortCardsByPosition(moved.sourceCards) };
            }
            if (list.id === moved.destinationListId) {
              return { ...list, cards: sortCardsByPosition(moved.destinationCards) };
            }
            return list;
          })
        };
      });

      setError(null);
      triggerSavedNotice();
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : "Failed to move card");
      // Revert to pre-drag state
      if (prevLists) {
        setBoard((current) => (current ? { ...current, lists: prevLists } : current));
      }
    }
  }, [board, boardId, triggerSavedNotice]);

  // -------------------------------------------------------------------------
  // List drag (HTML5 DnD — unchanged)
  // -------------------------------------------------------------------------
  const onDropList = async (targetListId: string): Promise<void> => {
    if (!boardId || !board || !draggingListId) return;
    if (draggingListId === targetListId) return;
    const currentIds = orderedLists.map((list) => list.id);
    const nextIds = moveListIds(currentIds, draggingListId, targetListId);
    if (currentIds.join(":") === nextIds.join(":")) return;
    const byId = new Map(board.lists.map((list) => [list.id, list]));
    const optimisticLists = nextIds
      .map((id, index) => { const found = byId.get(id); return found ? { ...found, position: index } : null; })
      .filter((list): list is BoardList => list !== null);
    const previousLists = board.lists;
    setBoard((current) => current ? { ...current, lists: optimisticLists } : current);
    try {
      const updatedLists = await reorderLists(boardId, nextIds);
      setBoard((current) => current ? { ...current, lists: sortBoardListsWithCards(updatedLists) } : current);
      setError(null);
      triggerSavedNotice();
    } catch (reorderError) {
      setError(reorderError instanceof Error ? reorderError.message : "Failed to reorder lists");
      setBoard((current) => current ? { ...current, lists: previousLists } : current);
    }
  };

  // -------------------------------------------------------------------------
  // CRUD handlers
  // -------------------------------------------------------------------------
  const onDeleteBoard = async (): Promise<void> => {
    if (!boardId) return;
    try {
      await deleteBoard(boardId);
      navigate("/boards");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete board");
    }
  };

  const onCreateList = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!boardId) return;
    if (newListName.trim().length < 1) { setError("List name cannot be empty."); return; }
    try {
      const created = await createList(boardId, { name: newListName.trim(), isDoneList: newListDone });
      listSyncedNamesRef.current[created.id] = created.name;
      setBoard((current) => {
        if (!current) return current;
        return { ...current, lists: sortBoardListsWithCards([...current.lists, { ...created, cards: [] }]) };
      });
      setListNameDrafts((c) => ({ ...c, [created.id]: created.name }));
      setNewCardTitles((c) => ({ ...c, [created.id]: "" }));
      setNewListName("");
      setNewListDone(false);
      setError(null);
      triggerSavedNotice();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create list");
    }
  };

  const onToggleDone = async (listId: string, isDoneList: boolean): Promise<void> => {
    try {
      const updated = await updateList(listId, { isDoneList: !isDoneList });
      setBoard((current) => {
        if (!current) return current;
        return { ...current, lists: current.lists.map((list) => list.id === updated.id ? { ...updated, cards: list.cards } : list) };
      });
      setError(null);
      triggerSavedNotice();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update list");
    }
  };

  const closeListEditor = useCallback(async (list: BoardList): Promise<void> => {
    if (editingListId !== list.id) return;
    const draft = listNameDrafts[list.id] ?? list.name;
    const trimmed = draft.trim();
    if (trimmed.length < 1) {
      const syncedName = listSyncedNamesRef.current[list.id] ?? list.name;
      setListNameDrafts((c) => ({ ...c, [list.id]: syncedName }));
      setEditingListId(null);
      setError("List name cannot be empty.");
      return;
    }
    setEditingListId(null);
    clearListAutosaveTimeout(list.id);
    await runListNameAutosave(list.id, draft);
  }, [editingListId, listNameDrafts, runListNameAutosave]);

  const cancelListEditor = useCallback((list: BoardList): void => {
    clearListAutosaveTimeout(list.id);
    const syncedName = listSyncedNamesRef.current[list.id] ?? list.name;
    setListNameDrafts((c) => ({ ...c, [list.id]: syncedName }));
    setEditingListId(null);
  }, []);

  const onToggleListEdit = async (list: BoardList): Promise<void> => {
    if (editingListId === list.id) { await closeListEditor(list); return; }
    setEditingListId(list.id);
  };

  const onDeleteList = async (): Promise<void> => {
    if (!listToDelete) return;
    try {
      await deleteList(listToDelete.id);
      clearListAutosaveTimeout(listToDelete.id);
      delete listSyncedNamesRef.current[listToDelete.id];
      setBoard((current) => {
        if (!current) return current;
        return { ...current, lists: current.lists.filter((list) => list.id !== listToDelete.id) };
      });
      setListNameDrafts((c) => { const n = { ...c }; delete n[listToDelete.id]; return n; });
      setNewCardTitles((c) => { const n = { ...c }; delete n[listToDelete.id]; return n; });
      setListSavingIds((c) => { const n = new Set(c); n.delete(listToDelete.id); return n; });
      if (editingListId === listToDelete.id) setEditingListId(null);
      setListToDelete(null);
      setError(null);
      triggerSavedNotice();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete list");
    }
  };

  const onCreateCard = async (listId: string, event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const title = (newCardTitles[listId] ?? "").trim();
    if (title.length < 1) { setError("Card title cannot be empty."); return; }
    try {
      const created = await createCard(listId, { title });
      setBoard((current) => {
        if (!current) return current;
        return {
          ...current,
          lists: current.lists.map((list) => {
            if (list.id !== listId) return list;
            return { ...list, cards: sortCardsByPosition([...list.cards, created]) };
          })
        };
      });
      setNewCardTitles((c) => ({ ...c, [listId]: "" }));
      setError(null);
      triggerSavedNotice();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create card");
    }
  };

  const openCardEditor = (card: BoardCard): void => {
    setSelectedCardId(card.id);
    setCardDraft(buildCardDraft(card));
  };

  const closeCardEditor = (): void => {
    setSelectedCardId(null);
    setCardDraft(null);
    setIsCardSaving(false);
  };

  const onSaveCard = async (): Promise<void> => {
    if (!selectedCardWithList || !cardDraft) return;
    const title = cardDraft.title.trim();
    if (title.length < 1) { setError("Card title cannot be empty."); return; }
    const dueDateIso = toIsoFromDateTimeInput(cardDraft.dueDate);
    setIsCardSaving(true);
    try {
      const updated = await updateCard(selectedCardWithList.card.id, {
        title,
        description: trimOrNull(cardDraft.description),
        priority: cardDraft.priority,
        dueDate: dueDateIso
      });
      setBoard((current) => {
        if (!current) return current;
        return {
          ...current,
          lists: current.lists.map((list) => {
            if (list.id !== updated.listId) return list;
            return { ...list, cards: sortCardsByPosition(list.cards.map((card) => card.id === updated.id ? updated : card)) };
          })
        };
      });
      setCardDraft(buildCardDraft(updated));
      setError(null);
      triggerSavedNotice();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update card");
    } finally {
      setIsCardSaving(false);
    }
  };

  const onDeleteCard = async (): Promise<void> => {
    if (!cardToDelete) return;
    try {
      await deleteCard(cardToDelete.id);
      setBoard((current) => {
        if (!current) return current;
        return {
          ...current,
          lists: current.lists.map((list) => {
            if (list.id !== cardToDelete.listId) return list;
            const nextCards = list.cards
              .filter((card) => card.id !== cardToDelete.id)
              .map((card, index) => ({ ...card, position: index }));
            return { ...list, cards: nextCards };
          })
        };
      });
      if (selectedCardId === cardToDelete.id) closeCardEditor();
      setCardToDelete(null);
      setError(null);
      triggerSavedNotice();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete card");
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading board...</p>;
  }

  if (!board) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Board not found</CardTitle>
          <CardDescription>The board may have been deleted or is unavailable.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/boards">
            <Button type="button">Back to boards</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className={`-mx-4 -my-4 space-y-6 px-4 py-4 lg:-mx-6 lg:-my-6 lg:px-6 lg:py-6 ${activeSurfaceClass}`}>
        <div className={`h-28 rounded-xl ${activeBannerClass}`} />

        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{boardName}</h2>
            <p className="text-sm text-muted-foreground">Cards are now live: create, drag, and edit in place.</p>
          </div>
          <Link to="/boards">
            <Button type="button" variant="ghost">Back to boards</Button>
          </Link>
        </div>

        {error && (
          <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Create List</CardTitle>
            <CardDescription>Add a new column to this board.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 sm:grid-cols-[1fr_auto_auto]" onSubmit={onCreateList}>
              <Input
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="List name"
              />
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={newListDone} onChange={(e) => setNewListDone(e.target.checked)} />
                Done list
              </label>
              <Button type="submit">Add list</Button>
            </form>
          </CardContent>
        </Card>

        <div>
          <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">Drag lists to reorder</p>

          {/* DndContext wraps all lists so cards can drag across them */}
          <DndContext
            sensors={cardSensors}
            collisionDetection={closestCenter}
            onDragStart={onCardDragStart}
            onDragOver={onCardDragOver}
            onDragEnd={(e) => { void onCardDragEnd(e); }}
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {orderedLists.map((list) => (
                <div
                  key={list.id}
                  data-list-id={list.id}
                  data-testid={`list-${list.id}`}
                  className={dragOverListId === list.id ? "rounded-lg ring-2 ring-primary/40" : ""}
                  onDragOver={(event) => {
                    // HTML5 DnD — list reordering only
                    if (!draggingListId) return;
                    event.preventDefault();
                    if (draggingListId !== list.id) setDragOverListId(list.id);
                  }}
                  onDrop={(event) => {
                    if (!draggingListId) return;
                    event.preventDefault();
                    void onDropList(list.id);
                    setDragOverListId(null);
                    setDraggingListId(null);
                  }}
                >
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base font-semibold">
                          {listNameDrafts[list.id] ?? list.name}
                        </CardTitle>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button" variant="ghost" size="sm" className="h-8 w-8 p-0"
                            onClick={() => { void onToggleListEdit(list); }}
                            title={editingListId === list.id ? "Done editing" : "Edit list name"}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button" variant="ghost" size="sm"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            onClick={() => setListToDelete(list)}
                            title="Delete list"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          {/* HTML5 drag handle for list reordering */}
                          <button
                            type="button"
                            draggable
                            onDragStart={() => setDraggingListId(list.id)}
                            onDragEnd={() => { setDraggingListId(null); setDragOverListId(null); }}
                            className="rounded-md p-1 text-muted-foreground hover:bg-secondary/70"
                            title="Drag to reorder list"
                          >
                            <GripVertical className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      {editingListId === list.id && (
                        <div className="space-y-2">
                          <Input
                            ref={(node) => { listInputRefs.current[list.id] = node; }}
                            value={listNameDrafts[list.id] ?? list.name}
                            onChange={(e) => {
                              const value = e.target.value;
                              setListNameDrafts((c) => ({ ...c, [list.id]: value }));
                              scheduleListNameAutosave(list.id, value);
                            }}
                            onBlur={() => { void closeListEditor(list); }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); void closeListEditor(list); }
                              if (e.key === "Escape") { e.preventDefault(); cancelListEditor(list); }
                            }}
                          />
                          <p className="text-xs text-muted-foreground">
                            {listSavingIds.has(list.id) ? "Saving..." : "Autosaves after a short pause."}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{list.isDoneList ? "Done list" : "Active list"}</span>
                        <button type="button" className="underline underline-offset-2"
                          onClick={() => void onToggleDone(list.id, list.isDoneList)}>
                          Toggle
                        </button>
                      </div>

                      {/* Card list — wrapped in SortableContext for this list */}
                      <SortableContext
                        items={list.cards.map((c) => c.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2 rounded-md border border-dashed border-border/70 p-2">
                          {list.cards.length === 0 ? (
                            <ListDropZone listId={list.id} />
                          ) : (
                            list.cards.map((card) => (
                              <SortableCard
                                key={card.id}
                                card={card}
                                onEdit={openCardEditor}
                                onDeleteRequest={(c) => setCardToDelete(c)}
                              />
                            ))
                          )}
                        </div>
                      </SortableContext>

                      <form
                        className="grid gap-2 sm:grid-cols-[1fr_auto]"
                        onSubmit={(e) => { void onCreateCard(list.id, e); }}
                      >
                        <Input
                          value={newCardTitles[list.id] ?? ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            setNewCardTitles((c) => ({ ...c, [list.id]: value }));
                          }}
                          placeholder="New card title"
                        />
                        <Button type="submit" className="gap-1">
                          <Plus className="h-4 w-4" />
                          Add Card
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>

            {/* The floating card that follows your cursor */}
            <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
              {activeCard ? (
                <div className="rotate-1 rounded-md border border-border/70 bg-background px-3 py-2 shadow-2xl opacity-95 ring-2 ring-primary/30">
                  <CardSummary card={activeCard} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Board Settings</CardTitle>
                <CardDescription>Collapsed by default so list work stays front and center.</CardDescription>
              </div>
              <Button
                type="button" variant="secondary" size="sm"
                onClick={() => setIsSettingsOpen((c) => !c)}
                className="gap-1"
              >
                {isSettingsOpen ? (<>Hide <ChevronUp className="h-4 w-4" /></>) : (<>Show <ChevronDown className="h-4 w-4" /></>)}
              </Button>
            </div>
          </CardHeader>

          {isSettingsOpen && (
            <CardContent className="space-y-4">
              <Input value={boardName} onChange={(e) => setBoardName(e.target.value)} />
              <textarea
                value={boardDescription}
                onChange={(e) => setBoardDescription(e.target.value)}
                placeholder="Description"
                className="min-h-[88px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
              />
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {boardBackgroundPresets.map((preset) => (
                  <button
                    key={preset.id} type="button"
                    onClick={() => setBoardBackground(preset.id)}
                    className={`overflow-hidden rounded-md border text-left ${boardBackground === preset.id ? "border-primary ring-2 ring-primary/40" : "border-border"}`}
                  >
                    <div className={`h-10 ${preset.className}`} />
                    <p className="px-2 py-1 text-[11px] text-muted-foreground">{preset.label}</p>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {isAutosavingBoard ? "Saving..." : "Changes save automatically"}
                </p>
                <Button type="button" variant="ghost" onClick={() => setIsDeleteBoardOpen(true)}>
                  Delete board
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Card editor modal */}
      {selectedCardWithList && cardDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle>Edit Card</CardTitle>
              <CardDescription>{selectedCardWithList.list.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Title</p>
                <Input
                  value={cardDraft.title}
                  onChange={(e) => { const v = e.target.value; setCardDraft((c) => c ? { ...c, title: v } : c); }}
                  placeholder="Card title"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Description</p>
                <textarea
                  value={cardDraft.description}
                  onChange={(e) => { const v = e.target.value; setCardDraft((c) => c ? { ...c, description: v } : c); }}
                  placeholder="Describe the task"
                  className="min-h-[140px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="text-xs text-muted-foreground">Priority</span>
                  <select
                    value={cardDraft.priority}
                    onChange={(e) => { const v = e.target.value as CardPriority; setCardDraft((c) => c ? { ...c, priority: v } : c); }}
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-xs text-muted-foreground">Due date</span>
                  <Input
                    type="datetime-local"
                    value={cardDraft.dueDate}
                    onChange={(e) => { const v = e.target.value; setCardDraft((c) => c ? { ...c, dueDate: v } : c); }}
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button type="button" variant="ghost" className="text-red-600 hover:text-red-700"
                  onClick={() => setCardToDelete(selectedCardWithList.card)}>
                  <Trash2 className="mr-1 h-4 w-4" />
                  Delete card
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={closeCardEditor}>Close</Button>
                  <Button type="button" onClick={() => void onSaveCard()} disabled={isCardSaving}>
                    {isCardSaving ? "Saving..." : "Save changes"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showSavedNotice && (
        <div className="pointer-events-none fixed bottom-5 right-5 z-40 rounded-full border border-emerald-300/60 bg-emerald-100/90 px-4 py-2 text-sm font-medium text-emerald-900 shadow-lg backdrop-blur">
          Saved
        </div>
      )}

      <ConfirmDialog
        open={isDeleteBoardOpen}
        title="Delete board"
        description={`Delete "${board.name}" and all its lists? This cannot be undone.`}
        confirmLabel="Delete" cancelLabel="Keep"
        onCancel={() => setIsDeleteBoardOpen(false)}
        onConfirm={() => { setIsDeleteBoardOpen(false); void onDeleteBoard(); }}
      />
      <ConfirmDialog
        open={cardToDelete !== null}
        title="Delete card"
        description={`Delete "${cardToDelete?.title ?? "this card"}"?`}
        confirmLabel="Delete" cancelLabel="Keep"
        onCancel={() => setCardToDelete(null)}
        onConfirm={() => { void onDeleteCard(); }}
      />
      <ConfirmDialog
        open={listToDelete !== null}
        title="Delete list"
        description={`Delete "${listToDelete?.name ?? "this list"}"?`}
        confirmLabel="Delete" cancelLabel="Keep"
        onCancel={() => setListToDelete(null)}
        onConfirm={() => { void onDeleteList(); }}
      />
    </>
  );
}