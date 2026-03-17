import { Paperclip, Send } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

import { MentionsField } from "@/components/mentions/mentions-input";
import { Button } from "@/components/ui/button";
import { UserHoverCard } from "@/components/users/user-hover-card";
import type { BoardMember } from "@/types/board";
import type { ThreadMessageSummary, ThreadReplySummary } from "@/types/threads";
import { THREAD_REACTION_CHOICES } from "./threads-page.constants";
import { formatDuration, formatTime, formatTimestamp, getInitial } from "./threads-page.utils";

type ThreadsReplyDrawerProps = {
  open: boolean;
  replyOpen: boolean;
  replyTarget: ThreadMessageSummary | null;
  replyPreviewExpanded: boolean;
  onToggleReplyPreview: () => void;
  replyAttachmentOpen: boolean;
  onToggleReplyAttachments: () => void;
  replies: ThreadReplySummary[];
  currentUserId: string | null | undefined;
  voiceUrls: Record<string, string>;
  hoveredReplyId: string | null;
  setHoveredReplyId: Dispatch<SetStateAction<string | null>>;
  reactionPickerReplyId: string | null;
  setReactionPickerReplyId: Dispatch<SetStateAction<string | null>>;
  onToggleReplyReaction: (replyId: string, emoji: string) => void | Promise<void>;
  onDownloadAttachment: (attachmentId: string, name: string) => void;
  replyDraft: string;
  onReplyDraftChange: (value: string) => void;
  mentionMembers: BoardMember[];
  onReplyKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
  replyError: string | null;
  onSendReply: () => void;
  onClose: () => void;
};

