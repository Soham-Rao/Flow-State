import { useEffect, useMemo, useRef } from "react";
import { markCommentMentionsSeen } from "@/lib/mentions-api";
import { useMentionStore } from "@/stores/mentions-store";
import type { BoardDetail } from "@/types/board";

export function useBoardCommentMentions(board: BoardDetail | null): void {
  const refreshMentions = useMentionStore((state) => state.refresh);
  const commentMentionIds = useMemo(() => {
    if (!board) return [] as string[];
    const ids = new Set<string>();
    (board.comments ?? []).forEach((comment) => ids.add(comment.id));
    board.lists?.forEach((list) => {
      (list.comments ?? []).forEach((comment) => ids.add(comment.id));
      list.cards?.forEach((card) => {
        (card.comments ?? []).forEach((comment) => ids.add(comment.id));
      });
    });
    return Array.from(ids);
  }, [board]);
  const commentMentionKey = useMemo(() => commentMentionIds.slice().sort().join("|"), [commentMentionIds]);
  const lastSeenCommentMentionsRef = useRef("");
  useEffect(() => {
    if (!commentMentionKey || commentMentionIds.length === 0) {
      return;
    }
    if (commentMentionKey === lastSeenCommentMentionsRef.current) {
      return;
    }
    lastSeenCommentMentionsRef.current = commentMentionKey;
    markCommentMentionsSeen(commentMentionIds)
      .then(() => refreshMentions())
      .catch(() => undefined);
  }, [commentMentionKey, commentMentionIds, refreshMentions]);
}
