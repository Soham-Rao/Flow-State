export interface MentionUnreadCounts {
  total: number;
  threads: number;
  comments: number;
  assignments: number;
}

export interface CommentMentionDetail {
  commentId: string;
  boardId: string;
  boardName: string;
  listId: string | null;
  listName: string | null;
  cardId: string | null;
  cardTitle: string | null;
  body: string;
  createdAt: number;
}

