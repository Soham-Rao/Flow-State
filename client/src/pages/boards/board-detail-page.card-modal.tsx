import { Archive, Check, Download, ListChecks, MessageSquare, Paperclip, Plus, Tag, Trash2, Users } from "lucide-react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MentionsField } from "@/components/mentions/mentions-input";
import { UserHoverCard } from "@/components/users/user-hover-card";
import { Input } from "@/components/ui/input";
import { CommentNote } from "@/pages/boards/board-detail-page.components";
import {
  clampYearInDateInput,
  coverColorClasses,
  coverColors,
  formatFileSize,
  getChecklistProgress,
  getInitials,
  getMemberDisplayName,
  labelColorStyles,
  CardDraft
} from "@/pages/boards/board-detail-page.utils";
import type {
  BoardAttachment,
  BoardCard,
  BoardLabel,
  BoardList,
  BoardMember,
  CardPriority,
  Checklist,
  ChecklistItem
} from "@/types/board";

export function CardDetailModal({
  open,
  selectedCardWithList,
  cardDraft,
  closeCardEditor,
  onArchiveCard,
  onSetCardToDelete,
  cardSaveStatus,
  onCardDraftChange,
  boardLabels,
  boardMembers,
  onToggleCardLabel,
  onToggleAssignee,
  attachmentInputRef,
  isUploadingAttachments,
  onUploadAttachments,
  attachmentError,
  selectedCardAttachments,
  onDownloadAttachment,
  onDeleteAttachment,
  expandedCommentIds,
  onToggleCommentExpanded,
  onToggleCommentReaction,
  onSetCommentToDelete,
  newCardComment,
  onCardCommentChange,
  onCreateCardComment,
  selectedCardChecklists,
  checklistTitleDrafts,
  onChecklistTitleDraftChange,
  onSaveChecklistTitle,
  onSetChecklistToDelete,
  checklistItemTitleDrafts,
  onChecklistItemTitleDraftChange,
  onSaveChecklistItemTitle,
  onSetChecklistItemToDelete,
  onToggleChecklistItem,
  newChecklistItemTitles,
  onChecklistItemDraftChange,
  onCreateChecklistItem,
  newChecklistTitle,
  onChecklistTitleChange,
  onCreateChecklist,
  checklistSectionRefs,
}: {
  open: boolean;
  selectedCardWithList: { card: BoardCard; list: BoardList } | null;
  cardDraft: CardDraft | null;
  closeCardEditor: () => void;
  onArchiveCard: () => Promise<void>;
  onSetCardToDelete: (card: BoardCard) => void;
  cardSaveStatus: "idle" | "saving" | "saved";
  onCardDraftChange: (updater: (current: CardDraft) => CardDraft) => void;
  boardLabels: BoardLabel[];
  boardMembers: BoardMember[];
  onToggleCardLabel: (cardId: string, labelId: string, nextValue: boolean) => Promise<void>;
  onToggleAssignee: (cardId: string, memberId: string, nextValue: boolean) => Promise<void>;
  attachmentInputRef: React.RefObject<HTMLInputElement>;
  isUploadingAttachments: boolean;
  onUploadAttachments: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  attachmentError: string | null;
  selectedCardAttachments: BoardAttachment[];
  onDownloadAttachment: (attachment: BoardAttachment) => Promise<void>;
  onDeleteAttachment: (attachmentId: string) => Promise<void>;
  expandedCommentIds: Set<string>;
  onToggleCommentExpanded: (commentId: string) => void;
  onToggleCommentReaction: (commentId: string, emoji: string) => void;
  onSetCommentToDelete: (commentId: string) => void;
  newCardComment: string;
  onCardCommentChange: (value: string) => void;
  onCreateCardComment: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  selectedCardChecklists: Checklist[];
  checklistTitleDrafts: Record<string, string>;
  onChecklistTitleDraftChange: (checklistId: string, value: string) => void;
  onSaveChecklistTitle: (cardId: string, checklist: Checklist) => Promise<void>;
  onSetChecklistToDelete: (checklist: Checklist) => void;
  checklistItemTitleDrafts: Record<string, string>;
  onChecklistItemTitleDraftChange: (itemId: string, value: string) => void;
  onSaveChecklistItemTitle: (cardId: string, checklistId: string, item: ChecklistItem) => Promise<void>;
  onSetChecklistItemToDelete: (payload: { item: ChecklistItem; cardId: string }) => void;
  onToggleChecklistItem: (cardId: string, checklistId: string, item: ChecklistItem, nextValue: boolean) => void;
  newChecklistItemTitles: Record<string, string>;
  onChecklistItemDraftChange: (checklistId: string, value: string) => void;
  onCreateChecklistItem: (cardId: string, checklistId: string, event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  newChecklistTitle: string;
  onChecklistTitleChange: (value: string) => void;
  onCreateChecklist: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  checklistSectionRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
}): JSX.Element | null {
  if (!open || !selectedCardWithList || !cardDraft) return null;
  const card = selectedCardWithList.card;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeCardEditor();
        }
      }}
    >
      <Card
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden"
        onMouseDown={(event) => event.stopPropagation()}
      >
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
                onClick={() => onSetCardToDelete(card)}
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
              onChange={(e) => { const v = e.target.value; onCardDraftChange((c) => ({ ...c, title: v })); }}
              placeholder="Card title"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            <p className="text-xs text-muted-foreground">Description</p>
            <textarea
              value={cardDraft.description}
              onChange={(e) => { const v = e.target.value; onCardDraftChange((c) => ({ ...c, description: v })); }}
              placeholder="Describe the task"
              className="min-h-[140px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Priority</span>
              <select
                value={cardDraft.priority}
                onChange={(e) => { const v = e.target.value as CardPriority; onCardDraftChange((c) => ({ ...c, priority: v })); }}
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
                onChange={(e) => { const v = clampYearInDateInput(e.target.value); onCardDraftChange((c) => ({ ...c, dueDate: v })); }}
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
                    onClick={() => onCardDraftChange((c) => ({ ...c, coverColor: color }))}
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
                  const isSelected = card.labels.some((item) => item.id === label.id);
                  return (
                    <label key={label.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(event) => {
                          onToggleCardLabel(card.id, label.id, event.target.checked);
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
                  const isSelected = card.assignees.some((item) => item.id === member.id);
                  return (
                    <label key={member.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(event) => {
                          onToggleAssignee(card.id, member.id, event.target.checked);
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
            {(card.comments ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No comments yet.</p>
            ) : (
              <div className="space-y-2">
                {(card.comments ?? []).map((comment) => (
                  <CommentNote
                    key={comment.id}
                    comment={comment}
                    expanded={expandedCommentIds.has(comment.id)}
                    onToggle={() => onToggleCommentExpanded(comment.id)}
                    onReact={(emoji) => onToggleCommentReaction(comment.id, emoji)}
                    onDelete={() => onSetCommentToDelete(comment.id)}
                  />
                ))}
              </div>
            )}
            <form className="space-y-2" onSubmit={onCreateCardComment}>
              <MentionsField
                value={newCardComment}
                onChange={(value) => onCardCommentChange(value)}
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
                            onChecklistTitleDraftChange(checklist.id, value);
                          }}
                          onBlur={() => { void onSaveChecklistTitle(card.id, checklist); }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") { event.preventDefault(); void onSaveChecklistTitle(card.id, checklist); }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              onChecklistTitleDraftChange(checklist.id, checklist.title);
                            }
                          }}
                          placeholder="Checklist title"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          onClick={() => onSetChecklistToDelete(checklist)}
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
                                    onToggleChecklistItem(card.id, checklist.id, item, event.target.checked);
                                  }}
                                />
                                <Input
                                  value={itemTitle}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    onChecklistItemTitleDraftChange(item.id, value);
                                  }}
                                  onBlur={() => { void onSaveChecklistItemTitle(card.id, checklist.id, item); }}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") { event.preventDefault(); void onSaveChecklistItemTitle(card.id, checklist.id, item); }
                                    if (event.key === "Escape") {
                                      event.preventDefault();
                                      onChecklistItemTitleDraftChange(item.id, item.title);
                                    }
                                  }}
                                  placeholder="Checklist item"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="mt-0.5 h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                  onClick={() => onSetChecklistItemToDelete({ item, cardId: card.id })}
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
                        onSubmit={(event) => { void onCreateChecklistItem(card.id, checklist.id, event); }}
                      >
                        <Input
                          value={newChecklistItemTitles[checklist.id] ?? ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            onChecklistItemDraftChange(checklist.id, value);
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
                onChange={(event) => onChecklistTitleChange(event.target.value)}
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
  );
}


