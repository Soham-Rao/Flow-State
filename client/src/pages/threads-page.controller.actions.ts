import { useEffect, useRef, useState } from "react";

import { extractMentionIds } from "@/lib/mentions";
import {
  createThreadMessage,
  createThreadMessageAttachments,
  createThreadReply,
  getOrCreateDmConversation,
  listDmConversations,
  listThreadMessageReactionDetails,
  listThreadReplies,
  toggleThreadMessageReaction,
  toggleThreadReplyReaction,
  updateThreadMessage,
  deleteThreadMessage
} from "@/lib/threads-api";
import type { BoardMember } from "@/types/board";
import type { DmConversationSummary, ThreadMessageSummary, ThreadReplySummary, ThreadUserSummary, ThreadReactionDetail } from "@/types/threads";

type ThreadActionsParams = {
  activeConversation: DmConversationSummary | null;
  userId: string | null | undefined;
  messages: ThreadMessageSummary[];
  setMessages: React.Dispatch<React.SetStateAction<ThreadMessageSummary[]>>;
  setDmConversations: React.Dispatch<React.SetStateAction<DmConversationSummary[]>>;
  mentionMembers: BoardMember[];
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
  replyTarget: ThreadMessageSummary | null;
  replyOpen: boolean;
  replyPreviewExpanded: boolean;
  setReplyPreviewExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  replyAttachmentOpen: boolean;
  setReplyAttachmentOpen: React.Dispatch<React.SetStateAction<boolean>>;
  replies: ThreadReplySummary[];
  replyError: string | null;
  forwardTarget: ThreadMessageSummary | null;
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
  openReplyThread: (message: ThreadMessageSummary) => Promise<void>;
  closeReplyThread: () => void;
  openInlineReply: (message: ThreadMessageSummary) => void;
  openForwardPicker: (message: ThreadMessageSummary) => void;
  closeForwardPicker: () => void;
  handleForwardToUser: (targetUser: ThreadUserSummary) => Promise<void>;
  startEditingMessage: (message: ThreadMessageSummary) => void;
  cancelEditingMessage: () => void;
  handleSaveEdit: (message: ThreadMessageSummary) => Promise<void>;
  handleDeleteMessage: (message: ThreadMessageSummary, scope: "me" | "all") => Promise<void>;
  handleSendMessage: () => Promise<void>;
  handleSendReply: () => Promise<void>;
  handleToggleMessageReaction: (messageId: string, emoji: string) => Promise<void>;
  handleToggleReplyReaction: (replyId: string, emoji: string) => Promise<void>;
  handleToggleReactionDetails: (messageId: string) => Promise<void>;
  handleMessageKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
  handleReplyKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
};

