import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { getCommentSnippet } from "@/pages/boards/board-detail-page.utils";
import type { BoardCard, BoardComment, BoardList, Checklist, ChecklistItem } from "@/types/board";

export function BoardDetailDialogs({
  showSavedNotice,
  restoreConflict,
  onDismissRestoreConflict,
  onConfirmRestoreConflict,
  isArchiveBoardOpen,
  onCancelArchiveBoard,
  onConfirmArchiveBoard,
  isDeleteBoardOpen,
  boardName,
  onCancelDeleteBoard,
  onConfirmDeleteBoard,
  cardToDelete,
  onCancelDeleteCard,
  onConfirmDeleteCard,
  commentToDelete,
  onCancelDeleteComment,
  onConfirmDeleteComment,
  checklistToDelete,
  onCancelDeleteChecklist,
  onConfirmDeleteChecklist,
  checklistItemToDelete,
  onCancelDeleteChecklistItem,
  onConfirmDeleteChecklistItem,
  listToDelete,
  onCancelDeleteList,
  onConfirmDeleteList,
}: {
  showSavedNotice: boolean;
  restoreConflict: { message: string; onConfirm: () => void } | null;
  onDismissRestoreConflict: () => void;
  onConfirmRestoreConflict: () => void;
  isArchiveBoardOpen: boolean;
  onCancelArchiveBoard: () => void;
  onConfirmArchiveBoard: () => void;
  isDeleteBoardOpen: boolean;
  boardName: string;
  onCancelDeleteBoard: () => void;
  onConfirmDeleteBoard: () => void;
  cardToDelete: BoardCard | null;
  onCancelDeleteCard: () => void;
  onConfirmDeleteCard: () => void;
  commentToDelete: BoardComment | null;
  onCancelDeleteComment: () => void;
  onConfirmDeleteComment: () => void;
  checklistToDelete: Checklist | null;
  onCancelDeleteChecklist: () => void;
  onConfirmDeleteChecklist: () => void;
  checklistItemToDelete: { item: ChecklistItem; cardId: string } | null;
  onCancelDeleteChecklistItem: () => void;
  onConfirmDeleteChecklistItem: () => void;
  listToDelete: BoardList | null;
  onCancelDeleteList: () => void;
  onConfirmDeleteList: () => void;
}): JSX.Element {
  return (
    <>
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
        onCancel={onDismissRestoreConflict}
        onConfirm={onConfirmRestoreConflict}
      />
      <ConfirmDialog
        open={isArchiveBoardOpen}
        title="Archive board"
        description={`Archive "${boardName}"? You can restore it for 7 days.`}
        confirmLabel="Archive"
        cancelLabel="Cancel"
        onCancel={onCancelArchiveBoard}
        onConfirm={onConfirmArchiveBoard}
      />
      <ConfirmDialog
        open={isDeleteBoardOpen}
        title="Delete board"
        description={`Delete "${boardName}" and all its lists? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Keep"
        onCancel={onCancelDeleteBoard}
        onConfirm={onConfirmDeleteBoard}
      />
      <ConfirmDialog
        open={cardToDelete !== null}
        title="Delete card"
        description={`Delete "${cardToDelete?.title ?? "this card"}"?`}
        confirmLabel="Delete"
        cancelLabel="Keep"
        onCancel={onCancelDeleteCard}
        onConfirm={onConfirmDeleteCard}
      />
      <ConfirmDialog
        open={commentToDelete !== null}
        title="Delete comment"
        description={`Delete "${commentToDelete ? getCommentSnippet(commentToDelete.body) : "this comment"}"?`}
        confirmLabel="Delete"
        cancelLabel="Keep"
        onCancel={onCancelDeleteComment}
        onConfirm={onConfirmDeleteComment}
      />
      <ConfirmDialog
        open={checklistToDelete !== null}
        title="Delete checklist"
        description={`Delete "${checklistToDelete?.title ?? "this checklist"}"?`}
        confirmLabel="Delete"
        cancelLabel="Keep"
        onCancel={onCancelDeleteChecklist}
        onConfirm={onConfirmDeleteChecklist}
      />
      <ConfirmDialog
        open={checklistItemToDelete !== null}
        title="Delete checklist item"
        description={`Delete "${checklistItemToDelete?.item.title ?? "this item"}"?`}
        confirmLabel="Delete"
        cancelLabel="Keep"
        onCancel={onCancelDeleteChecklistItem}
        onConfirm={onConfirmDeleteChecklistItem}
      />
      <ConfirmDialog
        open={listToDelete !== null}
        title="Delete list"
        description={`Delete "${listToDelete?.name ?? "this list"}"?`}
        confirmLabel="Delete"
        cancelLabel="Keep"
        onCancel={onCancelDeleteList}
        onConfirm={onConfirmDeleteList}
      />
    </>
  );
}
