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

interface DraggingCardState {
  cardId: string;
  sourceListId: string;
}

interface CardDropTarget {
  listId: string;
  destinationIndex: number;
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

function clampIndex(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

function formatDueDateForInput(value: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function toIsoFromDateTimeInput(value: string): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function formatDueDateLabel(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function getPriorityBadgeClass(priority: CardPriority): string {
  switch (priority) {
    case "low":
      return "border-emerald-400/50 bg-emerald-100/75 text-emerald-900";
    case "medium":
      return "border-sky-400/50 bg-sky-100/75 text-sky-900";
    case "high":
      return "border-amber-400/50 bg-amber-100/75 text-amber-900";
    case "urgent":
      return "border-rose-400/50 bg-rose-100/75 text-rose-900";
    default:
      return "border-border bg-secondary text-secondary-foreground";
  }
}

function getPriorityLabel(priority: CardPriority): string {
  switch (priority) {
    case "low":
      return "Low";
    case "medium":
      return "Medium";
    case "high":
      return "High";
    case "urgent":
      return "Urgent";
    default:
      return priority;
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
  if (!board || !cardId) {
    return null;
  }

  for (const list of board.lists) {
    const card = list.cards.find((item) => item.id === cardId);
    if (card) {
      return { card, list };
    }
  }

  return null;
}

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

  const [draggingListId, setDraggingListId] = useState<string | null>(null);
  const [dragOverListId, setDragOverListId] = useState<string | null>(null);

  const [draggingCard, setDraggingCard] = useState<DraggingCardState | null>(null);
  const [cardDropTarget, setCardDropTarget] = useState<CardDropTarget | null>(null);

  const [isAutosavingBoard, setIsAutosavingBoard] = useState(false);
  const [listSavingIds, setListSavingIds] = useState<Set<string>>(new Set());
  const [showSavedNotice, setShowSavedNotice] = useState(false);

  const autoSaveTimeoutRef = useRef<number | null>(null);
  const listAutoSaveTimeoutsRef = useRef<Record<string, number>>({});
  const listInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const savedShowTimeoutRef = useRef<number | null>(null);
  const savedHideTimeoutRef = useRef<number | null>(null);
  const suppressCardClickRef = useRef(false);

  const lastSyncedBoardRef = useRef<BoardDraft | null>(null);
  const currentDraftBoardRef = useRef<BoardDraft | null>(null);
  const listSyncedNamesRef = useRef<Record<string, string>>({});
  const initializedBoardRef = useRef(false);

  const orderedLists = useMemo(() => {
    return board ? sortBoardListsWithCards(board.lists) : [];
  }, [board]);

  const selectedCardWithList = useMemo(() => getCardFromBoard(board, selectedCardId), [board, selectedCardId]);

  const activeBannerClass = useMemo(() => {
    return getBoardBackgroundClass(boardBackground);
  }, [boardBackground]);

  const activeSurfaceClass = useMemo(() => {
    return getBoardSurfaceClass(boardBackground);
  }, [boardBackground]);

  const focusListInput = useCallback((listId: string): void => {
    window.requestAnimationFrame(() => {
      const input = listInputRefs.current[listId];
      if (!input) {
        return;
      }

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
    Object.values(listAutoSaveTimeoutsRef.current).forEach((timeout) => {
      window.clearTimeout(timeout);
    });

    listAutoSaveTimeoutsRef.current = {};
  };

  const hydrateBoardState = useCallback((data: BoardDetail): void => {
    const sortedLists = sortBoardListsWithCards(data.lists);

    setBoard({
      ...data,
      lists: sortedLists
    });

    setBoardName(data.name);
    setBoardDescription(data.description ?? "");
    setBoardBackground(data.background);
    setListNameDrafts(Object.fromEntries(sortedLists.map((list) => [list.id, list.name])));

    setNewCardTitles((current) => {
      const next = { ...current };
      for (const list of sortedLists) {
        if (next[list.id] === undefined) {
          next[list.id] = "";
        }
      }
      for (const key of Object.keys(next)) {
        if (!sortedLists.some((list) => list.id === key)) {
          delete next[key];
        }
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
      if (!current) {
        return current;
      }

      return sortedLists.some((list) => list.id === current) ? current : null;
    });
  }, []);

  const loadBoard = useCallback(async (): Promise<void> => {
    if (!boardId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getBoardById(boardId);
      hydrateBoardState(data);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load board";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [boardId, hydrateBoardState]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    if (!editingListId) {
      return;
    }

    focusListInput(editingListId);
  }, [editingListId, focusListInput]);

  useEffect(() => {
    if (!selectedCardId) {
      return;
    }

    if (!selectedCardWithList) {
      setSelectedCardId(null);
      setCardDraft(null);
    }
  }, [selectedCardId, selectedCardWithList]);

  const runBoardAutosave = useCallback(async (): Promise<void> => {
    if (!boardId) {
      return;
    }

    const draft = currentDraftBoardRef.current;
    const synced = lastSyncedBoardRef.current;

    if (!draft || !synced) {
      return;
    }

    const hasChanges =
      draft.name !== synced.name || draft.description !== synced.description || draft.background !== synced.background;

    if (!hasChanges) {
      return;
    }

    if (draft.name.length < 2) {
      setError("Board name must be at least 2 characters.");
      return;
    }

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
      const message = updateError instanceof Error ? updateError.message : "Failed to update board";
      setError(message);
    } finally {
      setIsAutosavingBoard(false);
    }
  }, [boardId, hydrateBoardState, triggerSavedNotice]);

  const runListNameAutosave = useCallback(
    async (listId: string, rawName: string): Promise<void> => {
      const name = rawName.trim();
      const syncedName = listSyncedNamesRef.current[listId];

      if (syncedName === undefined) {
        return;
      }

      if (name.length < 1) {
        setError("List name cannot be empty.");
        return;
      }

      if (name === syncedName) {
        return;
      }

      setListSavingIds((current) => {
        const next = new Set(current);
        next.add(listId);
        return next;
      });

      try {
        const updated = await updateList(listId, { name });

        listSyncedNamesRef.current[updated.id] = updated.name;

        setBoard((current) => {
          if (!current) {
            return current;
          }

          return {
            ...current,
            lists: current.lists.map((list) => (list.id === updated.id ? { ...updated, cards: list.cards } : list))
          };
        });

        setListNameDrafts((current) => ({
          ...current,
          [updated.id]: updated.name
        }));

        setError(null);
      triggerSavedNotice();
      } catch (updateError) {
        const message = updateError instanceof Error ? updateError.message : "Failed to update list";
        setError(message);
      } finally {
        setListSavingIds((current) => {
          const next = new Set(current);
          next.delete(listId);
          return next;
        });
      }
    },
    [triggerSavedNotice]
  );

  const scheduleListNameAutosave = useCallback(
    (listId: string, draftName: string): void => {
      clearListAutosaveTimeout(listId);

      listAutoSaveTimeoutsRef.current[listId] = window.setTimeout(() => {
        void runListNameAutosave(listId, draftName);
      }, AUTO_SAVE_DELAY_MS);
    },
    [runListNameAutosave]
  );

  useEffect(() => {
    if (!initializedBoardRef.current || !boardId) {
      return;
    }

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

    if (!hasChanges) {
      return;
    }

    setShowSavedNotice(false);
    clearSavedNoticeTimers();

    if (autoSaveTimeoutRef.current !== null) {
      window.clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = window.setTimeout(() => {
      void runBoardAutosave();
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      if (autoSaveTimeoutRef.current !== null) {
        window.clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
    };
  }, [boardId, boardName, boardDescription, boardBackground, runBoardAutosave, clearSavedNoticeTimers]);

  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current !== null) {
        window.clearTimeout(autoSaveTimeoutRef.current);
      }

      clearAllListAutosaveTimeouts();
      clearSavedNoticeTimers();
    };
  }, [clearSavedNoticeTimers]);

  const onDeleteBoard = async (): Promise<void> => {
    if (!boardId) {
      return;
    }

    try {
      await deleteBoard(boardId);
      navigate("/boards");
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Failed to delete board";
      setError(message);
    }
  };

  const onCreateList = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!boardId) {
      return;
    }

    if (newListName.trim().length < 1) {
      setError("List name cannot be empty.");
      return;
    }

    try {
      const created = await createList(boardId, {
        name: newListName.trim(),
        isDoneList: newListDone
      });

      listSyncedNamesRef.current[created.id] = created.name;

      setBoard((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          lists: sortBoardListsWithCards([...current.lists, { ...created, cards: [] }])
        };
      });

      setListNameDrafts((current) => ({
        ...current,
        [created.id]: created.name
      }));

      setNewCardTitles((current) => ({
        ...current,
        [created.id]: ""
      }));

      setNewListName("");
      setNewListDone(false);
      setError(null);
      triggerSavedNotice();
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Failed to create list";
      setError(message);
    }
  };

  const onToggleDone = async (listId: string, isDoneList: boolean): Promise<void> => {
    try {
      const updated = await updateList(listId, {
        isDoneList: !isDoneList
      });

      setBoard((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          lists: current.lists.map((list) => (list.id === updated.id ? { ...updated, cards: list.cards } : list))
        };
      });

      setError(null);
      triggerSavedNotice();
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "Failed to update list";
      setError(message);
    }
  };

  const closeListEditor = useCallback(
    async (list: BoardList): Promise<void> => {
      if (editingListId !== list.id) {
        return;
      }

      const draft = listNameDrafts[list.id] ?? list.name;
      const trimmed = draft.trim();

      if (trimmed.length < 1) {
        const syncedName = listSyncedNamesRef.current[list.id] ?? list.name;
        setListNameDrafts((current) => ({
          ...current,
          [list.id]: syncedName
        }));
        setEditingListId(null);
        setError("List name cannot be empty.");
        return;
      }

      setEditingListId(null);
      clearListAutosaveTimeout(list.id);
      await runListNameAutosave(list.id, draft);
    },
    [editingListId, listNameDrafts, runListNameAutosave]
  );

  const cancelListEditor = useCallback((list: BoardList): void => {
    clearListAutosaveTimeout(list.id);
    const syncedName = listSyncedNamesRef.current[list.id] ?? list.name;
    setListNameDrafts((current) => ({
      ...current,
      [list.id]: syncedName
    }));
    setEditingListId(null);
  }, []);

  const onToggleListEdit = async (list: BoardList): Promise<void> => {
    if (editingListId === list.id) {
      await closeListEditor(list);
      return;
    }

    setEditingListId(list.id);
  };

  const onDeleteList = async (): Promise<void> => {
    if (!listToDelete) {
      return;
    }

    try {
      await deleteList(listToDelete.id);

      clearListAutosaveTimeout(listToDelete.id);
      delete listSyncedNamesRef.current[listToDelete.id];

      setBoard((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          lists: current.lists.filter((list) => list.id !== listToDelete.id)
        };
      });

      setListNameDrafts((current) => {
        const nextDrafts = { ...current };
        delete nextDrafts[listToDelete.id];
        return nextDrafts;
      });

      setNewCardTitles((current) => {
        const nextDrafts = { ...current };
        delete nextDrafts[listToDelete.id];
        return nextDrafts;
      });

      setListSavingIds((current) => {
        const next = new Set(current);
        next.delete(listToDelete.id);
        return next;
      });

      if (editingListId === listToDelete.id) {
        setEditingListId(null);
      }

      setListToDelete(null);
      setError(null);
      triggerSavedNotice();
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Failed to delete list";
      setError(message);
    }
  };

  const onDropList = async (targetListId: string): Promise<void> => {
    if (!boardId || !board || !draggingListId || draggingCard) {
      return;
    }

    if (draggingListId === targetListId) {
      return;
    }

    const currentIds = orderedLists.map((list) => list.id);
    const nextIds = moveListIds(currentIds, draggingListId, targetListId);

    if (currentIds.join(":") === nextIds.join(":")) {
      return;
    }

    const byId = new Map(board.lists.map((list) => [list.id, list]));
    const optimisticLists = nextIds
      .map((id, index) => {
        const found = byId.get(id);
        if (!found) {
          return null;
        }

        return {
          ...found,
          position: index
        };
      })
      .filter((list): list is BoardList => list !== null);

    const previousLists = board.lists;

    setBoard((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        lists: optimisticLists
      };
    });

    try {
      const updatedLists = await reorderLists(boardId, nextIds);

      setBoard((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          lists: sortBoardListsWithCards(updatedLists)
        };
      });

      setError(null);
      triggerSavedNotice();
    } catch (reorderError) {
      const message = reorderError instanceof Error ? reorderError.message : "Failed to reorder lists";
      setError(message);

      setBoard((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          lists: previousLists
        };
      });
    }
  };
  const onCreateCard = async (listId: string, event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    const title = (newCardTitles[listId] ?? "").trim();
    if (title.length < 1) {
      setError("Card title cannot be empty.");
      return;
    }

    try {
      const created = await createCard(listId, { title });

      setBoard((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          lists: current.lists.map((list) => {
            if (list.id !== listId) {
              return list;
            }

            return {
              ...list,
              cards: sortCardsByPosition([...list.cards, created])
            };
          })
        };
      });

      setNewCardTitles((current) => ({
        ...current,
        [listId]: ""
      }));

      setError(null);
      triggerSavedNotice();
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Failed to create card";
      setError(message);
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
    if (!selectedCardWithList || !cardDraft) {
      return;
    }

    const title = cardDraft.title.trim();
    if (title.length < 1) {
      setError("Card title cannot be empty.");
      return;
    }

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
        if (!current) {
          return current;
        }

        return {
          ...current,
          lists: current.lists.map((list) => {
            if (list.id !== updated.listId) {
              return list;
            }

            return {
              ...list,
              cards: sortCardsByPosition(list.cards.map((card) => (card.id === updated.id ? updated : card)))
            };
          })
        };
      });

      setCardDraft(buildCardDraft(updated));
      setError(null);
      triggerSavedNotice();
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "Failed to update card";
      setError(message);
    } finally {
      setIsCardSaving(false);
    }
  };

  const onDeleteCard = async (): Promise<void> => {
    if (!cardToDelete) {
      return;
    }

    try {
      await deleteCard(cardToDelete.id);

      setBoard((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          lists: current.lists.map((list) => {
            if (list.id !== cardToDelete.listId) {
              return list;
            }

            const nextCards = list.cards
              .filter((card) => card.id !== cardToDelete.id)
              .map((card, index) => ({
                ...card,
                position: index
              }));

            return {
              ...list,
              cards: nextCards
            };
          })
        };
      });

      if (selectedCardId === cardToDelete.id) {
        closeCardEditor();
      }

      setCardToDelete(null);
      setError(null);
      triggerSavedNotice();
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Failed to delete card";
      setError(message);
    }
  };
  const getMovePayload = (
    currentBoard: BoardDetail,
    targetListId: string,
    rawDestinationIndex: number
  ): {
    sourceListId: string;
    destinationListId: string;
    destinationIndex: number;
    sourceIndex: number;
  } | null => {
    if (!draggingCard) {
      return null;
    }

    const sourceList = currentBoard.lists.find((list) => list.id === draggingCard.sourceListId);
    const destinationList = currentBoard.lists.find((list) => list.id === targetListId);

    if (!sourceList || !destinationList) {
      return null;
    }

    const sourceIndex = sourceList.cards.findIndex((card) => card.id === draggingCard.cardId);

    if (sourceIndex < 0) {
      return null;
    }

    const isSameList = sourceList.id === destinationList.id;

    let destinationIndex = rawDestinationIndex;
    if (isSameList && rawDestinationIndex > sourceIndex) {
      destinationIndex -= 1;
    }

    const maxIndex = isSameList ? Math.max(sourceList.cards.length - 1, 0) : destinationList.cards.length;
    destinationIndex = clampIndex(destinationIndex, 0, maxIndex);

    return {
      sourceListId: sourceList.id,
      destinationListId: destinationList.id,
      destinationIndex,
      sourceIndex
    };
  };

  const applyOptimisticCardMove = (
    currentBoard: BoardDetail,
    sourceListId: string,
    destinationListId: string,
    destinationIndex: number,
    cardId: string
  ): BoardList[] | null => {
    const sourceList = currentBoard.lists.find((list) => list.id === sourceListId);
    const destinationList = currentBoard.lists.find((list) => list.id === destinationListId);

    if (!sourceList || !destinationList) {
      return null;
    }

    const sourceCards = [...sourceList.cards];
    const sourceIndex = sourceCards.findIndex((card) => card.id === cardId);

    if (sourceIndex < 0) {
      return null;
    }

    const [movingCard] = sourceCards.splice(sourceIndex, 1);
    const isSameList = sourceListId === destinationListId;

    const destinationCards = isSameList ? sourceCards : [...destinationList.cards];
    const boundedIndex = clampIndex(destinationIndex, 0, destinationCards.length);

    const nowIso = new Date().toISOString();
    let doneEnteredAt = movingCard.doneEnteredAt;

    if (!sourceList.isDoneList && destinationList.isDoneList) {
      doneEnteredAt = nowIso;
    } else if (sourceList.isDoneList && !destinationList.isDoneList) {
      doneEnteredAt = null;
    }

    destinationCards.splice(boundedIndex, 0, {
      ...movingCard,
      listId: destinationListId,
      doneEnteredAt,
      updatedAt: nowIso
    });

    const normalizedSourceCards = (isSameList ? destinationCards : sourceCards).map((card, index) => ({
      ...card,
      listId: sourceListId,
      position: index
    }));

    const normalizedDestinationCards = isSameList
      ? normalizedSourceCards
      : destinationCards.map((card, index) => ({
          ...card,
          listId: destinationListId,
          position: index
        }));

    return currentBoard.lists.map((list) => {
      if (list.id === sourceListId) {
        return {
          ...list,
          cards: normalizedSourceCards
        };
      }

      if (list.id === destinationListId) {
        return {
          ...list,
          cards: normalizedDestinationCards
        };
      }

      return list;
    });
  };

  const onDropCard = async (targetListId: string, rawDestinationIndex: number): Promise<void> => {
    if (!boardId || !board || !draggingCard) {
      return;
    }

    const payload = getMovePayload(board, targetListId, rawDestinationIndex);
    if (!payload) {
      return;
    }

    if (payload.sourceListId === payload.destinationListId && payload.sourceIndex === payload.destinationIndex) {
      return;
    }

    const previousLists = board.lists;
    const optimisticLists = applyOptimisticCardMove(
      board,
      payload.sourceListId,
      payload.destinationListId,
      payload.destinationIndex,
      draggingCard.cardId
    );

    if (optimisticLists) {
      setBoard((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          lists: sortBoardListsWithCards(optimisticLists)
        };
      });
    }

    try {
      const moved = await moveCard({
        cardId: draggingCard.cardId,
        sourceListId: payload.sourceListId,
        destinationListId: payload.destinationListId,
        destinationIndex: payload.destinationIndex
      });

      setBoard((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          lists: current.lists.map((list) => {
            if (list.id === moved.sourceListId && list.id === moved.destinationListId) {
              return {
                ...list,
                cards: sortCardsByPosition(moved.sourceCards)
              };
            }

            if (list.id === moved.sourceListId) {
              return {
                ...list,
                cards: sortCardsByPosition(moved.sourceCards)
              };
            }

            if (list.id === moved.destinationListId) {
              return {
                ...list,
                cards: sortCardsByPosition(moved.destinationCards)
              };
            }

            return list;
          })
        };
      });

      setError(null);
      triggerSavedNotice();
    } catch (moveError) {
      const message = moveError instanceof Error ? moveError.message : "Failed to move card";
      setError(message);

      setBoard((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          lists: previousLists
        };
      });
    }
  };

  const clearCardDragState = (): void => {
    setDraggingCard(null);
    setCardDropTarget(null);

    window.setTimeout(() => {
      suppressCardClickRef.current = false;
    }, 0);
  };

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
            <Button type="button" variant="ghost">
              Back to boards
            </Button>
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
                onChange={(event) => setNewListName(event.target.value)}
                placeholder="List name"
              />
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={newListDone}
                  onChange={(event) => setNewListDone(event.target.checked)}
                />
                Done list
              </label>
              <Button type="submit">Add list</Button>
            </form>
          </CardContent>
        </Card>

        <div>
          <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">Drag lists to reorder</p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {orderedLists.map((list) => (
              <div
                key={list.id}
                className={dragOverListId === list.id ? "rounded-lg ring-2 ring-primary/40" : ""}
                onDragOver={(event) => {
                  if (draggingCard || !draggingListId) {
                    return;
                  }

                  event.preventDefault();
                  if (draggingListId !== list.id) {
                    setDragOverListId(list.id);
                  }
                }}
                onDrop={(event) => {
                  if (!draggingListId || draggingCard) {
                    return;
                  }

                  event.preventDefault();
                  void onDropList(list.id);
                  setDragOverListId(null);
                  setDraggingListId(null);
                }}
              >
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base font-semibold">{listNameDrafts[list.id] ?? list.name}</CardTitle>

                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            void onToggleListEdit(list);
                          }}
                          title={editingListId === list.id ? "Done editing" : "Edit list name"}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          onClick={() => setListToDelete(list)}
                          title="Delete list"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>

                        <button
                          type="button"
                          draggable
                          onDragStart={() => setDraggingListId(list.id)}
                          onDragEnd={() => {
                            setDraggingListId(null);
                            setDragOverListId(null);
                          }}
                          className="rounded-md p-1 text-muted-foreground hover:bg-secondary/70"
                          title="Drag to reorder"
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
                          ref={(node) => {
                            listInputRefs.current[list.id] = node;
                          }}
                          value={listNameDrafts[list.id] ?? list.name}
                          onChange={(event) => {
                            const value = event.target.value;

                            setListNameDrafts((current) => ({
                              ...current,
                              [list.id]: value
                            }));

                            scheduleListNameAutosave(list.id, value);
                          }}
                          onBlur={() => {
                            void closeListEditor(list);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void closeListEditor(list);
                            }

                            if (event.key === "Escape") {
                              event.preventDefault();
                              cancelListEditor(list);
                            }
                          }}
                        />
                        <p className="text-xs text-muted-foreground">
                          {listSavingIds.has(list.id) ? "Saving..." : "Autosaves after a short pause."}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{list.isDoneList ? "Done list" : "Active list"}</span>
                      <button
                        type="button"
                        className="underline underline-offset-2"
                        onClick={() => void onToggleDone(list.id, list.isDoneList)}
                      >
                        Toggle
                      </button>
                    </div>

                    <div
                      className={`space-y-2 rounded-md border border-dashed border-border/70 p-2 ${
                        cardDropTarget?.listId === list.id ? "ring-2 ring-primary/25" : ""
                      }`}
                      onDragOver={(event) => {
                        if (!draggingCard) {
                          return;
                        }

                        event.preventDefault();
                        event.stopPropagation();

                        setCardDropTarget({
                          listId: list.id,
                          destinationIndex: list.cards.length
                        });
                      }}
                      onDrop={(event) => {
                        if (!draggingCard) {
                          return;
                        }

                        event.preventDefault();
                        event.stopPropagation();

                        void onDropCard(list.id, list.cards.length);
                        clearCardDragState();
                      }}
                    >
                      {list.cards.length === 0 ? (
                        <p className="rounded-md border border-border/50 bg-background/70 px-3 py-4 text-sm text-muted-foreground">
                          No cards yet. Add one below.
                        </p>
                      ) : (
                        list.cards.map((card, cardIndex) => {
                          const topDropActive =
                            draggingCard !== null &&
                            cardDropTarget?.listId === list.id &&
                            cardDropTarget.destinationIndex === cardIndex;

                          const bottomDropActive =
                            draggingCard !== null &&
                            cardDropTarget?.listId === list.id &&
                            cardDropTarget.destinationIndex === cardIndex + 1;

                          const dueLabel = formatDueDateLabel(card.dueDate);

                          return (
                            <div key={card.id} className="relative">
                              {topDropActive && (
                                <div className="absolute -top-1 left-1 right-1 h-0.5 rounded-full bg-primary" />
                              )}

                              <div
                                draggable
                                onDragStart={(event) => {
                                  event.stopPropagation();
                                  setDraggingCard({ cardId: card.id, sourceListId: list.id });
                                  setCardDropTarget(null);
                                  suppressCardClickRef.current = true;
                                  event.dataTransfer.effectAllowed = "move";
                                }}
                                onDragEnd={() => {
                                  clearCardDragState();
                                }}
                                onDragOver={(event) => {
                                  if (!draggingCard) {
                                    return;
                                  }

                                  event.preventDefault();
                                  event.stopPropagation();

                                  const bounds = event.currentTarget.getBoundingClientRect();
                                  const isBefore = event.clientY < bounds.top + bounds.height / 2;

                                  setCardDropTarget({
                                    listId: list.id,
                                    destinationIndex: isBefore ? cardIndex : cardIndex + 1
                                  });
                                }}
                                onDrop={(event) => {
                                  if (!draggingCard) {
                                    return;
                                  }

                                  event.preventDefault();
                                  event.stopPropagation();

                                  const bounds = event.currentTarget.getBoundingClientRect();
                                  const isBefore = event.clientY < bounds.top + bounds.height / 2;
                                  const rawDestinationIndex = isBefore ? cardIndex : cardIndex + 1;

                                  void onDropCard(list.id, rawDestinationIndex);
                                  clearCardDragState();
                                }}
                                className="group flex cursor-grab items-start gap-2 rounded-md border border-border/70 bg-background/90 px-3 py-2 active:cursor-grabbing"
                              >
                                <button
                                  type="button"
                                  className="flex-1 text-left"
                                  onClick={() => {
                                    if (suppressCardClickRef.current) {
                                      return;
                                    }

                                    openCardEditor(card);
                                  }}
                                >
                                  <p className="line-clamp-2 text-sm font-medium text-foreground">{card.title}</p>
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <span
                                      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${getPriorityBadgeClass(card.priority)}`}
                                    >
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
                                </button>

                                <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100" />
                              </div>

                              {bottomDropActive && (
                                <div className="absolute -bottom-1 left-1 right-1 h-0.5 rounded-full bg-primary" />
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    <form
                      className="grid gap-2 sm:grid-cols-[1fr_auto]"
                      onSubmit={(event) => {
                        void onCreateCard(list.id, event);
                      }}
                    >
                      <Input
                        value={newCardTitles[list.id] ?? ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          setNewCardTitles((current) => ({
                            ...current,
                            [list.id]: value
                          }));
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
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Board Settings</CardTitle>
                <CardDescription>Collapsed by default so list work stays front and center.</CardDescription>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsSettingsOpen((current) => !current)}
                className="gap-1"
              >
                {isSettingsOpen ? (
                  <>
                    Hide
                    <ChevronUp className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Show
                    <ChevronDown className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardHeader>

          {isSettingsOpen && (
            <CardContent className="space-y-4">
              <Input value={boardName} onChange={(event) => setBoardName(event.target.value)} />
              <textarea
                value={boardDescription}
                onChange={(event) => setBoardDescription(event.target.value)}
                placeholder="Description"
                className="min-h-[88px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
              />

              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {boardBackgroundPresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setBoardBackground(preset.id)}
                    className={`overflow-hidden rounded-md border text-left ${
                      boardBackground === preset.id ? "border-primary ring-2 ring-primary/40" : "border-border"
                    }`}
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
                  onChange={(event) => {
                    const value = event.target.value;
                    setCardDraft((current) =>
                      current
                        ? {
                            ...current,
                            title: value
                          }
                        : current
                    );
                  }}
                  placeholder="Card title"
                />
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Description</p>
                <textarea
                  value={cardDraft.description}
                  onChange={(event) => {
                    const value = event.target.value;
                    setCardDraft((current) =>
                      current
                        ? {
                            ...current,
                            description: value
                          }
                        : current
                    );
                  }}
                  placeholder="Describe the task"
                  className="min-h-[140px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="text-xs text-muted-foreground">Priority</span>
                  <select
                    value={cardDraft.priority}
                    onChange={(event) => {
                      const value = event.target.value as CardPriority;
                      setCardDraft((current) =>
                        current
                          ? {
                              ...current,
                              priority: value
                            }
                          : current
                      );
                    }}
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
                    onChange={(event) => {
                      const value = event.target.value;
                      setCardDraft((current) =>
                        current
                          ? {
                              ...current,
                              dueDate: value
                            }
                          : current
                      );
                    }}
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => setCardToDelete(selectedCardWithList.card)}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Delete card
                </Button>

                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={closeCardEditor}>
                    Close
                  </Button>
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
        confirmLabel="Delete"
        cancelLabel="Keep"
        onCancel={() => setIsDeleteBoardOpen(false)}
        onConfirm={() => {
          setIsDeleteBoardOpen(false);
          void onDeleteBoard();
        }}
      />

      <ConfirmDialog
        open={listToDelete !== null}
        title="Delete list"
        description={`Delete "${listToDelete?.name ?? "this list"}"?`}
        confirmLabel="Delete"
        cancelLabel="Keep"
        onCancel={() => setListToDelete(null)}
        onConfirm={() => {
          void onDeleteList();
        }}
      />

      <ConfirmDialog
        open={cardToDelete !== null}
        title="Delete card"
        description={`Delete "${cardToDelete?.title ?? "this card"}"?`}
        confirmLabel="Delete"
        cancelLabel="Keep"
        onCancel={() => setCardToDelete(null)}
        onConfirm={() => {
          void onDeleteCard();
        }}
      />
    </>
  );
}



























































