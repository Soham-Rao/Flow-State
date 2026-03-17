import { ArrowRight, ChevronsLeft, CornerUpLeft, Paperclip, Pencil, Trash2 } from "lucide-react";
import type { Dispatch, RefObject, SetStateAction } from "react";

import { Button } from "@/components/ui/button";
import { UserHoverCard } from "@/components/users/user-hover-card";
import type { ThreadMessageSummary, ThreadReactionDetail } from "@/types/threads";
import { THREAD_REACTION_CHOICES } from "./threads-page.constants";
import {
  formatDateHeading,
  formatDuration,
  formatTime,
  getAttachmentKind,
  getInitial
} from "./threads-page.utils";

type DeleteConfirmState = { message: ThreadMessageSummary; scope: "me" | "all" } | null;

type ThreadMessageListProps = {
  messages: ThreadMessageSummary[];
  loadingMessages: boolean;
  currentUserId: string | null | undefined;
  messageListRef: RefObject<HTMLDivElement>;
  onScroll: () => void;
  hoveredMessageId: string | null;
  setHoveredMessageId: Dispatch<SetStateAction<string | null>>;
  reactionPickerMessageId: string | null;
  setReactionPickerMessageId: Dispatch<SetStateAction<string | null>>;
  reactionDetailsOpenId: string | null;
  reactionDetailsByMessageId: Record<string, ThreadReactionDetail[]>;
  reactionDetailsLoadingId: string | null;
  reactionDetailsTabByMessageId: Record<string, string>;
  setReactionDetailsTabByMessageId: Dispatch<SetStateAction<Record<string, string>>>;
  editingMessageId: string | null;
  editingDraft: string;
  setEditingDraft: Dispatch<SetStateAction<string>>;
  editingError: string | null;
  deleteMenuMessageId: string | null;
  setDeleteMenuMessageId: Dispatch<SetStateAction<string | null>>;
  setDeleteConfirm: Dispatch<SetStateAction<DeleteConfirmState>>;
  voiceUrls: Record<string, string>;
  attachmentPreviewUrls: Record<string, string>;
  onOpenInlineReply: (message: ThreadMessageSummary) => void;
  onOpenReplyThread: (message: ThreadMessageSummary) => void;
  onOpenForwardPicker: (message: ThreadMessageSummary) => void;
  onStartEditingMessage: (message: ThreadMessageSummary) => void;
  onCancelEditingMessage: () => void;
  onSaveEdit: (message: ThreadMessageSummary) => void;
  onToggleMessageReaction: (messageId: string, emoji: string) => void | Promise<void>;
  onToggleReactionDetails: (messageId: string) => void | Promise<void>;
  onSetImagePreview: (preview: { url: string; name: string } | null) => void;
  onSetVideoPreview: (preview: { url: string; name: string } | null) => void;
  onDownloadAttachment: (attachmentId: string, name: string) => void;
};