export function useThreadActions({
  activeConversation,
  userId,
  messages,
  setMessages,
  setDmConversations,
  mentionMembers,
  fileInputRef,
}: ThreadActionsParams): ThreadActionsState {
  const [messageDraft, setMessageDraft] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [replyDraft, setReplyDraft] = useState("");
  const [replyTarget, setReplyTarget] = useState<ThreadMessageSummary | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyPreviewExpanded, setReplyPreviewExpanded] = useState(false);
  const [replyAttachmentOpen, setReplyAttachmentOpen] = useState(false);
  const [replies, setReplies] = useState<ThreadReplySummary[]>([]);
  const [inlineReplyTarget, setInlineReplyTarget] = useState<ThreadMessageSummary | null>(null);
  const [forwardTarget, setForwardTarget] = useState<ThreadMessageSummary | null>(null);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardSearch, setForwardSearch] = useState("");
  const [forwarding, setForwarding] = useState(false);
  const [forwardError, setForwardError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [editingError, setEditingError] = useState<string | null>(null);
  const [deleteMenuMessageId, setDeleteMenuMessageId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ message: ThreadMessageSummary; scope: "me" | "all" } | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [reactionDetailsOpenId, setReactionDetailsOpenId] = useState<string | null>(null);
  const [reactionDetailsByMessageId, setReactionDetailsByMessageId] = useState<Record<string, ThreadReactionDetail[]>>({});
  const [reactionDetailsLoadingId, setReactionDetailsLoadingId] = useState<string | null>(null);
  const [reactionDetailsTabByMessageId, setReactionDetailsTabByMessageId] = useState<Record<string, string>>({});

  const replyCloseTimer = useRef<number | null>(null);
  const reactionDetailsSignatureRef = useRef<Record<string, string>>({});

  useEffect(() => {
    setMessageDraft("");
    setPendingAttachments([]);
    setSendError(null);
    setReplyDraft("");
    setReplyTarget(null);
    setReplyOpen(false);
    setReplies([]);
    setReplyError(null);
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
    setEditingMessageId(null);
    setEditingDraft("");
    setEditingError(null);
    setDeleteMenuMessageId(null);
    setDeleteConfirm(null);
  }, [activeConversation?.id]);

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

  const closeReplyThread = () => {
    setReplyOpen(false);
    if (replyCloseTimer.current) {
      window.clearTimeout(replyCloseTimer.current);
    }
    replyCloseTimer.current = window.setTimeout(() => {
      setReplyTarget(null);
      setReplyDraft("");
      setReplies([]);
      setReplyError(null);
    }, 200);
  };

  useEffect(() => {
    if (!replyOpen && !replyTarget) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeReplyThread();
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
    };
  }, [replyOpen, replyTarget]);

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
        hasVoiceNote: false
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
      const refreshed = await listDmConversations();
      setDmConversations(refreshed);
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
    setReplyError(null);
    setInlineReplyTarget(null);
    setReplyOpen(true);
    const data = await listThreadReplies(message.id);
    setReplies(data);
  };

  const openInlineReply = (message: ThreadMessageSummary) => {
    setInlineReplyTarget(message);
  };

  const openForwardPicker = (message: ThreadMessageSummary) => {
    setForwardTarget(message);
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
      const refreshed = await listDmConversations();
      setDmConversations(refreshed);
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
  };

  const cancelEditingMessage = () => {
    setEditingMessageId(null);
    setEditingDraft("");
    setEditingError(null);
  };

  const handleSaveEdit = async (message: ThreadMessageSummary) => {
    setEditingError(null);
    try {
      const updated = await updateThreadMessage(message.id, { body: editingDraft });
      setMessages((prev) => prev.map((item) => (item.id === message.id ? { ...item, ...updated } : item)));
      setEditingMessageId(null);
      setEditingDraft("");
      const refreshed = await listDmConversations();
      setDmConversations(refreshed);
    } catch (error) {
      setEditingError(error instanceof Error ? error.message : "Unable to update this message.");
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
      const refreshed = await listDmConversations();
      setDmConversations(refreshed);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Unable to delete this message.";
      setSendError(messageText);
    }
  };

  const handleSendReply = async () => {
    if (!replyTarget) return;
    const trimmed = replyDraft.trim();
    if (!trimmed) return;
    setReplyError(null);
    try {
      const mentions = extractMentionIds(replyDraft, mentionMembers);
      const created = await createThreadReply(replyTarget.id, { body: trimmed, mentions });
      setReplies((prev) => [...prev, created]);
      setMessages((prev) => prev.map((message) => (message.id === replyTarget.id
        ? { ...message, replyCount: (message.replyCount ?? 0) + 1 }
        : message)));
      setReplyTarget((prev) => (prev
        ? { ...prev, replyCount: (prev.replyCount ?? 0) + 1 }
        : prev));
      setReplyDraft("");
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
    replyTarget,
    replyOpen,
    replyPreviewExpanded,
    setReplyPreviewExpanded,
    replyAttachmentOpen,
    setReplyAttachmentOpen,
    replies,
    replyError,
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
    openReplyThread,
    closeReplyThread,
    openInlineReply,
    openForwardPicker,
    closeForwardPicker,
    handleForwardToUser,
    startEditingMessage,
    cancelEditingMessage,
    handleSaveEdit,
    handleDeleteMessage,
    handleSendMessage,
    handleSendReply,
    handleToggleMessageReaction,
    handleToggleReplyReaction,
    handleToggleReactionDetails,
    handleMessageKeyDown,
    handleReplyKeyDown
  };
}
