import { arrayMove } from "@dnd-kit/sortable";
import { useCallback, useMemo, useRef, useState } from "react";
import type { DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core";
import { moveCard, reorderLists } from "@/lib/boards-api";
import {
  fromListDragId,
  isListDragId,
  normalizeDragOverId,
  sortBoardListsWithCards,
  sortCardsByPosition,
} from "@/pages/boards/board-detail-page.utils";
import type { BoardDetail, BoardList } from "@/types/board";

export function useBoardDragAndDrop({
  board,
  boardId,
  orderedLists,
  setBoard,
  setError,
  triggerSavedNotice,
}: {
  board: BoardDetail | null;
  boardId: string | undefined;
  orderedLists: BoardList[];
  setBoard: React.Dispatch<React.SetStateAction<BoardDetail | null>>;
  setError: (message: string | null) => void;
  triggerSavedNotice: () => void;
}): {
  activeCardId: string | null;
  activeCard: BoardDetail["lists"][number]["cards"][number] | null;
  activeList: BoardList | null;
  onDragStart: (event: DragStartEvent) => void;
  onDragOver: (event: DragOverEvent) => void;
  onDragEnd: (event: DragEndEvent) => Promise<void>;
} {
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const preDragListsRef = useRef<BoardList[] | null>(null);
  const preDragListOrderRef = useRef<BoardList[] | null>(null);

  const activeList = useMemo(
    () => (activeListId ? orderedLists.find((list) => list.id === activeListId) ?? null : null),
    [orderedLists, activeListId]
  );
  const activeCard = useMemo(
    () => (activeCardId ? board?.lists.flatMap((l) => l.cards).find((c) => c.id === activeCardId) ?? null : null),
    [board, activeCardId]
  );

  const onCardDragStart = useCallback((event: DragStartEvent): void => {
    setActiveCardId(event.active.id as string);
    setActiveListId(null);
    preDragListsRef.current = board?.lists ?? null;
  }, [board]);

  const onCardDragOver = useCallback((event: DragOverEvent): void => {
    const { active, over } = event;
    if (!over || !board) return;
    const activeId = active.id as string;
    const overId = normalizeDragOverId(over.id as string);
    if (activeId === overId) return;
    const sourceList = board.lists.find((l) => l.cards.some((c) => c.id === activeId));
    const destList = board.lists.find(
      (l) => l.id === overId || l.cards.some((c) => c.id === overId)
    );
    if (!sourceList || !destList || sourceList.id === destList.id) return;
    const movingCard = sourceList.cards.find((c) => c.id === activeId);
    if (!movingCard) return;
    const overCardIndex = destList.cards.findIndex((c) => c.id === overId);
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
  }, [board, setBoard]);

  const onCardDragEnd = useCallback(async (event: DragEndEvent): Promise<void> => {
    const { active, over } = event;
    const prevLists = preDragListsRef.current;
    setActiveCardId(null);
    preDragListsRef.current = null;
    if (!over || !board || !boardId) return;
    const activeId = active.id as string;
    const overId = normalizeDragOverId(over.id as string);
    const currentList = board.lists.find((l) => l.cards.some((c) => c.id === activeId));
    if (!currentList) return;
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
    const originalSourceList = prevLists?.find((l) => l.cards.some((c) => c.id === activeId));
    if (!originalSourceList) return;
    const destinationIndex = finalCards.findIndex((c) => c.id === activeId);
    if (destinationIndex < 0) return;
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
      if (prevLists) {
        setBoard((current) => (current ? { ...current, lists: prevLists } : current));
      }
    }
  }, [board, boardId, setBoard, setError, triggerSavedNotice]);

  const onListDragStart = useCallback((event: DragStartEvent): void => {
    const activeId = event.active.id as string;
    if (!isListDragId(activeId)) return;
    setActiveListId(fromListDragId(activeId));
    setActiveCardId(null);
    preDragListOrderRef.current = board?.lists ?? null;
  }, [board]);

  const onListDragOver = useCallback((event: DragOverEvent): void => {
    const { active, over } = event;
    if (!over || !board) return;
    const activeId = fromListDragId(active.id as string);
    const overId = over.id as string;
    let targetListId: string;
    if (isListDragId(overId)) {
      targetListId = fromListDragId(overId);
    } else {
      const isDirectListId = board.lists.some((l) => l.id === overId);
      if (isDirectListId) {
        targetListId = overId;
      } else {
        const parentList = board.lists.find((l) => l.cards.some((c) => c.id === overId));
        if (!parentList) return;
        targetListId = parentList.id;
      }
    }
    if (activeId === targetListId) return;
    const currentIds = orderedLists.map((l) => l.id);
    const oldIndex = currentIds.indexOf(activeId);
    const newIndex = currentIds.indexOf(targetListId);
    if (oldIndex < 0 || newIndex < 0) return;
    const nextIds = arrayMove(currentIds, oldIndex, newIndex);
    const byId = new Map(board.lists.map((l) => [l.id, l]));
    const optimisticLists = nextIds
      .map((id, index) => {
        const found = byId.get(id);
        return found ? { ...found, position: index } : null;
      })
      .filter((l): l is BoardList => l !== null);
    setBoard((current) => (current ? { ...current, lists: optimisticLists } : current));
  }, [board, orderedLists, setBoard]);

  const onListDragEnd = useCallback(async (): Promise<void> => {
    const prevLists = preDragListOrderRef.current;
    setActiveListId(null);
    preDragListOrderRef.current = null;
    if (!board || !boardId) return;
    const currentIds = board.lists
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((l) => l.id);
    const originalIds = prevLists
      ?.slice()
      .sort((a, b) => a.position - b.position)
      .map((l) => l.id) ?? currentIds;
    if (currentIds.join(":") === originalIds.join(":")) return;
    try {
      const updatedLists = await reorderLists(boardId, currentIds);
      setBoard((current) => (current ? { ...current, lists: sortBoardListsWithCards(updatedLists) } : current));
      setError(null);
      triggerSavedNotice();
    } catch (reorderError) {
      setError(reorderError instanceof Error ? reorderError.message : "Failed to reorder lists");
      if (prevLists) {
        setBoard((current) => (current ? { ...current, lists: prevLists } : current));
      }
    }
  }, [board, boardId, setBoard, setError, triggerSavedNotice]);

  const onDragStart = useCallback((event: DragStartEvent): void => {
    if (isListDragId(event.active.id)) {
      onListDragStart(event);
      return;
    }
    onCardDragStart(event);
  }, [onCardDragStart, onListDragStart]);

  const onDragOver = useCallback((event: DragOverEvent): void => {
    if (isListDragId(event.active.id)) {
      onListDragOver(event);
      return;
    }
    onCardDragOver(event);
  }, [onCardDragOver, onListDragOver]);

  const onDragEnd = useCallback(async (event: DragEndEvent): Promise<void> => {
    if (isListDragId(event.active.id)) {
      await onListDragEnd();
      return;
    }
    await onCardDragEnd(event);
  }, [onCardDragEnd, onListDragEnd]);

  return {
    activeCardId,
    activeCard,
    activeList,
    onDragStart,
    onDragOver,
    onDragEnd,
  };
}