export function ThreadsReplyDrawer({
  open,
  replyOpen,
  replyTarget,
  replyPreviewExpanded,
  onToggleReplyPreview,
  replyAttachmentOpen,
  onToggleReplyAttachments,
  replies,
  currentUserId,
  voiceUrls,
  hoveredReplyId,
  setHoveredReplyId,
  reactionPickerReplyId,
  setReactionPickerReplyId,
  onToggleReplyReaction,
  onDownloadAttachment,
  replyDraft,
  onReplyDraftChange,
  mentionMembers,
  onReplyKeyDown,
  replyError,
  onSendReply,
  onClose
}: ThreadsReplyDrawerProps): JSX.Element | null {
  if (!open) return null;

  const hasReplyAttachments = (replyTarget?.attachments?.length ?? 0) > 0;

  return (
    <div className="absolute inset-0 z-20">
      <div
        className={`absolute inset-0 bg-background/40 transition-opacity ${replyOpen ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <div
        className={`absolute right-0 top-0 flex h-full w-full max-w-[380px] flex-col border-l border-border/70 bg-card/95 shadow-xl transition-transform duration-200 ${
          replyOpen ? "translate-x-0" : "translate-x-full"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 border-b border-border/70 bg-card/95 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Reply thread</p>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
          {replyTarget && (
            <div className="mt-3 rounded-lg border border-border/60 bg-background/70 p-2">
              <div className="flex items-start gap-2">
                <UserHoverCard user={replyTarget.author}>
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-transparent text-[10px] font-semibold">
                    {getInitial(
                      replyTarget.author.displayName ?? replyTarget.author.username ?? replyTarget.author.name
                    )}
                  </div>
                </UserHoverCard>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] text-foreground">
                      {replyPreviewExpanded || (replyTarget.body?.length ?? 0) <= 160
                        ? replyTarget.body
                        : `${replyTarget.body?.slice(0, 160)}…`}
                    </p>
                    {hasReplyAttachments && (
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-primary/80 hover:text-primary"
                        onClick={onToggleReplyAttachments}
                      >
                        {replyAttachmentOpen
                          ? "Hide attachments"
                          : `Show attachments (${replyTarget.attachments.length})`}
                      </button>
                    )}
                  </div>
                  {replyTarget.voiceNote && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg border border-border/60 bg-background/70 px-2 py-1">
                      {voiceUrls[replyTarget.voiceNote.id] ? (
                        <audio controls src={voiceUrls[replyTarget.voiceNote.id]} className="h-8 w-40" />
                      ) : (
                        <div className="text-[11px] text-muted-foreground">Loading voice message…</div>
                      )}
                      <span className="text-[11px] text-muted-foreground">{formatDuration(replyTarget.voiceNote.durationSec)}</span>
                    </div>
                  )}
                  {hasReplyAttachments && replyAttachmentOpen && (
                    <div className="mt-2 space-y-1 rounded-lg border border-border/60 bg-background/70 px-2 py-1">
                      {replyTarget.attachments.map((attachment) => (
                        <button
                          key={attachment.id}
                          type="button"
                          className="flex w-full items-center gap-2 rounded-md border border-border/60 bg-background/80 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                          onClick={() => onDownloadAttachment(attachment.id, attachment.originalName)}
                        >
                          <Paperclip className="h-3 w-3" />
                          <span className="max-w-[200px] truncate">{attachment.originalName}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground">{formatTimestamp(replyTarget.createdAt)}</p>
                    {(replyTarget.body?.length ?? 0) > 160 && (
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-primary/80 hover:text-primary"
                        onClick={onToggleReplyPreview}
                      >
                        {replyPreviewExpanded ? "Show less" : "Show more"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {replies.length === 0 && (
            <p className="text-xs text-muted-foreground">No replies yet.</p>
          )}
          {replies.map((reply, index) => {
            const isMine = reply.author.id === currentUserId;
            const previous = replies[index - 1];
            const showAvatar = !previous || previous.author.id !== reply.author.id;
            const initial = getInitial(
              reply.author.displayName ?? reply.author.username ?? reply.author.name
            );
            const isDeleted = Boolean(reply.deletedAt);
            const avatar = (
              <UserHoverCard user={reply.author}>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-transparent text-xs font-semibold">
                  {initial}
                </div>
              </UserHoverCard>
            );
            const avatarSlot = showAvatar ? avatar : <div className="h-8 w-8" />;
            const isHovered = hoveredReplyId === reply.id;
            const showReactionPicker = reactionPickerReplyId === reply.id;
            const hasReactions = reply.reactions.length > 0;
            const bubble = (
              <div
                className={`max-w-[80%] rounded-2xl border px-3 py-2 ${
                  isMine
                    ? "border-sky-400/40 bg-sky-500/15"
                    : "border-emerald-400/40 bg-emerald-500/15"
                }`}
              >
                <p className="text-[14px] text-foreground">{reply.body}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">{formatTime(reply.createdAt)}</p>
              </div>
            );

            const reactionStrip = hasReactions ? (
              <div className={`mt-0.5 flex flex-wrap gap-1 ${isMine ? "justify-end self-end" : "justify-start self-start"}`}>
                {reply.reactions.map((reaction) => {
                  const label = `${reaction.emoji} ${reaction.count}`;
                  return (
                    <button
                      key={`${reply.id}-${reaction.emoji}`}
                      type="button"
                      className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] text-primary"
                      onClick={(event) => {
                        event.stopPropagation();
                        void onToggleReplyReaction(reply.id, reaction.emoji);
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            ) : null;

            const actionRail = isHovered && !isDeleted ? (
              <div className="relative flex h-6 w-6 items-center justify-center">
                <button
                  type="button"
                  className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-primary"
                  onClick={(event) => {
                    event.stopPropagation();
                    setReactionPickerReplyId((current) => (current === reply.id ? null : reply.id));
                  }}
                >
                  <span aria-hidden="true">🙂</span>
                </button>
                {showReactionPicker && (
                  <div className={`absolute top-full mt-1 flex items-center gap-1 rounded-lg border border-border/60 bg-background/90 p-1 shadow-sm ${isMine ? "right-0" : "left-0"}`}>
                    {THREAD_REACTION_CHOICES.map((emoji) => (
                      <button
                        key={`${reply.id}-${emoji}-pick`}
                        type="button"
                        className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-primary"
                        onClick={(event) => {
                          event.stopPropagation();
                          void onToggleReplyReaction(reply.id, emoji);
                          setReactionPickerReplyId(null);
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null;

            const replyBody = (
              <div className={`flex w-fit flex-col ${isMine ? "items-end self-end" : "items-start self-start"}`}>
                <div className="inline-flex items-center gap-2">
                  {isMine && actionRail}
                  {bubble}
                  {!isMine && actionRail}
                </div>
                {reactionStrip && (
                  <div className={`mt-1 flex w-fit flex-col ${isMine ? "items-end" : "items-start"}`}>
                    {reactionStrip}
                  </div>
                )}
              </div>
            );

            return (
              <div
                key={reply.id}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                onMouseEnter={() => setHoveredReplyId(reply.id)}
                onMouseLeave={() => {
                  setHoveredReplyId((current) => (current === reply.id ? null : current));
                  setReactionPickerReplyId((current) => (current === reply.id ? null : current));
                }}
              >
                <div className="flex items-start gap-4">
                  {!isMine && avatarSlot}
                  {replyBody}
                  {isMine && avatarSlot}
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-border/70 bg-background/70 p-4">
          <MentionsField
            multiline
            rows={2}
            value={replyDraft}
            onChange={onReplyDraftChange}
            members={mentionMembers}
            placeholder="Reply with a mention..."
            onKeyDown={onReplyKeyDown}
          />
          {replyError && <p className="mt-2 text-xs text-rose-500">{replyError}</p>}
          <div className="mt-3 flex justify-end">
            <Button size="sm" onClick={onSendReply}>
              <Send className="mr-2 h-3 w-3" />
              Send reply
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
