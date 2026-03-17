import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";

interface BoardDetailToggleParams {
  setExpandedCommentIds: Dispatch<SetStateAction<Set<string>>>;
  setExpandedListCommentGroups: Dispatch<SetStateAction<Set<string>>>;
  setExpandedCardCommentGroups: Dispatch<SetStateAction<Set<string>>>;
}

export function useBoardDetailCommentToggles({
  setExpandedCommentIds,
  setExpandedListCommentGroups,
  setExpandedCardCommentGroups,
}: BoardDetailToggleParams) {
  const toggleListCommentGroup = useCallback((listId: string): void => {
    setExpandedListCommentGroups((current) => {
      const next = new Set(current);
      if (next.has(listId)) {
        next.delete(listId);
      } else {
        next.add(listId);
      }
      return next;
    });
  }, [setExpandedListCommentGroups]);

  const toggleCardCommentGroup = useCallback((cardId: string): void => {
    setExpandedCardCommentGroups((current) => {
      const next = new Set(current);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  }, [setExpandedCardCommentGroups]);

  const toggleCommentExpanded = useCallback((commentId: string): void => {
    setExpandedCommentIds((current) => {
      const next = new Set(current);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  }, [setExpandedCommentIds]);

  return {
    toggleListCommentGroup,
    toggleCardCommentGroup,
    toggleCommentExpanded,
  };
}
