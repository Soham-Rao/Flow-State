import { Plus } from "lucide-react";
import type React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MentionsField } from "@/components/mentions/mentions-input";
import { CommentNote } from "@/pages/boards/board-detail-page.components";
import type { BoardComment, BoardMember } from "@/types/board";

export function BoardHeaderSection({
  activeBannerClass,
  boardName,
  boardComments,
  expandedCommentIds,
  onToggleCommentExpanded,
  onToggleCommentReaction,
  onDeleteComment,
  newBoardComment,
  onNewBoardCommentChange,
  onCreateBoardComment,
  boardMembers,
  onOpenArchivedLists,
  error,
}: {
  activeBannerClass: string;
  boardName: string;
  boardComments: BoardComment[];
  expandedCommentIds: Set<string>;
  onToggleCommentExpanded: (commentId: string) => void;
  onToggleCommentReaction: (commentId: string, emoji: string) => void;
  onDeleteComment: (comment: BoardComment) => void;
  newBoardComment: string;
  onNewBoardCommentChange: (value: string) => void;
  onCreateBoardComment: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  boardMembers: BoardMember[];
  onOpenArchivedLists: () => void;
  error: string | null;
}): JSX.Element {
  return (
    <>
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
                    onToggle={() => onToggleCommentExpanded(comment.id)}
                    onReact={(emoji) => onToggleCommentReaction(comment.id, emoji)}
                    onDelete={() => onDeleteComment(comment)}
                    variant="default"
                  />
                ))}
              </div>
            )}
            <div className="space-y-2">
              <form className="flex flex-wrap gap-2" onSubmit={onCreateBoardComment}>
                <MentionsField
                  value={newBoardComment}
                  onChange={(value) => onNewBoardCommentChange(value)}
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
          <Button type="button" variant="secondary" onClick={onOpenArchivedLists}>
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
    </>
  );
}
