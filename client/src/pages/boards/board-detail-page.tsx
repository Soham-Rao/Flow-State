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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Archive, CalendarClock, Check, ChevronDown, ChevronUp, Download, GripVertical, ListChecks, MessageSquare, Paperclip, Pencil, Plus, Tag, Trash2, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MentionsField } from "@/components/mentions/mentions-input";
import { UserHoverCard } from "@/components/users/user-hover-card";
import { Input } from "@/components/ui/input";
import { boardBackgroundPresets, getBoardBackgroundClass, getBoardSurfaceClass, type BoardBackgroundPreset } from "@/lib/board-backgrounds";
import { extractMentionIds } from "@/lib/mentions";
import { markCommentMentionsSeen } from "@/lib/mentions-api";
import { useMentionStore } from "@/stores/mentions-store";
import {

  archiveBoard,
  archiveCard,
  archiveList,
  assignLabelToCard,
  assignMemberToCard,
  createAttachments,
  createBoardComment,
  createCard,
  createCardComment,
  deleteComment,
  createChecklist,
  createChecklistItem,
  createLabel,
  createList,
  createListComment,
  deleteAttachment,
  deleteBoard,
  deleteCard,
  deleteChecklist,
  deleteChecklistItem,
  deleteLabel,
  deleteList,
  downloadAttachment,
  getArchivedLists,
  getBoardById,
  moveCard,
  removeLabelFromCard,
  removeMemberFromCard,
  reorderLists,
  restoreBoard,
  restoreCard,
  restoreList,
  toggleCommentReaction,
  updateBoard,
  updateCard,
  updateChecklist,
  updateChecklistItem,
  updateLabel,
  updateList
} from "@/lib/boards-api";
import type { ArchivedListEntry, BoardAttachment, BoardBackground, BoardCard, BoardComment, BoardDetail, BoardLabel, BoardList, BoardMember, CardCoverColor, CardPriority, Checklist, ChecklistItem, LabelColor, RetentionMode } from "@/types/board";

interface BoardDraft {
  name: string;
  description: string;
  background: BoardBackground;
  retentionMode: RetentionMode;
  retentionMinutes: number;
  archiveRetentionMinutes: number;
}

interface CardDraft {
  title: string;
  description: string;
  priority: CardPriority;
  coverColor: CardCoverColor;
  dueDate: string;
}

const AUTO_SAVE_DELAY_MS = 750;
const CARD_AUTO_SAVE_DELAY_MS = 750;
const SAVED_TOAST_SHOW_DELAY_MS = 250;
const SAVED_TOAST_VISIBLE_MS = 1500;
const MIN_RETENTION_MINUTES = 1;
const MAX_RETENTION_MINUTES = 525600;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const labelColors: LabelColor[] = [
  "slate",
  "blue",
  "teal",
  "green",
  "amber",
  "orange",
  "red",
  "purple",
  "pink"
];

const labelColorStyles: Record<LabelColor, { chip: string; dot: string }> = {
  slate: { chip: "label-chip-slate", dot: "label-dot-slate" },
  blue: { chip: "label-chip-blue", dot: "label-dot-blue" },
  teal: { chip: "label-chip-teal", dot: "label-dot-teal" },
  green: { chip: "label-chip-green", dot: "label-dot-green" },
  amber: { chip: "label-chip-amber", dot: "label-dot-amber" },
  orange: { chip: "label-chip-orange", dot: "label-dot-orange" },
  red: { chip: "label-chip-red", dot: "label-dot-red" },
  purple: { chip: "label-chip-purple", dot: "label-dot-purple" },
  pink: { chip: "label-chip-pink", dot: "label-dot-pink" }
};

const coverColors: CardCoverColor[] = [
  "none",
  "slate",
  "blue",
  "teal",
  "green",
  "amber",
  "orange",
  "red",
  "purple",
  "pink"
];

const coverColorClasses: Record<CardCoverColor, string> = {
  none: "bg-transparent",
  slate: "bg-slate-500",
  blue: "bg-blue-500",
  teal: "bg-teal-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  orange: "bg-orange-500",
  red: "bg-rose-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500"
};

const coverColorSurfaceClasses: Record<CardCoverColor, string> = {
  none: "bg-background/90",
  slate: "card-cover-surface-slate",
  blue: "card-cover-surface-blue",
  teal: "card-cover-surface-teal",
  green: "card-cover-surface-green",
  amber: "card-cover-surface-amber",
  orange: "card-cover-surface-orange",
  red: "card-cover-surface-red",
  purple: "card-cover-surface-purple",
  pink: "card-cover-surface-pink"
};

function sortChecklistItems(items: ChecklistItem[]): ChecklistItem[] {
  return [...items].sort((a, b) => a.position - b.position);
}

function sortChecklists(checklists: Checklist[]): Checklist[] {
  return [...checklists]
    .sort((a, b) => a.position - b.position)
    .map((checklist) => ({
      ...checklist,
      items: sortChecklistItems(checklist.items ?? [])
    }));
}

