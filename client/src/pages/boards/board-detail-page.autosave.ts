import { useCallback, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction, MutableRefObject } from "react";
import { updateBoard, updateLabel, updateList } from "@/lib/boards-api";
import type { BoardBackground, BoardDetail, LabelColor, RetentionMode } from "@/types/board";
import { AUTO_SAVE_DELAY_MS } from "@/pages/boards/board-detail-page.utils";
import type { BoardDraft } from "@/pages/boards/board-detail-page.utils";

interface BoardDetailAutosaveParams {
  boardId: string | undefined;
  boardName: string;
  boardDescription: string;
  boardBackground: BoardBackground;
  retentionMode: RetentionMode;
  retentionTotalMinutes: number;
  archiveRetentionTotalMinutes: number;
  setError: (value: string | null) => void;
  setIsAutosavingBoard: (value: boolean) => void;
  setShowSavedNotice: (value: boolean) => void;
  setBoard: Dispatch<SetStateAction<BoardDetail | null>>;
  setListNameDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  setListSavingIds: Dispatch<SetStateAction<Set<string>>>;
  setLabelDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  setLabelColorDrafts: Dispatch<SetStateAction<Record<string, LabelColor>>>;
  setLabelSavingIds: Dispatch<SetStateAction<Set<string>>>;
  triggerSavedNotice: () => void;
  hydrateBoardState: (data: BoardDetail) => void;
  clearSavedNoticeTimers: () => void;
  clearCardAutosaveTimeout: () => void;
  listSyncedNamesRef: MutableRefObject<Record<string, string>>;
  lastSyncedBoardRef: MutableRefObject<BoardDraft | null>;
  currentDraftBoardRef: MutableRefObject<BoardDraft | null>;
  initializedBoardRef: MutableRefObject<boolean>;
}

export function useBoardDetailAutosave({
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
}: BoardDetailAutosaveParams) {
  const autoSaveTimeoutRef = useRef<number | null>(null);
  const labelAutoSaveTimeoutsRef = useRef<Record<string, number>>({});

  const clearLabelAutosaveTimeout = useCallback((labelId: string): void => {
    const timeout = labelAutoSaveTimeoutsRef.current[labelId];
    if (timeout !== undefined) {
      window.clearTimeout(timeout);
      delete labelAutoSaveTimeoutsRef.current[labelId];
    }
  }, []);

  const clearAllLabelAutosaveTimeouts = useCallback((): void => {
    Object.values(labelAutoSaveTimeoutsRef.current).forEach((t) => window.clearTimeout(t));
    labelAutoSaveTimeoutsRef.current = {};
  }, []);

  const runBoardAutosave = useCallback(async (): Promise<void> => {
    if (!boardId) return;
    const draft = currentDraftBoardRef.current;
    if (!draft) return;
    if (draft.name.trim().length < 2) {
      setError("Board name must be at least 2 characters.");
      return;
    }
    setIsAutosavingBoard(true);
    try {
      const updated = await updateBoard(boardId, {
        name: draft.name,
        description: draft.description ?? undefined,
        background: draft.background,
        retentionMode: draft.retentionMode,
        retentionMinutes: draft.retentionMinutes,
        archiveRetentionMinutes: draft.archiveRetentionMinutes,
      });
      hydrateBoardState(updated);
      setError(null);
      triggerSavedNotice();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update board");
    } finally {
      setIsAutosavingBoard(false);
    }
  }, [boardId, currentDraftBoardRef, hydrateBoardState, setError, setIsAutosavingBoard, triggerSavedNotice]);

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
      setListSavingIds((c) => {
        const n = new Set(c);
        n.delete(listId);
        return n;
      });
    }
  }, [listSyncedNamesRef, setBoard, setError, setListNameDrafts, setListSavingIds, triggerSavedNotice]);

  const runLabelAutosave = useCallback(async (labelId: string, name: string, color: LabelColor): Promise<void> => {
    const trimmed = name.trim();
    if (trimmed.length < 1) return;
    setLabelSavingIds((c) => new Set(c).add(labelId));
    try {
      const updated = await updateLabel(labelId, { name: trimmed, color });
      setBoard((current) => {
        if (!current) return current;
        return {
          ...current,
          labels: current.labels.map((label) => (label.id === updated.id ? updated : label)),
          lists: current.lists.map((list) => ({
            ...list,
            cards: list.cards.map((card) => ({
              ...card,
              labels: card.labels.map((label) => (label.id === updated.id ? updated : label))
            }))
          }))
        };
      });
      setLabelDrafts((c) => ({ ...c, [updated.id]: updated.name }));
      setLabelColorDrafts((c) => ({ ...c, [updated.id]: updated.color as LabelColor }));
      setError(null);
      triggerSavedNotice();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update label");
    } finally {
      setLabelSavingIds((c) => {
        const n = new Set(c);
        n.delete(labelId);
        return n;
      });
    }
  }, [setBoard, setError, setLabelColorDrafts, setLabelDrafts, setLabelSavingIds, triggerSavedNotice]);

  const scheduleLabelAutosave = useCallback((labelId: string, name: string, color: LabelColor): void => {
    clearLabelAutosaveTimeout(labelId);
    labelAutoSaveTimeoutsRef.current[labelId] = window.setTimeout(() => {
      void runLabelAutosave(labelId, name, color);
    }, AUTO_SAVE_DELAY_MS);
  }, [clearLabelAutosaveTimeout, runLabelAutosave]);

  useEffect(() => {
    if (!initializedBoardRef.current || !boardId) return;
    const nextDraft: BoardDraft = {
      name: boardName.trim(),
      description: boardDescription.trim(),
      background: boardBackground,
      retentionMode,
      retentionMinutes: retentionTotalMinutes,
      archiveRetentionMinutes: archiveRetentionTotalMinutes
    };
    currentDraftBoardRef.current = nextDraft;
    const synced = lastSyncedBoardRef.current;
    const hasChanges =
      synced !== null &&
      (nextDraft.name !== synced.name ||
        nextDraft.description !== synced.description ||
        nextDraft.background !== synced.background ||
        nextDraft.retentionMode !== synced.retentionMode ||
        nextDraft.retentionMinutes !== synced.retentionMinutes ||
        nextDraft.archiveRetentionMinutes !== synced.archiveRetentionMinutes);
    if (!hasChanges) return;
    setShowSavedNotice(false);
    clearSavedNoticeTimers();
    if (autoSaveTimeoutRef.current !== null) window.clearTimeout(autoSaveTimeoutRef.current);
    autoSaveTimeoutRef.current = window.setTimeout(() => {
      void runBoardAutosave();
    }, AUTO_SAVE_DELAY_MS);
    return () => {
      if (autoSaveTimeoutRef.current !== null) {
        window.clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
    };
  }, [
    boardId,
    boardName,
    boardDescription,
    boardBackground,
    retentionMode,
    retentionTotalMinutes,
    archiveRetentionTotalMinutes,
    runBoardAutosave,
    clearSavedNoticeTimers,
    setShowSavedNotice,
    lastSyncedBoardRef,
    currentDraftBoardRef,
    initializedBoardRef,
  ]);

  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current !== null) window.clearTimeout(autoSaveTimeoutRef.current);
      clearAllLabelAutosaveTimeouts();
      clearSavedNoticeTimers();
      clearCardAutosaveTimeout();
    };
  }, [clearAllLabelAutosaveTimeouts, clearSavedNoticeTimers, clearCardAutosaveTimeout]);

  return {
    runListNameAutosave,
    scheduleLabelAutosave,
  };
}
