import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { markThreadMentionsSeen } from "@/lib/mentions-api";
import { downloadThreadAttachment, getOrCreateDmConversation, listDmConversations, listDmUsers, listThreadMessages } from "@/lib/threads-api";
import { useAuthStore } from "@/stores/auth-store";
import { useMentionStore } from "@/stores/mentions-store";
import type { BoardMember } from "@/types/board";
import type { DmConversationSummary, ThreadMessageSummary, ThreadUserSummary } from "@/types/threads";
import { presencePalette, type PresenceState } from "./threads-page.constants";
import { useThreadActions } from "./threads-page.controller.actions";
import { useThreadMedia } from "./threads-page.controller.media";

export function useThreadsController() {
  const user = useAuthStore((state) => state.user);
  const [searchParams, setSearchParams] = useSearchParams();

  const [dmUsers, setDmUsers] = useState<ThreadUserSummary[]>([]);
  const [dmConversations, setDmConversations] = useState<DmConversationSummary[]>([]);
  const [activeConversation, setActiveConversation] = useState<DmConversationSummary | null>(null);
  const [messages, setMessages] = useState<ThreadMessageSummary[]>([]);
  const [activeTab, setActiveTab] = useState<"dms" | "channels">("dms");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [videoPreview, setVideoPreview] = useState<{ url: string; name: string } | null>(null);
  const [imagePreview, setImagePreview] = useState<{ url: string; name: string } | null>(null);

  const refreshMentions = useMentionStore((state) => state.refresh);
  const mentionCounts = useMentionStore((state) => state.counts);

  const messageListRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const userAtBottomRef = useRef(true);
  const lastMessageIdRef = useRef<string | null>(null);
  const pendingScrollRef = useRef(false);
  const pollingRef = useRef<number | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [hoveredReplyId, setHoveredReplyId] = useState<string | null>(null);
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<string | null>(null);
  const [reactionPickerReplyId, setReactionPickerReplyId] = useState<string | null>(null);

  const conversationByUserId = useMemo(() => {
    const map = new Map<string, DmConversationSummary>();
    dmConversations.forEach((conversation) => {
      map.set(conversation.otherUser.id, conversation);
    });
    return map;
  }, [dmConversations]);

  const mentionMembers = useMemo<BoardMember[]>(() => {
    return dmUsers.map((userEntry) => ({
      id: userEntry.id,
      name: userEntry.name,
      displayName: userEntry.displayName,
      username: userEntry.username,
      email: userEntry.email,
      role: userEntry.role === "admin" ? "admin" : "member",
      createdAt: new Date().toISOString()
    }));
  }, [dmUsers]);

  const presenceByUserId = useMemo(() => {
    const states: PresenceState[] = ["online", "idle", "dnd", "focus"];
    const map = new Map<string, PresenceState>();
    dmUsers.forEach((userEntry, index) => {
      map.set(userEntry.id, states[index % states.length]);
    });
    return map;
  }, [dmUsers]);

  const filteredDmUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return dmUsers;
    return dmUsers.filter((member) => {
      const name = member.name.toLowerCase();
      const displayName = member.displayName?.toLowerCase() ?? "";
      const username = member.username?.toLowerCase() ?? "";
      const email = member.email.toLowerCase();
      return (
        name.includes(query) ||
        displayName.includes(query) ||
        username.includes(query) ||
        email.includes(query)
      );
    });
  }, [dmUsers, searchTerm]);

  const actions = useThreadActions({
    activeConversation,
    userId: user?.id,
    messages,
    setMessages,
    setDmConversations,
    mentionMembers,
    fileInputRef
  });

  const filteredForwardUsers = useMemo(() => {
    const query = actions.forwardSearch.trim().toLowerCase();
    if (!query) return dmUsers;
    return dmUsers.filter((member) => {
      const name = member.name.toLowerCase();
      const displayName = member.displayName?.toLowerCase() ?? "";
      const username = member.username?.toLowerCase() ?? "";
      const email = member.email.toLowerCase();
      return (
        name.includes(query) ||
        displayName.includes(query) ||
        username.includes(query) ||
        email.includes(query)
      );
    });
  }, [dmUsers, actions.forwardSearch]);

  const media = useThreadMedia({
    activeConversationId: activeConversation?.id ?? null,
    messages,
    setMessages,
    setDmConversations,
    setSendError: actions.setSendError
  });

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "channels" || tab === "dms") {
      setActiveTab(tab);
    } else {
      setActiveTab("dms");
    }
  }, [searchParams]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        const [users, conversations] = await Promise.all([listDmUsers(), listDmConversations()]);
        if (!active) return;
        setDmUsers(users);
        setDmConversations(conversations);
        await refreshMentions();
      } catch {
        // ignore for now
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [refreshMentions]);

  useEffect(() => {
    pendingScrollRef.current = true;
    userAtBottomRef.current = true;
    lastMessageIdRef.current = null;
  }, [activeConversation?.id]);

  useEffect(() => {
    if (!activeConversation) {
      setMessages([]);
      return;
    }

    let active = true;
    const loadMessages = async () => {
      try {
        setLoadingMessages(true);
        const data = await listThreadMessages(activeConversation.id);
        if (!active) return;
        pendingScrollRef.current = true;
        userAtBottomRef.current = true;
        lastMessageIdRef.current = null;
        setMessages(data);

        await markThreadMentionsSeen(activeConversation.id);
        await refreshMentions();
        setDmConversations((prev) =>
          prev.map((conversation) =>
            conversation.id === activeConversation.id
              ? { ...conversation, unreadMentions: 0 }
              : conversation
          )
        );
      } catch {
        // ignore
      } finally {
        if (active) {
          setLoadingMessages(false);
        }
      }
    };

    loadMessages();
    return () => {
      active = false;
    };
  }, [activeConversation?.id, refreshMentions]);

  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    const container = messageListRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
  };

  const handleMessageScroll = () => {
    const container = messageListRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    userAtBottomRef.current = distanceFromBottom < 120;
  };

  const mergeMessages = (next: ThreadMessageSummary[]) => {
    setMessages((prev) => {
      if (prev.length === 0) {
        if (userAtBottomRef.current) {
          pendingScrollRef.current = true;
        }
        return next;
      }
      const prevLast = prev[prev.length - 1]?.id;
      const nextLast = next[next.length - 1]?.id;
      const appended = prevLast !== nextLast || prev.length !== next.length;
      if (!appended) {
        let contentChanged = false;
        for (let i = 0; i < prev.length; i += 1) {
          const prevMessage = prev[i];
          const nextMessage = next[i];
          if (!nextMessage || prevMessage.id !== nextMessage.id) {
            contentChanged = true;
            break;
          }
          if (prevMessage.replyCount !== nextMessage.replyCount) {
            contentChanged = true;
            break;
          }
          if (prevMessage.body !== nextMessage.body) {
            contentChanged = true;
            break;
          }
          const prevVoiceId = prevMessage.voiceNote?.id ?? null;
          const nextVoiceId = nextMessage.voiceNote?.id ?? null;
          if (prevVoiceId != nextVoiceId) {
            contentChanged = true;
            break;
          }
          const prevAttachments = prevMessage.attachments ?? [];
          const nextAttachments = nextMessage.attachments ?? [];
          if (prevAttachments.length != nextAttachments.length) {
            contentChanged = true;
            break;
          }
          const prevReactions = prevMessage.reactions ?? [];
          const nextReactions = nextMessage.reactions ?? [];
          if (prevReactions.length !== nextReactions.length) {
            contentChanged = true;
            break;
          }
          for (let r = 0; r < prevReactions.length; r += 1) {
            const prevReaction = prevReactions[r];
            const nextReaction = nextReactions[r];
            if (!nextReaction || prevReaction.emoji !== nextReaction.emoji || prevReaction.count !== nextReaction.count) {
              contentChanged = true;
              break;
            }
          }
          if (contentChanged) {
            break;
          }
        }
        return contentChanged ? next : prev;
      }
      if (userAtBottomRef.current) {
        pendingScrollRef.current = true;
      }
      return next;
    });
  };

  useEffect(() => {
    const lastId = messages[messages.length - 1]?.id ?? null;
    if (!lastId) {
      return;
    }
    const shouldScroll = pendingScrollRef.current || userAtBottomRef.current;
    if (shouldScroll && lastId != lastMessageIdRef.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => scrollToBottom("auto"));
      });
    }
    pendingScrollRef.current = false;
    lastMessageIdRef.current = lastId;
  }, [messages]);

  useEffect(() => {
    if (!activeConversation) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const [nextMessages, nextConversations] = await Promise.all([
          listThreadMessages(activeConversation.id),
          listDmConversations()
        ]);
        if (cancelled) return;
        mergeMessages(nextMessages);
        await markThreadMentionsSeen(activeConversation.id);
        await refreshMentions();
        setDmConversations(nextConversations);
        setActiveConversation((prev) => {
          if (!prev) return prev;
          const next = nextConversations.find((item) => item.id === prev.id);
          if (!next) return prev;
          if (next.lastMessageAt === prev.lastMessageAt && next.unreadMentions === prev.unreadMentions) {
            return prev;
          }
          return next;
        });
      } catch {
        // ignore
      }
    };

    poll();
    pollingRef.current = window.setInterval(poll, 3000);

    return () => {
      cancelled = true;
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
      }
      pollingRef.current = null;
    };
  }, [activeConversation?.id]);

  useEffect(() => {
    if (loadingMessages) return;
    if (messages.length === 0) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollToBottom("auto"));
    });
  }, [loadingMessages]);

  const handleSelectUser = async (userEntry: ThreadUserSummary) => {
    try {
      setLoadingMessages(true);
      const conversation = await getOrCreateDmConversation(userEntry.id);
      setActiveConversation(conversation);
      setDmConversations((prev) => {
        const existing = prev.find((item) => item.id === conversation.id);
        if (existing) {
          return prev.map((item) => (item.id === conversation.id ? conversation : item));
        }
        return [conversation, ...prev];
      });
    } catch {
      // ignore
    } finally {
      setLoadingMessages(false);
    }
  };

  const totalMentions = mentionCounts?.total ?? 0;
  const showReplyPanel = Boolean(actions.replyTarget || actions.replyOpen);

  return {
    user,
    setSearchParams,
    activeTab,
    totalMentions,
    searchTerm,
    setSearchTerm,
    loading,
    filteredDmUsers,
    conversationByUserId,
    presenceByUserId,
    activeConversation,
    handleSelectUser,
    messages,
    loadingMessages,
    messageListRef,
    handleMessageScroll,
    hoveredMessageId,
    setHoveredMessageId,
    reactionPickerMessageId,
    setReactionPickerMessageId,
    reactionDetailsOpenId: actions.reactionDetailsOpenId,
    reactionDetailsByMessageId: actions.reactionDetailsByMessageId,
    reactionDetailsLoadingId: actions.reactionDetailsLoadingId,
    reactionDetailsTabByMessageId: actions.reactionDetailsTabByMessageId,
    setReactionDetailsTabByMessageId: actions.setReactionDetailsTabByMessageId,
    editingMessageId: actions.editingMessageId,
    editingDraft: actions.editingDraft,
    setEditingDraft: actions.setEditingDraft,
    editingError: actions.editingError,
    deleteMenuMessageId: actions.deleteMenuMessageId,
    setDeleteMenuMessageId: actions.setDeleteMenuMessageId,
    setDeleteConfirm: actions.setDeleteConfirm,
    voiceUrls: media.voiceUrls,
    attachmentPreviewUrls: media.attachmentPreviewUrls,
    openInlineReply: actions.openInlineReply,
    openReplyThread: actions.openReplyThread,
    openForwardPicker: actions.openForwardPicker,
    startEditingMessage: actions.startEditingMessage,
    cancelEditingMessage: actions.cancelEditingMessage,
    handleSaveEdit: actions.handleSaveEdit,
    handleToggleMessageReaction: actions.handleToggleMessageReaction,
    handleToggleReactionDetails: actions.handleToggleReactionDetails,
    setImagePreview,
    setVideoPreview,
    downloadThreadAttachment,
    inlineReplyTarget: actions.inlineReplyTarget,
    setInlineReplyTarget: actions.setInlineReplyTarget,
    messageDraft: actions.messageDraft,
    setMessageDraft: actions.setMessageDraft,
    mentionMembers,
    handleMessageKeyDown: actions.handleMessageKeyDown,
    pendingAttachments: actions.pendingAttachments,
    handleRemoveAttachment: actions.handleRemoveAttachment,
    fileInputRef,
    handleAttachmentChange: actions.handleAttachmentChange,
    handlePickAttachments: actions.handlePickAttachments,
    sendError: actions.sendError,
    recording: media.recording,
    recordingDuration: media.recordingDuration,
    cancelRecording: media.cancelRecording,
    stopRecording: media.stopRecording,
    startRecording: media.startRecording,
    sending: actions.sending,
    handleSendMessage: actions.handleSendMessage,
    deleteConfirm: actions.deleteConfirm,
    handleDeleteMessage: actions.handleDeleteMessage,
    videoPreview,
    imagePreview,
    forwardOpen: actions.forwardOpen,
    forwardTarget: actions.forwardTarget,
    forwardSearch: actions.forwardSearch,
    setForwardSearch: actions.setForwardSearch,
    filteredForwardUsers,
    forwarding: actions.forwarding,
    forwardError: actions.forwardError,
    closeForwardPicker: actions.closeForwardPicker,
    handleForwardToUser: actions.handleForwardToUser,
    showReplyPanel,
    replyOpen: actions.replyOpen,
    replyTarget: actions.replyTarget,
    replyPreviewExpanded: actions.replyPreviewExpanded,
    setReplyPreviewExpanded: actions.setReplyPreviewExpanded,
    replyAttachmentOpen: actions.replyAttachmentOpen,
    setReplyAttachmentOpen: actions.setReplyAttachmentOpen,
    replies: actions.replies,
    hoveredReplyId,
    setHoveredReplyId,
    reactionPickerReplyId,
    setReactionPickerReplyId,
    handleToggleReplyReaction: actions.handleToggleReplyReaction,
    replyDraft: actions.replyDraft,
    setReplyDraft: actions.setReplyDraft,
    handleReplyKeyDown: actions.handleReplyKeyDown,
    replyError: actions.replyError,
    handleSendReply: actions.handleSendReply,
    closeReplyThread: actions.closeReplyThread
  };
}
