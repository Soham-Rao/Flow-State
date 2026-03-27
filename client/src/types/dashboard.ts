import type { CardPriority } from "./board";
import type { CommentMentionDetail } from "./mentions";
import type { AnnouncementDetail } from "./announcements";

export interface DashboardCardSummary {
  id: string;
  title: string;
  priority: CardPriority;
  dueDate: string | null;
  boardId: string;
  boardName: string;
  listId: string;
  listName: string;
  createdAt: string;
}

export interface ThreadMentionDetail {
  id: string;
  mentionType: "message" | "reply";
  conversationId: string;
  conversationType: "dm" | "channel";
  conversationLabel: string;
  messageId: string;
  replyId: string | null;
  body: string | null;
  createdAt: number;
}


export interface DashboardActivityHighlight {
  boardId: string;
  boardName: string;
  eventCount: number;
}

export interface DashboardNewJoiner {
  id: string;
  name: string;
  displayName: string | null;
  role: string;
  createdAt: string;
}

export interface DashboardMetricsSummary {
  cardsCompleted: number;
  cardsArchived: number;
  cardsDeleted: number;
  newCards: number;
  newLists: number;
  newBoards: number;
}

export interface DashboardSummary {
  assignedCards: DashboardCardSummary[];
  createdCards: DashboardCardSummary[];
  boardMentions: CommentMentionDetail[];
  threadMentions: ThreadMentionDetail[];
  announcements: AnnouncementDetail[];
  activityHighlights: DashboardActivityHighlight[];
  newJoiners: DashboardNewJoiner[];
  metrics: {
    weekly: DashboardMetricsSummary;
    monthly: DashboardMetricsSummary;
  };
}


