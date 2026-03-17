import type {
  BoardAttachment,
  BoardBackground,
  BoardCard,
  BoardDetail,
  BoardList,
  BoardMember,
  CardCoverColor,
  CardPriority,
  Checklist,
  ChecklistItem,
  LabelColor,
  RetentionMode
} from "@/types/board";

export interface CardDraft {
  title: string;
  description: string;
  priority: CardPriority;
  coverColor: CardCoverColor;
  dueDate: string;
}

export interface BoardDraft {
  name: string;
  description: string | null;
  background: BoardBackground;
  retentionMode: RetentionMode;
  retentionMinutes: number;
  archiveRetentionMinutes: number;
}

export const AUTO_SAVE_DELAY_MS = 750;
export const CARD_AUTO_SAVE_DELAY_MS = 750;
export const SAVED_TOAST_SHOW_DELAY_MS = 250;
export const SAVED_TOAST_VISIBLE_MS = 1500;
export const MIN_RETENTION_MINUTES = 1;
export const MAX_RETENTION_MINUTES = 525600;
export const MINUTES_PER_HOUR = 60;
export const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
export const LIST_DRAG_PREFIX = "list:";

export const labelColors: LabelColor[] = [
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

export const labelColorStyles: Record<LabelColor, { chip: string; dot: string }> = {
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

export const coverColors: CardCoverColor[] = [
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

export const coverColorClasses: Record<CardCoverColor, string> = {
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

export const coverColorSurfaceClasses: Record<CardCoverColor, string> = {
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

export function sortChecklistItems(items: ChecklistItem[]): ChecklistItem[] {
  return [...items].sort((a, b) => a.position - b.position);
}

export function sortChecklists(checklists: Checklist[]): Checklist[] {
  return [...checklists]
    .sort((a, b) => a.position - b.position)
    .map((checklist) => ({
      ...checklist,
      items: sortChecklistItems(checklist.items ?? [])
    }));
}

export function sortCardsByPosition(cards: BoardCard[]): BoardCard[] {
  return [...cards]
    .sort((a, b) => a.position - b.position)
    .map((card) => ({
      ...card,
      checklists: sortChecklists(card.checklists ?? [])
    }));
}

export function sortListsByPosition(values: BoardList[]): BoardList[] {
  return [...values].sort((a, b) => a.position - b.position);
}

export function sortBoardListsWithCards(values: BoardList[]): BoardList[] {
  return sortListsByPosition(values).map((list) => ({
    ...list,
    cards: sortCardsByPosition(list.cards)
  }));
}

export function toListDragId(listId: string): string {
  return `${LIST_DRAG_PREFIX}${listId}`;
}

export function isListDragId(id: unknown): id is string {
  return typeof id === "string" && id.startsWith(LIST_DRAG_PREFIX);
}

export function fromListDragId(id: string): string {
  return id.slice(LIST_DRAG_PREFIX.length);
}

export function normalizeDragOverId(id: string): string {
  return isListDragId(id) ? fromListDragId(id) : id;
}

export function formatDateTimeLocalValue(date: Date): string {
  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

export function formatDueDateForInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const safeDate = date.getTime() <= 0 ? new Date() : date;
  return formatDateTimeLocalValue(safeDate);
}

export function clampYearInDateInput(value: string): string {
  if (!value) return "";
  const [datePart, timePart] = value.split("T");
  const segments = datePart.split("-");
  if (segments.length < 3) return value;
  const [year, month, day] = segments;
  const trimmedYear = year.slice(0, 4);
  const rebuiltDate = `${trimmedYear}-${month}-${day}`;
  return timePart ? `${rebuiltDate}T${timePart}` : rebuiltDate;
}

export function toIsoFromDateTimeInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function clampRetentionMinutes(value: number): number {
  if (Number.isNaN(value)) return MIN_RETENTION_MINUTES;
  return Math.min(MAX_RETENTION_MINUTES, Math.max(MIN_RETENTION_MINUTES, value));
}

export function splitRetentionMinutes(totalMinutes: number): { days: number; hours: number; minutes: number } {
  const safeTotal = clampRetentionMinutes(totalMinutes);
  const days = Math.floor(safeTotal / MINUTES_PER_DAY);
  const hours = Math.floor((safeTotal % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
  const minutes = safeTotal % MINUTES_PER_HOUR;
  return { days, hours, minutes };
}

export function toRetentionMinutes(days: number, hours: number, minutes: number): number {
  const safeDays = Math.max(0, Math.floor(days));
  const safeHours = Math.max(0, Math.floor(hours));
  const safeMinutes = Math.max(0, Math.floor(minutes));
  const total = safeDays * MINUTES_PER_DAY + safeHours * MINUTES_PER_HOUR + safeMinutes;
  return clampRetentionMinutes(total);
}

export function parseRetentionInput(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes)) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = Math.max(0, bytes);
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const precision = unitIndex === 0 || size >= 10 ? 0 : 1;
  return `${size.toFixed(precision)} ${units[unitIndex]}`;
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export function getMemberDisplayName(member: BoardMember): string {
  return member.displayName || member.username || "Member";
}

export function getCommentSnippet(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length <= 80) return trimmed;
  return `${trimmed.slice(0, 77)}...`;
}

export function sortAttachments(attachments: BoardAttachment[]): BoardAttachment[] {
  return [...attachments].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function getTimeLeftLabel(doneEnteredAt: string, nowMs: number, retentionMinutes: number): string {
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

export function getArchiveCountdownLabel(
  archivedAt: string | null,
  nowMs: number,
  retentionMinutes: number,
  expiredLabel = "Deleting soon"
): string {
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

export function getChecklistProgress(checklist: Checklist): { done: number; total: number; percent: number } {
  const total = checklist.items?.length ?? 0;
  const done = checklist.items?.filter((item) => item.isDone).length ?? 0;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return { done, total, percent };
}

export function formatDueDateLabel(value: string | null): string | null {
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

export function getPriorityBadgeClass(priority: CardPriority): string {
  switch (priority) {
    case "low":
      return "priority-badge priority-badge-low";
    case "medium":
      return "priority-badge priority-badge-medium";
    case "high":
      return "priority-badge priority-badge-high";
    case "urgent":
      return "priority-badge priority-badge-urgent";
    default:
      return "priority-badge";
  }
}

export function getPriorityLabel(priority: CardPriority): string {
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

export function trimOrNull(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function buildCardDraft(card: BoardCard): CardDraft {
  return {
    title: card.title,
    description: card.description ?? "",
    priority: card.priority,
    coverColor: (card.coverColor ?? "none") as CardCoverColor,
    dueDate: formatDueDateForInput(card.dueDate)
  };
}

export function isCardDraftEqual(a: CardDraft | null, b: CardDraft | null): boolean {
  if (!a || !b) return false;
  return (
    a.title === b.title &&
    a.description === b.description &&
    a.priority === b.priority &&
    a.coverColor === b.coverColor &&
    a.dueDate === b.dueDate
  );
}

export function getCardFromBoard(
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
