import { useEffect, useRef, useState } from "react";

import { extractMentionIds } from "@/lib/mentions";
import { resolveAudioDuration } from "./threads-page.utils";
import {
  createThreadMessage,
  createThreadMessageAttachments,
  createThreadReply,
  createThreadReplyAttachments,
  createThreadReplyVoiceNote,
  getOrCreateDmConversation,

  listThreadMessageReactionDetails,
  listThreadReplyReactionDetails,
  listThreadReplies,
  toggleThreadMessageReaction,
  toggleThreadReplyReaction,
  updateThreadMessage,
  updateThreadReply,
  deleteThreadMessage,
  deleteThreadReply
} from "@/lib/threads-api";
import type { BoardMember } from "@/types/board";
import type { ChannelConversationSummary, DmConversationSummary, ThreadMessageSummary, ThreadReplySummary, ThreadUserSummary, ThreadReactionDetail } from "@/types/threads";
type ThreadConversationSummary = DmConversationSummary | ChannelConversationSummary;
type RefreshConversationsResult = { nextDm: DmConversationSummary[]; nextChannels: ChannelConversationSummary[] };

const REPLY_PAGE_SIZE = 30;
const MAX_REPLIES_IN_MEMORY = 200;
const REPLY_TOP_FETCH_THRESHOLD = 140;
const REPLY_BOTTOM_SCROLL_THRESHOLD = 140;
const THREAD_MESSAGE_CHARACTER_LIMIT = 5000;

function getThreadLengthError(length: number): string {
  return `Messages can be up to 5,000 characters. This draft is ${length - THREAD_MESSAGE_CHARACTER_LIMIT} characters over the limit.`;
}

const CompressionStreamImpl = "CompressionStream" in globalThis ? globalThis.CompressionStream : undefined;
const DecompressionStreamImpl = "DecompressionStream" in globalThis ? globalThis.DecompressionStream : undefined;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

type CompressedReplyPage =
  | { kind: "gzip"; data: Uint8Array<ArrayBuffer>; count: number }
  | { kind: "json"; data: string; count: number };

async function compressReplies(replies: ThreadReplySummary[]): Promise<CompressedReplyPage> {
  const payload = JSON.stringify(replies);
  if (!CompressionStreamImpl) {
    return { kind: "json", data: payload, count: replies.length };
  }
  const stream = new CompressionStreamImpl("gzip");
  const writer = stream.writable.getWriter();
  await writer.write(textEncoder.encode(payload));
  await writer.close();
  const buffer = await new Response(stream.readable).arrayBuffer();
  return { kind: "gzip", data: new Uint8Array(buffer), count: replies.length };
}

async function decompressReplies(page: CompressedReplyPage): Promise<ThreadReplySummary[]> {
  if (page.kind === "json") {
    return JSON.parse(page.data) as ThreadReplySummary[];
  }
  if (!DecompressionStreamImpl) {
    return [];
  }
  const stream = new DecompressionStreamImpl("gzip");
  const writer = stream.writable.getWriter();
  await writer.write(page.data);
  await writer.close();
  const buffer = await new Response(stream.readable).arrayBuffer();
  return JSON.parse(textDecoder.decode(buffer)) as ThreadReplySummary[];
}


function getReplyReactionSignature(reactions: ThreadReplySummary["reactions"] | undefined): string {
  return (reactions ?? [])
    .slice()
    .sort((a, b) => a.emoji.localeCompare(b.emoji))
    .map((reaction) => `${reaction.emoji}:${reaction.count}`)
    .join("|");
}
type ForwardTarget = { body: string | null };

type ThreadActionsParams = {
  activeConversation: ThreadConversationSummary | null;
  userId: string | null | undefined;
  messages: ThreadMessageSummary[];
  setMessages: React.Dispatch<React.SetStateAction<ThreadMessageSummary[]>>;
  setReplySeenCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  refreshConversations: () => Promise<RefreshConversationsResult>;
  mentionMembers: BoardMember[];
  enablePolling: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
};

