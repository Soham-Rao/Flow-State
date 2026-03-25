import { Plus } from "lucide-react";
import type React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MentionsField } from "@/components/mentions/mentions-input";
import { CommentNote } from "@/pages/boards/board-detail-page.components";
import type { BoardComment, BoardMember } from "@/types/board";
import type { PresenceUser } from "@/types/presence";


function getPresenceInitials(user: PresenceUser): string {
  const raw = user.displayName || user.username || user.name || user.email || "?";
  const label = raw.includes("@") ? raw.split("@")[0] : raw;
  const parts = label.trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]).join("");
  return initials ? initials.toUpperCase() : "?";
}
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
  boardPresence,
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
  boardPresence: PresenceUser[];
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

          {boardPresence.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {boardPresence.slice(0, 3).map((member) => (
                  <div
                    key={member.id}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-card/80 text-[10px] font-semibold text-muted-foreground shadow-sm"
                    title={member.displayName ?? member.username ?? member.email}
                  >
                    {getPresenceInitials(member)}
                  </div>
                ))}
                {boardPresence.length > 3 && (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-background/80 text-[10px] font-semibold text-muted-foreground shadow-sm">
                    +{boardPresence.length - 3}
                  </div>
                )}
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Online</span>
            </div>
          )}

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
