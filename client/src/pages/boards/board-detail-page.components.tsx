import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, Check, Download, GripVertical, ListChecks } from "lucide-react";
import type React from "react";
import { UserHoverCard } from "@/components/users/user-hover-card";
import type { BoardCard, BoardComment, BoardMember, Checklist, ChecklistItem } from "@/types/board";
import {
  coverColorSurfaceClasses,
  formatDueDateLabel,
  getChecklistProgress,
  getCommentSnippet,
  getInitials,
  getMemberDisplayName,
  getPriorityBadgeClass,
  getPriorityLabel,
  getTimeLeftLabel,
  labelColorStyles,
  toListDragId
} from "@/pages/boards/board-detail-page.utils";

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

export function CommentNote({
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

export function CardSummary({
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
                {card.assignees.map((assignee: BoardMember) => (
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
            {checklists.map((checklist: Checklist) => {
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

export function SortableCard({
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

export function SortableListContainer({
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

export function ListDropZone({ listId, isCardDrag }: { listId: string; isCardDrag: boolean }): JSX.Element {
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

