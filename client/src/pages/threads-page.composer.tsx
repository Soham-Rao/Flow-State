import { AlertCircle, Mic, Paperclip, Send } from "lucide-react";
import type { RefObject } from "react";

import { MentionsField } from "@/components/mentions/mentions-input";
import { Button } from "@/components/ui/button";
import type { BoardMember } from "@/types/board";
import type { ThreadMessageSummary, ThreadReplySummary } from "@/types/threads";
import { formatDuration } from "./threads-page.utils";

const THREAD_MESSAGE_CHARACTER_LIMIT = 5000;

type ThreadComposerProps = {
  inlineReplyTarget: ThreadMessageSummary | ThreadReplySummary | null;
  onCancelInlineReply: () => void;
  messageDraft: string;
  onMessageDraftChange: (value: string) => void;
  mentionMembers: BoardMember[];
  onMessageKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
  pendingAttachments: File[];
  onRemoveAttachment: (index: number) => void;
  fileInputRef: RefObject<HTMLInputElement>;
  onAttachmentChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onPickAttachments: () => void;
  sendError: string | null;
  recording: boolean;
  recordingDuration: number;
  onCancelRecording: () => void;
  onStopRecording: () => void;
  onStartRecording: () => void;
  sending: boolean;
  onSendMessage: () => void;
};

function isLengthError(message: string | null): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes("5000") || normalized.includes("5,000") || normalized.includes("at most");
}

export function ThreadComposer({
  inlineReplyTarget,
  onCancelInlineReply,
  messageDraft,
  onMessageDraftChange,
  mentionMembers,
  onMessageKeyDown,
  pendingAttachments,
  onRemoveAttachment,
  fileInputRef,
  onAttachmentChange,
  onPickAttachments,
  sendError,
  recording,
  recordingDuration,
  onCancelRecording,
  onStopRecording,
  onStartRecording,
  sending,
  onSendMessage
}: ThreadComposerProps): JSX.Element {
  const normalizedLength = messageDraft.trim().length;
  const remainingCharacters = THREAD_MESSAGE_CHARACTER_LIMIT - normalizedLength;
  const overLimitBy = Math.max(0, normalizedLength - THREAD_MESSAGE_CHARACTER_LIMIT);
  const isOverLimit = overLimitBy > 0;
  const visibleError = isOverLimit
    ? `This message is ${overLimitBy} characters over the 5,000-character limit. Break it into smaller parts before sending.`
    : isLengthError(sendError)
      ? null
      : sendError;

  return (
    <div className="sticky bottom-0 rounded-xl border border-border/70 bg-background/90 p-3 backdrop-blur">
      {inlineReplyTarget && (
        <div className="mb-2 flex items-center justify-between rounded-md border border-border/70 bg-card/70 px-2.5 py-1 text-xs text-muted-foreground">
          <span>
            Replying to{" "}
            <span className="font-semibold text-foreground">
              {inlineReplyTarget.author.displayName ??
                inlineReplyTarget.author.username ??
                inlineReplyTarget.author.name}
            </span>
          </span>
          <button
            type="button"
            className="text-[11px] text-muted-foreground hover:text-foreground"
            onClick={onCancelInlineReply}
          >
            Cancel
          </button>
        </div>
      )}
      <MentionsField
        multiline
        rows={3}
        value={messageDraft}
        onChange={onMessageDraftChange}
        members={mentionMembers}
        placeholder="Write a message..."
        dropdownPlacement="top"
        onKeyDown={onMessageKeyDown}
      />
      {pendingAttachments.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {pendingAttachments.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 rounded-md border border-border/60 bg-background/80 px-2 py-1 text-[11px] text-muted-foreground"
            >
              <span className="max-w-[200px] truncate">{file.name}</span>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => onRemoveAttachment(index)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={onAttachmentChange}
      />
      {visibleError && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Message needs attention</p>
            <p className="mt-0.5 leading-relaxed">{visibleError}</p>
          </div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <button
            type="button"
            className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={onPickAttachments}
          >
            <Paperclip className="h-4 w-4" />
            Attachments
          </button>
          {recording ? (
            <div className="ml-3 flex items-center gap-2 text-xs text-rose-500">
              <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
              Recording {formatDuration(recordingDuration)}
              <button
                type="button"
                className="ml-2 text-[11px] text-rose-500 hover:text-rose-400"
                onClick={onCancelRecording}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ml-1 text-[11px] font-semibold text-rose-500 hover:text-rose-400"
                onClick={onStopRecording}
              >
                Send
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="ml-3 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={onStartRecording}
            >
              <Mic className="h-4 w-4" />
              Voice
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs ${isOverLimit ? "font-semibold text-rose-500" : remainingCharacters <= 500 ? "text-amber-500" : "text-muted-foreground"}`}>
            {normalizedLength} / {THREAD_MESSAGE_CHARACTER_LIMIT}
          </span>
          <Button size="sm" onClick={onSendMessage} disabled={sending || isOverLimit}>
            <Send className="mr-2 h-4 w-4" />
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
