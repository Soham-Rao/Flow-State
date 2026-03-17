import { useCallback } from "react";
import type React from "react";
import {
  archiveBoard,
  archiveList,
  createBoardComment,
  createCard,
  createLabel,
  createList,
  createListComment,
  deleteBoard,
  deleteComment,
  deleteLabel,
  deleteList,
  getArchivedLists,
  restoreCard,
  restoreList,
  toggleCommentReaction,
  updateList
} from "@/lib/boards-api";
import { extractMentionIds } from "@/lib/mentions";
import type {
  ArchivedListEntry,
  BoardCard,
  BoardComment,
  BoardDetail,
  BoardLabel,
  BoardList,
  BoardMember,
  LabelColor
} from "@/types/board";
import { sortBoardListsWithCards, sortCardsByPosition } from "@/pages/boards/board-detail-page.utils";

export interface BoardDetailBoardHandlersParams {
  boardId: string | undefined;
  board: BoardDetail | null;
  boardMembers: BoardMember[];
  newBoardComment: string;
  setNewBoardComment: React.Dispatch<React.SetStateAction<string>>;
  newListCommentDrafts: Record<string, string>;
  setNewListCommentDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  newListName: string;
  newListDone: boolean;
  setNewListName: React.Dispatch<React.SetStateAction<string>>;
  setNewListDone: React.Dispatch<React.SetStateAction<boolean>>;
  setBoard: React.Dispatch<React.SetStateAction<BoardDetail | null>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  triggerSavedNotice: () => void;
  navigate: (path: string) => void;
  listSyncedNamesRef: React.MutableRefObject<Record<string, string>>;
  editingListId: string | null;
  listNameDrafts: Record<string, string>;
  runListNameAutosave: (listId: string, name: string) => Promise<void>;
  setEditingListId: React.Dispatch<React.SetStateAction<string | null>>;
  listToDelete: BoardList | null;
  setListToDelete: React.Dispatch<React.SetStateAction<BoardList | null>>;
  setListNameDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setListSavingIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setNewCardTitles: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  newCardTitles: Record<string, string>;
  newLabelName: string;
  newLabelColor: LabelColor;
  setNewLabelName: React.Dispatch<React.SetStateAction<string>>;
  labelToDelete: BoardLabel | null;
  setLabelToDelete: React.Dispatch<React.SetStateAction<BoardLabel | null>>;
  setLabelDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setLabelColorDrafts: React.Dispatch<React.SetStateAction<Record<string, LabelColor>>>;
  setLabelSavingIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  commentToDelete: BoardComment | null;
  setCommentToDelete: React.Dispatch<React.SetStateAction<BoardComment | null>>;
  isArchivedOpen: boolean;
  setIsArchivedOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setArchivedLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setArchivedError: React.Dispatch<React.SetStateAction<string | null>>;
  setArchivedLists: React.Dispatch<React.SetStateAction<ArchivedListEntry[]>>;
  setIsArchiveBoardOpen: React.Dispatch<React.SetStateAction<boolean>>;
  hydrateBoardState: (data: BoardDetail) => void;
  refreshBoardSilently: () => Promise<void>;
  setRestoreConflict: React.Dispatch<React.SetStateAction<{ message: string; onConfirm: () => void } | null>>;
}

