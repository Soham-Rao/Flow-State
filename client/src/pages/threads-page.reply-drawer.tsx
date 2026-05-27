import { ArrowRight, CornerUpLeft, Paperclip, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";

import { Button } from "@/components/ui/button";
import { ThreadComposer } from "./threads-page.composer";
import { UserHoverCard } from "@/components/users/user-hover-card";
import type { BoardMember } from "@/types/board";
import type { ThreadMessageSummary, ThreadReactionDetail, ThreadReplySummary } from "@/types/threads";
import { THREAD_REACTION_CHOICES } from "./threads-page.constants";
import { ThreadExpandableText } from "./threads-page.long-text";
import { formatDateHeading, formatDuration, formatTime, formatTimestamp, getAttachmentKind, getInitial } from "./threads-page.utils";

type ThreadsReplyDrawerProps = {
  open: boolean;
  replyOpen: boolean;
  replyTarget: ThreadMessageSummary | null;
  replyPreviewExpanded: boolean;
  onToggleReplyPreview: () => void;
  replyAttachmentOpen: boolean;
  onToggleReplyAttachments: () => void;
  replies: ThreadReplySummary[];
  replyListRef: RefObject<HTMLDivElement>;
  replyLoadingOlder: boolean;
  replyNewCount: number;
  mentionNewCount?: number;
  onJumpToNextMention?: () => void;
  onReplyScroll: () => void;
  onJumpToLatestReply: () => void;
  currentUserId: string | null | undefined;
  voiceUrls: Record<string, string>;
  attachmentPreviewUrls: Record<string, string>;
  onSetImagePreview: (preview: { url: string; name: string } | null) => void;
  onSetVideoPreview: (preview: { url: string; name: string } | null) => void;
  hoveredReplyId: string | null;
  setHoveredReplyId: Dispatch<SetStateAction<string | null>>;
  reactionPickerReplyId: string | null;
  setReactionPickerReplyId: Dispatch<SetStateAction<string | null>>;
  replyReactionDetailsOpenId: string | null;
  replyReactionDetailsByReplyId: Record<string, ThreadReactionDetail[]>;
  replyReactionDetailsLoadingId: string | null;
  replyReactionDetailsTabByReplyId: Record<string, string>;
  setReplyReactionDetailsTabByReplyId: Dispatch<SetStateAction<Record<string, string>>>;
  onToggleReplyReaction: (replyId: string, emoji: string) => void | Promise<void>;
  onToggleReplyReactionDetails: (replyId: string) => void | Promise<void>;
  onDownloadReplyAttachment: (attachmentId: string, name: string) => void;
  onOpenInlineReply: (reply: ThreadReplySummary) => void;
  onOpenForwardPicker: (reply: ThreadReplySummary) => void;
  editingReplyId: string | null;
  editingReplyDraft: string;
  setEditingReplyDraft: Dispatch<SetStateAction<string>>;
  editingReplyError: string | null;
  onStartEditingReply: (reply: ThreadReplySummary) => void;
  onCancelEditingReply: () => void;
  onSaveReplyEdit: (reply: ThreadReplySummary) => void | Promise<void>;
  onRequestDeleteReply: (payload: { reply: ThreadReplySummary; scope: "me" | "all" }) => void;
  replyPendingAttachments: File[];
  replyFileInputRef: RefObject<HTMLInputElement>;
  onReplyPickAttachments: () => void;
  onReplyAttachmentChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onReplyRemoveAttachment: (index: number) => void;
  replyRecording: boolean;
  replyRecordingDuration: number;
  onReplyStartRecording: () => void;
  onReplyStopRecording: () => void;
  onReplyCancelRecording: () => void;
  replyDraft: string;
  onReplyDraftChange: (value: string) => void;
  replyInlineTarget: ThreadReplySummary | null;
  onCancelReplyInline: () => void;
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
  replyListRef,
  replyLoadingOlder,
  replyNewCount,
  mentionNewCount,
  onJumpToNextMention,
  onReplyScroll,
  onJumpToLatestReply,
  currentUserId,
  voiceUrls,
  attachmentPreviewUrls,
  onSetImagePreview,
  onSetVideoPreview,
  hoveredReplyId,
  setHoveredReplyId,
  reactionPickerReplyId,
  setReactionPickerReplyId,
  replyReactionDetailsOpenId,
  replyReactionDetailsByReplyId,
  replyReactionDetailsLoadingId,
  replyReactionDetailsTabByReplyId,
  setReplyReactionDetailsTabByReplyId,
  onToggleReplyReaction,
  onToggleReplyReactionDetails,
  onDownloadReplyAttachment,
  onOpenInlineReply,
  onOpenForwardPicker,
  editingReplyId,
  editingReplyDraft,
  setEditingReplyDraft,
  editingReplyError,
  onStartEditingReply,
  onCancelEditingReply,
  onSaveReplyEdit,
  onRequestDeleteReply,
  replyPendingAttachments,
  replyFileInputRef,
  onReplyPickAttachments,
  onReplyAttachmentChange,
  onReplyRemoveAttachment,
  replyRecording,
  replyRecordingDuration,
  onReplyStartRecording,
  onReplyStopRecording,
  onReplyCancelRecording,
  replyDraft,
  onReplyDraftChange,
  replyInlineTarget,
  onCancelReplyInline,
  mentionMembers,
  onReplyKeyDown,
  replyError,
  onSendReply,
  onClose
}: ThreadsReplyDrawerProps): JSX.Element | null {
  const hasReplyAttachments = (replyTarget?.attachments?.length ?? 0) > 0;
  const [deleteMenuReplyId, setDeleteMenuReplyId] = useState<string | null>(null);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-20">
      <div
        className={`absolute inset-0 bg-background/40 transition-opacity ${replyOpen ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <div
        className={`absolute right-0 top-0 flex h-full w-full max-w-[1100px] flex-col border-l border-border/70 bg-card/95 shadow-xl transition-transform duration-200 ${
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
                      {replyTarget.attachments.map((attachment) => {
                        const kind = getAttachmentKind(attachment.mimeType, attachment.originalName);
                        const previewUrl = attachmentPreviewUrls[attachment.id];
                        return (
                          <button
                            key={attachment.id}
                            type="button"
                            className="flex w-full items-center gap-2 rounded-md border border-border/60 bg-background/80 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                            onDoubleClick={() => {
                              if (kind === "image" && previewUrl) {
                                onSetImagePreview({ url: previewUrl, name: attachment.originalName });
                                return;
                              }
                              if (kind === "video" && previewUrl) {
                                onSetVideoPreview({ url: previewUrl, name: attachment.originalName });
                                return;
                              }
                              onDownloadReplyAttachment(attachment.id, attachment.originalName);
                            }}
                          >
                            <Paperclip className="h-3 w-3" />
                            <span className="max-w-[200px] truncate">{attachment.originalName}</span>
                          </button>
                        );
                      })}
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

        <div
          ref={replyListRef}
          onScroll={onReplyScroll}
          className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3"
        >
          {replyLoadingOlder && (
            <div className="text-center text-[11px] text-muted-foreground">Loading older replies...</div>
          )}
          {replies.length === 0 && !replyLoadingOlder && (
            <p className="text-xs text-muted-foreground">No replies yet.</p>
          )}
          {replies.map((reply, index) => {
            const isMine = reply.author.id === currentUserId;
            const previous = replies[index - 1];
            const replyDateKey = reply.createdAt ? new Date(reply.createdAt).toDateString() : "";
            const previousDateKey = previous?.createdAt ? new Date(previous.createdAt).toDateString() : "";
            const showDate = replyDateKey !== previousDateKey;
            const showAvatar = !previous || previous.author.id !== reply.author.id;
            const initial = getInitial(
              reply.author.displayName ?? reply.author.username ?? reply.author.name
            );
            const isDeleted = Boolean(reply.deletedAt);
            const isEditing = editingReplyId === reply.id;
            const isEdited = !isDeleted && new Date(reply.updatedAt).getTime() > new Date(reply.createdAt).getTime();
            const canEdit = isMine && !isDeleted && Date.now() - new Date(reply.createdAt).getTime() <= 15 * 60 * 1000;
            const canDeleteForAll = isMine && !isDeleted;
            const deleteMenuOpen = deleteMenuReplyId === reply.id;
            const replyBodyText = isDeleted
              ? reply.body && reply.body.trim().length > 0
                ? reply.body
                : "This message was deleted."
              : reply.body;
            const replyContext = reply.replyContext;
            const replyAuthorLabel = replyContext
              ? replyContext.author.displayName ?? replyContext.author.username ?? replyContext.author.name
              : "";
            const replyPreview = replyContext?.body?.trim()
              ? replyContext.body
              : replyContext
                ? "Attachment"
                : "";
            const replyBlock = replyContext ? (
              <div className={`mb-2 rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-[11px] text-muted-foreground ${isMine ? "text-right" : "text-left"}`}>
                <div className={`flex items-center gap-1 ${isMine ? "justify-end" : "justify-start"}`}>
                  <CornerUpLeft className="h-3 w-3" />
                  <span>Replying to {replyAuthorLabel}</span>
                </div>
                <p className="mt-1 text-[12px] text-foreground/80">{replyPreview}</p>
              </div>
            ) : null;
            const avatar = (
              <UserHoverCard user={reply.author}>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-transparent text-sm font-semibold">
                  {initial}
                </div>
              </UserHoverCard>
            );
            const leadingAvatar = !isMine ? (showAvatar ? avatar : <div className="h-9 w-9" />) : null;
            const isHovered = hoveredReplyId === reply.id;
            const showActionRail = isHovered && !isDeleted;
            const showReactionPicker = showActionRail && reactionPickerReplyId === reply.id;
            const hasReactions = reply.reactions.length > 0;
            const voiceNote = reply.voiceNote;
            const voiceUrl = voiceNote ? voiceUrls[voiceNote.id] : null;
            const voicePlayer = voiceNote ? (
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-border/60 bg-background/70 px-2 py-1">
                {voiceUrl ? (
                  <audio controls src={voiceUrl} className="h-8 w-40" />
                ) : (
                  <div className="text-[11px] text-muted-foreground">Loading voice message…</div>
                )}
                <span className="text-[11px] text-muted-foreground">{formatDuration(voiceNote.durationSec)}</span>
              </div>
            ) : null;
            const attachments = reply.attachments ?? [];
            const attachmentList = attachments.length > 0 ? (
              <div className={`mt-2 flex w-full flex-col gap-2 ${isMine ? "items-end" : "items-start"}`}>
                {attachments.map((attachment) => {
                  const kind = getAttachmentKind(attachment.mimeType, attachment.originalName);
                  const previewUrl = attachmentPreviewUrls[attachment.id];
                  if (kind === "image") {
                    return previewUrl ? (
                      <div
                        key={attachment.id}
                        className={`w-fit max-w-full rounded-lg border border-border/60 bg-background/70 p-2 ${isMine ? "ml-auto" : ""}`}
                      >
                        <img
                          src={previewUrl}
                          alt={attachment.originalName}
                          className="h-40 w-56 max-w-full rounded-md object-cover block"
                          onDoubleClick={() =>
                            onSetImagePreview({ url: previewUrl, name: attachment.originalName })
                          }
                        />
                      </div>
                    ) : (
                      <div
                        key={attachment.id}
                        className={`w-fit max-w-full rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-[11px] text-muted-foreground ${isMine ? "ml-auto text-right" : ""}`}
                      >
                        Loading image preview...
                      </div>
                    );
                  }
                  if (kind === "video") {
                    return previewUrl ? (
                      <div key={attachment.id} className="w-full max-w-full rounded-lg border border-border/60 bg-background/70 p-2">
                        <video
                          src={previewUrl}
                          className="h-40 w-full rounded-md object-cover"
                          onClick={(event) => {
                            const video = event.currentTarget;
                            if (video.paused) {
                              void video.play();
                            } else {
                              video.pause();
                            }
                          }}
                          onDoubleClick={() =>
                            onSetVideoPreview({ url: previewUrl, name: attachment.originalName })
                          }
                        />
                        <p className="mt-1 text-[11px] text-muted-foreground">Click to play, double click to expand</p>
                      </div>
                    ) : (
                      <div key={attachment.id} className="w-full max-w-full rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-[11px] text-muted-foreground">
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
                      onDoubleClick={() => onDownloadReplyAttachment(attachment.id, attachment.originalName)}
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
                className={`min-w-0 flex-1 rounded-2xl border px-4 py-3 ${
                  isMine
                    ? "border-sky-400/40 bg-sky-500/15"
                    : "border-emerald-400/40 bg-emerald-500/15"
                }`}
              >
                {replyBlock}
                {isEdited && !isEditing && (
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
                      value={editingReplyDraft}
                      onChange={(event) => setEditingReplyDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void onSaveReplyEdit(reply);
                        }
                      }}
                    />
                    {editingReplyError && (
                      <p className="text-[11px] text-rose-500">{editingReplyError}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => onSaveReplyEdit(reply)}>
                        Save
                      </Button>
                      <Button variant="ghost" size="sm" onClick={onCancelEditingReply}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : replyBodyText ? (
                  <ThreadExpandableText text={replyBodyText} className="whitespace-pre-line text-[15px] text-foreground" />
                ) : null}
                {attachmentList}
                <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="mr-auto whitespace-nowrap">{formatTime(reply.createdAt)}</span>
                  {!isEditing && (
                    <div className="flex shrink-0 items-center gap-2">
                      {!isDeleted && (
                        <>
                          <button
                            type="button"
                            className="rounded-full border border-border/60 px-2 py-0.5 text-xs text-muted-foreground hover:text-primary"
                            onClick={() => onOpenInlineReply(reply)}
                            aria-label="Reply inline"
                          >
                            <CornerUpLeft className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded-full border border-border/60 px-2 py-0.5 text-xs text-muted-foreground hover:text-primary"
                            onClick={() => onOpenForwardPicker(reply)}
                            aria-label="Forward message"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {isMine && !isDeleted && (
                        <button
                          type="button"
                          className={`rounded-full border border-border/60 px-2 py-0.5 text-xs ${canEdit ? "text-muted-foreground hover:text-primary" : "cursor-not-allowed text-muted-foreground/50"}`}
                          onClick={() => {
                            if (canEdit) {
                              onStartEditingReply(reply);
                            }
                          }}
                          aria-label="Edit reply"
                          title={canEdit ? "Edit reply" : "Editing is available for 15 minutes"}
                          disabled={!canEdit}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        className="rounded-full border border-border/60 px-2 py-0.5 text-xs text-muted-foreground hover:text-primary"
                        onClick={() => setDeleteMenuReplyId((current) => (current === reply.id ? null : reply.id))}
                        aria-label="Delete reply"
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
                        onRequestDeleteReply({ reply, scope: "me" });
                        setDeleteMenuReplyId(null);
                      }}
                    >
                      Delete for me
                    </button>
                    {canDeleteForAll && (
                      <button
                        type="button"
                        className="rounded-full border border-rose-500/60 bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-600 hover:text-rose-500"
                        onClick={() => {
                          onRequestDeleteReply({ reply, scope: "all" });
                          setDeleteMenuReplyId(null);
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

            const replyReactionDetails = replyReactionDetailsByReplyId[reply.id];
            const replyReactionDetailsOpen = replyReactionDetailsOpenId === reply.id;
            const replyReactionDetailsToggle = hasReactions ? (
              <button
                type="button"
                className="mt-1 text-[11px] font-semibold text-primary/80 hover:text-primary"
                onClick={() => void onToggleReplyReactionDetails(reply.id)}
              >
                {replyReactionDetailsOpen ? "Hide reactions" : "View reactions"}
              </button>
            ) : null;
            const selectedReplyReactionTab = replyReactionDetailsTabByReplyId[reply.id] ?? replyReactionDetails?.[0]?.emoji ?? "";
            const activeReplyReactionDetail = replyReactionDetails?.find((detail) => detail.emoji === selectedReplyReactionTab) ?? replyReactionDetails?.[0];
            const replyReactionTabs = replyReactionDetails?.map((detail) => {
              const isActive = detail.emoji === selectedReplyReactionTab;
              return (
                <button
                  key={`${reply.id}-${detail.emoji}-tab`}
                  type="button"
                  className={`rounded-full border px-2 py-0.5 text-[10px] ${isActive ? "border-primary/60 bg-primary/15 text-primary" : "border-border/60 text-muted-foreground hover:text-primary"}`}
                  onClick={() => setReplyReactionDetailsTabByReplyId((prev) => ({ ...prev, [reply.id]: detail.emoji }))}
                >
                  {detail.emoji} {detail.users.length}
                </button>
              );
            });
            const replyReactionDetailsPanel = replyReactionDetailsOpen ? (
              <div className="mt-2 space-y-2 rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-[11px] text-muted-foreground">
                {replyReactionDetailsLoadingId === reply.id && (
                  <p>Loading reactions...</p>
                )}
                {replyReactionDetailsLoadingId !== reply.id && (replyReactionDetails?.length ?? 0) === 0 && (
                  <p>No reactions yet.</p>
                )}
                {replyReactionDetailsLoadingId !== reply.id && (replyReactionDetails?.length ?? 0) > 0 && (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {replyReactionTabs}
                    </div>
                    {activeReplyReactionDetail && (
                      <div className="max-h-28 space-y-1 overflow-y-auto">
                        {activeReplyReactionDetail.users.map((reactor) => (
                          <div key={`${reply.id}-${activeReplyReactionDetail.emoji}-${reactor.id}`} className="rounded-md border border-border/60 bg-background/80 px-2 py-1 text-[10px] text-foreground">
                            {reactor.displayName ?? reactor.username ?? reactor.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : null;
            const actionRail = (
              <div className={`relative flex h-6 w-6 items-center justify-center transition ${showActionRail ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                <button
                  type="button"
                  className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-primary"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!showActionRail) return;
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
            );

            const replyBody = (
              <div className={`flex min-w-[260px] max-w-[75%] flex-col ${isMine ? "items-end self-end" : "items-start self-start"}`}>
                <div className="inline-flex items-center gap-2">
                  {isMine && actionRail}
                  {bubble}
                  {!isMine && actionRail}
                </div>
                {reactionStrip || replyReactionDetailsToggle || replyReactionDetailsPanel ? (
                  <div className={`mt-1 flex w-full flex-col ${isMine ? "items-end" : "items-start"}`}>
                    {reactionStrip}
                    {replyReactionDetailsToggle}
                    {replyReactionDetailsPanel}
                  </div>
                ) : null}
              </div>
            );

            return (
              <div key={reply.id} className="space-y-2" data-reply-id={reply.id} id={`reply-${reply.id}`}>
                {showDate && (
                  <div className="flex justify-center">
                    <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1 text-[11px] text-muted-foreground">
                      {formatDateHeading(reply.createdAt)}
                    </span>
                  </div>
                )}
                <div
                  className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                onMouseEnter={() => setHoveredReplyId(reply.id)}
                onMouseLeave={() => {
                  setHoveredReplyId((current) => (current === reply.id ? null : current));
                  setReactionPickerReplyId((current) => (current === reply.id ? null : current));
                  setDeleteMenuReplyId((current) => (current === reply.id ? null : current));
                }}
              >
                <div className={`flex items-start gap-4 ${isMine ? "justify-end" : ""}`}>
                  {leadingAvatar}
                  {replyBody}
                </div>
              </div>
            </div>
            );
          })}
        </div>

        {Boolean(onJumpToNextMention) && (mentionNewCount ?? 0) > 0 && (
          <div className="flex justify-center px-4">
            <button
              type="button"
              className="rounded-full bg-rose-500/90 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-rose-500"
              onClick={onJumpToNextMention}
            >
              +{mentionNewCount} new mentions
            </button>
          </div>
        )}

        {replyNewCount > 0 && (
          <div className="flex justify-end px-4">
            <button
              type="button"
              className="rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500"
              onClick={onJumpToLatestReply}
            >
              +{replyNewCount} new replies
            </button>
          </div>
        )}

        <div className="border-t border-border/70 bg-background/70 p-4">
          <ThreadComposer
            inlineReplyTarget={replyInlineTarget}
            onCancelInlineReply={onCancelReplyInline}
            messageDraft={replyDraft}
            onMessageDraftChange={onReplyDraftChange}
            mentionMembers={mentionMembers}
            onMessageKeyDown={onReplyKeyDown}
            pendingAttachments={replyPendingAttachments}
            onRemoveAttachment={onReplyRemoveAttachment}
            fileInputRef={replyFileInputRef}
            onAttachmentChange={onReplyAttachmentChange}
            onPickAttachments={onReplyPickAttachments}
            sendError={replyError}
            recording={replyRecording}
            recordingDuration={replyRecordingDuration}
            onCancelRecording={onReplyCancelRecording}
            onStopRecording={onReplyStopRecording}
            onStartRecording={onReplyStartRecording}
            sending={false}
            onSendMessage={onSendReply}
          />
        </div>
      </div>
    </div>
  );
}









