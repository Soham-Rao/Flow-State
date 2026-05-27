import type { BoardDetail } from "@/types/board";

export function useBoardCommentMentions(board: BoardDetail | null): void {
  void board;
  // Intentionally empty: comment mentions are marked seen on hover.
}
