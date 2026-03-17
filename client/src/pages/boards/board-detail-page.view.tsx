import type React from "react";
import type { MutableRefObject } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArchivedListsModal } from "@/pages/boards/board-detail-page.archived-panel";
import { CardDetailModal } from "@/pages/boards/board-detail-page.card-modal";
import { BoardDetailDialogs } from "@/pages/boards/board-detail-page.dialogs";
import { BoardHeaderSection } from "@/pages/boards/board-detail-page.header";
import { BoardListsSection } from "@/pages/boards/board-detail-page.lists";
import { BoardSettingsSection } from "@/pages/boards/board-detail-page.settings";
import type {
  ArchivedListEntry,
  BoardAttachment,
  BoardBackground,
  BoardCard,
  BoardComment,
  BoardDetail,
  BoardLabel,
  BoardList,
  BoardMember,
  Checklist,
  ChecklistItem,
  LabelColor,
  RetentionMode
} from "@/types/board";
import type { CardDraft } from "@/pages/boards/board-detail-page.utils";
import type { DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core";

export interface BoardDetailPageViewProps {
  state: {
    loading: boolean;
    board: BoardDetail | null;
    error: string | null;
    activeSurfaceClass: string;
    activeBannerClass: string;
    boardName: string;
    boardDescription: string;
    boardBackground: BoardBackground;
    retentionMode: RetentionMode;
    retentionDays: number;
    retentionHours: number;
    retentionMinutesPart: number;
    retentionTotalMinutes: number;
    archiveRetentionDays: number;
    archiveRetentionHours: number;
    archiveRetentionMinutesPart: number;
    archiveRetentionTotalMinutes: number;
    newBoardComment: string;
    newListCommentDrafts: Record<string, string>;
    newListName: string;
    newListDone: boolean;
    newCardTitles: Record<string, string>;
    newLabelName: string;
    newLabelColor: LabelColor;
    labelDrafts: Record<string, string>;
    labelColorDrafts: Record<string, LabelColor>;
    labelSavingIds: Set<string>;
    listNameDrafts: Record<string, string>;
    editingListId: string | null;
    listSavingIds: Set<string>;
    orderedLists: BoardList[];
    boardMembers: BoardMember[];
    boardLabels: BoardLabel[];
    expandedCommentIds: Set<string>;
    expandedListCommentGroups: Set<string>;
    expandedCardCommentGroups: Set<string>;
    selectedCardWithList: { card: BoardCard; list: BoardList } | null;
    cardDraft: CardDraft | null;
    cardSaveStatus: "idle" | "saving" | "saved";
    isUploadingAttachments: boolean;
    attachmentError: string | null;
    selectedCardAttachments: BoardAttachment[];
    newCardComment: string;
    selectedCardChecklists: Checklist[];
    checklistTitleDrafts: Record<string, string>;
    checklistItemTitleDrafts: Record<string, string>;
    newChecklistItemTitles: Record<string, string>;
    newChecklistTitle: string;
    archivedLoading: boolean;
    archivedError: string | null;
    archivedLists: ArchivedListEntry[];
    isArchivedOpen: boolean;
    showSavedNotice: boolean;
    restoreConflict: { message: string; onConfirm: () => void } | null;
    isArchiveBoardOpen: boolean;
    isDeleteBoardOpen: boolean;
    cardToDelete: BoardCard | null;
    commentToDelete: BoardComment | null;
    checklistToDelete: Checklist | null;
    checklistItemToDelete: { item: ChecklistItem; cardId: string } | null;
    listToDelete: BoardList | null;
    nowMs: number;
    activeCardId: string | null;
    activeCard: BoardCard | null;
    activeList: BoardList | null;
    isSettingsOpen: boolean;
    isAutosavingBoard: boolean;
  };
  refs: {
    listInputRefs: MutableRefObject<Record<string, HTMLInputElement | null>>;
    attachmentInputRef: MutableRefObject<HTMLInputElement | null>;
    checklistSectionRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  };
  actions: {
    onToggleCommentExpanded: (commentId: string) => void;
    onToggleCommentReaction: (commentId: string, emoji: string) => Promise<void>;
    onSetCommentToDelete: (comment: BoardComment | null) => void;
    onCreateBoardComment: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
    onOpenArchivedLists: () => void;
    onNewBoardCommentChange: (value: string) => void;
    onNewListNameChange: (value: string) => void;
    onNewListDoneChange: (value: boolean) => void;
    onCreateList: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
    onToggleListEdit: (list: BoardList) => Promise<void>;
    onListNameDraftChange: (listId: string, value: string) => void;
    closeListEditor: (list: BoardList) => Promise<void>;
    cancelListEditor: (list: BoardList) => void;
    onArchiveList: (listId: string) => Promise<void>;
    onSetListToDelete: (list: BoardList | null) => void;
    onToggleDone: (listId: string, isDoneList: boolean) => Promise<void>;
    onToggleListCommentGroup: (listId: string) => void;
    onToggleCardCommentGroup: (cardId: string) => void;
    onListCommentDraftChange: (listId: string, value: string) => void;
    onCreateListComment: (listId: string, event: React.FormEvent<HTMLFormElement>) => Promise<void>;
    onCardTitleChange: (listId: string, value: string) => void;
    onCreateCard: (listId: string, event: React.FormEvent<HTMLFormElement>) => Promise<void>;
    openCardEditor: (card: BoardCard, checklistId?: string) => void;
    onToggleChecklistItem: (cardId: string, checklistId: string, item: ChecklistItem, nextValue: boolean) => void;
    onDownloadAllAttachments: (card: BoardCard) => Promise<void>;
    onDragStart: (event: DragStartEvent) => void;
    onDragOver: (event: DragOverEvent) => void;
    onDragEnd: (event: DragEndEvent) => void;
    onToggleSettingsOpen: () => void;
    onBoardNameChange: (value: string) => void;
    onBoardDescriptionChange: (value: string) => void;
    onApplyBoardBackground: (next: BoardBackground) => void;
    onRetentionModeChange: (next: RetentionMode) => void;
    applyRetentionParts: (days: number, hours: number, minutes: number) => void;
    applyArchiveRetentionParts: (days: number, hours: number, minutes: number) => void;
    onNewLabelNameChange: (value: string) => void;
    onNewLabelColorChange: (value: LabelColor) => void;
    onLabelDraftChange: (labelId: string, value: string) => void;
    onLabelColorDraftChange: (labelId: string, value: LabelColor) => void;
    scheduleLabelAutosave: (labelId: string, name: string, color: LabelColor) => void;
    onLabelDelete: (label: BoardLabel | null) => void;
    onCreateLabel: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
    onOpenArchiveBoard: () => void;
    onOpenDeleteBoard: () => void;
    onArchiveBoard: () => Promise<void>;
    closeCardEditor: () => void;
    onArchiveCard: () => Promise<void>;
    onSetCardToDelete: (card: BoardCard | null) => void;
    onCardDraftChange: (updater: (current: CardDraft) => CardDraft) => void;
    onToggleCardLabel: (cardId: string, labelId: string, nextValue: boolean) => Promise<void>;
    onToggleAssignee: (cardId: string, memberId: string, nextValue: boolean) => Promise<void>;
    onUploadAttachments: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    onDownloadAttachment: (attachment: BoardAttachment) => Promise<void>;
    onDeleteAttachment: (attachmentId: string) => Promise<void>;
    onCardCommentChange: (value: string) => void;
    onCreateCardComment: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
    onChecklistTitleDraftChange: (checklistId: string, value: string) => void;
    onSaveChecklistTitle: (cardId: string, checklist: Checklist) => Promise<void>;
    onSetChecklistToDelete: (checklist: Checklist | null) => void;
    onChecklistItemTitleDraftChange: (itemId: string, value: string) => void;
    onSaveChecklistItemTitle: (cardId: string, checklistId: string, item: ChecklistItem) => Promise<void>;
    onSetChecklistItemToDelete: (entry: { item: ChecklistItem; cardId: string } | null) => void;
    onChecklistItemDraftChange: (checklistId: string, value: string) => void;
    onCreateChecklistItem: (cardId: string, checklistId: string, event: React.FormEvent<HTMLFormElement>) => Promise<void>;
    onChecklistTitleChange: (value: string) => void;
    onCreateChecklist: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
    onSetIsArchivedOpen: (value: boolean) => void;
    onRequestRestoreArchivedEntry: (entry: ArchivedListEntry) => void;
    onRequestRestoreArchivedCard: (entry: ArchivedListEntry, card: BoardCard) => void;
    onSetRestoreConflict: (value: { message: string; onConfirm: () => void } | null) => void;
    onSetIsArchiveBoardOpen: (value: boolean) => void;
    onSetIsDeleteBoardOpen: (value: boolean) => void;
    onDeleteBoard: () => Promise<void>;
    onDeleteCard: () => Promise<void>;
    onDeleteComment: () => Promise<void>;
    onDeleteChecklist: () => Promise<void>;
    onDeleteChecklistItem: () => Promise<void>;
    onDeleteList: () => Promise<void>;
  };
}

export function BoardDetailPageView({ state, refs, actions }: BoardDetailPageViewProps): JSX.Element {
  if (state.loading) {
    return <p className="text-sm text-muted-foreground">Loading board...</p>;
  }
  if (!state.board) {
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

  const boardComments = state.board.comments ?? [];
  return (
    <>
      <div className={`-mx-4 -my-4 space-y-6 px-4 py-4 lg:-mx-6 lg:-my-6 lg:px-6 lg:py-6 ${state.activeSurfaceClass}`}>
        <BoardHeaderSection
          activeBannerClass={state.activeBannerClass}
          boardName={state.boardName}
          boardComments={boardComments}
          expandedCommentIds={state.expandedCommentIds}
          onToggleCommentExpanded={actions.onToggleCommentExpanded}
          onToggleCommentReaction={(commentId, emoji) => { void actions.onToggleCommentReaction(commentId, emoji); }}
          onDeleteComment={(comment) => actions.onSetCommentToDelete(comment)}
          newBoardComment={state.newBoardComment}
          onNewBoardCommentChange={actions.onNewBoardCommentChange}
          onCreateBoardComment={actions.onCreateBoardComment}
          boardMembers={state.boardMembers}
          onOpenArchivedLists={actions.onOpenArchivedLists}
          error={state.error}
        />
        <BoardListsSection
          nowMs={state.nowMs}
          retentionMinutes={state.retentionTotalMinutes}
          newListName={state.newListName}
          onNewListNameChange={actions.onNewListNameChange}
          newListDone={state.newListDone}
          onNewListDoneChange={actions.onNewListDoneChange}
          onCreateList={actions.onCreateList}
          orderedLists={state.orderedLists}
          listNameDrafts={state.listNameDrafts}
          editingListId={state.editingListId}
          listInputRefs={refs.listInputRefs}
          listSavingIds={state.listSavingIds}
          onToggleListEdit={actions.onToggleListEdit}
          onListNameDraftChange={actions.onListNameDraftChange}
          closeListEditor={actions.closeListEditor}
          cancelListEditor={actions.cancelListEditor}
          onArchiveList={actions.onArchiveList}
          onDeleteList={(list) => actions.onSetListToDelete(list)}
          onToggleDone={actions.onToggleDone}
          expandedListCommentGroups={state.expandedListCommentGroups}
          toggleListCommentGroup={actions.onToggleListCommentGroup}
          expandedCommentIds={state.expandedCommentIds}
          toggleCommentExpanded={actions.onToggleCommentExpanded}
          onToggleCommentReaction={(commentId, emoji) => { void actions.onToggleCommentReaction(commentId, emoji); }}
          onDeleteComment={(comment) => actions.onSetCommentToDelete(comment)}
          newListCommentDrafts={state.newListCommentDrafts}
          onListCommentDraftChange={actions.onListCommentDraftChange}
          onCreateListComment={actions.onCreateListComment}
          boardMembers={state.boardMembers}
          newCardTitles={state.newCardTitles}
          onCardTitleChange={actions.onCardTitleChange}
          onCreateCard={actions.onCreateCard}
          openCardEditor={actions.openCardEditor}
          onToggleChecklistItem={actions.onToggleChecklistItem}
          expandedCardCommentGroups={state.expandedCardCommentGroups}
          onToggleCardCommentGroup={actions.onToggleCardCommentGroup}
          onDownloadAllAttachments={actions.onDownloadAllAttachments}
          activeCardId={state.activeCardId}
          activeCard={state.activeCard}
          activeList={state.activeList}
          onDragStart={actions.onDragStart}
          onDragOver={actions.onDragOver}
          onDragEnd={actions.onDragEnd}
        />
        <BoardSettingsSection
          isSettingsOpen={state.isSettingsOpen}
          onToggleSettingsOpen={actions.onToggleSettingsOpen}
          boardName={state.boardName}
          onBoardNameChange={actions.onBoardNameChange}
          boardDescription={state.boardDescription}
          onBoardDescriptionChange={actions.onBoardDescriptionChange}
          boardBackground={state.boardBackground}
          onApplyBoardBackground={actions.onApplyBoardBackground}
          retentionDays={state.retentionDays}
          retentionHours={state.retentionHours}
          retentionMinutesPart={state.retentionMinutesPart}
          retentionMode={state.retentionMode}
          onRetentionModeChange={actions.onRetentionModeChange}
          applyRetentionParts={actions.applyRetentionParts}
          archiveRetentionDays={state.archiveRetentionDays}
          archiveRetentionHours={state.archiveRetentionHours}
          archiveRetentionMinutesPart={state.archiveRetentionMinutesPart}
          applyArchiveRetentionParts={actions.applyArchiveRetentionParts}
          newLabelName={state.newLabelName}
          onNewLabelNameChange={actions.onNewLabelNameChange}
          newLabelColor={state.newLabelColor}
          onNewLabelColorChange={actions.onNewLabelColorChange}
          boardLabels={state.boardLabels}
          labelDrafts={state.labelDrafts}
          labelColorDrafts={state.labelColorDrafts}
          onLabelDraftChange={actions.onLabelDraftChange}
          onLabelColorDraftChange={actions.onLabelColorDraftChange}
          scheduleLabelAutosave={actions.scheduleLabelAutosave}
          onLabelDelete={(label) => actions.onLabelDelete(label)}
          labelSavingIds={state.labelSavingIds}
          onCreateLabel={actions.onCreateLabel}
          isAutosavingBoard={state.isAutosavingBoard}
          onOpenArchiveBoard={actions.onOpenArchiveBoard}
          onOpenDeleteBoard={actions.onOpenDeleteBoard}
        />
      </div>
      <CardDetailModal
        open={Boolean(state.selectedCardWithList && state.cardDraft)}
        selectedCardWithList={state.selectedCardWithList}
        cardDraft={state.cardDraft}
        closeCardEditor={actions.closeCardEditor}
        onArchiveCard={actions.onArchiveCard}
        onSetCardToDelete={(card) => actions.onSetCardToDelete(card)}
        cardSaveStatus={state.cardSaveStatus}
        onCardDraftChange={actions.onCardDraftChange}
        boardLabels={state.boardLabels}
        boardMembers={state.boardMembers}
        onToggleCardLabel={actions.onToggleCardLabel}
        onToggleAssignee={actions.onToggleAssignee}
        attachmentInputRef={refs.attachmentInputRef}
        isUploadingAttachments={state.isUploadingAttachments}
        onUploadAttachments={actions.onUploadAttachments}
        attachmentError={state.attachmentError}
        selectedCardAttachments={state.selectedCardAttachments}
        onDownloadAttachment={actions.onDownloadAttachment}
        onDeleteAttachment={actions.onDeleteAttachment}
        expandedCommentIds={state.expandedCommentIds}
        onToggleCommentExpanded={actions.onToggleCommentExpanded}
        onToggleCommentReaction={(commentId, emoji) => { void actions.onToggleCommentReaction(commentId, emoji); }}
        onSetCommentToDelete={(commentId) => {
          const comment = state.selectedCardWithList?.card.comments?.find((entry) => entry.id === commentId) ?? null;
          actions.onSetCommentToDelete(comment);
        }}
        newCardComment={state.newCardComment}
        onCardCommentChange={actions.onCardCommentChange}
        onCreateCardComment={actions.onCreateCardComment}
        selectedCardChecklists={state.selectedCardChecklists}
        checklistTitleDrafts={state.checklistTitleDrafts}
        onChecklistTitleDraftChange={actions.onChecklistTitleDraftChange}
        onSaveChecklistTitle={actions.onSaveChecklistTitle}
        onSetChecklistToDelete={actions.onSetChecklistToDelete}
        checklistItemTitleDrafts={state.checklistItemTitleDrafts}
        onChecklistItemTitleDraftChange={actions.onChecklistItemTitleDraftChange}
        onSaveChecklistItemTitle={actions.onSaveChecklistItemTitle}
        onSetChecklistItemToDelete={actions.onSetChecklistItemToDelete}
        onToggleChecklistItem={actions.onToggleChecklistItem}
        newChecklistItemTitles={state.newChecklistItemTitles}
        onChecklistItemDraftChange={actions.onChecklistItemDraftChange}
        onCreateChecklistItem={actions.onCreateChecklistItem}
        newChecklistTitle={state.newChecklistTitle}
        onChecklistTitleChange={actions.onChecklistTitleChange}
        onCreateChecklist={actions.onCreateChecklist}
        checklistSectionRefs={refs.checklistSectionRefs}
      />
      <ArchivedListsModal
        open={state.isArchivedOpen}
        archivedLoading={state.archivedLoading}
        archivedError={state.archivedError}
        archivedLists={state.archivedLists}
        nowMs={state.nowMs}
        archiveRetentionTotalMinutes={state.archiveRetentionTotalMinutes}
        onClose={() => actions.onSetIsArchivedOpen(false)}
        onRestore={actions.onRequestRestoreArchivedEntry}
        onRestoreCard={actions.onRequestRestoreArchivedCard}
      />
      <BoardDetailDialogs
        showSavedNotice={state.showSavedNotice}
        restoreConflict={state.restoreConflict}
        onDismissRestoreConflict={() => actions.onSetRestoreConflict(null)}
        onConfirmRestoreConflict={() => {
          state.restoreConflict?.onConfirm();
          actions.onSetRestoreConflict(null);
        }}
        isArchiveBoardOpen={state.isArchiveBoardOpen}
        onCancelArchiveBoard={() => actions.onSetIsArchiveBoardOpen(false)}
        onConfirmArchiveBoard={() => {
          actions.onSetIsArchiveBoardOpen(false);
          void actions.onArchiveBoard();
        }}
        isDeleteBoardOpen={state.isDeleteBoardOpen}
        boardName={state.board.name}
        onCancelDeleteBoard={() => actions.onSetIsDeleteBoardOpen(false)}
        onConfirmDeleteBoard={() => {
          actions.onSetIsDeleteBoardOpen(false);
          void actions.onDeleteBoard();
        }}
        cardToDelete={state.cardToDelete}
        onCancelDeleteCard={() => actions.onSetCardToDelete(null)}
        onConfirmDeleteCard={() => { void actions.onDeleteCard(); }}
        commentToDelete={state.commentToDelete}
        onCancelDeleteComment={() => actions.onSetCommentToDelete(null)}
        onConfirmDeleteComment={() => { void actions.onDeleteComment(); }}
        checklistToDelete={state.checklistToDelete}
        onCancelDeleteChecklist={() => actions.onSetChecklistToDelete(null)}
        onConfirmDeleteChecklist={() => { void actions.onDeleteChecklist(); }}
        checklistItemToDelete={state.checklistItemToDelete}
        onCancelDeleteChecklistItem={() => actions.onSetChecklistItemToDelete(null)}
        onConfirmDeleteChecklistItem={() => { void actions.onDeleteChecklistItem(); }}
        listToDelete={state.listToDelete}
        onCancelDeleteList={() => actions.onSetListToDelete(null)}
        onConfirmDeleteList={() => { void actions.onDeleteList(); }}
      />
    </>
  );
}