type ThreadActionsState = {
  messageDraft: string;
  setMessageDraft: React.Dispatch<React.SetStateAction<string>>;
  pendingAttachments: File[];
  handlePickAttachments: () => void;
  handleAttachmentChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveAttachment: (index: number) => void;
  inlineReplyTarget: ThreadMessageSummary | null;
  setInlineReplyTarget: React.Dispatch<React.SetStateAction<ThreadMessageSummary | null>>;
  replyDraft: string;
  setReplyDraft: React.Dispatch<React.SetStateAction<string>>;
  replyInlineTarget: ThreadReplySummary | null;
  setReplyInlineTarget: React.Dispatch<React.SetStateAction<ThreadReplySummary | null>>;
  replyPendingAttachments: File[];
  replyFileInputRef: React.RefObject<HTMLInputElement>;
  handleReplyPickAttachments: () => void;
  handleReplyAttachmentChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleReplyRemoveAttachment: (index: number) => void;
  replyRecording: boolean;
  replyRecordingDuration: number;
  startReplyRecording: () => void;
  stopReplyRecording: () => void;
  cancelReplyRecording: () => void;
  editingReplyId: string | null;
  editingReplyDraft: string;
  setEditingReplyDraft: React.Dispatch<React.SetStateAction<string>>;
  editingReplyError: string | null;
  startEditingReply: (reply: ThreadReplySummary) => void;
  cancelEditingReply: () => void;
  handleSaveReplyEdit: (reply: ThreadReplySummary) => Promise<void>;
  replyDeleteConfirm: { reply: ThreadReplySummary; scope: "me" | "all" } | null;
  setReplyDeleteConfirm: React.Dispatch<React.SetStateAction<{ reply: ThreadReplySummary; scope: "me" | "all" } | null>>;
  handleDeleteReply: (reply: ThreadReplySummary, scope: "me" | "all") => Promise<void>;
  replyTarget: ThreadMessageSummary | null;
  replyOpen: boolean;
  replyPreviewExpanded: boolean;
  setReplyPreviewExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  replyAttachmentOpen: boolean;
  setReplyAttachmentOpen: React.Dispatch<React.SetStateAction<boolean>>;
  replies: ThreadReplySummary[];
  replyListRef: React.RefObject<HTMLDivElement>;
  replyLoadingOlder: boolean;
  replyNewCount: number;
  handleReplyScroll: () => void;
  jumpToLatestReply: () => void;
  replyError: string | null;
  refreshReplies: () => Promise<void>;
  forwardTarget: ForwardTarget | null;
  forwardOpen: boolean;
  forwardSearch: string;
  setForwardSearch: React.Dispatch<React.SetStateAction<string>>;
  forwarding: boolean;
  forwardError: string | null;
  editingMessageId: string | null;
  editingDraft: string;
  setEditingDraft: React.Dispatch<React.SetStateAction<string>>;
  editingError: string | null;
  deleteMenuMessageId: string | null;
  setDeleteMenuMessageId: React.Dispatch<React.SetStateAction<string | null>>;
  deleteConfirm: { message: ThreadMessageSummary; scope: "me" | "all" } | null;
  setDeleteConfirm: React.Dispatch<React.SetStateAction<{ message: ThreadMessageSummary; scope: "me" | "all" } | null>>;
  sending: boolean;
  sendError: string | null;
  setSendError: React.Dispatch<React.SetStateAction<string | null>>;
  reactionDetailsOpenId: string | null;
  reactionDetailsByMessageId: Record<string, ThreadReactionDetail[]>;
  reactionDetailsLoadingId: string | null;
  reactionDetailsTabByMessageId: Record<string, string>;
  setReactionDetailsTabByMessageId: React.Dispatch<React.SetStateAction<Record<string, string>>>;

  replyReactionDetailsOpenId: string | null;
  replyReactionDetailsByReplyId: Record<string, ThreadReactionDetail[]>;
  replyReactionDetailsLoadingId: string | null;
  replyReactionDetailsTabByReplyId: Record<string, string>;
  setReplyReactionDetailsTabByReplyId: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  openReplyThread: (message: ThreadMessageSummary) => Promise<void>;
  closeReplyThread: () => void;
  openInlineReply: (message: ThreadMessageSummary) => void;
  openInlineReplyForReply: (reply: ThreadReplySummary) => void;
  openForwardPicker: (message: ThreadMessageSummary) => void;
  openForwardPickerForReply: (reply: ThreadReplySummary) => void;
  closeForwardPicker: () => void;
  handleForwardToUser: (targetUser: ThreadUserSummary) => Promise<void>;
  handleForwardToChannel: (targetChannel: ChannelConversationSummary) => Promise<void>;
  startEditingMessage: (message: ThreadMessageSummary) => void;
  cancelEditingMessage: () => void;
  handleSaveEdit: (message: ThreadMessageSummary) => Promise<void>;
  handleDeleteMessage: (message: ThreadMessageSummary, scope: "me" | "all") => Promise<void>;
  handleSendMessage: () => Promise<void>;
  handleSendReply: () => Promise<void>;
  handleToggleMessageReaction: (messageId: string, emoji: string) => Promise<void>;
  handleToggleReplyReaction: (replyId: string, emoji: string) => Promise<void>;
  handleToggleReactionDetails: (messageId: string) => Promise<void>;
  handleToggleReplyReactionDetails: (replyId: string) => Promise<void>;
  handleMessageKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
  handleReplyKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
};