function sortCardsByPosition(cards: BoardCard[]): BoardCard[] {
  return [...cards]
    .sort((a, b) => a.position - b.position)
    .map((card) => ({
      ...card,
      checklists: sortChecklists(card.checklists ?? [])
    }));
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

const LIST_DRAG_PREFIX = "list:";

function toListDragId(listId: string): string {
  return `${LIST_DRAG_PREFIX}${listId}`;
}

function isListDragId(id: unknown): id is string {
  return typeof id === "string" && id.startsWith(LIST_DRAG_PREFIX);
}

function fromListDragId(id: string): string {
  return id.slice(LIST_DRAG_PREFIX.length);
}

function normalizeDragOverId(id: string): string {
  return isListDragId(id) ? fromListDragId(id) : id;
}

function formatDateTimeLocalValue(date: Date): string {
  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function formatDueDateForInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const safeDate = date.getTime() <= 0 ? new Date() : date;
  return formatDateTimeLocalValue(safeDate);
}

function clampYearInDateInput(value: string): string {
  if (!value) {
    return value;
  }
  const [datePart, timePart] = value.split("T");
  const segments = datePart.split("-");
  if (segments.length < 3) {
    return value;
  }
  const [year, month, day] = segments;
  if (year.length <= 4) {
    return value;
  }
  const trimmedYear = year.slice(0, 4);
  const rebuiltDate = `${trimmedYear}-${month}-${day}`;
  return timePart ? `${rebuiltDate}T${timePart}` : rebuiltDate;
}

function toIsoFromDateTimeInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function clampRetentionMinutes(value: number): number {
  if (Number.isNaN(value) || value < MIN_RETENTION_MINUTES) {
    return MIN_RETENTION_MINUTES;
  }
  return Math.min(Math.floor(value), MAX_RETENTION_MINUTES);
}

function splitRetentionMinutes(totalMinutes: number): { days: number; hours: number; minutes: number } {
  const safeTotal = clampRetentionMinutes(totalMinutes);
  const days = Math.floor(safeTotal / MINUTES_PER_DAY);
  const hours = Math.floor((safeTotal % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
  const minutes = safeTotal % MINUTES_PER_HOUR;
  return { days, hours, minutes };
}

function toRetentionMinutes(days: number, hours: number, minutes: number): number {
  const safeDays = Math.max(0, Math.floor(days));
  const safeHours = Math.max(0, Math.floor(hours));
  const safeMinutes = Math.max(0, Math.floor(minutes));
  const total = safeDays * MINUTES_PER_DAY + safeHours * MINUTES_PER_HOUR + safeMinutes;
  return clampRetentionMinutes(total);
}

function parseRetentionInput(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const precision = unitIndex === 0 || size >= 10 ? 0 : 1;
  return `${size.toFixed(precision)} ${units[unitIndex]}`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function getMemberDisplayName(member: BoardMember): string {
  return member.displayName || member.username || "Member";
}

function getCommentSnippet(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length <= 80) return trimmed;
  return `${trimmed.slice(0, 77)}...`;
}

const MENTION_RENDER_TOKEN = /@[\p{L}\p{N}._'-]+/gu;

function renderMentionBody(body: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  for (const match of body.matchAll(MENTION_RENDER_TOKEN)) {
    const index = match.index ?? 0;
    if (index > 0 && !/\s/.test(body[index - 1] ?? "")) {
      continue;
    }
    if (index > lastIndex) {
      parts.push(body.slice(lastIndex, index));
    }
    parts.push(
      <span key={`${index}-${match[0]}`} className="font-semibold">
        {match[0]}
      </span>
    );
    lastIndex = index + match[0].length;
  }
  if (lastIndex < body.length) {
    parts.push(body.slice(lastIndex));
  }
  return parts.length > 0 ? parts : body;
}

const COMMENT_REACTION_CHOICES = ["👍", "🎉", "❤️"];

function CommentNote({
  comment,
  expanded,
  onToggle,
  onReact,
  onDelete,
  variant = "default"
}: {
  comment: BoardComment;
  expanded: boolean;
  onToggle: () => void;
  onReact?: (emoji: string) => void;
  onDelete?: () => void;
  variant?: "default" | "compact";
}): JSX.Element {
  const displayBody = expanded ? comment.body : getCommentSnippet(comment.body);
  const renderedBody = renderMentionBody(displayBody);
  const reactionCounts = new Map(comment.reactions.map((reaction) => [reaction.emoji, reaction.count]));
  const showReactionPicker = Boolean(onReact && expanded);
  const reactionEmojis = showReactionPicker
    ? Array.from(new Set([...COMMENT_REACTION_CHOICES, ...comment.reactions.map((reaction) => reaction.emoji)]))
    : comment.reactions.map((reaction) => reaction.emoji);
  const isCompact = variant === "compact";
  const reactionSummary = comment.reactions
    .map((reaction) => `${reaction.emoji}${reaction.count}`)
    .join(" ");
  if (isCompact && !expanded) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        className="inline-flex w-auto max-w-[240px] min-w-0 items-center gap-1.5 rounded-full border comment-note comment-note-compact px-2 py-1 text-[10px] shadow-sm transition"
      >
        <UserHoverCard user={comment.author}>
          <span className="font-semibold">{getMemberDisplayName(comment.author)}</span>
        </UserHoverCard>
        <span className="truncate comment-note-muted">{renderedBody}</span>
        {reactionSummary.length > 0 && (
          <span className="ml-auto text-[9px] comment-note-subtle">{reactionSummary}</span>
        )}
      </button>
    );
  }
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          onToggle();
        }
      }}
      className="w-full rounded-md border comment-note comment-note-block px-2.5 py-2 text-left text-xs shadow-sm transition"
    >
      <div className="flex items-center justify-between gap-2 text-[10px] comment-note-subtle">
        <UserHoverCard user={comment.author}>
          <span className="font-semibold comment-note-strong">{getMemberDisplayName(comment.author)}</span>
        </UserHoverCard>
        <div className="flex items-center gap-2">
          <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
          {expanded && (
            <button
              type="button"
              className="text-[10px] comment-note-action"
              onClick={(event) => {
                event.stopPropagation();
                onToggle();
              }}
            >
              Collapse
            </button>
          )}
          {expanded && onDelete && (
            <button
              type="button"
              className="text-[10px] comment-note-delete"
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
            >
              Delete
            </button>
          )}
        </div>
      </div>
      <p className="mt-1 text-xs comment-note-strong">{renderedBody}</p>
      {expanded && reactionEmojis.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {reactionEmojis.map((emoji) => {
            const count = reactionCounts.get(emoji) ?? 0;
            const label = count > 0 ? `${emoji} ${count}` : emoji;
            const chipClass = count > 0
              ? "comment-note-chip comment-note-chip-active"
              : "comment-note-chip";
            return showReactionPicker ? (
              <button
                key={`${comment.id}-${emoji}`}
                type="button"
                className={`rounded-full border px-1.5 py-0.5 text-[10px] ${chipClass}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onReact?.(emoji);
                }}
              >
                {label}
              </button>
            ) : (
              <span
                key={`${comment.id}-${emoji}`}
                className={`rounded-full border px-1.5 py-0.5 text-[10px] ${chipClass}`}
              >
                {label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function sortAttachments(attachments: BoardAttachment[]): BoardAttachment[] {
  return [...attachments].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function getTimeLeftLabel(doneEnteredAt: string, nowMs: number, retentionMinutes: number): string {
  const enteredAtMs = new Date(doneEnteredAt).getTime();
  if (Number.isNaN(enteredAtMs)) return "";
  const retentionMs = clampRetentionMinutes(retentionMinutes) * 60 * 1000;
  const remainingMs = retentionMs - (nowMs - enteredAtMs);
  if (remainingMs <= 0) return "Files deleted";
  const second = 1000;
  const minute = 60 * second;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (remainingMs >= 2 * day) {
    const daysLeft = Math.ceil(remainingMs / day);
    return `${daysLeft}d left`;
  }
  if (remainingMs >= 2 * hour) {
    const hoursLeft = Math.ceil(remainingMs / hour);
    return `${hoursLeft}h left`;
  }
  if (remainingMs >= 2 * minute) {
    const minutesLeft = Math.ceil(remainingMs / minute);
    return `${minutesLeft}m left`;
  }
  const secondsLeft = Math.max(1, Math.ceil(remainingMs / second));
  return `${secondsLeft}s left`;
}

function getArchiveCountdownLabel(archivedAt: string | null, nowMs: number, retentionMinutes: number, expiredLabel = "Deleting soon"): string {
  if (!archivedAt) return "";
  const archivedAtMs = new Date(archivedAt).getTime();
  if (Number.isNaN(archivedAtMs)) return "";
  const retentionMs = clampRetentionMinutes(retentionMinutes) * 60 * 1000;
  const remainingMs = retentionMs - (nowMs - archivedAtMs);
  if (remainingMs <= 0) return expiredLabel;
  const second = 1000;
  const minute = 60 * second;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (remainingMs >= 2 * day) {
    const daysLeft = Math.ceil(remainingMs / day);
    return `${daysLeft}d left`;
  }
  if (remainingMs >= 2 * hour) {
    const hoursLeft = Math.ceil(remainingMs / hour);
    return `${hoursLeft}h left`;
  }
  if (remainingMs >= 2 * minute) {
    const minutesLeft = Math.ceil(remainingMs / minute);
    return `${minutesLeft}m left`;
  }
  const secondsLeft = Math.max(1, Math.ceil(remainingMs / second));
  return `${secondsLeft}s left`;
}

function getChecklistProgress(checklist: Checklist): { done: number; total: number; percent: number } {
  const total = checklist.items?.length ?? 0;
  const done = checklist.items?.filter((item) => item.isDone).length ?? 0;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return { done, total, percent };
}

function formatDueDateLabel(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const safeDate = date.getTime() <= 0 ? new Date() : date;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(safeDate);
}

function getPriorityBadgeClass(priority: CardPriority): string {
  switch (priority) {
    case "low":    return "priority-badge priority-badge-low";
    case "medium": return "priority-badge priority-badge-medium";
    case "high":   return "priority-badge priority-badge-high";
    case "urgent": return "priority-badge priority-badge-urgent";
    default:       return "priority-badge";
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
    coverColor: card.coverColor ?? "none",
    dueDate: formatDueDateForInput(card.dueDate)
  };
}

function isCardDraftEqual(a: CardDraft | null, b: CardDraft | null): boolean {
  if (!a || !b) return false;
  return (
    a.title === b.title &&
    a.description === b.description &&
    a.priority === b.priority &&
    a.coverColor === b.coverColor &&
    a.dueDate === b.dueDate
  );
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

function CardSummary({
  card,
  nowMs,
  retentionMinutes,
  showChecklists = true,
  onChecklistItemToggle,
  onChecklistOpen,
  expandedCommentIds,
  onToggleComment,
  onReact,
  onDeleteComment,
  expandedCardCommentGroups,
  onToggleCardCommentGroup
}: {
  card: BoardCard;
  nowMs: number;
  retentionMinutes: number;
  showChecklists?: boolean;
  onChecklistItemToggle?: (
    cardId: string,
    checklistId: string,
    item: ChecklistItem,
    nextValue: boolean
  ) => void;
  onChecklistOpen?: (card: BoardCard, checklistId: string) => void;
  expandedCommentIds?: Set<string>;
  onToggleComment?: (commentId: string) => void;
  onReact?: (commentId: string, emoji: string) => void;
  onDeleteComment?: (comment: BoardComment) => void;
  expandedCardCommentGroups?: Set<string>;
  onToggleCardCommentGroup?: (cardId: string) => void;
  onDownloadAllAttachments?: (card: BoardCard) => void;
}): JSX.Element {
  const dueLabel = formatDueDateLabel(card.dueDate);
  const checklists = showChecklists ? card.checklists ?? [] : [];
  const cardComments = card.comments ?? [];
  const showAllComments = expandedCardCommentGroups?.has(card.id) ?? false;
  const visibleComments = showAllComments ? cardComments : cardComments.slice(0, 2);
  const canToggleItems = Boolean(onChecklistItemToggle);
  const handleChecklistBodyClick = (
    event: React.MouseEvent<HTMLElement>,
    checklistId: string
  ): void => {
    const target = event.target as HTMLElement;
    if (target.closest("summary")) return;
    if (target.closest("input, button, a")) return;
    const details = target.closest("details") as HTMLDetailsElement | null;
    if (details && !details.open) return;
    onChecklistOpen?.(card, checklistId);
  };
  return (
    <div className="space-y-2">
      <p className="line-clamp-2 text-sm font-semibold text-foreground">{card.title}</p>
      <div className="space-y-2">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Highlights</p>
          <div className="flex flex-wrap items-center gap-2">
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
              <span className="rounded-full border badge-rose px-2 py-0.5 text-[11px]">
                {getTimeLeftLabel(card.doneEnteredAt, nowMs, retentionMinutes)}
              </span>
            )}
            {card.assignees.length > 0 && (
              <div className="flex items-center gap-1">
                {card.assignees.map((assignee) => (
                  <UserHoverCard key={assignee.id} user={assignee}>
                    <span
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full avatar-chip text-[10px] font-semibold"
                      title={getMemberDisplayName(assignee)}
                    >
                      {getInitials(getMemberDisplayName(assignee))}
                    </span>
                  </UserHoverCard>
                ))}
              </div>
            )}
          </div>
        </div>
        {card.labels.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Tags</p>
            <div className="flex flex-wrap gap-1">
              {card.labels.map((label) => (
                <span
                  key={label.id}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${labelColorStyles[label.color].chip}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${labelColorStyles[label.color].dot}`} />
                  {label.name}
                </span>
              ))}
            </div>
          </div>
        )}
        {cardComments.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Notes</p>
            <div className="flex flex-wrap gap-1">
              {visibleComments.map((comment) => (
                <CommentNote
                  key={comment.id}
                  comment={comment}
                  expanded={expandedCommentIds?.has(comment.id) ?? false}
                  onToggle={() => onToggleComment?.(comment.id)}
                  onReact={onReact ? (emoji) => onReact(comment.id, emoji) : undefined}
                  onDelete={onDeleteComment ? () => onDeleteComment(comment) : undefined}
                  variant="compact"
                />
              ))}
              {cardComments.length > 2 && onToggleCardCommentGroup && (
                <button
                  type="button"
                  className="basis-full text-[10px] text-muted-foreground underline underline-offset-2"
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleCardCommentGroup(card.id);
                  }}
                >
                  {showAllComments ? "Show less" : `Show all (${cardComments.length})`}
                </button>
              )}
              {!onToggleCardCommentGroup && cardComments.length > visibleComments.length && (
                <span className="basis-full text-[10px] text-muted-foreground">
                  +{cardComments.length - visibleComments.length} more comments
                </span>
              )}
            </div>
          </div>
        )}
        {checklists.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Checklists</p>
            {checklists.map((checklist) => {
              const progress = getChecklistProgress(checklist);
              return (
                <details
                  key={checklist.id}
                  className="rounded-md border border-border/60 bg-muted/40 px-2 py-1.5"
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <summary className="flex cursor-pointer items-center justify-between text-[11px] font-medium text-muted-foreground">
                    <span className="flex min-w-0 items-center gap-1">
                      <ListChecks className="h-3 w-3" />
                      <span className="truncate">{checklist.title}</span>
                    </span>
                    <span>{progress.done}/{progress.total}</span>
                  </summary>
                  <div
                    className="mt-2 space-y-2"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleChecklistBodyClick(event, checklist.id);
                    }}
                  >
                    <div className="h-1.5 w-full rounded-full bg-muted/60">
                      <div
                        className="h-1.5 rounded-full bg-emerald-500/80"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                    {checklist.items.length > 0 ? (
                      <ul className="space-y-1 text-[11px] text-muted-foreground">
                        {checklist.items.map((item) => (
                          <li key={item.id} className="flex items-center gap-1.5">
                            {canToggleItems ? (
                              <input
                                type="checkbox"
                                className="mt-0.5 h-3.5 w-3.5 rounded border-muted-foreground/40 text-emerald-500"
                                checked={item.isDone}
                                onChange={(event) => {
                                  event.stopPropagation();
                                  onChecklistItemToggle?.(card.id, checklist.id, item, event.target.checked);
                                }}
                                onClick={(event) => event.stopPropagation()}
                                aria-label={`Mark ${item.title} ${item.isDone ? "not done" : "done"}`}
                              />
                            ) : (
                              <span
                                className={`inline-flex h-3 w-3 items-center justify-center rounded-sm border ${
                                  item.isDone
                                    ? "border-emerald-500/80 bg-emerald-500/80 text-white"
                                    : "border-muted-foreground/40"
                                }`}
                              >
                                {item.isDone && <Check className="h-2 w-2" />}
                              </span>
                            )}
                            <span className={item.isDone ? "line-through text-muted-foreground/70" : ""}>
                              {item.title}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">No items yet.</p>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
// ---------------------------------------------------------------------------
// SortableCard — wraps a card with dnd-kit drag handle

// ---------------------------------------------------------------------------

function SortableCard({
  card,
  onEdit,
  nowMs,
  retentionMinutes,
  onChecklistItemToggle,
  onChecklistOpen,
  expandedCommentIds,
  onToggleComment,
  onReact,
  onDeleteComment,
  expandedCardCommentGroups,
  onToggleCardCommentGroup,
  onDownloadAllAttachments,
}: {
  card: BoardCard;
  onEdit: (card: BoardCard) => void;
  nowMs: number;
  retentionMinutes: number;
  onChecklistItemToggle?: (
    cardId: string,
    checklistId: string,
    item: ChecklistItem,
    nextValue: boolean
  ) => void;
  onChecklistOpen?: (card: BoardCard, checklistId: string) => void;
  expandedCommentIds?: Set<string>;
  onToggleComment?: (commentId: string) => void;
  onReact?: (commentId: string, emoji: string) => void;
  onDeleteComment?: (comment: BoardComment) => void;
  expandedCardCommentGroups?: Set<string>;
  onToggleCardCommentGroup?: (cardId: string) => void;
  onDownloadAllAttachments?: (card: BoardCard) => void;
}): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} data-card-id={card.id}>
      <div
        className={`group flex items-start gap-2 rounded-md border border-border/70 ${coverColorSurfaceClasses[card.coverColor ?? "none"]} px-3 py-2 transition-all duration-150 ${
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
          <CardSummary
            card={card}
            nowMs={nowMs}
            retentionMinutes={retentionMinutes}
            onChecklistItemToggle={onChecklistItemToggle}
            onChecklistOpen={onChecklistOpen}
            expandedCommentIds={expandedCommentIds}
            onToggleComment={onToggleComment}
            onReact={onReact}
            onDeleteComment={onDeleteComment}
            expandedCardCommentGroups={expandedCardCommentGroups}
            onToggleCardCommentGroup={onToggleCardCommentGroup}
          />
        </div>
        <div className="mt-0.5 flex shrink-0 flex-col items-center gap-1">
          {card.attachments.length > 0 && onDownloadAllAttachments && (
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground opacity-60 transition-opacity hover:text-foreground group-hover:opacity-100"
              title="Download all"
              onClick={(event) => {
                event.stopPropagation();
                onDownloadAllAttachments(card);
              }}
            >
              <Download className="h-4 w-4" />
            </button>
          )}
          {/* Drag handle — only this area initiates drag */}
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="rounded p-0.5 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100 touch-none cursor-grab active:cursor-grabbing"
            tabIndex={-1}
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
// ---------------------------------------------------------------------------
// SortableListContainer — wraps a list with dnd-kit drag handle

// ---------------------------------------------------------------------------

function SortableListContainer({
  listId,
  children,
}: {
  listId: string;
  children: (options: {
    dragHandleProps: React.HTMLAttributes<HTMLButtonElement>;
    isDragging: boolean;
  }) => React.ReactNode;
}): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: toListDragId(listId)
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      data-list-id={listId}
      data-testid={`list-${listId}`}
      className={isDragging ? "opacity-60" : undefined}
    >
      {children({
        dragHandleProps: {
          ...attributes,
          ...listeners
        },
        isDragging
      })}
    </div>
  );
}
// ---------------------------------------------------------------------------
// ListDropZone — makes an empty list accept drops

// ---------------------------------------------------------------------------

function ListDropZone({ listId, isCardDrag }: { listId: string; isCardDrag: boolean }): JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id: listId });
  const active = isOver && isCardDrag;
  return (
    <div
      ref={setNodeRef}
      className={`rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground transition-colors ${
        active ? "border-primary/50 bg-primary/5" : "border-border/50 bg-background/70"
      }`}
    >
      {active ? "Drop here" : "No cards yet. Add one below."}
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
  const [retentionMode, setRetentionMode] = useState<RetentionMode>("card_and_attachments");
  const [retentionDays, setRetentionDays] = useState(7);
  const [retentionHours, setRetentionHours] = useState(0);
  const [retentionMinutesPart, setRetentionMinutesPart] = useState(0);
  const [archiveRetentionDays, setArchiveRetentionDays] = useState(7);
  const [archiveRetentionHours, setArchiveRetentionHours] = useState(0);
  const [archiveRetentionMinutesPart, setArchiveRetentionMinutesPart] = useState(0);
  const [newBoardComment, setNewBoardComment] = useState("");
  const [newListCommentDrafts, setNewListCommentDrafts] = useState<Record<string, string>>({});
  const [newCardComment, setNewCardComment] = useState("");
  const [expandedCommentIds, setExpandedCommentIds] = useState<Set<string>>(new Set());
  const [expandedListCommentGroups, setExpandedListCommentGroups] = useState<Set<string>>(new Set());
  const [expandedCardCommentGroups, setExpandedCardCommentGroups] = useState<Set<string>>(new Set());
  const [archivedLists, setArchivedLists] = useState<ArchivedListEntry[]>([]);
  const [isArchivedOpen, setIsArchivedOpen] = useState(false);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [archivedError, setArchivedError] = useState<string | null>(null);
  const [restoreConflict, setRestoreConflict] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState<LabelColor>("blue");
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>({});
  const [labelColorDrafts, setLabelColorDrafts] = useState<Record<string, LabelColor>>({});
  const [labelSavingIds, setLabelSavingIds] = useState<Set<string>>(new Set());
  const [labelToDelete, setLabelToDelete] = useState<BoardLabel | null>(null);
  const [newListName, setNewListName] = useState("");
  const [newListDone, setNewListDone] = useState(false);
  const [listNameDrafts, setListNameDrafts] = useState<Record<string, string>>({});
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [newCardTitles, setNewCardTitles] = useState<Record<string, string>>({});
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [cardDraft, setCardDraft] = useState<CardDraft | null>(null);
  const [cardSaveStatus, setCardSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [newChecklistItemTitles, setNewChecklistItemTitles] = useState<Record<string, string>>({});
  const [checklistTitleDrafts, setChecklistTitleDrafts] = useState<Record<string, string>>({});
  const [checklistItemTitleDrafts, setChecklistItemTitleDrafts] = useState<Record<string, string>>({});
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDeleteBoardOpen, setIsDeleteBoardOpen] = useState(false);
  const [isArchiveBoardOpen, setIsArchiveBoardOpen] = useState(false);
  const [listToDelete, setListToDelete] = useState<BoardList | null>(null);
  const [cardToDelete, setCardToDelete] = useState<BoardCard | null>(null);
  const [commentToDelete, setCommentToDelete] = useState<BoardComment | null>(null);
  const [checklistToDelete, setChecklistToDelete] = useState<Checklist | null>(null);
  const [checklistItemToDelete, setChecklistItemToDelete] = useState<{ item: ChecklistItem; cardId: string } | null>(null);
  const refreshMentions = useMentionStore((state) => state.refresh);
  const commentMentionIds = useMemo(() => {
    if (!board) return [];
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
  const [scrollToChecklistId, setScrollToChecklistId] = useState<string | null>(null);
  // List drag (dnd-kit)
  const [activeListId, setActiveListId] = useState<string | null>(null);
  // Card drag (dnd-kit)
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const preDragListsRef = useRef<BoardList[] | null>(null);
  const preDragListOrderRef = useRef<BoardList[] | null>(null);
  const [isAutosavingBoard, setIsAutosavingBoard] = useState(false);
  const [listSavingIds, setListSavingIds] = useState<Set<string>>(new Set());
  const [showSavedNotice, setShowSavedNotice] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const autoSaveTimeoutRef = useRef<number | null>(null);
  const listAutoSaveTimeoutsRef = useRef<Record<string, number>>({});
  const labelAutoSaveTimeoutsRef = useRef<Record<string, number>>({});
  const listInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const checklistSectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const cardAutoSaveTimeoutRef = useRef<number | null>(null);
  const lastSyncedCardRef = useRef<CardDraft | null>(null);
  const savedShowTimeoutRef = useRef<number | null>(null);
  const savedHideTimeoutRef = useRef<number | null>(null);
  const lastCleanupSyncRef = useRef(0);
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
  const hasDoneCards = useMemo(
    () => (board ? board.lists.some((list) => list.cards.some((card) => Boolean(card.doneEnteredAt))) : false),
    [board]
  );
  const retentionTotalMinutes = useMemo(
    () => toRetentionMinutes(retentionDays, retentionHours, retentionMinutesPart),
    [retentionDays, retentionHours, retentionMinutesPart]
  );
  const archiveRetentionTotalMinutes = useMemo(
    () => toRetentionMinutes(archiveRetentionDays, archiveRetentionHours, archiveRetentionMinutesPart),
    [archiveRetentionDays, archiveRetentionHours, archiveRetentionMinutesPart]
  );
  const hasExpired = useMemo(() => {
    if (!board) return false;
    const retentionMs = clampRetentionMinutes(retentionTotalMinutes) * 60 * 1000;
    return board.lists.some((list) =>
      list.cards.some((card) => {
        if (!card.doneEnteredAt) return false;
        const enteredAtMs = new Date(card.doneEnteredAt).getTime();
        if (Number.isNaN(enteredAtMs)) return false;
        return nowMs - enteredAtMs >= retentionMs;
      })
    );
  }, [board, nowMs, retentionTotalMinutes]);
  const selectedCardWithList = useMemo(
    () => getCardFromBoard(board, selectedCardId),
    [board, selectedCardId]
  );
  const selectedCardChecklists = useMemo(
    () => selectedCardWithList?.card.checklists ?? [],
    [selectedCardWithList]
  );
  const selectedCardAttachments = useMemo(
    () => selectedCardWithList?.card.attachments ?? [],
    [selectedCardWithList]
  );
  const boardLabels = useMemo(() => board?.labels ?? [], [board]);
  const boardMembers = useMemo<BoardMember[]>(() => board?.members ?? [], [board]);
  const activeList = useMemo(
    () => (activeListId ? orderedLists.find((list) => list.id === activeListId) ?? null : null),
    [orderedLists, activeListId]
  );
  // The card currently being dragged (for the DragOverlay ghost)
  const activeCard = useMemo(
    () => (activeCardId ? board?.lists.flatMap((l) => l.cards).find((c) => c.id === activeCardId) ?? null : null),
    [board, activeCardId]
  );
  const resolvedBoardBackground = board?.background ?? boardBackground;
  const activeBannerClass = useMemo(() => getBoardBackgroundClass(resolvedBoardBackground), [resolvedBoardBackground]);
  const activeSurfaceClass = useMemo(() => getBoardSurfaceClass(resolvedBoardBackground), [resolvedBoardBackground]);
  const applyBoardBackground = useCallback((next: BoardBackground): void => {
    setBoardBackground(next);
    setBoard((current) => (current ? { ...current, background: next } : current));
  }, []);
  const focusListInput = useCallback((listId: string): void => {
    window.requestAnimationFrame(() => {
      const input = listInputRefs.current[listId];
      if (!input) return;
      input.focus({ preventScroll: true });
      const cursorAt = input.value.length;
      input.setSelectionRange(cursorAt, cursorAt);
    });
  }, []);
  useEffect(() => {
    if (!editingListId) return;
    focusListInput(editingListId);
  }, [editingListId, focusListInput]);
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
  const clearCardAutosaveTimeout = useCallback((): void => {
    if (cardAutoSaveTimeoutRef.current !== null) {
      window.clearTimeout(cardAutoSaveTimeoutRef.current);
      cardAutoSaveTimeoutRef.current = null;
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
  const clearLabelAutosaveTimeout = (labelId: string): void => {
    const timeout = labelAutoSaveTimeoutsRef.current[labelId];
    if (timeout !== undefined) {
      window.clearTimeout(timeout);
      delete labelAutoSaveTimeoutsRef.current[labelId];
    }
  };
  const clearAllLabelAutosaveTimeouts = (): void => {
    Object.values(labelAutoSaveTimeoutsRef.current).forEach((t) => window.clearTimeout(t));
    labelAutoSaveTimeoutsRef.current = {};
  };
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
  }, []);
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
  }, []);
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
  }, []);
  const applyRetentionParts = useCallback((days: number, hours: number, minutes: number): void => {
    const totalMinutes = toRetentionMinutes(days, hours, minutes);
    const nextParts = splitRetentionMinutes(totalMinutes);
    setRetentionDays(nextParts.days);
    setRetentionHours(nextParts.hours);
    setRetentionMinutesPart(nextParts.minutes);
  }, []);
  const applyArchiveRetentionParts = useCallback((days: number, hours: number, minutes: number): void => {
    const totalMinutes = toRetentionMinutes(days, hours, minutes);
    const nextParts = splitRetentionMinutes(totalMinutes);
    setArchiveRetentionDays(nextParts.days);
    setArchiveRetentionHours(nextParts.hours);
    setArchiveRetentionMinutesPart(nextParts.minutes);
  }, []);
  const hydrateBoardState = useCallback((data: BoardDetail): void => {
    const sortedLists = sortBoardListsWithCards(data.lists);
    setBoard({ ...data, lists: sortedLists });
    setBoardName(data.name);
    setBoardDescription(data.description ?? "");
    setBoardBackground(data.background);
    setRetentionMode(data.retentionMode ?? "card_and_attachments");
    const retentionParts = splitRetentionMinutes(data.retentionMinutes ?? MIN_RETENTION_MINUTES);
    setRetentionDays(retentionParts.days);
    setRetentionHours(retentionParts.hours);
    setRetentionMinutesPart(retentionParts.minutes);
    const archiveRetentionParts = splitRetentionMinutes(data.archiveRetentionMinutes ?? MIN_RETENTION_MINUTES);
    setArchiveRetentionDays(archiveRetentionParts.days);
    setArchiveRetentionHours(archiveRetentionParts.hours);
    setArchiveRetentionMinutesPart(archiveRetentionParts.minutes);
    setListNameDrafts(Object.fromEntries(sortedLists.map((list) => [list.id, list.name])));
    const syncedDraft: BoardDraft = {
      name: data.name,
      description: data.description ?? "",
      background: data.background,
      retentionMode: data.retentionMode ?? "card_and_attachments",
      retentionMinutes: data.retentionMinutes ?? MIN_RETENTION_MINUTES,
      archiveRetentionMinutes: data.archiveRetentionMinutes ?? MIN_RETENTION_MINUTES
    };
    lastSyncedBoardRef.current = syncedDraft;
    currentDraftBoardRef.current = syncedDraft;
    initializedBoardRef.current = true;
    const boardLabels = data.labels ?? [];
    setLabelDrafts(Object.fromEntries(boardLabels.map((label) => [label.id, label.name])));
    setLabelColorDrafts(Object.fromEntries(boardLabels.map((label) => [label.id, label.color])));
    setLabelSavingIds(new Set());
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
    setNewListCommentDrafts((current) => {
      const next = { ...current };
      for (const list of sortedLists) {
        if (next[list.id] === undefined) next[list.id] = "";
      }
      for (const key of Object.keys(next)) {
        if (!sortedLists.some((list) => list.id === key)) delete next[key];
      }
      return next;
    });
  }, []);
  const updateCardInBoard = useCallback((cardId: string, updater: (card: BoardCard) => BoardCard): void => {
    setBoard((current) => {
      if (!current) return current;
      return {
        ...current,
        lists: current.lists.map((list) => ({
          ...list,
          cards: list.cards.map((card) => (card.id === cardId ? updater(card) : card))
        }))
      };
    });
  }, []);
  const replaceCardInBoard = useCallback((updated: BoardCard): void => {
    setBoard((current) => {
      if (!current) return current;
      return {
        ...current,
        lists: current.lists.map((list) => {
          if (list.id !== updated.listId) return list;
          const exists = list.cards.some((card) => card.id === updated.id);
          const nextCards = exists
            ? list.cards.map((card) => (card.id === updated.id ? updated : card))
            : [...list.cards, updated];
          return { ...list, cards: sortCardsByPosition(nextCards) };
        })
      };
    });
  }, []);
  const updateCardChecklists = useCallback(
    (cardId: string, updater: (checklists: Checklist[]) => Checklist[]): void => {
      updateCardInBoard(cardId, (card) => ({
        ...card,
        checklists: sortChecklists(updater(card.checklists ?? []))
      }));
    },
    [updateCardInBoard]
  );
  const updateChecklistInCard = useCallback(
    (cardId: string, checklistId: string, updater: (checklist: Checklist) => Checklist): void => {
      updateCardChecklists(cardId, (checklists) =>
        checklists.map((checklist) => (checklist.id === checklistId ? updater(checklist) : checklist))
      );
    },
    [updateCardChecklists]
  );
  const updateChecklistItemsInCard = useCallback(
    (cardId: string, checklistId: string, updater: (items: ChecklistItem[]) => ChecklistItem[]): void => {
      updateChecklistInCard(cardId, checklistId, (checklist) => ({
        ...checklist,
        items: sortChecklistItems(updater(checklist.items ?? []))
      }));
    },
    [updateChecklistInCard]
  );
  const updateCardAttachments = useCallback(
    (cardId: string, updater: (attachments: BoardAttachment[]) => BoardAttachment[]): void => {
      updateCardInBoard(cardId, (card) => ({
        ...card,
        attachments: sortAttachments(updater(card.attachments ?? []))
      }));
    },
    [updateCardInBoard]
  );
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
  }, []);
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
  }, []);
  const loadBoard = useCallback(async (showLoading: boolean): Promise<void> => {
    if (!boardId) {
      if (showLoading) setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    try {
      const data = await getBoardById(boardId);
      hydrateBoardState(data);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load board");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [boardId, hydrateBoardState]);
  const refreshBoardSilently = useCallback(async (): Promise<void> => {
    await loadBoard(false);
  }, [loadBoard]);
  useEffect(() => {
    void loadBoard(true);
  }, [loadBoard]);
  useEffect(() => {
    if (!board || !hasDoneCards) return;
    if (!hasExpired) return;
    if (nowMs - lastCleanupSyncRef.current < 2000) return;
    lastCleanupSyncRef.current = nowMs;
    void refreshBoardSilently();
  }, [board, hasDoneCards, hasExpired, nowMs, refreshBoardSilently]);
  useEffect(() => {
    if (!selectedCardId) return;
    if (!selectedCardWithList) {
      setSelectedCardId(null);
      setCardDraft(null);
      setNewChecklistTitle("");
      setNewChecklistItemTitles({});
      setChecklistTitleDrafts({});
      setChecklistItemTitleDrafts({});
      setChecklistToDelete(null);
      setChecklistItemToDelete(null);
      setAttachmentError(null);
      setIsUploadingAttachments(false);
      setNewCardComment("");
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
      draft.background !== synced.background ||
      draft.retentionMode !== synced.retentionMode ||
      draft.retentionMinutes !== synced.retentionMinutes ||
      draft.archiveRetentionMinutes !== synced.archiveRetentionMinutes;
    if (!hasChanges) return;
    if (draft.name.length < 2) { setError("Board name must be at least 2 characters."); return; }
    setIsAutosavingBoard(true);
    try {
      const updated = await updateBoard(boardId, {
        name: draft.name,
        description: draft.description,
        background: draft.background,
        retentionMode: draft.retentionMode,
        retentionMinutes: draft.retentionMinutes,
        archiveRetentionMinutes: draft.archiveRetentionMinutes
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
      setLabelSavingIds((c) => { const n = new Set(c); n.delete(labelId); return n; });
    }
  }, [triggerSavedNotice]);
  const scheduleLabelAutosave = useCallback((labelId: string, name: string, color: LabelColor): void => {
    clearLabelAutosaveTimeout(labelId);
    labelAutoSaveTimeoutsRef.current[labelId] = window.setTimeout(() => {
      void runLabelAutosave(labelId, name, color);
    }, AUTO_SAVE_DELAY_MS);
  }, [runLabelAutosave]);
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
    autoSaveTimeoutRef.current = window.setTimeout(() => { void runBoardAutosave(); }, AUTO_SAVE_DELAY_MS);
    return () => {
      if (autoSaveTimeoutRef.current !== null) {
        window.clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
    };
  }, [boardId, boardName, boardDescription, boardBackground, retentionMode, retentionTotalMinutes, archiveRetentionTotalMinutes, runBoardAutosave, clearSavedNoticeTimers]);
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current !== null) window.clearTimeout(autoSaveTimeoutRef.current);
      clearAllListAutosaveTimeouts();
      clearAllLabelAutosaveTimeouts();
      clearSavedNoticeTimers();
      clearCardAutosaveTimeout();
    };
  }, [clearSavedNoticeTimers, clearCardAutosaveTimeout]);
  // -------------------------------------------------------------------------
  // dnd-kit card drag handlers
  // -------------------------------------------------------------------------
  const onCardDragStart = useCallback((event: DragStartEvent): void => {
    setActiveCardId(event.active.id as string);
    setActiveListId(null);
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
    const overId = normalizeDragOverId(over.id as string);
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
    const overId = normalizeDragOverId(over.id as string);
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
  // List drag (dnd-kit)
  // -------------------------------------------------------------------------
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
      // overId is either a plain list ID (from ListDropZone) or a card ID
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
  }, [board, orderedLists]);
  const onListDragEnd = useCallback(async (): Promise<void> => {
    const prevLists = preDragListOrderRef.current;
    setActiveListId(null);
    preDragListOrderRef.current = null;
    if (!board || !boardId) return;
    // Order is already applied optimistically in onListDragOver — just persist it
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
  }, [board, boardId, triggerSavedNotice]);
  // -------------------------------------------------------------------------
  // dnd-kit shared handlers
  // -------------------------------------------------------------------------
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
      clearLabelAutosaveTimeout(labelToDelete.id);
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
  const onToggleCardLabel = async (cardId: string, labelId: string, nextValue: boolean): Promise<void> => {
    try {
      const updated = nextValue
        ? await assignLabelToCard(cardId, labelId)
        : await removeLabelFromCard(cardId, labelId);
      replaceCardInBoard(updated);
      setError(null);
      triggerSavedNotice();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Failed to update label");
    }
  };
  const onToggleAssignee = async (cardId: string, userId: string, nextValue: boolean): Promise<void> => {
    try {
      const updated = nextValue
        ? await assignMemberToCard(cardId, userId)
        : await removeMemberFromCard(cardId, userId);
      replaceCardInBoard(updated);
      setError(null);
      triggerSavedNotice();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Failed to update assignees");
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
  const onCreateCardComment = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!selectedCardWithList) return;
    const body = newCardComment.trim();
    if (body.length < 1) return;
    try {
      const mentions = extractMentionIds(body, boardMembers);
      const created = await createCardComment(selectedCardWithList.card.id, { body, mentions });
      updateCardInBoard(selectedCardWithList.card.id, (card) => ({
        ...card,
        comments: [...(card.comments ?? []), created]
      }));
      setNewCardComment("");
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
  }, [boardId]);
  const openArchivedLists = useCallback((): void => {
    setIsArchivedOpen(true);
    void loadArchivedLists();
  }, [loadArchivedLists]);
  const onArchiveBoard = useCallback(async (): Promise<void> => {
    if (!boardId) return;
    try {
      await archiveBoard(boardId);
      setIsArchiveBoardOpen(false);
      navigate("/boards");
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Failed to archive board");
    }
  }, [boardId, navigate]);
  const onArchiveList = useCallback(async (listId: string): Promise<void> => {
    try {
      await archiveList(listId);
      setBoard((current) => (current ? { ...current, lists: current.lists.filter((list) => list.id !== listId) } : current));
      triggerSavedNotice();
      if (isArchivedOpen) void loadArchivedLists();
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Failed to archive list");
    }
  }, [isArchivedOpen, loadArchivedLists, triggerSavedNotice]);
  const onArchiveCard = useCallback(async (): Promise<void> => {
    if (!selectedCardWithList) return;
    try {
      await archiveCard(selectedCardWithList.card.id);
      setBoard((current) => {
        if (!current) return current;
        return {
          ...current,
          lists: current.lists.map((list) =>
            list.id === selectedCardWithList.list.id
              ? { ...list, cards: list.cards.filter((card) => card.id !== selectedCardWithList.card.id) }
              : list
          )
        };
      });
      setSelectedCardId(null);
      setCardDraft(null);
      triggerSavedNotice();
      if (isArchivedOpen) void loadArchivedLists();
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Failed to archive card");
    }
  }, [selectedCardWithList, isArchivedOpen, loadArchivedLists, triggerSavedNotice]);
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
  }, [hydrateBoardState, loadArchivedLists, refreshBoardSilently]);
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
  }, [board, restoreArchivedEntry]);
  const onCreateChecklist = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!selectedCardWithList) return;
    const title = newChecklistTitle.trim();
    if (title.length < 1) { setError("Checklist title cannot be empty."); return; }
    try {
      const created = await createChecklist(selectedCardWithList.card.id, { title });
      updateCardChecklists(selectedCardWithList.card.id, (checklists) => [...checklists, created]);
      setNewChecklistTitle("");
      setError(null);
      triggerSavedNotice();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create checklist");
    }
  };
  const onSaveChecklistTitle = async (cardId: string, checklist: Checklist): Promise<void> => {
    const draft = checklistTitleDrafts[checklist.id] ?? checklist.title;
    const title = draft.trim();
    if (title.length < 1) {
      setChecklistTitleDrafts((current) => ({ ...current, [checklist.id]: checklist.title }));
      setError("Checklist title cannot be empty.");
      return;
    }
    if (title === checklist.title) return;
    try {
      const updated = await updateChecklist(checklist.id, { title });
      updateChecklistInCard(cardId, checklist.id, () => updated);
      setChecklistTitleDrafts((current) => ({ ...current, [checklist.id]: updated.title }));
      setError(null);
      triggerSavedNotice();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update checklist");
    }
  };
  const onDeleteChecklist = async (): Promise<void> => {
    if (!checklistToDelete) return;
    try {
      await deleteChecklist(checklistToDelete.id);
      updateCardChecklists(checklistToDelete.cardId, (checklists) =>
        checklists.filter((checklist) => checklist.id !== checklistToDelete.id)
      );
      setChecklistTitleDrafts((current) => {
        const next = { ...current };
        delete next[checklistToDelete.id];
        return next;
      });
      setChecklistItemTitleDrafts((current) => {
        const next = { ...current };
        checklistToDelete.items.forEach((item) => {
          delete next[item.id];
        });
        return next;
      });
      setNewChecklistItemTitles((current) => {
        const next = { ...current };
        delete next[checklistToDelete.id];
        return next;
      });
      setChecklistToDelete(null);
      setError(null);
      triggerSavedNotice();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete checklist");
    }
  };
  const onCreateChecklistItem = async (
    cardId: string,
    checklistId: string,
    event: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();
    const title = (newChecklistItemTitles[checklistId] ?? "").trim();
    if (title.length < 1) { setError("Checklist item cannot be empty."); return; }
    try {
      const created = await createChecklistItem(checklistId, { title });
      updateChecklistItemsInCard(cardId, checklistId, (items) => [...items, created]);
      setNewChecklistItemTitles((current) => ({ ...current, [checklistId]: "" }));
      setError(null);
      triggerSavedNotice();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create checklist item");
    }
  };
  const onSaveChecklistItemTitle = async (
    cardId: string,
    checklistId: string,
    item: ChecklistItem
  ): Promise<void> => {
    const draft = checklistItemTitleDrafts[item.id] ?? item.title;
    const title = draft.trim();
    if (title.length < 1) {
      setChecklistItemTitleDrafts((current) => ({ ...current, [item.id]: item.title }));
      setError("Checklist item cannot be empty.");
      return;
    }
    if (title === item.title) return;
    try {
      const updated = await updateChecklistItem(item.id, { title });
      updateChecklistItemsInCard(cardId, checklistId, (items) =>
        items.map((entry) => (entry.id === item.id ? updated : entry))
      );
      setChecklistItemTitleDrafts((current) => ({ ...current, [item.id]: updated.title }));
      setError(null);
      triggerSavedNotice();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update checklist item");
    }
  };
  const onToggleChecklistItem = async (
    cardId: string,
    checklistId: string,
    item: ChecklistItem,
    nextValue: boolean
  ): Promise<void> => {
    try {
      const updated = await updateChecklistItem(item.id, { isDone: nextValue });
      updateChecklistItemsInCard(cardId, checklistId, (items) =>
        items.map((entry) => (entry.id === item.id ? updated : entry))
      );
      setError(null);
      triggerSavedNotice();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update checklist item");
    }
  };
  const onDeleteChecklistItem = async (): Promise<void> => {
    if (!checklistItemToDelete) return;
    const { item, cardId } = checklistItemToDelete;
    try {
      await deleteChecklistItem(item.id);
      updateChecklistItemsInCard(cardId, item.checklistId, (items) =>
        items.filter((entry) => entry.id !== item.id)
      );
      setChecklistItemTitleDrafts((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      setChecklistItemToDelete(null);
      setError(null);
      triggerSavedNotice();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete checklist item");
    }
  };
  const onUploadAttachments = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    if (!selectedCardWithList) return;
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    setIsUploadingAttachments(true);
    setAttachmentError(null);
    try {
      const created = await createAttachments(selectedCardWithList.card.id, files);
      updateCardAttachments(selectedCardWithList.card.id, (current) => [...current, ...created]);
      triggerSavedNotice();
    } catch (uploadError) {
      setAttachmentError(uploadError instanceof Error ? uploadError.message : "Failed to upload attachments");
    } finally {
      setIsUploadingAttachments(false);
      event.target.value = "";
    }
  };
  const onDownloadAttachment = async (attachment: BoardAttachment): Promise<void> => {
    try {
      await downloadAttachment(attachment.id, attachment.originalName);
      setAttachmentError(null);
    } catch (downloadError) {
      setAttachmentError(downloadError instanceof Error ? downloadError.message : "Failed to download attachment");
    }
  };
  const onDownloadAllAttachments = useCallback(async (card: BoardCard): Promise<void> => {
    const attachments = sortAttachments(card.attachments ?? []);
    if (attachments.length === 0) return;
    try {
      for (const attachment of attachments) {
        await downloadAttachment(attachment.id, attachment.originalName);
      }
      setError(null);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Failed to download attachments");
    }
  }, []);
  const onDeleteAttachment = async (attachmentId: string): Promise<void> => {
    if (!selectedCardWithList) return;
    try {
      await deleteAttachment(attachmentId);
      updateCardAttachments(selectedCardWithList.card.id, (current) =>
        current.filter((attachment) => attachment.id !== attachmentId)
      );
      setAttachmentError(null);
      triggerSavedNotice();
    } catch (deleteError) {
      setAttachmentError(deleteError instanceof Error ? deleteError.message : "Failed to delete attachment");
    }
  };
  useEffect(() => {
    if (!selectedCardWithList || !cardDraft) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCardEditor();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedCardWithList, cardDraft]);
  useEffect(() => {
    if (!isArchivedOpen) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsArchivedOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isArchivedOpen]);
  useEffect(() => {
    if (!scrollToChecklistId || !selectedCardWithList || !cardDraft) return;
    const target = checklistSectionRefs.current[scrollToChecklistId];
    if (!target) return;
    window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    setScrollToChecklistId(null);
  }, [scrollToChecklistId, selectedCardWithList, cardDraft]);
  const openCardEditor = (card: BoardCard, checklistId?: string): void => {
    const draft = buildCardDraft(card);
    setSelectedCardId(card.id);
    setCardDraft(draft);
    lastSyncedCardRef.current = draft;
    setCardSaveStatus("saved");
    setNewCardComment("");
    setNewChecklistTitle("");
    setNewChecklistItemTitles({});
    setChecklistTitleDrafts({});
    setChecklistItemTitleDrafts({});
    setChecklistToDelete(null);
    setChecklistItemToDelete(null);
    setAttachmentError(null);
    setIsUploadingAttachments(false);
    setScrollToChecklistId(checklistId ?? null);
  };
  const closeCardEditor = (): void => {
    setSelectedCardId(null);
    setCardDraft(null);
    setCardSaveStatus("idle");
    setNewCardComment("");
    clearCardAutosaveTimeout();
    lastSyncedCardRef.current = null;
    setNewChecklistTitle("");
    setNewChecklistItemTitles({});
    setChecklistTitleDrafts({});
    setChecklistItemTitleDrafts({});
    setChecklistToDelete(null);
    setChecklistItemToDelete(null);
    setAttachmentError(null);
    setIsUploadingAttachments(false);
    setScrollToChecklistId(null);
  };
  const runCardAutosave = useCallback(async (draft: CardDraft, cardId: string): Promise<void> => {
    if (!selectedCardWithList || selectedCardWithList.card.id !== cardId) return;
    const title = draft.title.trim();
    if (title.length < 1) {
      setError("Card title cannot be empty.");
      setCardSaveStatus("idle");
      return;
    }
    const dueDateIso = toIsoFromDateTimeInput(draft.dueDate);
    if (draft.dueDate && !dueDateIso) {
      setCardSaveStatus("idle");
      return;
    }
    setCardSaveStatus("saving");
    try {
      const updated = await updateCard(cardId, {
        title,
        description: trimOrNull(draft.description),
        priority: draft.priority,
        coverColor: draft.coverColor,
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
      const nextDraft = buildCardDraft(updated);
      lastSyncedCardRef.current = nextDraft;
      setCardDraft(nextDraft);
      setError(null);
      setCardSaveStatus("saved");
      triggerSavedNotice();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update card");
      setCardSaveStatus("idle");
    }
  }, [selectedCardWithList, triggerSavedNotice]);
  useEffect(() => {
    if (!selectedCardWithList || !cardDraft) return;
    const synced = lastSyncedCardRef.current;
    if (synced && isCardDraftEqual(cardDraft, synced)) {
      clearCardAutosaveTimeout();
      setCardSaveStatus("saved");
      return;
    }
    const dueDateIso = toIsoFromDateTimeInput(cardDraft.dueDate);
    if (cardDraft.dueDate && !dueDateIso) {
      clearCardAutosaveTimeout();
      return;
    }
    clearCardAutosaveTimeout();
    setCardSaveStatus("saving");
    cardAutoSaveTimeoutRef.current = window.setTimeout(() => {
      void runCardAutosave(cardDraft, selectedCardWithList.card.id);
    }, CARD_AUTO_SAVE_DELAY_MS);
    return () => {
      clearCardAutosaveTimeout();
    };
  }, [cardDraft, selectedCardWithList, runCardAutosave, clearCardAutosaveTimeout]);
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
  const boardComments = board.comments ?? [];
  return (
    <>
      <div className={`-mx-4 -my-4 space-y-6 px-4 py-4 lg:-mx-6 lg:-my-6 lg:px-6 lg:py-6 ${activeSurfaceClass}`}>
        <div className={`h-28 rounded-xl ${activeBannerClass}`} />
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold tracking-tight">{boardName}</h2>
            <div className="space-y-2">
              {boardComments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No board notes yet.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {boardComments.map((comment) => (
                    <CommentNote
                      key={comment.id}
                      comment={comment}
                      expanded={expandedCommentIds.has(comment.id)}
                      onToggle={() => toggleCommentExpanded(comment.id)}
                      onReact={(emoji) => onToggleCommentReaction(comment.id, emoji)}
                      onDelete={() => setCommentToDelete(comment)}
                      variant="default"
                    />
                  ))}
                </div>
              )}
              <div className="space-y-2">
                <form className="flex flex-wrap gap-2" onSubmit={onCreateBoardComment}>
                  <MentionsField
                    value={newBoardComment}
                    onChange={(value) => setNewBoardComment(value)}
                    members={boardMembers}
                    placeholder="Add a board note"
                  />
                  <Button type="submit" className="gap-1">
                    <Plus className="h-4 w-4" />
                    Add note
                  </Button>
                </form>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={openArchivedLists}>
              Archived lists
            </Button>
            <Link to="/boards">
              <Button type="button" variant="ghost">Back to boards</Button>
            </Link>
          </div>
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
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={orderedLists.map((list) => toListDragId(list.id))}
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {orderedLists.map((list) => (
                  <SortableListContainer key={list.id} listId={list.id}>
                    {({ dragHandleProps }) => (
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
                              <Button
                                type="button" variant="ghost" size="sm"
                                className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700"
                                onClick={() => { void onArchiveList(list.id); }}
                                title="Archive list"
                              >
                                <Archive className="h-4 w-4" />
                              </Button>
                              <button
                                type="button"
                                {...dragHandleProps}
                                className="rounded-md p-1 text-muted-foreground hover:bg-secondary/70 cursor-grab active:cursor-grabbing"
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
                          <div className="space-y-2">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Notes</p>
                            {(() => {
                              const listComments = list.comments ?? [];
                              const showAll = expandedListCommentGroups.has(list.id);
                              const visibleComments = showAll ? listComments : listComments.slice(0, 2);
                              if (listComments.length === 0) {
                                return <p className="text-xs text-muted-foreground">No list notes yet.</p>;
                              }
                              return (
                                <div className="flex flex-wrap gap-1">
                                  {visibleComments.map((comment) => (
                                    <CommentNote
                                      key={comment.id}
                                      comment={comment}
                                      expanded={expandedCommentIds.has(comment.id)}
                                      onToggle={() => toggleCommentExpanded(comment.id)}
                                      onReact={(emoji) => onToggleCommentReaction(comment.id, emoji)}
                                      onDelete={() => setCommentToDelete(comment)}
                                      variant="compact"
                                    />
                                  ))}
                                  {listComments.length > 2 && (
                                    <button
                                      type="button"
                                      className="basis-full text-[10px] text-muted-foreground underline underline-offset-2"
                                      onClick={() => toggleListCommentGroup(list.id)}
                                    >
                                      {showAll ? "Show less" : `Show all (${listComments.length})`}
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
                            <form
                              className="grid gap-2 sm:grid-cols-[1fr_auto]"
                              onSubmit={(event) => { void onCreateListComment(list.id, event); }}
                            >
                              <MentionsField
                                value={newListCommentDrafts[list.id] ?? ""}
                                onChange={(value) => {
                                  setNewListCommentDrafts((current) => ({ ...current, [list.id]: value }));
                                }}
                                members={boardMembers}
                                placeholder="Add list note"
                              />
                              <Button type="submit" variant="secondary" className="gap-1">
                                <Plus className="h-4 w-4" />
                                Note
                              </Button>
                            </form>
                          </div>
                          <div className="space-y-2">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Cards</p>
                            <SortableContext
                              items={list.cards.map((c) => c.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              <div className="space-y-2 rounded-md border border-dashed border-border/70 p-2">
                              {list.cards.length === 0 ? (
                                <ListDropZone listId={list.id} isCardDrag={activeCardId !== null} />
                              ) : (
                                list.cards.map((card) => (
                                  <SortableCard
                                    key={card.id}
                                    card={card}
                                    onEdit={openCardEditor}
                                    nowMs={nowMs}
                                    retentionMinutes={retentionTotalMinutes}
                                    onChecklistItemToggle={onToggleChecklistItem}
                                    onChecklistOpen={openCardEditor}
                                    expandedCommentIds={expandedCommentIds}
                                    onToggleComment={toggleCommentExpanded}
                                    onReact={onToggleCommentReaction}
                                    onDeleteComment={(comment) => setCommentToDelete(comment)}
                                    expandedCardCommentGroups={expandedCardCommentGroups}
                                    onToggleCardCommentGroup={toggleCardCommentGroup}
                                    onDownloadAllAttachments={onDownloadAllAttachments}
                                  />
                                ))
                              )}
                              </div>
                            </SortableContext>
                          </div>
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
                    )}
                  </SortableListContainer>
                ))}
              </div>
            </SortableContext>
            {/* The floating card that follows your cursor */}
            <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
              {activeCard ? (
                <div className={`rotate-1 rounded-md border border-border/70 ${coverColorSurfaceClasses[activeCard.coverColor ?? "none"]} px-3 py-2 shadow-2xl opacity-95 ring-2 ring-primary/30`}>
                  <CardSummary
                    card={activeCard}
                    nowMs={nowMs}
                    retentionMinutes={retentionTotalMinutes}
                    showChecklists={false}
                    expandedCommentIds={expandedCommentIds}
                    onToggleComment={toggleCommentExpanded}
                    onReact={onToggleCommentReaction}
                    onDeleteComment={(comment) => setCommentToDelete(comment)}
                    expandedCardCommentGroups={expandedCardCommentGroups}
                    onToggleCardCommentGroup={toggleCardCommentGroup}
                  />
                </div>
              ) : activeList ? (
                <div className="w-80 rotate-1 rounded-xl border border-border/70 bg-card/90 p-4 shadow-2xl opacity-95 ring-2 ring-primary/30">
                  <p className="text-sm font-semibold text-foreground">{activeList.name}</p>
                  <p className="text-xs text-muted-foreground">{activeList.cards.length} cards</p>
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
                {boardBackgroundPresets.map((preset: BoardBackgroundPreset) => (
                  <button
                    key={preset.id} type="button"
                    onClick={() => applyBoardBackground(preset.id)}
                    className={`overflow-hidden rounded-md border text-left ${boardBackground === preset.id ? "border-primary ring-2 ring-primary/40" : "border-border"}`}
                  >
                    <div className={`h-10 ${preset.className}`} />
                    <p className="px-2 py-1 text-[11px] text-muted-foreground">{preset.label}</p>
                  </button>
                ))}
              </div>
              <div className="space-y-3 rounded-lg border border-border/60 bg-background/80 p-3">
                <div className="flex flex-wrap gap-1">
                  <p className="text-sm font-medium">Done card retention</p>
                  <p className="text-xs text-muted-foreground">Set how long completed cards remain before cleanup.</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="space-y-1 text-xs text-muted-foreground">
                    <span>Days</span>
                    <Input
                      type="number"
                      min={0}
                      max={365}
                      value={retentionDays}
                      onChange={(event) => {
                        const value = parseRetentionInput(event.target.value);
                        applyRetentionParts(value, retentionHours, retentionMinutesPart);
                      }}
                    />
                  </label>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    <span>Hours</span>
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      value={retentionHours}
                      onChange={(event) => {
                        const value = parseRetentionInput(event.target.value);
                        applyRetentionParts(retentionDays, value, retentionMinutesPart);
                      }}
                    />
                  </label>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    <span>Minutes</span>
                    <Input
                      type="number"
                      min={0}
                      max={59}
                      value={retentionMinutesPart}
                      onChange={(event) => {
                        const value = parseRetentionInput(event.target.value);
                        applyRetentionParts(retentionDays, retentionHours, value);
                      }}
                    />
                  </label>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant={retentionMode === "card_and_attachments" ? "default" : "secondary"}
                    onClick={() => setRetentionMode("card_and_attachments")}
                  >
                    Delete card + attachments
                  </Button>
                  <Button
                    type="button"
                    variant={retentionMode === "attachments_only" ? "default" : "secondary"}
                    onClick={() => setRetentionMode("attachments_only")}
                  >
                    Delete attachments only
                  </Button>
                </div>
              </div>
              <div className="space-y-3 rounded-lg border border-border/60 bg-background/80 p-3">
                <div className="flex flex-wrap gap-1">
                  <p className="text-sm font-medium">Archive retention</p>
                  <p className="text-xs text-muted-foreground">How long archived lists and cards remain before cleanup.</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="space-y-1 text-xs text-muted-foreground">
                    <span>Days</span>
                    <Input
                      type="number"
                      min={0}
                      max={365}
                      value={archiveRetentionDays}
                      onChange={(event) => {
                        const value = parseRetentionInput(event.target.value);
                        applyArchiveRetentionParts(value, archiveRetentionHours, archiveRetentionMinutesPart);
                      }}
                    />
                  </label>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    <span>Hours</span>
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      value={archiveRetentionHours}
                      onChange={(event) => {
                        const value = parseRetentionInput(event.target.value);
                        applyArchiveRetentionParts(archiveRetentionDays, value, archiveRetentionMinutesPart);
                      }}
                    />
                  </label>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    <span>Minutes</span>
                    <Input
                      type="number"
                      min={0}
                      max={59}
                      value={archiveRetentionMinutesPart}
                      onChange={(event) => {
                        const value = parseRetentionInput(event.target.value);
                        applyArchiveRetentionParts(archiveRetentionDays, archiveRetentionHours, value);
                      }}
                    />
                  </label>
                </div>
              </div>
              <div className="space-y-3 rounded-lg border border-border/60 bg-background/80 p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  Labels
                </div>
                <form className="grid gap-2 sm:grid-cols-[1fr_auto_auto]" onSubmit={onCreateLabel}>
                  <Input
                    value={newLabelName}
                    onChange={(event) => setNewLabelName(event.target.value)}
                    placeholder="New label name"
                  />
                  <select
                    value={newLabelColor}
                    onChange={(event) => setNewLabelColor(event.target.value as LabelColor)}
                    className="h-10 rounded-md border border-input bg-card px-3 text-sm"
                  >
                    {labelColors.map((color) => (
                      <option key={color} value={color}>
                        {color.charAt(0).toUpperCase() + color.slice(1)}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" className="gap-1">
                    <Plus className="h-4 w-4" />
                    Add label
                  </Button>
                </form>
                {boardLabels.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No labels yet.</p>
                ) : (
                  <div className="space-y-2">
                    {boardLabels.map((label) => {
                      const draftName = labelDrafts[label.id] ?? label.name;
                      const draftColor = labelColorDrafts[label.id] ?? label.color;
                      return (
                        <div key={label.id} className="flex flex-wrap items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${labelColorStyles[draftColor].dot}`} />
                          <Input
                            value={draftName}
                            onChange={(event) => {
                              const value = event.target.value;
                              setLabelDrafts((c) => ({ ...c, [label.id]: value }));
                              scheduleLabelAutosave(label.id, value, draftColor);
                            }}
                            className="h-9 max-w-[220px]"
                          />
                          <select
                            value={draftColor}
                            onChange={(event) => {
                              const value = event.target.value as LabelColor;
                              setLabelColorDrafts((c) => ({ ...c, [label.id]: value }));
                              scheduleLabelAutosave(label.id, draftName, value);
                            }}
                            className="h-9 rounded-md border border-input bg-card px-2 text-xs"
                          >
                            {labelColors.map((color) => (
                              <option key={color} value={color}>
                                {color.charAt(0).toUpperCase() + color.slice(1)}
                              </option>
                            ))}
                          </select>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            onClick={() => setLabelToDelete(label)}
                            title="Delete label"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          {labelSavingIds.has(label.id) && (
                            <span className="text-xs text-muted-foreground">Saving...</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {isAutosavingBoard ? "Saving..." : "Changes save automatically"}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="ghost" onClick={() => setIsArchiveBoardOpen(true)}>
                    Archive board
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setIsDeleteBoardOpen(true)}>
                    Delete board
                  </Button>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
      {/* Card editor modal */}
      {selectedCardWithList && cardDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeCardEditor();
            }
          }}
        >
          <Card className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden" onMouseDown={(event) => event.stopPropagation()}>
            <CardHeader className="sticky top-0 z-10 shrink-0 border-b border-border/60 bg-card/95 backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Edit Card</CardTitle>
                  <CardDescription>{selectedCardWithList.list.name}</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-amber-600 hover:text-amber-700"
                    onClick={() => { void onArchiveCard(); }}
                    aria-label="Archive card"
                  >
                    <Archive className="mr-1 h-4 w-4" />
                    Archive
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => setCardToDelete(selectedCardWithList.card)}
                    aria-label="Delete card"
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Delete
                  </Button>
                  <Button type="button" variant="ghost" onClick={closeCardEditor}>Close</Button>
                  <div className="flex items-center gap-2 text-xs font-medium">
                    {cardSaveStatus === "saving" ? (
                      <span className="text-muted-foreground">Saving...</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-emerald-600">
                        <Check className="h-3.5 w-3.5" />
                        Saved
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              <div className="flex flex-wrap gap-1">
                <p className="text-xs text-muted-foreground">Title</p>
                <Input
                  value={cardDraft.title}
                  onChange={(e) => { const v = e.target.value; setCardDraft((c) => c ? { ...c, title: v } : c); }}
                  placeholder="Card title"
                />
              </div>
              <div className="flex flex-wrap gap-1">
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
                    onChange={(e) => { const v = clampYearInDateInput(e.target.value); setCardDraft((c) => c ? { ...c, dueDate: v } : c); }}
                  />
                </label>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span>Cover color</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {coverColors.map((color) => {
                    const isSelected = cardDraft.coverColor === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setCardDraft((c) => (c ? { ...c, coverColor: color } : c))}
                        className={`h-8 w-10 rounded-full border ${isSelected ? "border-primary ring-2 ring-primary/40" : "border-border"}`}
                        aria-pressed={isSelected}
                        title={color === "none" ? "No cover" : `${color} cover`}
                      >
                        <span
                          className={`mx-auto block h-3 w-8 rounded-full ${coverColorClasses[color]}`}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  Labels
                </div>
                {boardLabels.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No labels yet. Create one in board settings.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {boardLabels.map((label) => {
                      const isSelected = selectedCardWithList.card.labels.some((item) => item.id === label.id);
                      return (
                        <label key={label.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(event) => {
                              void onToggleCardLabel(selectedCardWithList.card.id, label.id, event.target.checked);
                            }}
                          />
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${labelColorStyles[label.color].chip}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${labelColorStyles[label.color].dot}`} />
                            {label.name}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Assignees
                </div>
                {boardMembers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No members available.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {boardMembers.map((member) => {
                      const isSelected = selectedCardWithList.card.assignees.some((item) => item.id === member.id);
                      return (
                        <label key={member.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(event) => {
                              void onToggleAssignee(selectedCardWithList.card.id, member.id, event.target.checked);
                            }}
                          />
                          <UserHoverCard user={member}>
                            <span className="inline-flex items-center gap-2">
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full avatar-chip text-[11px] font-semibold">
                                {getInitials(getMemberDisplayName(member))}
                              </span>
                              <span className="text-xs">{getMemberDisplayName(member)}</span>
                            </span>
                          </UserHoverCard>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    Attachments
                  </div>
                  <div className="flex items-center gap-2">
                    {isUploadingAttachments && (
                      <span className="text-xs text-muted-foreground">Uploading...</span>
                    )}
                    <input
                      ref={attachmentInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(event) => { void onUploadAttachments(event); }}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="gap-1"
                      onClick={() => attachmentInputRef.current?.click()}
                      disabled={isUploadingAttachments}
                    >
                      <Plus className="h-4 w-4" />
                      Add files
                    </Button>
                  </div>
                </div>
                {attachmentError && (
                  <p className="text-xs text-destructive">{attachmentError}</p>
                )}
                {selectedCardAttachments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No attachments yet.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedCardAttachments.map((attachment) => (
                      <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/80 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{attachment.originalName}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(attachment.size)}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                            onClick={() => { void onDownloadAttachment(attachment); }}
                          >
                            <Download className="h-4 w-4" />
                            Download
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-red-600 hover:text-red-700"
                            onClick={() => { void onDeleteAttachment(attachment.id); }}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  Comments
                </div>
                {(selectedCardWithList.card.comments ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">No comments yet.</p>
                ) : (
                  <div className="space-y-2">
                    {(selectedCardWithList.card.comments ?? []).map((comment) => (
                      <CommentNote
                        key={comment.id}
                        comment={comment}
                        expanded={expandedCommentIds.has(comment.id)}
                        onToggle={() => toggleCommentExpanded(comment.id)}
                        onReact={(emoji) => onToggleCommentReaction(comment.id, emoji)}
                        onDelete={() => setCommentToDelete(comment)}
                      />
                    ))}
                  </div>
                )}
                <form className="space-y-2" onSubmit={onCreateCardComment}>
                  <MentionsField
                    value={newCardComment}
                    onChange={(value) => setNewCardComment(value)}
                    members={boardMembers}
                    placeholder="Add a comment"
                    multiline
                    className="min-h-[96px] w-full"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button type="submit" variant="secondary" size="sm" className="gap-1">
                      <Plus className="h-4 w-4" />
                      Add comment
                    </Button>
                  </div>
                </form>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ListChecks className="h-4 w-4 text-muted-foreground" />
                    Checklists
                  </div>
                </div>
                {selectedCardChecklists.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No checklists yet.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedCardChecklists.map((checklist) => {
                      const progress = getChecklistProgress(checklist);
                      const title = checklistTitleDrafts[checklist.id] ?? checklist.title;
                      return (
                        <div
                          key={checklist.id}
                          ref={(node) => { checklistSectionRefs.current[checklist.id] = node; }}
                          className="space-y-3 rounded-lg border border-border/60 bg-background/80 p-3"
                        >
                          <div className="flex items-center gap-2">
                            <Input
                              value={title}
                              onChange={(event) => {
                                const value = event.target.value;
                                setChecklistTitleDrafts((current) => ({ ...current, [checklist.id]: value }));
                              }}
                              onBlur={() => { void onSaveChecklistTitle(selectedCardWithList.card.id, checklist); }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") { event.preventDefault(); void onSaveChecklistTitle(selectedCardWithList.card.id, checklist); }
                                if (event.key === "Escape") {
                                  event.preventDefault();
                                  setChecklistTitleDrafts((current) => ({ ...current, [checklist.id]: checklist.title }));
                                }
                              }}
                              placeholder="Checklist title"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                              onClick={() => setChecklistToDelete(checklist)}
                              title="Delete checklist"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <div className="h-1.5 w-full rounded-full bg-muted/60">
                              <div
                                className="h-1.5 rounded-full bg-emerald-500/80"
                                style={{ width: `${progress.percent}%` }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {progress.done}/{progress.total} complete
                            </p>
                          </div>
                          <div className="space-y-2">
                            {checklist.items.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No items yet.</p>
                            ) : (
                              checklist.items.map((item) => {
                                const itemTitle = checklistItemTitleDrafts[item.id] ?? item.title;
                                return (
                                  <div key={item.id} className="flex items-start gap-2">
                                    <input
                                      type="checkbox"
                                      className="mt-1 h-4 w-4"
                                      checked={item.isDone}
                                      onChange={(event) => {
                                        void onToggleChecklistItem(
                                          selectedCardWithList.card.id,
                                          checklist.id,
                                          item,
                                          event.target.checked
                                        );
                                      }}
                                    />
                                    <Input
                                      value={itemTitle}
                                      onChange={(event) => {
                                        const value = event.target.value;
                                        setChecklistItemTitleDrafts((current) => ({ ...current, [item.id]: value }));
                                      }}
                                      onBlur={() => { void onSaveChecklistItemTitle(selectedCardWithList.card.id, checklist.id, item); }}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter") { event.preventDefault(); void onSaveChecklistItemTitle(selectedCardWithList.card.id, checklist.id, item); }
                                        if (event.key === "Escape") {
                                          event.preventDefault();
                                          setChecklistItemTitleDrafts((current) => ({ ...current, [item.id]: item.title }));
                                        }
                                      }}
                                      placeholder="Checklist item"
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="mt-0.5 h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                      onClick={() => setChecklistItemToDelete({ item, cardId: selectedCardWithList.card.id })}
                                      title="Delete item"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                );
                              })
                            )}
                          </div>
                          <form
                            className="grid gap-2 sm:grid-cols-[1fr_auto]"
                            onSubmit={(event) => { void onCreateChecklistItem(selectedCardWithList.card.id, checklist.id, event); }}
                          >
                            <Input
                              value={newChecklistItemTitles[checklist.id] ?? ""}
                              onChange={(event) => {
                                const value = event.target.value;
                                setNewChecklistItemTitles((current) => ({ ...current, [checklist.id]: value }));
                              }}
                              placeholder="New checklist item"
                            />
                            <Button type="submit" className="gap-1">
                              <Plus className="h-4 w-4" />
                              Add item
                            </Button>
                          </form>
                        </div>
                      );
                    })}
                  </div>
                )}
                <form className="grid gap-2 sm:grid-cols-[1fr_auto]" onSubmit={onCreateChecklist}>
                  <Input
                    value={newChecklistTitle}
                    onChange={(event) => setNewChecklistTitle(event.target.value)}
                    placeholder="New checklist title"
                  />
                  <Button type="submit" className="gap-1">
                    <Plus className="h-4 w-4" />
                    Add checklist
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {isArchivedOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsArchivedOpen(false);
            }
          }}
        >
          <Card className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden" onMouseDown={(event) => event.stopPropagation()}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>Archived lists</CardTitle>
                <CardDescription>Restore archived lists and cards before they are cleaned up.</CardDescription>
              </div>
              <Button type="button" variant="ghost" onClick={() => setIsArchivedOpen(false)}>
                Close
              </Button>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              {archivedLoading ? (
                <p className="text-sm text-muted-foreground">Loading archived lists...</p>
              ) : archivedError ? (
                <p className="text-sm text-destructive">{archivedError}</p>
              ) : archivedLists.length === 0 ? (
                <p className="text-sm text-muted-foreground">No archived lists yet.</p>
              ) : (
                <div className="space-y-3">
                  {archivedLists.map((entry) => {
                    const entryCountdown = entry.kind === "list"
                      ? getArchiveCountdownLabel(entry.archivedAt, nowMs, archiveRetentionTotalMinutes)
                      : "";
                    return (
                      <div key={entry.id} className="rounded-lg border border-border/60 bg-background/80 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{entry.name}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <p className="text-xs text-muted-foreground">
                                {entry.kind === "list" ? "Archived list" : "Archived cards"}
                              </p>
                              {entryCountdown && (
                                <span className="rounded-full border badge-rose px-2 py-0.5 text-[10px] font-semibold">
                                  {entryCountdown}
                                </span>
                              )}
                            </div>
                            {entry.archivedAt && (
                              <p className="text-[11px] text-muted-foreground">
                                Archived {new Date(entry.archivedAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <Button type="button" size="sm" onClick={() => requestRestoreArchivedEntry(entry)}>
                            Restore
                          </Button>
                        </div>
                        {entry.cards.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {entry.cards.map((card) => {
                              const cardCountdown = getArchiveCountdownLabel(card.archivedAt, nowMs, archiveRetentionTotalMinutes);
                              return (
                                <div
                                  key={card.id}
                                  className="flex items-center gap-2 rounded-md border border-border/50 bg-card/70 px-2 py-1 text-xs text-muted-foreground"
                                >
                                  <span className="font-medium text-foreground">{card.title}</span>
                                  {entry.kind === "cards" && cardCountdown && (
                                    <span className="rounded-full border badge-rose px-2 py-0.5 text-[10px] font-semibold">
                                      {cardCountdown}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      {showSavedNotice && (
        <div className="pointer-events-none fixed bottom-5 right-5 z-40 rounded-full border badge-emerald px-4 py-2 text-sm font-medium shadow-lg backdrop-blur">
          Saved
        </div>
      )}
      <ConfirmDialog
        open={restoreConflict !== null}
        title="Name conflict"
        description={restoreConflict?.message ?? ""}
        confirmLabel="Restore with new name"
        cancelLabel="Cancel"
        onCancel={() => setRestoreConflict(null)}
        onConfirm={() => {
          restoreConflict?.onConfirm();
          setRestoreConflict(null);
        }}
      />
      <ConfirmDialog
        open={isArchiveBoardOpen}
        title="Archive board"
        description={`Archive "${board.name}"? You can restore it for 7 days.`}
        confirmLabel="Archive"
        cancelLabel="Cancel"
        onCancel={() => setIsArchiveBoardOpen(false)}
        onConfirm={() => {
          setIsArchiveBoardOpen(false);
          void onArchiveBoard();
        }}
      />
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
        open={commentToDelete !== null}
        title="Delete comment"
        description={`Delete "${commentToDelete ? getCommentSnippet(commentToDelete.body) : "this comment"}"?`}
        confirmLabel="Delete"
        cancelLabel="Keep"
        onCancel={() => setCommentToDelete(null)}
        onConfirm={() => { void onDeleteComment(); }}
      />
      <ConfirmDialog
        open={checklistToDelete !== null}
        title="Delete checklist"
        description={`Delete "${checklistToDelete?.title ?? "this checklist"}"?`}
        confirmLabel="Delete" cancelLabel="Keep"
        onCancel={() => setChecklistToDelete(null)}
        onConfirm={() => { void onDeleteChecklist(); }}
      />
      <ConfirmDialog
        open={checklistItemToDelete !== null}
        title="Delete checklist item"
        description={`Delete "${checklistItemToDelete?.item.title ?? "this item"}"?`}
        confirmLabel="Delete" cancelLabel="Keep"
        onCancel={() => setChecklistItemToDelete(null)}
        onConfirm={() => { void onDeleteChecklistItem(); }}
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