export function useBoardDetailBoardHandlers({
  boardId,
  board,
  boardMembers,
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
  newCardTitles,
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
}: BoardDetailBoardHandlersParams): {
  onDeleteBoard: () => Promise<void>;
  onCreateList: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onToggleDone: (listId: string, isDoneList: boolean) => Promise<void>;
  closeListEditor: (list: BoardList) => Promise<void>;
  cancelListEditor: (list: BoardList) => void;
  onToggleListEdit: (list: BoardList) => Promise<void>;
  onDeleteList: () => Promise<void>;
  onCreateCard: (listId: string, event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onCreateLabel: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onDeleteLabel: () => Promise<void>;
  onCreateBoardComment: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onCreateListComment: (listId: string, event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onToggleCommentReaction: (commentId: string, emoji: string) => Promise<void>;
  onDeleteComment: () => Promise<void>;
  loadArchivedLists: () => Promise<void>;
  openArchivedLists: () => void;
  onArchiveBoard: () => Promise<void>;
  onArchiveList: (listId: string) => Promise<void>;
  requestRestoreArchivedEntry: (entry: ArchivedListEntry) => void;
  requestRestoreArchivedCard: (entry: ArchivedListEntry, card: BoardCard) => void;
} {
  const removeCommentFromBoard = useCallback((comment: BoardComment): void => {
    setBoard((current) => {
      if (!current) return current;
      const isBoardComment = !comment.listId && !comment.cardId;
      return {
        ...current,
        comments: isBoardComment
          ? (current.comments ?? []).filter((entry) => entry.id !== comment.id)
          : current.comments,
        lists: current.lists.map((list) => ({
          ...list,
          comments: comment.listId === list.id
            ? (list.comments ?? []).filter((entry) => entry.id !== comment.id)
            : list.comments,
          cards: list.cards.map((card) => ({
            ...card,
            comments: comment.cardId === card.id
              ? (card.comments ?? []).filter((entry) => entry.id !== comment.id)
              : card.comments
          }))
        }))
      };
    });
  }, [setBoard]);

  const replaceCommentInBoard = useCallback((updated: BoardComment): void => {
    setBoard((current) => {
      if (!current) return current;
      const isBoardComment = !updated.listId && !updated.cardId;
      return {
        ...current,
        comments: isBoardComment
          ? (current.comments ?? []).map((entry) => (entry.id === updated.id ? updated : entry))
          : current.comments,
        lists: current.lists.map((list) => ({
          ...list,
          comments: updated.listId === list.id
            ? (list.comments ?? []).map((entry) => (entry.id === updated.id ? updated : entry))
            : list.comments,
          cards: list.cards.map((card) => ({
            ...card,
            comments: updated.cardId === card.id
              ? (card.comments ?? []).map((entry) => (entry.id === updated.id ? updated : entry))
              : card.comments
          }))
        }))
      };
    });
  }, [setBoard]);

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
        return {
          ...current,
          lists: current.lists.map((list) =>
            list.id === updated.id ? { ...updated, cards: sortCardsByPosition(updated.cards ?? []) } : list
          )
        };
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
    await runListNameAutosave(list.id, draft);
  }, [editingListId, listNameDrafts, runListNameAutosave, listSyncedNamesRef, setListNameDrafts, setEditingListId, setError]);

  const cancelListEditor = useCallback((list: BoardList): void => {
    const syncedName = listSyncedNamesRef.current[list.id] ?? list.name;
    setListNameDrafts((c) => ({ ...c, [list.id]: syncedName }));
    setEditingListId(null);
  }, [listSyncedNamesRef, setListNameDrafts, setEditingListId]);

  const onToggleListEdit = async (list: BoardList): Promise<void> => {
    if (editingListId === list.id) { await closeListEditor(list); return; }
    setEditingListId(list.id);
  };

  const onDeleteList = async (): Promise<void> => {
    if (!listToDelete) return;
    try {
      await deleteList(listToDelete.id);
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

  const onCreateLabel = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!boardId) return;
    const name = newLabelName.trim();
    if (name.length < 1) {
      setError("Label name cannot be empty.");
      return;
    }
    try {
      const created = await createLabel(boardId, { name, color: newLabelColor });
      setBoard((current) => (current ? { ...current, labels: [...current.labels, created] } : current));
      setLabelDrafts((c) => ({ ...c, [created.id]: created.name }));
      setLabelColorDrafts((c) => ({ ...c, [created.id]: created.color as LabelColor }));
      setNewLabelName("");
      setError(null);
      triggerSavedNotice();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create label");
    }
  };

  const onDeleteLabel = async (): Promise<void> => {
    if (!labelToDelete) return;
    try {
      await deleteLabel(labelToDelete.id);
      setBoard((current) => {
        if (!current) return current;
        return {
          ...current,
          labels: current.labels.filter((label) => label.id !== labelToDelete.id),
          lists: current.lists.map((list) => ({
            ...list,
            cards: list.cards.map((card) => ({
              ...card,
              labels: card.labels.filter((label) => label.id !== labelToDelete.id)
            }))
          }))
        };
      });
      setLabelDrafts((c) => { const n = { ...c }; delete n[labelToDelete.id]; return n; });
      setLabelColorDrafts((c) => { const n = { ...c }; delete n[labelToDelete.id]; return n; });
      setLabelSavingIds((c) => { const n = new Set(c); n.delete(labelToDelete.id); return n; });
      setLabelToDelete(null);
      setError(null);
      triggerSavedNotice();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete label");
    }
  };

  const onCreateBoardComment = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!boardId) return;
    const body = newBoardComment.trim();
    if (body.length < 1) return;
    try {
      const mentions = extractMentionIds(body, boardMembers);
      const created = await createBoardComment(boardId, { body, mentions });
      setBoard((current) => current ? { ...current, comments: [...(current.comments ?? []), created] } : current);
      setNewBoardComment("");
      setError(null);
      triggerSavedNotice();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to add comment");
    }
  };

  const onCreateListComment = async (listId: string, event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const body = (newListCommentDrafts[listId] ?? "").trim();
    if (body.length < 1) return;
    const mentions = extractMentionIds(body, boardMembers);
    try {
      const created = await createListComment(listId, { body, mentions });
      setBoard((current) => {
        if (!current) return current;
        return {
          ...current,
          lists: current.lists.map((list) =>
            list.id === listId ? { ...list, comments: [...(list.comments ?? []), created] } : list
          )
        };
      });
      setNewListCommentDrafts((current) => ({ ...current, [listId]: "" }));
      setError(null);
      triggerSavedNotice();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to add comment");
    }
  };

  const onToggleCommentReaction = async (commentId: string, emoji: string): Promise<void> => {
    try {
      const updated = await toggleCommentReaction(commentId, { emoji });
      replaceCommentInBoard(updated);
      setError(null);
    } catch (reactionError) {
      setError(reactionError instanceof Error ? reactionError.message : "Failed to update reaction");
    }
  };

  const onDeleteComment = async (): Promise<void> => {
    if (!commentToDelete) return;
    try {
      await deleteComment(commentToDelete.id);
      removeCommentFromBoard(commentToDelete);
      setCommentToDelete(null);
      setError(null);
      triggerSavedNotice();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete comment");
    }
  };

  const loadArchivedLists = useCallback(async (): Promise<void> => {
    if (!boardId) return;
    setArchivedLoading(true);
    setArchivedError(null);
    try {
      const data = await getArchivedLists(boardId);
      setArchivedLists(data);
    } catch (loadError) {
      setArchivedError(loadError instanceof Error ? loadError.message : "Failed to load archived lists");
    } finally {
      setArchivedLoading(false);
    }
  }, [boardId, setArchivedLoading, setArchivedError, setArchivedLists]);

  const openArchivedLists = useCallback((): void => {
    setIsArchivedOpen(true);
    void loadArchivedLists();
  }, [loadArchivedLists, setIsArchivedOpen]);

  const onArchiveBoard = useCallback(async (): Promise<void> => {
    if (!boardId) return;
    try {
      await archiveBoard(boardId);
      setIsArchiveBoardOpen(false);
      navigate("/boards");
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Failed to archive board");
    }
  }, [boardId, navigate, setIsArchiveBoardOpen, setError]);

  const onArchiveList = useCallback(async (listId: string): Promise<void> => {
    try {
      await archiveList(listId);
      setBoard((current) => (current ? { ...current, lists: current.lists.filter((list) => list.id !== listId) } : current));
      triggerSavedNotice();
      if (isArchivedOpen) void loadArchivedLists();
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Failed to archive list");
    }
  }, [isArchivedOpen, loadArchivedLists, setBoard, setError, triggerSavedNotice]);

  const restoreArchivedEntry = useCallback(async (entry: ArchivedListEntry, renameConflicts: boolean): Promise<void> => {
    try {
      if (entry.kind === "list") {
        const updated = await restoreList(entry.sourceListId, { renameConflicts });
        hydrateBoardState(updated);
      } else {
        for (const card of entry.cards) {
          await restoreCard(card.id, { renameConflicts });
        }
        await refreshBoardSilently();
      }
      await loadArchivedLists();
      setRestoreConflict(null);
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : "Failed to restore archive");
    }
  }, [hydrateBoardState, loadArchivedLists, refreshBoardSilently, setError, setRestoreConflict]);

  const restoreArchivedCard = useCallback(
    async (entry: ArchivedListEntry, card: BoardCard, renameConflicts: boolean): Promise<void> => {
      try {
        await restoreCard(card.id, { renameConflicts });
        await refreshBoardSilently();
        await loadArchivedLists();
        setRestoreConflict(null);
      } catch (restoreError) {
        setError(restoreError instanceof Error ? restoreError.message : "Failed to restore archive");
      }
    },
    [loadArchivedLists, refreshBoardSilently, setError, setRestoreConflict]
  );

  const requestRestoreArchivedEntry = useCallback((entry: ArchivedListEntry): void => {
    if (!board) return;
    let targetList: BoardList | undefined;
    if (entry.kind === "list") {
      targetList = board.lists.find((list) => list.name === entry.name);
    } else {
      targetList = board.lists.find((list) => list.id === entry.sourceListId);
    }
    if (!targetList) {
      void restoreArchivedEntry(entry, false);
      return;
    }
    const existingNames = new Set(targetList.cards.map((card) => card.title));
    const hasConflict = entry.cards.some((card) => existingNames.has(card.title));
    if (hasConflict) {
      setRestoreConflict({
        message: "Card with same name exists creating conflict",
        onConfirm: () => {
          void restoreArchivedEntry(entry, true);
        }
      });
      return;
    }
    void restoreArchivedEntry(entry, false);
  }, [board, restoreArchivedEntry, setRestoreConflict]);

  const requestRestoreArchivedCard = useCallback(
    (entry: ArchivedListEntry, card: BoardCard): void => {
      if (!board) return;
      const targetList = board.lists.find((list) => list.id === entry.sourceListId)
        ?? board.lists.find((list) => list.name === entry.name);
      if (!targetList) {
        void restoreArchivedCard(entry, card, false);
        return;
      }
      const hasConflict = targetList.cards.some((existing) => existing.title === card.title);
      if (hasConflict) {
        setRestoreConflict({
          message: "Card with same name exists creating conflict",
          onConfirm: () => {
            void restoreArchivedCard(entry, card, true);
          }
        });
        return;
      }
      void restoreArchivedCard(entry, card, false);
    },
    [board, restoreArchivedCard, setRestoreConflict]
  );

  return {
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
  };
}