export function ThreadMessageList({
  messages,
  loadingMessages,
  currentUserId,
  messageListRef,
  onScroll,
  hoveredMessageId,
  setHoveredMessageId,
  reactionPickerMessageId,
  setReactionPickerMessageId,
  reactionDetailsOpenId,
  reactionDetailsByMessageId,
  reactionDetailsLoadingId,
  reactionDetailsTabByMessageId,
  setReactionDetailsTabByMessageId,
  editingMessageId,
  editingDraft,
  setEditingDraft,
  editingError,
  deleteMenuMessageId,
  setDeleteMenuMessageId,
  setDeleteConfirm,
  voiceUrls,
  attachmentPreviewUrls,
  onOpenInlineReply,
  onOpenReplyThread,
  onOpenForwardPicker,
  onStartEditingMessage,
  onCancelEditingMessage,
  onSaveEdit,
  onToggleMessageReaction,
  onToggleReactionDetails,
  onSetImagePreview,
  onSetVideoPreview,
  onDownloadAttachment
}: ThreadMessageListProps): JSX.Element {
  return (
    <div
      className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-2"
      ref={messageListRef}
      onScroll={onScroll}
    >
      {loadingMessages && (
        <div className="text-xs text-muted-foreground">Loading messages...</div>
      )}
      {!loadingMessages && messages.length === 0 && (
        <div className="text-xs text-muted-foreground">No messages yet. Say hello!</div>
      )}
      {!loadingMessages &&
        messages.map((message, index) => {
          const previous = messages[index - 1];
          const messageDateKey = message.createdAt ? new Date(message.createdAt).toDateString() : "";
          const previousDateKey = previous?.createdAt ? new Date(previous.createdAt).toDateString() : "";
          const showDate = messageDateKey != previousDateKey;
          const isMine = message.author.id === currentUserId;
          const showAvatar = !previous || previous.author.id !== message.author.id;
          const initial = getInitial(
            message.author.displayName ?? message.author.username ?? message.author.name
          );
          const avatar = (
            <UserHoverCard user={message.author}>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-transparent text-sm font-semibold">
                {initial}
              </div>
            </UserHoverCard>
          );
          const avatarSlot = showAvatar ? avatar : <div className="h-9 w-9" />;
          const isHovered = hoveredMessageId === message.id;
          const isDeleted = Boolean(message.deletedAt);
          const isEditing = editingMessageId === message.id;
          const isEdited = !isDeleted && new Date(message.updatedAt).getTime() > new Date(message.createdAt).getTime();
          const canEdit = isMine && !message.isForwarded && !isDeleted && Date.now() - new Date(message.createdAt).getTime() <= 15 * 60 * 1000;
          const canDeleteForAll = isMine && !isDeleted;
          const deleteMenuOpen = deleteMenuMessageId === message.id;
          const showReactionPicker = reactionPickerMessageId === message.id;
          const hasReactions = message.reactions.length > 0;
          const voiceNote = message.voiceNote;
          const voiceUrl = voiceNote ? voiceUrls[voiceNote.id] : null;
          const voicePlayer = voiceNote ? (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-border/60 bg-background/70 px-2 py-1">
              {voiceUrl ? (
                <audio controls src={voiceUrl} className="h-8 w-40" />
              ) : (
                <div className="text-[11px] text-muted-foreground">Loading voice message…</div>
              )}
              {isEdited && (
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Edited
                </p>
              )}
              <span className="text-[11px] text-muted-foreground">{formatDuration(voiceNote.durationSec)}</span>
            </div>
          ) : null;
          const attachments = message.attachments ?? [];
          const attachmentList = attachments.length > 0 ? (
            <div className={`mt-2 flex w-full flex-col gap-2 ${isMine ? "items-end" : "items-start"}`}>
              {attachments.map((attachment) => {
                const kind = getAttachmentKind(attachment.mimeType, attachment.originalName);
                const previewUrl = attachmentPreviewUrls[attachment.id];
                if (kind === "image") {
                  return previewUrl ? (
                    <div key={attachment.id} className={`w-fit max-w-full rounded-lg border border-border/60 bg-background/70 p-2 ${isMine ? "ml-auto" : ""}`}>
                      <img
                        src={previewUrl}
                        alt={attachment.originalName}
                        className="h-48 w-64 max-w-full rounded-md object-cover block"
                        onDoubleClick={() => onSetImagePreview({ url: previewUrl, name: attachment.originalName })}
                      />
                    </div>
                  ) : (
                    <div key={attachment.id} className={`w-fit max-w-full rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-[11px] text-muted-foreground ${isMine ? "ml-auto text-right" : ""}`}>
                      Loading image preview...
                    </div>
                  );
                }
                if (kind === "video") {
                  return previewUrl ? (
                    <div key={attachment.id} className={`rounded-lg border border-border/60 bg-background/70 p-2 w-full max-w-full ${isMine ? "" : ""}`}>
                      <video
                        src={previewUrl}
                        className="h-48 w-full rounded-md object-cover"
                        onClick={(event) => {
                          const video = event.currentTarget;
                          if (video.paused) {
                            void video.play();
                          } else {
                            video.pause();
                          }
                        }}
                        onDoubleClick={() => onSetVideoPreview({ url: previewUrl, name: attachment.originalName })}
                      />
                      <p className="mt-1 text-[11px] text-muted-foreground">Click to play, double click to expand</p>
                    </div>
                  ) : (
                    <div key={attachment.id} className={`rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-[11px] text-muted-foreground w-full max-w-full ${isMine ? "" : ""}`}>
                      Loading video...
                    </div>
                  );
                }
                if (kind === "audio") {
                  return previewUrl ? (
                    <div key={attachment.id} className="w-full rounded-lg border border-border/60 bg-background/70 px-2 py-1">
                      <audio controls src={previewUrl} className="h-8 w-full" />
                    </div>
                  ) : (
                    <div key={attachment.id} className="w-full rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-[11px] text-muted-foreground">
                      Loading audio...
                    </div>
                  );
                }
                return (
                  <button
                    key={attachment.id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md border border-border/60 bg-background/80 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={() => onDownloadAttachment(attachment.id, attachment.originalName)}
                  >
                    <Paperclip className="h-3 w-3" />
                    <span className="max-w-[200px] truncate">{attachment.originalName}</span>
                  </button>
                );
              })}
            </div>
          ) : null;
          const bubble = (
            <div
              className={`max-w-[75%] min-w-[260px] rounded-2xl border px-4 py-3 ${
                isMine
                  ? "border-sky-400/40 bg-sky-500/15"
                  : "border-emerald-400/40 bg-emerald-500/15"
              }`}
            >
              {message.isForwarded && (
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Forwarded
                </p>
              )}
              {isEdited && (
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Edited
                </p>
              )}
              {voicePlayer}
              {isEditing ? (
                <div className="space-y-2">
                  <textarea
                    className="w-full rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-sm text-foreground outline-none"
                    rows={3}
                    value={editingDraft}
                    onChange={(event) => setEditingDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void onSaveEdit(message);
                      }
                    }}
                  />
                  {editingError && (
                    <p className="text-[11px] text-rose-500">{editingError}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => onSaveEdit(message)}>
                      Save
                    </Button>
                    <Button variant="ghost" size="sm" onClick={onCancelEditingMessage}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                message.body && (
                  <p className={`whitespace-pre-line text-[15px] text-foreground ${isDeleted ? "" : ""}`}>{message.body}</p>
                )
              )}
              {attachmentList}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span className="mr-auto">{formatTime(message.createdAt)}</span>
                {!isEditing && (
                  <div className="flex flex-wrap items-center gap-2">
                    {!isDeleted && (
                      <>
                        <button
                          type="button"
                          className="rounded-full border border-border/60 px-2 py-0.5 text-xs text-muted-foreground hover:text-primary"
                          onClick={() => onOpenInlineReply(message)}
                          aria-label="Reply inline"
                        >
                          <CornerUpLeft className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-xs text-muted-foreground hover:text-primary"
                          onClick={() => onOpenReplyThread(message)}
                          aria-label="Open reply thread"
                        >
                          <ChevronsLeft className="h-4 w-4" />
                          {message.replyCount > 0 && (
                            <span className="rounded-full bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-sky-500">+{message.replyCount}</span>
                          )}
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-border/60 px-2 py-0.5 text-xs text-muted-foreground hover:text-primary"
                          onClick={() => onOpenForwardPicker(message)}
                          aria-label="Forward message"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {isMine && !message.isForwarded && !isDeleted && (
                      <button
                        type="button"
                        className={`rounded-full border border-border/60 px-2 py-0.5 text-xs ${canEdit ? "text-muted-foreground hover:text-primary" : "cursor-not-allowed text-muted-foreground/50"}`}
                        onClick={() => {
                          if (canEdit) {
                            onStartEditingMessage(message);
                          }
                        }}
                        aria-label="Edit message"
                        title={canEdit ? "Edit message" : "Editing is available for 15 minutes"}
                        disabled={!canEdit}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded-full border border-border/60 px-2 py-0.5 text-xs text-muted-foreground hover:text-primary"
                      onClick={() => setDeleteMenuMessageId((current) => (current === message.id ? null : message.id))}
                      aria-label="Delete message"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              {!isEditing && deleteMenuOpen && (
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  <button
                    type="button"
                    className="rounded-full border border-amber-500/60 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700 hover:text-amber-600"
                    onClick={() => {
                      setDeleteConfirm({ message, scope: "me" });
                      setDeleteMenuMessageId(null);
                    }}
                  >
                    Delete for me
                  </button>
                  {canDeleteForAll && (
                    <button
                      type="button"
                      className="rounded-full border border-rose-500/60 bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-600 hover:text-rose-500"
                      onClick={() => {
                        setDeleteConfirm({ message, scope: "all" });
                        setDeleteMenuMessageId(null);
                      }}
                    >
                      Delete for all
                    </button>
                  )}
                </div>
              )}
            </div>
          );

          const reactionStrip = hasReactions ? (
            <div className={`mt-0.5 flex flex-wrap gap-1 ${isMine ? "justify-end self-end" : "justify-start self-start"}`}>
              {message.reactions.map((reaction) => {
                const label = `${reaction.emoji} ${reaction.count}`;
                return (
                  <button
                    key={`${message.id}-${reaction.emoji}`}
                    type="button"
                    className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] text-primary"
                    onClick={(event) => {
                      event.stopPropagation();
                      void onToggleMessageReaction(message.id, reaction.emoji);
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : null;

          const reactionDetails = reactionDetailsByMessageId[message.id];
          const reactionDetailsOpen = reactionDetailsOpenId === message.id;
          const reactionDetailsToggle = hasReactions ? (
            <button
              type="button"
              className="mt-1 text-[11px] font-semibold text-primary/80 hover:text-primary"
              onClick={() => void onToggleReactionDetails(message.id)}
            >
              {reactionDetailsOpen ? "Hide reactions" : "View reactions"}
            </button>
          ) : null;
          const selectedReactionTab = reactionDetailsTabByMessageId[message.id] ?? reactionDetails?.[0]?.emoji ?? "";
          const activeReactionDetail = reactionDetails?.find((detail) => detail.emoji === selectedReactionTab) ?? reactionDetails?.[0];
          const reactionTabs = reactionDetails?.map((detail) => {
            const isActive = detail.emoji === selectedReactionTab;
            return (
              <button
                key={`${message.id}-${detail.emoji}-tab`}
                type="button"
                className={`rounded-full border px-2 py-0.5 text-[10px] ${isActive ? "border-primary/60 bg-primary/15 text-primary" : "border-border/60 text-muted-foreground hover:text-primary"}`}
                onClick={() => setReactionDetailsTabByMessageId((prev) => ({ ...prev, [message.id]: detail.emoji }))}
              >
                {detail.emoji} {detail.users.length}
              </button>
            );
          });
          const reactionDetailsPanel = reactionDetailsOpen ? (
            <div className="mt-2 space-y-2 rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-[11px] text-muted-foreground">
              {reactionDetailsLoadingId === message.id && (
                <p>Loading reactions...</p>
              )}
              {reactionDetailsLoadingId !== message.id && (reactionDetails?.length ?? 0) === 0 && (
                <p>No reactions yet.</p>
              )}
              {reactionDetailsLoadingId !== message.id && (reactionDetails?.length ?? 0) > 0 && (
                <>
                  <div className="flex flex-wrap gap-2">
                    {reactionTabs}
                  </div>
                  {activeReactionDetail && (
                    <div className="max-h-28 space-y-1 overflow-y-auto">
                      {activeReactionDetail.users.map((reactor) => (
                        <div key={`${message.id}-${activeReactionDetail.emoji}-${reactor.id}`} className="rounded-md border border-border/60 bg-background/80 px-2 py-1 text-[10px] text-foreground">
                          {reactor.displayName ?? reactor.username ?? reactor.name}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : null;

          const actionRail = isHovered && !isDeleted ? (
            <div className="relative flex h-6 w-6 items-center justify-center">
              <button
                type="button"
                className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-primary"
                onClick={(event) => {
                  event.stopPropagation();
                  setReactionPickerMessageId((current) => (current === message.id ? null : message.id));
                }}
              >
                <span aria-hidden="true">🙂</span>
              </button>
              {showReactionPicker && (
                <div className={`absolute top-full mt-1 flex items-center gap-1 rounded-lg border border-border/60 bg-background/90 p-1 shadow-sm ${isMine ? "right-0" : "left-0"}`}>
                  {THREAD_REACTION_CHOICES.map((emoji) => (
                    <button
                      key={`${message.id}-${emoji}-pick`}
                      type="button"
                      className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-primary"
                      onClick={(event) => {
                        event.stopPropagation();
                        void onToggleMessageReaction(message.id, emoji);
                        setReactionPickerMessageId(null);
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null;

          const messageBody = (
            <div className={`flex w-fit flex-col ${isMine ? "items-end self-end" : "items-start self-start"}`}>
              <div className="inline-flex items-center gap-2">
                {isMine && actionRail}
                {bubble}
                {!isMine && actionRail}
              </div>
              {reactionStrip || reactionDetailsToggle || reactionDetailsPanel ? (
                <div className={`mt-1 flex w-fit flex-col ${isMine ? "items-end" : "items-start"}`}>
                  {reactionStrip}
                  {reactionDetailsToggle}
                  {reactionDetailsPanel}
                </div>
              ) : null}
            </div>
          );

          return (
            <div key={message.id} className="space-y-2">
              {showDate && (
                <div className="flex justify-center">
                  <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1 text-[11px] text-muted-foreground">{formatDateHeading(message.createdAt)}</span>
                </div>
              )}
              <div
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                onMouseEnter={() => setHoveredMessageId(message.id)}
                onMouseLeave={() => {
                  setHoveredMessageId((current) => (current === message.id ? null : current));
                  setReactionPickerMessageId((current) => (current === message.id ? null : current));
                }}
              >
                <div className="flex items-start gap-4">
                  {!isMine && avatarSlot}
                  {messageBody}
                  {isMine && avatarSlot}
                </div>
              </div>
            </div>
          );
        })}
    </div>
  );
}
