import { DndContext, DragEndEvent, DragOverEvent, DragOverlay, DragStartEvent, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Archive, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MentionsField } from "@/components/mentions/mentions-input";
import { Input } from "@/components/ui/input";
import { CardSummary, CommentNote, ListDropZone, SortableCard, SortableListContainer } from "@/pages/boards/board-detail-page.components";
import { coverColorSurfaceClasses, toListDragId } from "@/pages/boards/board-detail-page.utils";
import type { BoardCard, BoardComment, BoardList, BoardMember, ChecklistItem } from "@/types/board";

export function BoardListsSection({
  nowMs,
  retentionMinutes,
  newListName,
  onNewListNameChange,
  newListDone,
  onNewListDoneChange,
  onCreateList,
  orderedLists,
  listNameDrafts,
  editingListId,
  listInputRefs,
  listSavingIds,
  onToggleListEdit,
  onListNameDraftChange,
  closeListEditor,
  cancelListEditor,
  onArchiveList,
  onDeleteList,
  onToggleDone,
  expandedListCommentGroups,
  toggleListCommentGroup,
  expandedCommentIds,
  toggleCommentExpanded,
  onToggleCommentReaction,
  onDeleteComment,
  newListCommentDrafts,
  onListCommentDraftChange,
  onCreateListComment,
  boardMembers,
  newCardTitles,
  onCardTitleChange,
  onCreateCard,
  openCardEditor,
  onToggleChecklistItem,
  expandedCardCommentGroups,
  onToggleCardCommentGroup,
  onDownloadAllAttachments,
  activeCardId,
  activeCard,
  activeList,
  onDragStart,
  onDragOver,
  onDragEnd,
}: {
  nowMs: number;
  retentionMinutes: number;
  newListName: string;
  onNewListNameChange: (value: string) => void;
  newListDone: boolean;
  onNewListDoneChange: (value: boolean) => void;
  onCreateList: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  orderedLists: BoardList[];
  listNameDrafts: Record<string, string>;
  editingListId: string | null;
  listInputRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
  listSavingIds: Set<string>;
  onToggleListEdit: (list: BoardList) => Promise<void>;
  onListNameDraftChange: (listId: string, value: string) => void;
  closeListEditor: (list: BoardList) => Promise<void>;
  cancelListEditor: (list: BoardList) => void;
  onArchiveList: (listId: string) => Promise<void>;
  onDeleteList: (list: BoardList) => void;
  onToggleDone: (listId: string, isDoneList: boolean) => Promise<void>;
  expandedListCommentGroups: Set<string>;
  toggleListCommentGroup: (listId: string) => void;
  expandedCommentIds: Set<string>;
  toggleCommentExpanded: (commentId: string) => void;
  onToggleCommentReaction: (commentId: string, emoji: string) => void;
  onDeleteComment: (comment: BoardComment) => void;
  newListCommentDrafts: Record<string, string>;
  onListCommentDraftChange: (listId: string, value: string) => void;
  onCreateListComment: (listId: string, event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  boardMembers: BoardMember[];
  newCardTitles: Record<string, string>;
  onCardTitleChange: (listId: string, value: string) => void;
  onCreateCard: (listId: string, event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  openCardEditor: (card: BoardCard, checklistId?: string) => void;
  onToggleChecklistItem: (cardId: string, checklistId: string, item: ChecklistItem, nextValue: boolean) => void;
  expandedCardCommentGroups: Set<string>;
  onToggleCardCommentGroup: (cardId: string) => void;
  onDownloadAllAttachments: (card: BoardCard) => Promise<void>;
  activeCardId: string | null;
  activeCard: BoardCard | null;
  activeList: BoardList | null;
  onDragStart: (event: DragStartEvent) => void;
  onDragOver: (event: DragOverEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
}): JSX.Element {
  const cardSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Create List</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-[1fr_auto_auto]" onSubmit={onCreateList}>
            <Input
              value={newListName}
              onChange={(e) => onNewListNameChange(e.target.value)}
              placeholder="List name"
            />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={newListDone} onChange={(e) => onNewListDoneChange(e.target.checked)} />
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
                              onClick={() => onDeleteList(list)}
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
                                onListNameDraftChange(list.id, e.target.value);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") { e.preventDefault(); void closeListEditor(list); }
                                if (e.key === "Escape") { e.preventDefault(); cancelListEditor(list); }
                              }}
                            />
                            <p className="text-xs text-muted-foreground">
                              {listSavingIds.has(list.id) ? "Saving..." : "Press Enter to save. Esc to cancel."}
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
                                    onDelete={() => onDeleteComment(comment)}
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
                              onChange={(value) => onListCommentDraftChange(list.id, value)}
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
                                  retentionMinutes={retentionMinutes}
                                  onChecklistItemToggle={onToggleChecklistItem}
                                  onChecklistOpen={openCardEditor}
                                  expandedCommentIds={expandedCommentIds}
                                  onToggleComment={toggleCommentExpanded}
                                  onReact={onToggleCommentReaction}
                                  onDeleteComment={(comment) => onDeleteComment(comment)}
                                  expandedCardCommentGroups={expandedCardCommentGroups}
                                  onToggleCardCommentGroup={onToggleCardCommentGroup}
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
                            onChange={(e) => onCardTitleChange(list.id, e.target.value)}
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
                  retentionMinutes={retentionMinutes}
                  showChecklists={false}
                  expandedCommentIds={expandedCommentIds}
                  onToggleComment={toggleCommentExpanded}
                  onReact={onToggleCommentReaction}
                  onDeleteComment={(comment) => onDeleteComment(comment)}
                  expandedCardCommentGroups={expandedCardCommentGroups}
                  onToggleCardCommentGroup={onToggleCardCommentGroup}
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
    </>
  );
}