export function useThreadActions({
  activeConversation,
  userId,
  messages,
  setMessages,
  setReplySeenCounts,
  refreshConversations,
  mentionMembers,
  enablePolling,
  fileInputRef,
}: ThreadActionsParams): ThreadActionsState {
  const [messageDraft, setMessageDraft] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [replyDraft, setReplyDraft] = useState("");
  const [replyInlineTarget, setReplyInlineTarget] = useState<ThreadReplySummary | null>(null);
  const [replyPendingAttachments, setReplyPendingAttachments] = useState<File[]>([]);
  const [replyTarget, setReplyTarget] = useState<ThreadMessageSummary | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyPreviewExpanded, setReplyPreviewExpanded] = useState(false);
  const replyFileInputRef = useRef<HTMLInputElement | null>(null);
  const [replyAttachmentOpen, setReplyAttachmentOpen] = useState(false);
  const [replyRecording, setReplyRecording] = useState(false);
  const [replyRecordingDuration, setReplyRecordingDuration] = useState(0);
  const replyRecorderRef = useRef<MediaRecorder | null>(null);
  const replyRecorderStreamRef = useRef<MediaStream | null>(null);
  const replyRecorderChunksRef = useRef<Blob[]>([]);
  const replyRecordingTimerRef = useRef<number | null>(null);
  const replyRecordingDurationRef = useRef(0);
  const replyRecordingCanceledRef = useRef(false);
  const [replies, setReplies] = useState<ThreadReplySummary[]>([]);
  const [replyLoadingOlder, setReplyLoadingOlder] = useState(false);
  const [replyHasMore, setReplyHasMore] = useState(true);
  const [replyNewCount, setReplyNewCount] = useState(0);

  const replyListRef = useRef<HTMLDivElement | null>(null);
  const repliesRef = useRef<ThreadReplySummary[]>([]);
  const replyCompressedHistoryRef = useRef<CompressedReplyPage[]>([]);
  const replyUserAtBottomRef = useRef(true);
  const replyPendingScrollRef = useRef(false);
  const replyLastIdRef = useRef<string | null>(null);
  const replyPollingRef = useRef<number | null>(null);
  const [inlineReplyTarget, setInlineReplyTarget] = useState<ThreadMessageSummary | null>(null);
  const [forwardTarget, setForwardTarget] = useState<ForwardTarget | null>(null);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardSearch, setForwardSearch] = useState("");
  const [forwarding, setForwarding] = useState(false);
  const [forwardError, setForwardError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [editingError, setEditingError] = useState<string | null>(null);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editingReplyDraft, setEditingReplyDraft] = useState("");
  const [editingReplyError, setEditingReplyError] = useState<string | null>(null);
  const [deleteMenuMessageId, setDeleteMenuMessageId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ message: ThreadMessageSummary; scope: "me" | "all" } | null>(null);
  const [replyDeleteConfirm, setReplyDeleteConfirm] = useState<{ reply: ThreadReplySummary; scope: "me" | "all" } | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [reactionDetailsOpenId, setReactionDetailsOpenId] = useState<string | null>(null);
  const [reactionDetailsByMessageId, setReactionDetailsByMessageId] = useState<Record<string, ThreadReactionDetail[]>>({});
  const [reactionDetailsLoadingId, setReactionDetailsLoadingId] = useState<string | null>(null);
  const [reactionDetailsTabByMessageId, setReactionDetailsTabByMessageId] = useState<Record<string, string>>({});
  const [replyReactionDetailsOpenId, setReplyReactionDetailsOpenId] = useState<string | null>(null);
  const [replyReactionDetailsByReplyId, setReplyReactionDetailsByReplyId] = useState<Record<string, ThreadReactionDetail[]>>({});
  const [replyReactionDetailsLoadingId, setReplyReactionDetailsLoadingId] = useState<string | null>(null);
  const [replyReactionDetailsTabByReplyId, setReplyReactionDetailsTabByReplyId] = useState<Record<string, string>>({});


  const replyCloseTimer = useRef<number | null>(null);
  const reactionDetailsSignatureRef = useRef<Record<string, string>>({});
  const replyReactionDetailsSignatureRef = useRef<Record<string, string>>({});

  useEffect(() => {
    setMessageDraft("");
    setPendingAttachments([]);
    setSendError(null);
    setReplyDraft("");
    setReplyInlineTarget(null);
    setReplyTarget(null);
    setReplyOpen(false);
    setReplies([]);
    setReplyError(null);
    setReplyInlineTarget(null);
    setInlineReplyTarget(null);
    setForwardTarget(null);
    setForwardOpen(false);
    setForwardSearch("");
    setForwardError(null);
    setForwarding(false);
    setReactionDetailsOpenId(null);
    setReactionDetailsByMessageId({});
    setReactionDetailsLoadingId(null);
    setReactionDetailsTabByMessageId({});
    reactionDetailsSignatureRef.current = {};
    setReplyReactionDetailsOpenId(null);
    setReplyReactionDetailsByReplyId({});
    setReplyReactionDetailsLoadingId(null);
    setReplyReactionDetailsTabByReplyId({});
    replyReactionDetailsSignatureRef.current = {};
    setEditingMessageId(null);
    setEditingDraft("");
    setEditingError(null);
    setEditingReplyId(null);
    setEditingReplyDraft("");
    setEditingReplyError(null);
    setDeleteMenuMessageId(null);
    setDeleteConfirm(null);
    setReplyDeleteConfirm(null);
    setReplyLoadingOlder(false);
    setReplyHasMore(true);
    setReplyNewCount(0);
    replyCompressedHistoryRef.current = [];
    replyUserAtBottomRef.current = true;
    replyPendingScrollRef.current = true;
    replyLastIdRef.current = null;
  }, [activeConversation?.id]);

  useEffect(() => {
    repliesRef.current = replies;
  }, [replies]);

  useEffect(() => {
    replyUserAtBottomRef.current = true;
    replyPendingScrollRef.current = true;
    replyLastIdRef.current = null;
    replyCompressedHistoryRef.current = [];
    setReplyHasMore(true);
    setReplyNewCount(0);
  }, [replyTarget?.id]);

  useEffect(() => {
    const lastId = replies[replies.length - 1]?.id ?? null;
    if (!lastId) {
      return;
    }
    const shouldScroll = replyPendingScrollRef.current || replyUserAtBottomRef.current;
    if (shouldScroll && lastId != replyLastIdRef.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => scrollToReplyBottom("auto"));
      });
    }
    replyPendingScrollRef.current = false;
    replyLastIdRef.current = lastId;
  }, [replies]);

  useEffect(() => {
    if (!replyOpen || !replyTarget || !enablePolling) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const latest = await listThreadReplies(replyTarget.id, { limit: REPLY_PAGE_SIZE });
        if (cancelled) return;
        mergeLatestReplies(latest);
      } catch {
        // ignore
      }
    };

    poll();
    replyPollingRef.current = window.setInterval(poll, 3000);

    return () => {
      cancelled = true;
      if (replyPollingRef.current) {
        window.clearInterval(replyPollingRef.current);
      }
      replyPollingRef.current = null;
    };
  }, [replyOpen, replyTarget?.id, enablePolling]);

  const handlePickAttachments = () => {
    fileInputRef.current?.click();
  };

  const handleAttachmentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }
    setPendingAttachments((prev) => {
      const next = [...prev, ...files];
      return next.slice(0, 10);
    });
    event.target.value = "";
  };

  const handleRemoveAttachment = (index: number) => {
    setPendingAttachments((prev) => prev.filter((_, current) => current !== index));
  };


  const handleReplyPickAttachments = () => {
    replyFileInputRef.current?.click();
  };

  const handleReplyAttachmentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }
    setReplyPendingAttachments((prev) => {
      const next = [...prev, ...files];
      return next.slice(0, 10);
    });
    event.target.value = "";
  };

  const handleReplyRemoveAttachment = (index: number) => {
    setReplyPendingAttachments((prev) => prev.filter((_, current) => current !== index));
  };

  const queueReplyCompression = (chunk: ThreadReplySummary[]) => {
    if (chunk.length == 0) return;
    void compressReplies(chunk)
      .then((page) => {
        replyCompressedHistoryRef.current.push(page);
      })
      .catch(() => {
        // ignore compression failures
      });
  };

  const trimRepliesIfNeeded = (items: ThreadReplySummary[]) => {
    if (!replyUserAtBottomRef.current) return items;
    if (items.length <= MAX_REPLIES_IN_MEMORY) return items;
    const overflow = items.length - MAX_REPLIES_IN_MEMORY;
    const trimmed = items.slice(overflow);
    const dropped = items.slice(0, overflow);
    queueReplyCompression(dropped);
    return trimmed;
  };

  const prependReplies = (older: ThreadReplySummary[]) => {
    if (older.length == 0) return;
    const container = replyListRef.current;
    const prevHeight = container?.scrollHeight ?? 0;
    setReplies((prev) => {
      const existing = new Set(prev.map((reply) => reply.id));
      const filtered = older.filter((reply) => !existing.has(reply.id));
      if (filtered.length == 0) return prev;
      return [...filtered, ...prev];
    });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const nextContainer = replyListRef.current;
        if (!nextContainer) return;
        const nextHeight = nextContainer.scrollHeight;
        if (nextHeight > prevHeight) {
          nextContainer.scrollTop += nextHeight - prevHeight;
        }
      });
    });
  };

  const mergeLatestReplies = (latest: ThreadReplySummary[]) => {
    setReplies((prev) => {
      if (prev.length == 0) {
        if (replyUserAtBottomRef.current) {
          replyPendingScrollRef.current = true;
        }
        setReplyNewCount(0);
        return trimRepliesIfNeeded(latest);
      }
      const prevIds = new Set(prev.map((reply) => reply.id));
      const latestById = new Map(latest.map((reply) => [reply.id, reply]));
      let changed = false;
      const updated = prev.map((reply) => {
        const incoming = latestById.get(reply.id);
        if (!incoming) return reply;
        const updatedChanged =
          incoming.updatedAt !== reply.updatedAt ||
          incoming.body !== reply.body ||
          incoming.deletedAt !== reply.deletedAt ||
          (incoming.attachments?.length ?? 0) !== (reply.attachments?.length ?? 0) ||
          getReplyReactionSignature(incoming.reactions) !== getReplyReactionSignature(reply.reactions) ||
          (incoming.voiceNote?.id ?? null) !== (reply.voiceNote?.id ?? null);
        if (updatedChanged) {
          changed = true;
          return incoming;
        }
        return reply;
      });
      const newOnes = latest.filter((reply) => !prevIds.has(reply.id));
      if (newOnes.length > 0) {
        changed = true;
        updated.push(...newOnes);
        if (replyUserAtBottomRef.current) {
          replyPendingScrollRef.current = true;
          setReplyNewCount(0);
        } else {
          setReplyNewCount((count) => count + newOnes.length);
        }
      }
      if (!changed) return prev;
      return trimRepliesIfNeeded(updated);
    });
  };

  const refreshReplies = async (): Promise<void> => {
    if (!replyOpen || !replyTarget) return;
    try {
      const latest = await listThreadReplies(replyTarget.id, { limit: REPLY_PAGE_SIZE });
      mergeLatestReplies(latest);
    } catch {
      // ignore
    }
  };


  const scrollToReplyBottom = (behavior: ScrollBehavior = "auto") => {
    const container = replyListRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
  };

  const jumpToLatestReply = () => {
    replyUserAtBottomRef.current = true;
    replyPendingScrollRef.current = true;
    scrollToReplyBottom("smooth");
    setReplyNewCount(0);
  };

  const loadOlderReplies = async () => {
    if (replyLoadingOlder) return;
    if (!replyTarget) return;
    if (replyCompressedHistoryRef.current.length == 0 && !replyHasMore) return;
    setReplyLoadingOlder(true);
    try {
      if (replyCompressedHistoryRef.current.length > 0) {
        const page = replyCompressedHistoryRef.current.pop();
        if (page) {
          const older = await decompressReplies(page);
          if (older.length > 0) {
            prependReplies(older);
          }
        }
        return;
      }
      const current = repliesRef.current;
      const oldest = current[0];
      const cursor = oldest?.createdAt ? new Date(oldest.createdAt).getTime() : undefined;
      const data = await listThreadReplies(replyTarget.id, {
        limit: REPLY_PAGE_SIZE,
        cursor
      });
      if (data.length == 0) {
        setReplyHasMore(false);
        return;
      }
      if (data.length < REPLY_PAGE_SIZE) {
        setReplyHasMore(false);
      }
      prependReplies(data);
    } finally {
      setReplyLoadingOlder(false);
    }
  };

  const handleReplyScroll = () => {
    const container = replyListRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const atBottom = distanceFromBottom < REPLY_BOTTOM_SCROLL_THRESHOLD;
    replyUserAtBottomRef.current = atBottom;
    if (atBottom && replyNewCount > 0) {
      setReplyNewCount(0);
    }
    if (container.scrollTop <= REPLY_TOP_FETCH_THRESHOLD) {
      void loadOlderReplies();
    }
  };

  const stopReplyRecordingTimer = () => {
    if (replyRecordingTimerRef.current) {
      window.clearInterval(replyRecordingTimerRef.current);
      replyRecordingTimerRef.current = null;
    }
  };

  const cleanupReplyRecordingStream = () => {
    replyRecorderStreamRef.current?.getTracks().forEach((track) => track.stop());
    replyRecorderStreamRef.current = null;
    replyRecorderRef.current = null;
  };

  const startReplyRecordingTimer = () => {
    replyRecordingDurationRef.current = 0;
    setReplyRecordingDuration(0);
    replyRecordingTimerRef.current = window.setInterval(() => {
      replyRecordingDurationRef.current += 1;
      setReplyRecordingDuration(replyRecordingDurationRef.current);
    }, 1000);
  };

  const handleSendReplyVoiceNote = async (blob: Blob, durationSec: number) => {
    if (!replyTarget || !activeConversation) return;
    try {
      const created = await createThreadReply(replyTarget.id, {
        body: "",
        hasVoiceNote: true
      });
      const file = new File([blob], `reply-voice-${created.id}.webm`, { type: blob.type || "audio/webm" });
      const voiceNote = await createThreadReplyVoiceNote(created.id, file, durationSec);
      const enriched = { ...created, voiceNote };
      setReplies((prev) => {
        const next = [...prev, enriched];
        if (replyUserAtBottomRef.current) {
          replyPendingScrollRef.current = true;
          setReplyNewCount(0);
        } else {
          setReplyNewCount((count) => count + 1);
        }
        return trimRepliesIfNeeded(next);
      });
      setMessages((prev) => prev.map((message) => (message.id === replyTarget.id
        ? { ...message, replyCount: (message.replyCount ?? 0) + 1 }
        : message)));
      setReplyTarget((prev) => (prev
        ? { ...prev, replyCount: (prev.replyCount ?? 0) + 1 }
        : prev));
      await refreshConversations();
    } catch (error) {
      setReplyError(error instanceof Error ? error.message : "Unable to send voice reply right now.");
    }
  };

  const startReplyRecording = async () => {
    if (replyRecording) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setReplyError("Voice recording isn't supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      replyRecorderStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      replyRecorderRef.current = recorder;
      replyRecorderChunksRef.current = [];
      replyRecordingCanceledRef.current = false;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          replyRecorderChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        stopReplyRecordingTimer();
        cleanupReplyRecordingStream();
        setReplyRecording(false);
        const fallbackDuration = replyRecordingDurationRef.current;
        const chunks = replyRecorderChunksRef.current;
        replyRecorderChunksRef.current = [];
        if (replyRecordingCanceledRef.current) {
          replyRecordingCanceledRef.current = false;
          return;
        }
        if (chunks.length === 0) {
          setReplyError("No audio captured.");
          return;
        }
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        void resolveAudioDuration(blob, fallbackDuration).then((duration) => {
          void handleSendReplyVoiceNote(blob, duration);
        });
      };
      recorder.start();
      setReplyRecording(true);
      startReplyRecordingTimer();
    } catch {
      cleanupReplyRecordingStream();
      setReplyError("Microphone access was blocked.");
    }
  };

  const stopReplyRecording = () => {
    if (!replyRecorderRef.current) return;
    replyRecorderRef.current.stop();
  };

  const cancelReplyRecording = () => {
    if (!replyRecorderRef.current) {
      setReplyRecording(false);
      stopReplyRecordingTimer();
      cleanupReplyRecordingStream();
      return;
    }
    replyRecordingCanceledRef.current = true;
    replyRecorderRef.current.stop();
  };

  const closeReplyThread = () => {
    setReplyOpen(false);
    setReplyNewCount(0);
    setReplyHasMore(true);
    replyCompressedHistoryRef.current = [];
    replyUserAtBottomRef.current = true;
    replyPendingScrollRef.current = true;
    replyLastIdRef.current = null;
    if (replyCloseTimer.current) {
      window.clearTimeout(replyCloseTimer.current);
    }
    replyCloseTimer.current = window.setTimeout(() => {
      setReplyTarget(null);
      setReplyDraft("");
      setReplyInlineTarget(null);
      setReplyPendingAttachments([]);
      setReplies([]);
      setReplyError(null);
      setEditingReplyId(null);
      setEditingReplyDraft("");
      setEditingReplyError(null);
      setReplyDeleteConfirm(null);
    }, 200);
  };

  useEffect(() => {
    if (!replyOpen && !replyTarget) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (editingReplyId) {
          event.preventDefault();
          cancelEditingReply();
          return;
        }
        closeReplyThread();
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
    };
  }, [replyOpen, replyTarget, editingReplyId]);

  useEffect(() => {
    setReplyPreviewExpanded(false);
    setReplyAttachmentOpen(false);
  }, [replyTarget?.id]);

  useEffect(() => {
    if (!forwardOpen) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeForwardPicker();
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
    };
  }, [forwardOpen]);

  const handleSendMessage = async () => {
    if (!activeConversation || sending) return;
    const trimmed = messageDraft.trim();
    const hasAttachments = pendingAttachments.length > 0;
    if (!trimmed && !hasAttachments) return;
    if (trimmed.length > THREAD_MESSAGE_CHARACTER_LIMIT) {
      setSendError(getThreadLengthError(trimmed.length));
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      const baseMentions = extractMentionIds(messageDraft, mentionMembers);
      const inlineMentionId = inlineReplyTarget?.author.id;
      const mentionSet = new Set(baseMentions);
      if (inlineMentionId) {
        mentionSet.add(inlineMentionId);
      }
      if (userId) {
        mentionSet.delete(userId);
      }
      const created = await createThreadMessage(activeConversation.id, {
        body: trimmed,
        mentions: Array.from(mentionSet),
        hasAttachments,
        hasVoiceNote: false,
        replyToMessageId: inlineReplyTarget?.id ?? undefined
      });

      let attachments = created.attachments ?? [];
      if (pendingAttachments.length > 0) {
        attachments = await createThreadMessageAttachments(created.id, pendingAttachments);
      }

      const enriched = { ...created, attachments };
      setMessages((prev) => [...prev, enriched]);
      setMessageDraft("");
      setPendingAttachments([]);
      setInlineReplyTarget(null);
      await refreshConversations();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send message right now.";
      setSendError(message);
    } finally {
      setSending(false);
    }
  };

  const openReplyThread = async (message: ThreadMessageSummary) => {
    if (replyCloseTimer.current) {
      window.clearTimeout(replyCloseTimer.current);
    }
    setReplyTarget(message);
    setReplyDraft("");
    setReplyInlineTarget(null);
    setReplyError(null);
    setInlineReplyTarget(null);
    if (!replyOpen) {
      requestAnimationFrame(() => {
        setReplyOpen(true);
      });
    } else {
      setReplyOpen(true);
    }
    const data = await listThreadReplies(message.id, { limit: REPLY_PAGE_SIZE });
    setReplyHasMore(data.length == REPLY_PAGE_SIZE);
    setReplyNewCount(0);
    replyPendingScrollRef.current = true;
    replyUserAtBottomRef.current = true;
    replyLastIdRef.current = null;
    replyCompressedHistoryRef.current = [];
    setReplies(data);
    setReplySeenCounts((prev) => ({ ...prev, [message.id]: Math.max(prev[message.id] ?? 0, message.replyCount ?? 0) }));
  };

  const openInlineReply = (message: ThreadMessageSummary) => {
    setInlineReplyTarget(message);
  };

  const openInlineReplyForReply = (reply: ThreadReplySummary) => {
    setReplyInlineTarget(reply);
  };

  const openForwardPicker = (message: ThreadMessageSummary) => {
    setForwardTarget({ body: message.body ?? "" });
    setForwardOpen(true);
    setForwardSearch("");
    setForwardError(null);
  };

  const openForwardPickerForReply = (reply: ThreadReplySummary) => {
    setForwardTarget({ body: reply.body ?? "" });
    setForwardOpen(true);
    setForwardSearch("");
    setForwardError(null);
  };

  const closeForwardPicker = () => {
    setForwardOpen(false);
    setForwardTarget(null);
    setForwardSearch("");
    setForwardError(null);
    setForwarding(false);
  };

  const handleForwardToUser = async (targetUser: ThreadUserSummary) => {
    if (!forwardTarget || forwarding) return;
    const body = forwardTarget.body ?? "";
    if (!body) return;
    setForwarding(true);
    setForwardError(null);
    try {
      const conversation = await getOrCreateDmConversation(targetUser.id);
      const created = await createThreadMessage(conversation.id, { body, forwarded: true });
      if (activeConversation?.id === conversation.id) {
        setMessages((prev) => [...prev, created]);
      }
      await refreshConversations();
      closeForwardPicker();
    } catch (error) {
      setForwardError(error instanceof Error ? error.message : "Unable to forward message right now.");
    } finally {
      setForwarding(false);
    }
  };
  const handleForwardToChannel = async (targetChannel: ChannelConversationSummary) => {
    if (!forwardTarget || forwarding) return;
    const body = forwardTarget.body ?? "";
    if (!body) return;
    setForwarding(true);
    setForwardError(null);
    try {
      const created = await createThreadMessage(targetChannel.id, { body, forwarded: true });
      if (activeConversation?.id === targetChannel.id) {
        setMessages((prev) => [...prev, created]);
      }
      await refreshConversations();
      closeForwardPicker();
    } catch (error) {
      setForwardError(error instanceof Error ? error.message : "Unable to forward message right now.");
    } finally {
      setForwarding(false);
    }
  };
  const startEditingMessage = (message: ThreadMessageSummary) => {
    setEditingMessageId(message.id);
    setEditingDraft(message.body ?? "");
    setEditingError(null);
    setDeleteMenuMessageId(null);
    setDeleteConfirm(null);
    setReplyDeleteConfirm(null);
  };

  const cancelEditingMessage = () => {
    setEditingMessageId(null);
    setEditingDraft("");
    setEditingError(null);
    setEditingReplyId(null);
    setEditingReplyDraft("");
    setEditingReplyError(null);
  };

  const handleSaveEdit = async (message: ThreadMessageSummary) => {
    const trimmed = editingDraft.trim();
    if (trimmed.length > THREAD_MESSAGE_CHARACTER_LIMIT) {
      setEditingError(getThreadLengthError(trimmed.length));
      return;
    }
    setEditingError(null);
    try {
      const updated = await updateThreadMessage(message.id, { body: editingDraft });
      setMessages((prev) => prev.map((item) => (item.id === message.id ? { ...item, ...updated } : item)));
      setEditingMessageId(null);
      setEditingDraft("");
      await refreshConversations();
    } catch (error) {
      setEditingError(error instanceof Error ? error.message : "Unable to update this message.");
    }
  };

  const startEditingReply = (reply: ThreadReplySummary) => {
    setEditingReplyId(reply.id);
    setEditingReplyDraft(reply.body ?? "");
    setEditingReplyError(null);
    setReplyDeleteConfirm(null);
  };

  const cancelEditingReply = () => {
    setEditingReplyId(null);
    setEditingReplyDraft("");
    setEditingReplyError(null);
  };

  const handleSaveReplyEdit = async (reply: ThreadReplySummary) => {
    const trimmed = editingReplyDraft.trim();
    const hasMedia = (reply.attachments?.length ?? 0) > 0 || Boolean(reply.voiceNote);
    if (!trimmed && !hasMedia) {
      setEditingReplyError("Message cannot be empty.");
      return;
    }
    if (trimmed.length > THREAD_MESSAGE_CHARACTER_LIMIT) {
      setEditingReplyError(getThreadLengthError(trimmed.length));
      return;
    }
    setEditingReplyError(null);
    try {
      const updated = await updateThreadReply(reply.id, { body: trimmed });
      setReplies((prev) => prev.map((item) => (item.id === reply.id ? { ...item, ...updated } : item)));
      setEditingReplyId(null);
      setEditingReplyDraft("");
      await refreshConversations();
    } catch (error) {
      setEditingReplyError(error instanceof Error ? error.message : "Unable to update this reply.");
    }
  };

  const handleDeleteReply = async (reply: ThreadReplySummary, scope: "me" | "all") => {
    try {
      await deleteThreadReply(reply.id, scope);
      if (scope === "me") {
        setReplies((prev) => prev.filter((item) => item.id !== reply.id));
      } else {
        const deletedAt = new Date().toISOString();
        setReplies((prev) => prev.map((item) => (
          item.id === reply.id
            ? {
                ...item,
                body: "This message was deleted.",
                deletedAt,
                attachments: [],
                voiceNote: null,
                reactions: []
              }
            : item
        )));
      }
      setMessages((prev) => prev.map((message) => (
        message.id === reply.parentMessageId
          ? { ...message, replyCount: Math.max(0, (message.replyCount ?? 0) - 1) }
          : message
      )));
      setReplyTarget((prev) => (prev && prev.id === reply.parentMessageId
        ? { ...prev, replyCount: Math.max(0, (prev.replyCount ?? 0) - 1) }
        : prev));
      if (editingReplyId === reply.id) {
        setEditingReplyId(null);
        setEditingReplyDraft("");
        setEditingReplyError(null);
      }
      setReplyDeleteConfirm(null);
      await refreshConversations();
    } catch (error) {
      setReplyError(error instanceof Error ? error.message : "Unable to delete this reply.");
    }
  };

  const handleDeleteMessage = async (message: ThreadMessageSummary, scope: "me" | "all") => {
    setSendError(null);
    setEditingError(null);
    try {
      const result = await deleteThreadMessage(message.id, scope);
      if (result.scope === "me") {
        setMessages((prev) => prev.filter((item) => item.id !== message.id));
      } else if (result.message) {
        setMessages((prev) => prev.map((item) => (item.id === message.id ? { ...item, ...result.message } : item)));
      }
      if (replyTarget?.id === message.id) {
        setReplyTarget(null);
        setReplyOpen(false);
      }
      if (inlineReplyTarget?.id === message.id) {
        setInlineReplyTarget(null);
      }
      setDeleteMenuMessageId(null);
      setDeleteConfirm(null);
    setReplyDeleteConfirm(null);
      await refreshConversations();
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Unable to delete this message.";
      setSendError(messageText);
    }
  };

  const handleSendReply = async () => {
    if (!replyTarget) return;
    const trimmed = replyDraft.trim();
    const hasAttachments = replyPendingAttachments.length > 0;
    if (!trimmed && !hasAttachments) return;
    if (trimmed.length > THREAD_MESSAGE_CHARACTER_LIMIT) {
      setReplyError(getThreadLengthError(trimmed.length));
      return;
    }
    setReplyError(null);
    try {
      const baseMentions = extractMentionIds(replyDraft, mentionMembers);
      const inlineMentionId = replyInlineTarget?.author.id;
      const mentionSet = new Set(baseMentions);
      if (inlineMentionId) {
        mentionSet.add(inlineMentionId);
      }
      if (userId) {
        mentionSet.delete(userId);
      }
      const created = await createThreadReply(replyTarget.id, {
        body: trimmed,
        mentions: Array.from(mentionSet),
        hasAttachments,
        replyToReplyId: replyInlineTarget?.id ?? undefined
      });
      let attachments = created.attachments ?? [];
      if (replyPendingAttachments.length > 0) {
        attachments = await createThreadReplyAttachments(created.id, replyPendingAttachments);
      }
      const enriched = { ...created, attachments };
      setReplies((prev) => {
        const next = [...prev, enriched];
        if (replyUserAtBottomRef.current) {
          replyPendingScrollRef.current = true;
          setReplyNewCount(0);
        } else {
          setReplyNewCount((count) => count + 1);
        }
        return trimRepliesIfNeeded(next);
      });
      setMessages((prev) => prev.map((message) => (message.id === replyTarget.id
        ? { ...message, replyCount: (message.replyCount ?? 0) + 1 }
        : message)));
      setReplyTarget((prev) => (prev
        ? { ...prev, replyCount: (prev.replyCount ?? 0) + 1 }
        : prev));
      setReplyDraft("");
      setReplyInlineTarget(null);
      setReplyPendingAttachments([]);
    } catch (error) {
      setReplyError(error instanceof Error ? error.message : "Unable to send reply right now.");
    }
  };

  const handleToggleMessageReaction = async (messageId: string, emoji: string) => {
    try {
      const reactions = await toggleThreadMessageReaction(messageId, { emoji });
      setMessages((prev) => prev.map((message) => (message.id === messageId ? { ...message, reactions } : message)));
      setReplyTarget((prev) => (prev && prev.id === messageId ? { ...prev, reactions } : prev));
    } catch {
      // ignore for now
    }
  };

  const handleToggleReplyReaction = async (replyId: string, emoji: string) => {
    try {
      const reactions = await toggleThreadReplyReaction(replyId, { emoji });
      setReplies((prev) => prev.map((reply) => (reply.id === replyId ? { ...reply, reactions } : reply)));
    } catch {
      // ignore for now
    }
  };

  const handleToggleReactionDetails = async (messageId: string) => {
    if (reactionDetailsOpenId === messageId) {
      setReactionDetailsOpenId(null);
      return;
    }
    setReactionDetailsOpenId(messageId);
    const existing = reactionDetailsByMessageId[messageId];
    if (existing) {
      setReactionDetailsTabByMessageId((prev) => ({
        ...prev,
        [messageId]: prev[messageId] ?? existing[0]?.emoji ?? ""
      }));
      return;
    }
    setReactionDetailsLoadingId(messageId);
    try {
      const details = await listThreadMessageReactionDetails(messageId);
      setReactionDetailsByMessageId((prev) => ({ ...prev, [messageId]: details }));
      setReactionDetailsTabByMessageId((prev) => ({
        ...prev,
        [messageId]: prev[messageId] ?? details[0]?.emoji ?? ""
      }));
    } catch {
      // ignore
    } finally {
      setReactionDetailsLoadingId((current) => (current === messageId ? null : current));
    }
  };

  const handleToggleReplyReactionDetails = async (replyId: string) => {
    if (replyReactionDetailsOpenId === replyId) {
      setReplyReactionDetailsOpenId(null);
      return;
    }
    setReplyReactionDetailsOpenId(replyId);
    const existing = replyReactionDetailsByReplyId[replyId];
    if (existing) {
      setReplyReactionDetailsTabByReplyId((prev) => ({
        ...prev,
        [replyId]: prev[replyId] ?? existing[0]?.emoji ?? ""
      }));
      return;
    }
    setReplyReactionDetailsLoadingId(replyId);
    try {
      const details = await listThreadReplyReactionDetails(replyId);
      setReplyReactionDetailsByReplyId((prev) => ({ ...prev, [replyId]: details }));
      setReplyReactionDetailsTabByReplyId((prev) => ({
        ...prev,
        [replyId]: prev[replyId] ?? details[0]?.emoji ?? ""
      }));
    } catch {
      // ignore
    } finally {
      setReplyReactionDetailsLoadingId((current) => (current === replyId ? null : current));
    }
  };


  useEffect(() => {
    if (!reactionDetailsOpenId) return;
    const message = messages.find((item) => item.id === reactionDetailsOpenId);
    if (!message) return;
    const reactions = message.reactions ?? [];
    const signature = reactions
      .slice()
      .sort((a, b) => a.emoji.localeCompare(b.emoji))
      .map((reaction) => `${reaction.emoji}:${reaction.count}`)
      .join("|");
    if (reactionDetailsSignatureRef.current[reactionDetailsOpenId] === signature) {
      return;
    }
    reactionDetailsSignatureRef.current[reactionDetailsOpenId] = signature;
    const refreshReactionDetails = async () => {
      setReactionDetailsLoadingId(reactionDetailsOpenId);
      try {
        const details = await listThreadMessageReactionDetails(reactionDetailsOpenId);
        setReactionDetailsByMessageId((prev) => ({ ...prev, [reactionDetailsOpenId]: details }));
        setReactionDetailsTabByMessageId((prev) => ({
          ...prev,
          [reactionDetailsOpenId]: prev[reactionDetailsOpenId] ?? details[0]?.emoji ?? ""
        }));
      } catch {
        // ignore
      } finally {
        setReactionDetailsLoadingId((current) => (current === reactionDetailsOpenId ? null : current));
      }
    };
    void refreshReactionDetails();
  }, [messages, reactionDetailsOpenId]);

  useEffect(() => {
    if (!replyReactionDetailsOpenId) return;
    const reply = replies.find((item) => item.id === replyReactionDetailsOpenId);
    if (!reply) return;
    const reactions = reply.reactions ?? [];
    const signature = reactions
      .slice()
      .sort((a, b) => a.emoji.localeCompare(b.emoji))
      .map((reaction) => `${reaction.emoji}:${reaction.count}`)
      .join("|");
    if (replyReactionDetailsSignatureRef.current[replyReactionDetailsOpenId] === signature) {
      return;
    }
    replyReactionDetailsSignatureRef.current[replyReactionDetailsOpenId] = signature;
    const refreshReplyReactionDetails = async () => {
      setReplyReactionDetailsLoadingId(replyReactionDetailsOpenId);
      try {
        const details = await listThreadReplyReactionDetails(replyReactionDetailsOpenId);
        setReplyReactionDetailsByReplyId((prev) => ({ ...prev, [replyReactionDetailsOpenId]: details }));
        setReplyReactionDetailsTabByReplyId((prev) => ({
          ...prev,
          [replyReactionDetailsOpenId]: prev[replyReactionDetailsOpenId] ?? details[0]?.emoji ?? ""
        }));
      } catch {
        // ignore
      } finally {
        setReplyReactionDetailsLoadingId((current) => (current === replyReactionDetailsOpenId ? null : current));
      }
    };
    void refreshReplyReactionDetails();
  }, [replies, replyReactionDetailsOpenId]);

  const handleMessageKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (event.defaultPrevented) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSendMessage();
    }
  };

  const handleReplyKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (event.defaultPrevented) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSendReply();
    }
  };

  return {
    messageDraft,
    setMessageDraft,
    pendingAttachments,
    handlePickAttachments,
    handleAttachmentChange,
    handleRemoveAttachment,
    inlineReplyTarget,
    setInlineReplyTarget,
    replyDraft,
    setReplyDraft,
    replyInlineTarget,
    setReplyInlineTarget,
    replyPendingAttachments,
    replyFileInputRef,
    handleReplyPickAttachments,
    handleReplyAttachmentChange,
    handleReplyRemoveAttachment,
    replyRecording,
    replyRecordingDuration,
    startReplyRecording,
    stopReplyRecording,
    cancelReplyRecording,
    editingReplyId,
    editingReplyDraft,
    setEditingReplyDraft,
    editingReplyError,
    startEditingReply,
    cancelEditingReply,
    handleSaveReplyEdit,
    replyDeleteConfirm,
    setReplyDeleteConfirm,
    handleDeleteReply,
    replyTarget,
    replyOpen,
    replyPreviewExpanded,
    setReplyPreviewExpanded,
    replyAttachmentOpen,
    setReplyAttachmentOpen,
    replies,
    replyListRef,
    replyLoadingOlder,
    replyNewCount,
    handleReplyScroll,
    jumpToLatestReply,
    replyError,
    refreshReplies,
    forwardTarget,
    forwardOpen,
    forwardSearch,
    setForwardSearch,
    forwarding,
    forwardError,
    editingMessageId,
    editingDraft,
    setEditingDraft,
    editingError,
    deleteMenuMessageId,
    setDeleteMenuMessageId,
    deleteConfirm,
    setDeleteConfirm,
    sending,
    sendError,
    setSendError,
    reactionDetailsOpenId,
    reactionDetailsByMessageId,
    reactionDetailsLoadingId,
    reactionDetailsTabByMessageId,
    setReactionDetailsTabByMessageId,
    replyReactionDetailsOpenId,
    replyReactionDetailsByReplyId,
    replyReactionDetailsLoadingId,
    replyReactionDetailsTabByReplyId,
    setReplyReactionDetailsTabByReplyId,
    openReplyThread,
    closeReplyThread,
    openInlineReply,
    openInlineReplyForReply,
    openForwardPicker,
    openForwardPickerForReply,
    closeForwardPicker,
    handleForwardToUser,
    handleForwardToChannel,
    startEditingMessage,
    cancelEditingMessage,
    handleSaveEdit,
    handleDeleteMessage,
    handleSendMessage,
    handleSendReply,
    handleToggleMessageReaction,
    handleToggleReplyReaction,
    handleToggleReactionDetails,
    handleToggleReplyReactionDetails,
    handleMessageKeyDown,
    handleReplyKeyDown
  };
}












