import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { listUnreadThreadMentions, markThreadMessageMentionsSeen, markThreadReplyMentionIdsSeen } from "@/lib/mentions-api";
import {
    createChannel,
    updateChannel,
    leaveChannel,
    deleteChannel,
    addChannelMembers,
    downloadThreadAttachment,
    downloadThreadReplyAttachment,
    getOrCreateDmConversation,
    listChannelConversations,
    listChannelMembers,
    removeChannelMember,
    updateChannelMemberOverrides,
    listDmConversations,
    listDmUsers,
    listThreadMessages
  } from "@/lib/threads-api";
import { useAuthStore } from "@/stores/auth-store";
import { useMentionStore } from "@/stores/mentions-store";
import { useThreadSettingsStore } from "@/stores/thread-settings-store";
import type { BoardMember } from "@/types/board";
import type { ChannelConversationSummary, ChannelMemberSummary, DmConversationSummary, ThreadMessageSummary, ThreadUserSummary } from "@/types/threads";
type ThreadConversationSummary = DmConversationSummary | ChannelConversationSummary;
type RefreshConversationsResult = { nextDm: DmConversationSummary[]; nextChannels: ChannelConversationSummary[] };
import { usePresenceStore } from "@/stores/presence-store";
import { useSocketStore } from "@/stores/socket-store";
import type { PresenceState } from "@/types/presence";
import { useThreadActions } from "./threads-page.controller.actions";
import { useThreadMedia } from "./threads-page.controller.media";

const MESSAGES_PAGE_SIZE = 40;
const MAX_MESSAGES_IN_MEMORY = 200;
const TOP_FETCH_THRESHOLD = 140;
const BOTTOM_SCROLL_THRESHOLD = 80;

const CompressionStreamImpl = (globalThis as any).CompressionStream as any;
const DecompressionStreamImpl = (globalThis as any).DecompressionStream as any;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

type CompressedMessagePage =
  | { kind: "gzip"; data: Uint8Array; count: number }
  | { kind: "json"; data: string; count: number };

async function compressMessages(messages: ThreadMessageSummary[]): Promise<CompressedMessagePage> {
  const payload = JSON.stringify(messages);
  if (!CompressionStreamImpl) {
    return { kind: "json", data: payload, count: messages.length };
  }
  const stream = new CompressionStreamImpl("gzip");
  const writer = stream.writable.getWriter();
  await writer.write(textEncoder.encode(payload));
  await writer.close();
  const buffer = await new Response(stream.readable).arrayBuffer();
  return { kind: "gzip", data: new Uint8Array(buffer), count: messages.length };
}

async function decompressMessages(page: CompressedMessagePage): Promise<ThreadMessageSummary[]> {
  if (page.kind === "json") {
    return JSON.parse(page.data) as ThreadMessageSummary[];
  }
  if (!DecompressionStreamImpl) {
    return [];
  }
  const stream = new DecompressionStreamImpl("gzip");
  const writer = stream.writable.getWriter();
  await writer.write(page.data);
  await writer.close();
  const buffer = await new Response(stream.readable).arrayBuffer();
  return JSON.parse(textDecoder.decode(buffer)) as ThreadMessageSummary[];
}

export function useThreadsController() {
  const PIN_STORAGE_KEY = "flowstate:threads:pinned";
  const REPLY_SEEN_STORAGE_KEY = "flowstate:threads:replySeenCounts";
  const user = useAuthStore((state) => state.user);
  const canPinThreads = user?.role !== "guest";
  const [searchParams, setSearchParams] = useSearchParams();

  const [dmUsers, setDmUsers] = useState<ThreadUserSummary[]>([]);
  const [dmConversations, setDmConversations] = useState<DmConversationSummary[]>([]);
  const [channelConversations, setChannelConversations] = useState<ChannelConversationSummary[]>([]);
  const [channelMembers, setChannelMembers] = useState<ChannelMemberSummary[]>([]);
  const [channelDraft, setChannelDraft] = useState("");
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [channelNameDraft, setChannelNameDraft] = useState("");
  const [channelDescriptionDraft, setChannelDescriptionDraft] = useState("");
  const [savingChannelSettings, setSavingChannelSettings] = useState(false);
  const [leavingChannel, setLeavingChannel] = useState(false);
  const [channelSaveState, setChannelSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [deletingChannel, setDeletingChannel] = useState(false);
  const [activeConversation, setActiveConversation] = useState<ThreadConversationSummary | null>(null);
  const [messages, setMessages] = useState<ThreadMessageSummary[]>([]);
  const [activeTab, setActiveTab] = useState<"dms" | "channels">("dms");
  const [searchTerm, setSearchTerm] = useState("");
  const [pinnedUserIds, setPinnedUserIds] = useState<string[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [offscreenMentionCount, setOffscreenMentionCount] = useState(0);
  const [mentionJumpLoading, setMentionJumpLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [videoPreview, setVideoPreview] = useState<{ url: string; name: string } | null>(null);
  const [imagePreview, setImagePreview] = useState<{ url: string; name: string } | null>(null);
  const [replySeenCounts, setReplySeenCounts] = useState<Record<string, number>>({});
  const [mentionNewCount, setMentionNewCount] = useState(0);
  const [replyMentionNewCount, setReplyMentionNewCount] = useState(0);

  const refreshMentions = useMentionStore((state) => state.refresh);
  const mentionCounts = useMentionStore((state) => state.counts);
  const threadBadgeMode = useThreadSettingsStore((state) => state.threadBadgeMode);
  const socketStatus = useSocketStore((state) => state.status);
  const joinThread = useSocketStore((state) => state.joinThread);
  const leaveThread = useSocketStore((state) => state.leaveThread);
  const subscribeThreadEvents = useSocketStore((state) => state.subscribeThreadEvents);

  const activeChannel = activeConversation?.type === "channel" ? activeConversation : null;
  const lastSavedChannelRef = useRef<{ id: string; name: string; description: string | null } | null>(null);

  const activeChannelMember = useMemo(() => {
    if (!activeChannel || !user?.id) return null;
    return channelMembers.find((member) => member.user.id === user.id) ?? null;
  }, [activeChannel?.id, channelMembers, user?.id]);

  const channelPermissions = activeChannelMember?.effectivePermissions;
  const isChannelCreator = Boolean(activeChannel && activeChannel.createdById === user?.id);
  const canEditChannel = Boolean(activeChannel && (isChannelCreator || channelPermissions?.channel_edit));
  const canAddChannelMembers = Boolean(activeChannel && (isChannelCreator || channelPermissions?.channel_members_add));
  const canRemoveChannelMembers = Boolean(activeChannel && (isChannelCreator || channelPermissions?.channel_members_remove));
  const canManageChannelOverrides = Boolean(activeChannel && (isChannelCreator || channelPermissions?.channel_manage_overrides));
  const canDeleteChannel = Boolean(activeChannel && (isChannelCreator || channelPermissions?.channel_delete));
  const canManageChannel = Boolean(
    activeChannel && (canEditChannel || canAddChannelMembers || canRemoveChannelMembers || canManageChannelOverrides || canDeleteChannel)
  );

  const messageListRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<ThreadMessageSummary[]>([]);
  const pendingNewMessageIdsRef = useRef<Set<string>>(new Set());
  const compressedHistoryRef = useRef<CompressedMessagePage[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const userAtBottomRef = useRef(true);
  const lastMessageIdRef = useRef<string | null>(null);
  const pendingScrollRef = useRef(false);
  const pollingRef = useRef<number | null>(null);
  const threadRefreshTimerRef = useRef<number | null>(null);
  const conversationsRefreshTimerRef = useRef<number | null>(null);
  const replyRefreshTimerRef = useRef<number | null>(null);
  const activeConversationRef = useRef<ThreadConversationSummary | null>(null);
  const joinedThreadsRef = useRef<Set<string>>(new Set());
  const pendingMentionMessageIdsRef = useRef<Set<string>>(new Set());
  const pendingReplyMentionsByMessageRef = useRef<Map<string, Set<string>>>(new Map());
  const mentionSyncTimerRef = useRef<number | null>(null);
  const replyMentionSyncTimerRef = useRef<number | null>(null);
  const deferMentionSyncRef = useRef(false);
  const mentionLoadRef = useRef<Set<string>>(new Set());
  const replyTargetIdRef = useRef<string | null>(null);
  const handledMentionParamRef = useRef<string | null>(null);
  const handledReplyMentionParamRef = useRef<string | null>(null);
  const latestFetchTokenRef = useRef(0);
  const latestFetchInFlightRef = useRef(false);
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
    const baseMembers =
      activeConversation?.type === "channel"
        ? channelMembers.map((member) => member.user)
        : dmUsers;
    const sorted = [...baseMembers].sort((a, b) => {
      const aLabel = (a.displayName ?? a.name ?? a.username ?? a.email).toLowerCase();
      const bLabel = (b.displayName ?? b.name ?? b.username ?? b.email).toLowerCase();
      return aLabel.localeCompare(bLabel);
    });
    return sorted.map((userEntry) => ({
      id: userEntry.id,
      name: userEntry.name,
      displayName: userEntry.displayName,
      username: userEntry.username,
      email: userEntry.email,
      bio: userEntry.bio ?? null,
      role: userEntry.role === "admin" ? "admin" : "member",
      createdAt: new Date().toISOString()
    }));
  }, [activeConversation?.type, channelMembers, dmUsers]);

  const dmBadgeCount = useMemo(() => {
    if (threadBadgeMode === "never") return 0;
    return dmConversations.filter((conversation) => {
      const messageMentions = conversation.unreadMentions ?? 0;
      const replyMentions = conversation.unreadReplyMentions ?? 0;
      const isActive = activeConversation?.type === "dm" && activeConversation.id === conversation.id;
      if (threadBadgeMode === "mentions") {
        if (isActive) return replyMentions > 0;
        return messageMentions + replyMentions > 0;
      }
      const hasMentions = messageMentions + replyMentions > 0;
      if (hasMentions) return true;
      if (isActive) return false;
      return Boolean(conversation.hasUnread);
    }).length;
  }, [dmConversations, threadBadgeMode, activeConversation?.id, activeConversation?.type]);

  const channelBadgeCount = useMemo(() => {
    if (threadBadgeMode === "never") return 0;
    return channelConversations.filter((conversation) => {
      const messageMentions = conversation.unreadMentions ?? 0;
      const replyMentions = conversation.unreadReplyMentions ?? 0;
      const isActive = activeConversation?.type === "channel" && activeConversation.id === conversation.id;
      if (threadBadgeMode === "mentions") {
        if (isActive) return replyMentions > 0;
        return messageMentions + replyMentions > 0;
      }
      const hasMentions = messageMentions + replyMentions > 0;
      if (hasMentions) return true;
      if (isActive) return false;
      return Boolean(conversation.hasUnread);
    }).length;
  }, [channelConversations, threadBadgeMode, activeConversation?.id, activeConversation?.type]);

  const queueCompression = (chunk: ThreadMessageSummary[]) => {
    if (chunk.length == 0) return;
    void compressMessages(chunk)
      .then((page) => {
        compressedHistoryRef.current.push(page);
      })
      .catch(() => {
        // ignore compression failures
      });
  };

  const trimIfNeeded = (items: ThreadMessageSummary[]) => {
    if (!userAtBottomRef.current) return items;
    if (items.length <= MAX_MESSAGES_IN_MEMORY) return items;
    const overflow = items.length - MAX_MESSAGES_IN_MEMORY;
    const trimmed = items.slice(overflow);
    const dropped = items.slice(0, overflow);
    queueCompression(dropped);
    return trimmed;
  };

  const prependMessages = (older: ThreadMessageSummary[]) => {
    if (older.length == 0) return;
    const container = messageListRef.current;
    const prevHeight = container?.scrollHeight ?? 0;
    setMessages((prev) => {
      const existing = new Set(prev.map((message) => message.id));
      const filtered = older.filter((message) => !existing.has(message.id));
      if (filtered.length == 0) return prev;
      return [...filtered, ...prev];
    });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const nextContainer = messageListRef.current;
        if (!nextContainer) return;
        const nextHeight = nextContainer.scrollHeight;
        if (nextHeight > prevHeight) {
          nextContainer.scrollTop += nextHeight - prevHeight;
        }
      });
    });
  };

  const mergeLatestMessages = (latest: ThreadMessageSummary[]) => {
    setMessages((prev) => {
      if (prev.length == 0) {
        if (userAtBottomRef.current) {
          pendingScrollRef.current = true;
        }
        setNewMessageCount(0);
        return trimIfNeeded(latest);
      }
      const prevIds = new Set(prev.map((message) => message.id));
      const latestById = new Map(latest.map((message) => [message.id, message]));
      let changed = false;
      const updated = prev.map((message) => {
        const incoming = latestById.get(message.id);
        if (!incoming) return message;
        const updatedChanged =
          incoming.updatedAt !== message.updatedAt ||
          incoming.replyCount !== message.replyCount ||
          incoming.unreadReplyMentions !== message.unreadReplyMentions ||
          incoming.body !== message.body ||
          incoming.deletedAt !== message.deletedAt ||
          (incoming.attachments?.length ?? 0) !== (message.attachments?.length ?? 0) ||
          (incoming.reactions?.length ?? 0) !== (message.reactions?.length ?? 0) ||
          (incoming.voiceNote?.id ?? null) !== (message.voiceNote?.id ?? null);
        if (updatedChanged) {
          changed = true;
          return incoming;
        }
        return message;
      });
      const newOnes = latest.filter((message) => !prevIds.has(message.id));
      if (newOnes.length > 0) {
        changed = true;
        updated.push(...newOnes);
        if (userAtBottomRef.current) {
          pendingScrollRef.current = true;
          pendingNewMessageIdsRef.current.clear();
          setNewMessageCount(0);
        } else {
          const pending = pendingNewMessageIdsRef.current;
          newOnes.forEach((message) => pending.add(message.id));
          setNewMessageCount(pending.size);
        }
      }
      if (!changed) return prev;
      return trimIfNeeded(updated);
    });
  };
  const refreshConversations = useCallback(async (): Promise<RefreshConversationsResult> => {
    const [nextDm, nextChannels] = await Promise.all([
      listDmConversations(),
      listChannelConversations()
    ]);
    setDmConversations(nextDm);
    setChannelConversations(nextChannels);
    return { nextDm, nextChannels };
  }, []);
  const refreshActiveConversation = useCallback(async (conversation: ThreadConversationSummary): Promise<void> => {
    if (latestFetchInFlightRef.current) return;
    latestFetchInFlightRef.current = true;
    const conversationId = conversation.id;
    const conversationType = conversation.type;
    const fetchToken = ++latestFetchTokenRef.current;
    try {
      const [nextMessages, refreshed] = await Promise.all([
        listThreadMessages(conversationId, { limit: MESSAGES_PAGE_SIZE }),
        refreshConversations()
      ]);
      if (activeConversationRef.current?.id !== conversationId) return;
      if (latestFetchTokenRef.current !== fetchToken) return;
      mergeLatestMessages(nextMessages);
      const nextDm = refreshed.nextDm;
      const nextChannels = refreshed.nextChannels;
      if (conversationType === "dm") {
        setActiveConversation((prev) => {
          if (!prev || prev.type !== "dm") return prev;
          const next = nextDm.find((item) => item.id === prev.id);
          if (!next) return prev;
          if (next.lastMessageAt === prev.lastMessageAt && next.unreadMentions === prev.unreadMentions && next.unreadReplyMentions === prev.unreadReplyMentions && next.hasUnread === prev.hasUnread) {
            return prev;
          }
          return next;
        });
      } else {
        setActiveConversation((prev) => {
          if (!prev || prev.type !== "channel") return prev;
          const next = nextChannels.find((item) => item.id === prev.id);
          if (!next) return prev;
          if (next.lastMessageAt === prev.lastMessageAt && next.unreadMentions === prev.unreadMentions && next.unreadReplyMentions === prev.unreadReplyMentions && next.hasUnread === prev.hasUnread) {
            return prev;
          }
          return next;
        });
      }
    } catch {
      // ignore
    } finally {
      latestFetchInFlightRef.current = false;
    }
  }, [mergeLatestMessages, refreshConversations]);

  const syncMentionCounts = useCallback(() => {
    let replyCount = 0;
    pendingReplyMentionsByMessageRef.current.forEach((set) => {
      replyCount += set.size;
    });
    const total = pendingMentionMessageIdsRef.current.size + replyCount;
    setMentionNewCount(total);
    const activeReplyId = replyTargetIdRef.current;
    if (activeReplyId) {
      setReplyMentionNewCount(pendingReplyMentionsByMessageRef.current.get(activeReplyId)?.size ?? 0);
    } else {
      setReplyMentionNewCount(0);
    }
  }, []);

  const updateOffscreenMentionCount = useCallback(() => {
    const container = messageListRef.current;
    const pending = pendingMentionMessageIdsRef.current;
    if (!container || pending.size === 0) {
      setOffscreenMentionCount(0);
      return;
    }
    const bounds = container.getBoundingClientRect();
    let offscreen = 0;
    pending.forEach((id) => {
      const node = container.querySelector<HTMLElement>(`#message-${id}`);
      if (!node) {
        offscreen += 1;
        return;
      }
      const rect = node.getBoundingClientRect();
      if (rect.bottom < bounds.top || rect.top > bounds.bottom) {
        offscreen += 1;
      }
    });
    setOffscreenMentionCount(offscreen);
  }, []);

  const loadThreadMentions = useCallback(async (conversationId: string) => {
    try {
      const mentions = await listUnreadThreadMentions();
      const messageIds = new Set<string>();
      const replyMap = new Map<string, Set<string>>();
      for (const mention of mentions) {
        if (mention.conversationId !== conversationId) continue;
        if (mention.mentionType === "message") {
          messageIds.add(mention.messageId);
          continue;
        }
        if (mention.replyId) {
          const existing = replyMap.get(mention.messageId) ?? new Set<string>();
          existing.add(mention.replyId);
          replyMap.set(mention.messageId, existing);
        }
      }
      pendingMentionMessageIdsRef.current = messageIds;
      pendingReplyMentionsByMessageRef.current = replyMap;
      syncMentionCounts();
      updateOffscreenMentionCount();
    } catch {
      // ignore
    }
  }, [syncMentionCounts, updateOffscreenMentionCount]);

  const syncVisibleMentions = useCallback(async () => {
    const container = messageListRef.current;
    const pending = pendingMentionMessageIdsRef.current;
    if (!container || pending.size === 0) {
      return;
    }
    const bounds = container.getBoundingClientRect();
    const nodes = Array.from(container.querySelectorAll<HTMLElement>("[data-message-id]"));
    const seenIds: string[] = [];
    for (const node of nodes) {
      const messageId = node.getAttribute("data-message-id");
      if (!messageId || !pending.has(messageId)) continue;
      const rect = node.getBoundingClientRect();
      if (rect.bottom < bounds.top || rect.top > bounds.bottom) continue;
      seenIds.push(messageId);
    }
    if (seenIds.length === 0) return;
    seenIds.forEach((id) => pending.delete(id));
    syncMentionCounts();
    try {
      await markThreadMessageMentionsSeen(seenIds);
    } catch {
      // ignore
    }
    void refreshMentions();
    void refreshConversations();
    updateOffscreenMentionCount();
  }, [refreshConversations, refreshMentions, syncMentionCounts, updateOffscreenMentionCount]);

  const scheduleMentionSync = useCallback(() => {
    if (mentionSyncTimerRef.current !== null) return;
    mentionSyncTimerRef.current = window.setTimeout(() => {
      mentionSyncTimerRef.current = null;
      void syncVisibleMentions();
    }, 120);
  }, [syncVisibleMentions]);



  const loadOlderMessages = async () => {
    if (loadingOlder) return;
    if (!activeConversation) return;
    if (compressedHistoryRef.current.length == 0 && !hasMoreMessages) return;
    setLoadingOlder(true);
    try {
      if (compressedHistoryRef.current.length > 0) {
        const page = compressedHistoryRef.current.pop();
        if (page) {
          const older = await decompressMessages(page);
          if (older.length > 0) {
            prependMessages(older);
          }
        }
        return;
      }
      const current = messagesRef.current;
      const oldest = current[0];
      const cursor = oldest?.createdAt ? new Date(oldest.createdAt).getTime() : undefined;
      const data = await listThreadMessages(activeConversation.id, {
        limit: MESSAGES_PAGE_SIZE,
        cursor
      });
      if (data.length == 0) {
        setHasMoreMessages(false);
        return;
      }
      if (data.length < MESSAGES_PAGE_SIZE) {
        setHasMoreMessages(false);
      }
      prependMessages(data);
    } finally {
      setLoadingOlder(false);
    }
  };

  const ensureMessageLoaded = useCallback(async (messageId: string) => {
    if (mentionLoadRef.current.has(messageId)) return;
    mentionLoadRef.current.add(messageId);
    try {
      let attempts = 0;
      let lastCount = messagesRef.current.length;
      while (attempts < 40) {
        if (messagesRef.current.some((message) => message.id === messageId)) return;
        const canLoadMore = compressedHistoryRef.current.length > 0 || hasMoreMessages;
        if (!canLoadMore) return;
        await loadOlderMessages();
        await new Promise((resolve) => setTimeout(resolve, 0));
        const nextCount = messagesRef.current.length;
        if (nextCount == lastCount && compressedHistoryRef.current.length == 0 && !hasMoreMessages) {
          return;
        }
        lastCount = nextCount;
        attempts += 1;
      }
    } finally {
      mentionLoadRef.current.delete(messageId);
    }
  }, [hasMoreMessages, loadOlderMessages]);


  useEffect(() => {
    try {
      const raw = localStorage.getItem(REPLY_SEEN_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      const cleaned: Record<string, number> = {};
      Object.entries(parsed).forEach(([key, value]) => {
        if (typeof value === "number" && Number.isFinite(value)) {
          cleaned[key] = value;
        }
      });
      setReplySeenCounts(cleaned);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(REPLY_SEEN_STORAGE_KEY, JSON.stringify(replySeenCounts));
    } catch {
      // ignore
    }
  }, [replySeenCounts]);

  const workspacePresence = usePresenceStore((state) => state.workspace);
  const lastSeenByUserId = usePresenceStore((state) => state.lastSeenByUserId);
  const setPresenceStatus = useSocketStore((state) => state.setPresenceStatus);

  const presenceByUserId = useMemo(() => {
    const map = new Map<string, PresenceState>();
    workspacePresence.forEach((entry) => {
      map.set(entry.id, entry.status ?? "online");
    });
    return map;
  }, [workspacePresence]);

  const togglePinUser = (userId: string) => {
    if (!canPinThreads) return;
    setPinnedUserIds((prev) => {
      const exists = prev.includes(userId);
      const next = exists ? prev.filter((id) => id != userId) : [userId, ...prev];
      try {
        localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const filteredDmUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const base = query
      ? dmUsers.filter((member) => {
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
      })
      : dmUsers;
    const pinnedSet = new Set(pinnedUserIds);
    return [...base].sort((a, b) => {
      const aPinned = pinnedSet.has(a.id);
      const bPinned = pinnedSet.has(b.id);
      if (aPinned !== bPinned) {
        return aPinned ? -1 : 1;
      }
      const aLast = conversationByUserId.get(a.id)?.lastMessageAt;
      const bLast = conversationByUserId.get(b.id)?.lastMessageAt;
      const aTs = aLast ? new Date(aLast).getTime() : 0;
      const bTs = bLast ? new Date(bLast).getTime() : 0;
      if (aTs !== bTs) {
        return bTs - aTs;
      }
      const aLabel = a.displayName ?? a.name;
      const bLabel = b.displayName ?? b.name;
      return aLabel.localeCompare(bLabel)
    });
  }, [dmUsers, searchTerm, pinnedUserIds, conversationByUserId]);
  const filteredChannels = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const base = query
      ? channelConversations.filter((channel) => channel.name.toLowerCase().includes(query))
      : channelConversations;
    return [...base].sort((a, b) => {
      const aTs = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bTs = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return bTs - aTs;
    });
  }, [channelConversations, searchTerm]);

  const actions = useThreadActions({
    activeConversation,
    userId: user?.id,
    messages,
    setMessages,
    setReplySeenCounts,
    refreshConversations,
    refreshMentions,
    mentionMembers,
    enablePolling: socketStatus !== "connected",
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

  const filteredForwardChannels = useMemo(() => {
    const query = actions.forwardSearch.trim().toLowerCase();
    if (!query) return channelConversations;
    return channelConversations.filter((channel) => {
      const name = channel.name.toLowerCase();
      const description = channel.description?.toLowerCase() ?? "";
      return name.includes(query) || description.includes(query);
    });
  }, [channelConversations, actions.forwardSearch]);
  const media = useThreadMedia({
    activeConversationId: activeConversation?.id ?? null,
    messages,
    replies: actions.replies,
    setMessages,
    refreshConversations,
    setSendError: actions.setSendError
  });

  useEffect(() => {
    replyTargetIdRef.current = actions.replyTarget?.id ?? null;
    const activeReplyId = replyTargetIdRef.current;
    if (!activeReplyId) {
      setReplyMentionNewCount(0);
      return;
    }
    setReplyMentionNewCount(pendingReplyMentionsByMessageRef.current.get(activeReplyId)?.size ?? 0);
  }, [actions.replyTarget?.id]);

  const syncVisibleReplyMentions = useCallback(async () => {
    const replyTargetId = actions.replyTarget?.id;
    if (!replyTargetId) return;
    const pending = pendingReplyMentionsByMessageRef.current.get(replyTargetId);
    if (!pending || pending.size === 0) return;
    const container = actions.replyListRef.current;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    const nodes = Array.from(container.querySelectorAll<HTMLElement>("[data-reply-id]"));
    const seenIds: string[] = [];
    for (const node of nodes) {
      const replyId = node.getAttribute("data-reply-id");
      if (!replyId || !pending.has(replyId)) continue;
      const rect = node.getBoundingClientRect();
      if (rect.bottom < bounds.top || rect.top > bounds.bottom) continue;
      seenIds.push(replyId);
    }
    if (seenIds.length === 0) return;
    seenIds.forEach((id) => pending.delete(id));
    if (pending.size === 0) {
      pendingReplyMentionsByMessageRef.current.delete(replyTargetId);
      setMessages((prev) => prev.map((message) => (
        message.id === replyTargetId
          ? { ...message, unreadReplyMentions: 0 }
          : message
      )));
    }
    syncMentionCounts();
    try {
      await markThreadReplyMentionIdsSeen(seenIds);
    } catch {
      // ignore
    }
    void refreshMentions();
    void refreshConversations();
  }, [actions.replyTarget?.id, refreshConversations, refreshMentions, setMessages, syncMentionCounts]);

  const scheduleReplyMentionSync = useCallback(() => {
    if (replyMentionSyncTimerRef.current !== null) return;
    replyMentionSyncTimerRef.current = window.setTimeout(() => {
      replyMentionSyncTimerRef.current = null;
      void syncVisibleReplyMentions();
    }, 120);
  }, [syncVisibleReplyMentions]);


  const scheduleThreadRefresh = useCallback(() => {
    if (threadRefreshTimerRef.current !== null) return;
    threadRefreshTimerRef.current = window.setTimeout(() => {
      threadRefreshTimerRef.current = null;
      const conversation = activeConversationRef.current;
      if (conversation) {
        void refreshActiveConversation(conversation);
      }
    }, 300);
  }, [refreshActiveConversation]);

  const scheduleConversationRefresh = useCallback(() => {
    if (conversationsRefreshTimerRef.current !== null) return;
    conversationsRefreshTimerRef.current = window.setTimeout(() => {
      conversationsRefreshTimerRef.current = null;
      void refreshConversations();
    }, 300);
  }, [refreshConversations]);

  const scheduleReplyRefresh = useCallback(() => {
    if (replyRefreshTimerRef.current !== null) return;
    replyRefreshTimerRef.current = window.setTimeout(() => {
      replyRefreshTimerRef.current = null;
      void actions.refreshReplies();
    }, 300);
  }, [actions.refreshReplies]);

  useEffect(() => {
    return () => {
      if (threadRefreshTimerRef.current !== null) {
        window.clearTimeout(threadRefreshTimerRef.current);
        threadRefreshTimerRef.current = null;
      }
      if (conversationsRefreshTimerRef.current !== null) {
        window.clearTimeout(conversationsRefreshTimerRef.current);
        conversationsRefreshTimerRef.current = null;
      }
      if (replyRefreshTimerRef.current !== null) {
        window.clearTimeout(replyRefreshTimerRef.current);
        replyRefreshTimerRef.current = null;
      }
    };
  }, []);
  const syncIsAtBottom = useCallback(() => {
    const container = messageListRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const atBottom = distanceFromBottom < BOTTOM_SCROLL_THRESHOLD;
    userAtBottomRef.current = atBottom;
    setIsAtBottom(atBottom);
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (messages.length === 0) {
      setOffscreenMentionCount(0);
      return;
    }
    requestAnimationFrame(() => {
      updateOffscreenMentionCount();
      syncIsAtBottom();
    });
  }, [messages, updateOffscreenMentionCount, syncIsAtBottom]);

  useEffect(() => {
    if (!messageListRef.current) return;
    syncIsAtBottom();
  }, [loadingOlder, syncIsAtBottom]);

  useEffect(() => {
    setReplySeenCounts((prev) => {
      let changed = false;
      const next: Record<string, number> = { ...prev };
      messages.forEach((message) => {
        const current = next[message.id] ?? 0;
        if (current > message.replyCount) {
          next[message.id] = message.replyCount;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [messages]);

  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PIN_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setPinnedUserIds(parsed.filter((id) => typeof id == "string"));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "channels" || tab === "dms") {
      setActiveTab(tab);
    } else {
      setActiveTab("dms");
    }
  }, [searchParams]);

  useEffect(() => {
    const dmId = searchParams.get("dm");
    const channelId = searchParams.get("channel");
    if (activeTab === "dms" && dmId) {
      const match = dmConversations.find((item) => item.id === dmId);
      if (match && match.id != activeConversation?.id) {
        setActiveConversation(match);
      }
    }
    if (activeTab === "channels" && channelId) {
      const match = channelConversations.find((item) => item.id === channelId);
      if (match && match.id != activeConversation?.id) {
        setActiveConversation(match);
      }
    }
  }, [activeTab, searchParams, dmConversations, channelConversations, activeConversation?.id]);

  useEffect(() => {
    if (activeTab === "channels" && activeConversation?.type === "dm") {
      setActiveConversation(null);
    }
    if (activeTab === "dms" && activeConversation?.type === "channel") {
      setActiveConversation(null);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!activeChannel) {
      setChannelNameDraft("");
      setChannelDescriptionDraft("");
      lastSavedChannelRef.current = null;
      setChannelSaveState("idle");
      return;
    }
    setChannelNameDraft(activeChannel.name);
    setChannelDescriptionDraft(activeChannel.description ?? "");
    lastSavedChannelRef.current = {
      id: activeChannel.id,
      name: activeChannel.name,
      description: activeChannel.description ?? null
    };
    setChannelSaveState("idle");
  }, [activeChannel?.id, activeChannel?.name, activeChannel?.description]);

  useEffect(() => {
    if (!activeChannel || !canEditChannel) return;
    const name = channelNameDraft.trim();
    const description = channelDescriptionDraft.trim();
    if (!name) return;
    const normalizedDescription = description.length > 0 ? description : null;
    const lastSaved = lastSavedChannelRef.current;
    if (!lastSaved || lastSaved.id !== activeChannel.id) return;
    if (name === lastSaved.name && normalizedDescription === lastSaved.description) return;

    const timer = window.setTimeout(() => {
      setSavingChannelSettings(true);
      setChannelSaveState("saving");
      updateChannel(activeChannel.id, { name, description: normalizedDescription })
        .then((updated) => {
          lastSavedChannelRef.current = {
            id: updated.id,
            name: updated.name,
            description: updated.description ?? null
          };
          setChannelConversations((prev) => prev.map((channel) => (
            channel.id === updated.id ? updated : channel
          )));
          setActiveConversation(updated);
          setChannelSaveState("saved");
        })
        .catch(() => {
          setChannelSaveState("error");
        })
        .finally(() => {
          setSavingChannelSettings(false);
        });
    }, 500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [channelNameDraft, channelDescriptionDraft, activeChannel?.id, canManageChannel]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        const [users, conversations, channels] = await Promise.all([listDmUsers(), listDmConversations(), listChannelConversations()]);
        if (!active) return;
        setDmUsers(users);
        setDmConversations(conversations);
        setChannelConversations(channels);
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
    compressedHistoryRef.current = [];
    setHasMoreMessages(true);
    setNewMessageCount(0);
  }, [activeConversation?.id, loadThreadMentions, syncMentionCounts]);

  useEffect(() => {
    if (!activeConversation) {
      setMessages([]);
      pendingMentionMessageIdsRef.current = new Set();
      pendingReplyMentionsByMessageRef.current = new Map();
      pendingNewMessageIdsRef.current.clear();
      setNewMessageCount(0);
      setIsAtBottom(true);
      setOffscreenMentionCount(0);
      syncMentionCounts();
      return;
    }

    let active = true;
    const loadMessages = async () => {
      const fetchToken = ++latestFetchTokenRef.current;
      try {
        latestFetchInFlightRef.current = true;
        setLoadingMessages(true);
        const data = await listThreadMessages(activeConversation.id, { limit: MESSAGES_PAGE_SIZE });
        if (!active) return;
        if (latestFetchTokenRef.current != fetchToken) return;
        pendingScrollRef.current = true;
        userAtBottomRef.current = true;
        lastMessageIdRef.current = null;
        setMessages(data);
        setHasMoreMessages(data.length == MESSAGES_PAGE_SIZE);
        setNewMessageCount(0);
        pendingNewMessageIdsRef.current.clear();
        setIsAtBottom(true);
        setOffscreenMentionCount(0);

        deferMentionSyncRef.current = true;
        void loadThreadMentions(activeConversation.id);
      } catch {
        // ignore
      } finally {
        latestFetchInFlightRef.current = false;
        if (active && latestFetchTokenRef.current == fetchToken) {
          setLoadingMessages(false);
        }
      }
    };

    loadMessages();
    return () => {
      active = false;
    };
  }, [activeConversation?.id, loadThreadMentions, syncMentionCounts]);

  useEffect(() => {
    if (!activeConversation) return;
    const handleMentionParams = async () => {
      const mentionMessageId = searchParams.get("mention");
      if (mentionMessageId && handledMentionParamRef.current !== mentionMessageId) {
        if (!messagesRef.current.some((message) => message.id === mentionMessageId)) {
          await ensureMessageLoaded(mentionMessageId);
        }
        const target = messagesRef.current.find((message) => message.id === mentionMessageId);
        if (target) {
          handledMentionParamRef.current = mentionMessageId;
          const node = messageListRef.current?.querySelector<HTMLElement>(`#message-${mentionMessageId}`);
          node?.scrollIntoView({ block: "center", behavior: "smooth" });
          scheduleMentionSync();
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.delete("mention");
            return next;
          });
        }
      }

      const replyMessageId = searchParams.get("reply");
      const replyMentionId = searchParams.get("replyMention");
      if (replyMessageId && replyMentionId) {
        const key = `${replyMessageId}:${replyMentionId}`;
        if (handledReplyMentionParamRef.current !== key) {
          if (!messagesRef.current.some((message) => message.id === replyMessageId)) {
            await ensureMessageLoaded(replyMessageId);
          }
          const target = messagesRef.current.find((message) => message.id === replyMessageId);
          if (target) {
            handledReplyMentionParamRef.current = key;
            void actions.openReplyThread(target).then(() => {
              requestAnimationFrame(() => {
                const node = actions.replyListRef.current?.querySelector<HTMLElement>(`#reply-${replyMentionId}`);
                node?.scrollIntoView({ block: "center", behavior: "smooth" });
                scheduleReplyMentionSync();
              });
            });
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.delete("reply");
              next.delete("replyMention");
              return next;
            });
          }
        }
      }
    };

    void handleMentionParams();
  }, [activeConversation?.id, actions.openReplyThread, ensureMessageLoaded, messages, scheduleMentionSync, scheduleReplyMentionSync, searchParams, setSearchParams]);

  useEffect(() => {
    if (socketStatus !== "connected") {
      joinedThreadsRef.current.clear();
      return;
    }

    const nextIds = new Set<string>();
    dmConversations.forEach((conversation) => nextIds.add(conversation.id));
    channelConversations.forEach((conversation) => nextIds.add(conversation.id));

    const current = joinedThreadsRef.current;
    nextIds.forEach((id) => {
      if (!current.has(id)) {
        joinThread(id);
        current.add(id);
      }
    });

    current.forEach((id) => {
      if (!nextIds.has(id)) {
        leaveThread(id);
        current.delete(id);
      }
    });
  }, [socketStatus, dmConversations, channelConversations, joinThread, leaveThread]);

  useEffect(() => {
    const unsubscribe = subscribeThreadEvents((events) => {
      if (events.length === 0) return;
      scheduleConversationRefresh();
      const conversationId = activeConversationRef.current?.id;
      if (!conversationId) return;
      if (!events.some((event) => event.payload.conversationId === conversationId)) return;
      scheduleThreadRefresh();
      void loadThreadMentions(conversationId);
      if (actions.replyOpen) {
        scheduleReplyRefresh();
      }
    });
    return () => {
      unsubscribe();
    };
  }, [subscribeThreadEvents, scheduleConversationRefresh, scheduleThreadRefresh, scheduleReplyRefresh, actions.replyOpen]);
  useEffect(() => {
    if (!activeConversation || activeConversation.type !== "channel") {
      setChannelMembers([]);
      return;
    }
    let active = true;
    const loadMembers = async () => {
      try {
        const members = await listChannelMembers(activeConversation.id);
        if (!active) return;
        setChannelMembers(members);
      } catch {
        // ignore
      }
    };
    loadMembers();
    return () => {
      active = false;
    };
  }, [activeConversation?.id, activeConversation?.type]);

  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    const container = messageListRef.current;
    if (!container) return;
    if (typeof (container as any).scrollTo === "function") {
      container.scrollTo({ top: container.scrollHeight, behavior });
    } else {
      container.scrollTop = container.scrollHeight;
    }
  };

  const jumpToLatest = () => {
    userAtBottomRef.current = true;
    setIsAtBottom(true);
    pendingScrollRef.current = true;
    scrollToBottom("smooth");
    if (pendingNewMessageIdsRef.current.size > 0) {
      pendingNewMessageIdsRef.current.clear();
    }
    setNewMessageCount(0);
  };

  const handleMessageScroll = () => {
    const container = messageListRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const atBottom = distanceFromBottom < BOTTOM_SCROLL_THRESHOLD;
    userAtBottomRef.current = atBottom;
    setIsAtBottom(atBottom);
    if (atBottom) {
      if (pendingNewMessageIdsRef.current.size > 0) {
        pendingNewMessageIdsRef.current.clear();
      }
      if (newMessageCount > 0) {
        setNewMessageCount(0);
      }
    }
    if (container.scrollTop <= TOP_FETCH_THRESHOLD) {
      void loadOlderMessages();
    }
    scheduleMentionSync();
    updateOffscreenMentionCount();
  };

  const handleReplyScroll = () => {
    actions.handleReplyScroll();
    scheduleReplyMentionSync();
  };

  const jumpToNextMention = useCallback(async () => {
    if (!activeConversation) return;
    setMentionJumpLoading(true);
    try {
      let pendingMessageId: string | undefined;
      for (let i = messagesRef.current.length - 1; i >= 0; i -= 1) {
        if (pendingMentionMessageIdsRef.current.has(messagesRef.current[i].id)) {
          pendingMessageId = messagesRef.current[i].id;
          break;
        }
      }
      if (!pendingMessageId) {
        const fallback = Array.from(pendingMentionMessageIdsRef.current);
        pendingMessageId = fallback[fallback.length - 1];
      }
      if (pendingMessageId) {
        if (!messagesRef.current.some((message) => message.id === pendingMessageId)) {
          await ensureMessageLoaded(pendingMessageId);
        }
        const node = messageListRef.current?.querySelector<HTMLElement>(`#message-${pendingMessageId}`);
        if (node) {
          node.scrollIntoView({ block: "center", behavior: "smooth" });
          scheduleMentionSync();
          return;
        }
      }
      const replyTargetId = messagesRef.current.find((message) => pendingReplyMentionsByMessageRef.current.has(message.id))?.id
        ?? Array.from(pendingReplyMentionsByMessageRef.current.keys())[0];
      if (!replyTargetId) return;
      const replyIds = pendingReplyMentionsByMessageRef.current.get(replyTargetId);
      if (!replyIds || replyIds.size === 0) return;
      if (!messagesRef.current.some((message) => message.id === replyTargetId)) {
        await ensureMessageLoaded(replyTargetId);
      }
      const targetMessage = messagesRef.current.find((message) => message.id === replyTargetId);
      if (!targetMessage) return;
      await actions.openReplyThread(targetMessage);
      const replyId = actions.replies.find((reply) => replyIds.has(reply.id))?.id ?? Array.from(replyIds)[0];
      requestAnimationFrame(() => {
        const node = actions.replyListRef.current?.querySelector<HTMLElement>(`#reply-${replyId}`);
        node?.scrollIntoView({ block: "center", behavior: "smooth" });
        scheduleReplyMentionSync();
      });
    } finally {
      setMentionJumpLoading(false);
    }
  }, [activeConversation, actions.openReplyThread, actions.replies, ensureMessageLoaded, scheduleMentionSync, scheduleReplyMentionSync]);

  const jumpToNextReplyMention = useCallback(() => {
    const replyTargetId = actions.replyTarget?.id;
    if (!replyTargetId) return;
    const pending = pendingReplyMentionsByMessageRef.current.get(replyTargetId);
    if (!pending || pending.size === 0) return;
    const replyId = actions.replies.find((reply) => pending.has(reply.id))?.id ?? Array.from(pending)[0];
    if (!replyId) return;
    const node = actions.replyListRef.current?.querySelector<HTMLElement>(`#reply-${replyId}`);
    node?.scrollIntoView({ block: "center", behavior: "smooth" });
    scheduleReplyMentionSync();
  }, [actions.replyTarget?.id, actions.replies, scheduleReplyMentionSync]);

  useEffect(() => {
    const lastId = messages[messages.length - 1]?.id ?? null;
    if (!lastId) {
      return;
    }
    const shouldScroll = userAtBottomRef.current && !loadingOlder;
    if (shouldScroll && lastId != lastMessageIdRef.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToBottom("auto");
          if (deferMentionSyncRef.current) {
            deferMentionSyncRef.current = false;
            scheduleMentionSync();
          }
        });
      });
    } else if (deferMentionSyncRef.current) {
      deferMentionSyncRef.current = false;
      scheduleMentionSync();
    }
    pendingScrollRef.current = false;
    lastMessageIdRef.current = lastId;
  }, [messages, scheduleMentionSync, loadingOlder]);

  useEffect(() => {
    if (messages.length === 0) return;
    if (deferMentionSyncRef.current) return;
    scheduleMentionSync();
  }, [messages, scheduleMentionSync]);

  useEffect(() => {
    if (!activeConversation || socketStatus === "connected") return;

    let cancelled = false;

    const poll = async () => {
      try {
        const conversation = activeConversation;
        await refreshActiveConversation(conversation);
        if (cancelled) return;
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
  }, [activeConversation?.id, socketStatus, refreshActiveConversation]);

  useEffect(() => {
    if (loadingMessages) return;
    if (messages.length === 0) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollToBottom("auto"));
    });
  }, [loadingMessages]);

  useEffect(() => {
    if (!actions.replyOpen) return;
    scheduleReplyMentionSync();
  }, [actions.replies, actions.replyOpen, scheduleReplyMentionSync]);

  const handleSelectUser = async (userEntry: ThreadUserSummary) => {
    try {
      setLoadingMessages(true);
      const conversation = await getOrCreateDmConversation(userEntry.id);
      setActiveConversation(conversation);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", "dms");
        next.set("dm", conversation.id);
        next.delete("channel");
        next.delete("view");
        return next;
      });
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
  const handleSelectChannel = (channel: ChannelConversationSummary) => {
    setActiveConversation(channel);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", "channels");
      next.set("channel", channel.id);
      next.delete("dm");
      next.delete("view");
      return next;
    });
  };

  const handleCreateChannel = async () => {
    const name = channelDraft.trim();
    if (!name || creatingChannel) return;
    setCreatingChannel(true);
    try {
      const created = await createChannel({ name });
      setChannelConversations((prev) => [created, ...prev]);
      setActiveConversation(created);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", "channels");
        next.set("channel", created.id);
        next.delete("dm");
        next.delete("view");
        return next;
      });
      setChannelDraft("");
    } catch {
      // ignore
    } finally {
      setCreatingChannel(false);
    }
  };
  const handleAddChannelMember = async (memberId: string) => {
    if (!activeConversation || activeConversation.type !== "channel") return;
    if (!canAddChannelMembers) return;
    try {
      const updated = await addChannelMembers(activeConversation.id, [{ userId: memberId }]);
      setChannelMembers(updated);
    } catch {
      // ignore
    }
  };

  const handleToggleChannelOverride = async (
    memberId: string,
    permission: "channel_read" | "channel_write" | "channel_edit" | "channel_members_add" | "channel_members_remove" | "channel_manage_overrides" | "channel_delete",
    enabled: boolean
  ) => {
    if (!activeConversation || activeConversation.type !== "channel") return;
    if (!canManageChannelOverrides) return;
    const current = channelMembers.find((member) => member.user.id === memberId);
    if (!current) return;
    const access: "allow" | "deny" = enabled ? "allow" : "deny";
    const nextOverrides = [
      ...current.overrides.filter((override) => override.permission !== permission),
      { permission, access }
    ];
    try {
      const updatedMember = await updateChannelMemberOverrides(activeConversation.id, memberId, nextOverrides);
      setChannelMembers((prev) => prev.map((member) => (
        member.user.id === memberId ? updatedMember : member
      )));
    } catch {
      // ignore
    }
  };

  const handleClearChannelOverride = async (
    memberId: string,
    permission: "channel_read" | "channel_write" | "channel_edit" | "channel_members_add" | "channel_members_remove" | "channel_manage_overrides" | "channel_delete"
  ) => {
    if (!activeConversation || activeConversation.type !== "channel") return;
    if (!canManageChannelOverrides) return;
    const current = channelMembers.find((member) => member.user.id === memberId);
    if (!current) return;
    const nextOverrides = current.overrides.filter((override) => override.permission !== permission);
    try {
      const updatedMember = await updateChannelMemberOverrides(activeConversation.id, memberId, nextOverrides);
      setChannelMembers((prev) => prev.map((member) => (
        member.user.id === memberId ? updatedMember : member
      )));
    } catch {
      // ignore
    }
  };

  const handleRemoveChannelMember = async (memberId: string) => {
    if (!activeConversation || activeConversation.type !== "channel") return;
    if (!canRemoveChannelMembers) return;
    try {
      await removeChannelMember(activeConversation.id, memberId);
      setChannelMembers((prev) => prev.filter((member) => member.user.id !== memberId));
    } catch {
      // ignore
    }
  };

  const handleSaveChannelDetails = async () => {
    if (!activeConversation || activeConversation.type !== "channel" || savingChannelSettings) return;
    if (!canEditChannel) return;
    const name = channelNameDraft.trim();
    const description = channelDescriptionDraft.trim();
    if (!name) return;

    const payload: { name?: string; description?: string | null } = {};
    if (name !== activeConversation.name) {
      payload.name = name;
    }
    const normalizedDescription = description.length > 0 ? description : null;
    if ((activeConversation.description ?? null) !== normalizedDescription) {
      payload.description = normalizedDescription;
    }
    if (Object.keys(payload).length === 0) return;

    setSavingChannelSettings(true);
    try {
      const updated = await updateChannel(activeConversation.id, payload);
      setChannelConversations((prev) => prev.map((channel) => (
        channel.id === updated.id ? updated : channel
      )));
      setActiveConversation(updated);
    } catch {
      // ignore
    } finally {
      setSavingChannelSettings(false);
    }
  };

  const handleLeaveChannel = async () => {
    if (!activeConversation || activeConversation.type !== "channel" || leavingChannel) return;
    setLeavingChannel(true);
    try {
      await leaveChannel(activeConversation.id);
      setChannelConversations((prev) => prev.filter((channel) => channel.id !== activeConversation.id));
      setChannelMembers([]);
      setActiveConversation(null);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (next.get("channel") == activeConversation.id) {
          next.delete("channel");
          next.delete("view");
        }
        return next;
      });
    } catch {
      // ignore
    } finally {
      setLeavingChannel(false);
    }
  };

  const handleDeleteChannel = async () => {
    if (!activeConversation || activeConversation.type !== "channel" || deletingChannel) return;
    if (!canDeleteChannel) return;
    setDeletingChannel(true);
    try {
      await deleteChannel(activeConversation.id);
      setChannelConversations((prev) => prev.filter((channel) => channel.id !== activeConversation.id));
      setChannelMembers([]);
      setActiveConversation(null);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (next.get("channel") == activeConversation.id) {
          next.delete("channel");
          next.delete("view");
        }
        return next;
      });
    } catch {
      // ignore
    } finally {
      setDeletingChannel(false);
    }
  };

  const totalMentions = mentionCounts?.total ?? 0;
  const showReplyPanel = Boolean(actions.replyTarget || actions.replyOpen);

  return {
    user,
    searchParams,
    setSearchParams,
    activeTab,
    totalMentions,
    dmBadgeCount,
    channelBadgeCount,
    threadBadgeMode,
    searchTerm,
    setSearchTerm,
    loading,
    filteredDmUsers,
    filteredChannels,
    dmUsers,
    channelDraft,
    setChannelDraft,
    creatingChannel,
    handleCreateChannel,
    handleSelectChannel,
    channelNameDraft,
    setChannelNameDraft,
    channelDescriptionDraft,
    setChannelDescriptionDraft,
    savingChannelSettings,
    channelSaveState,
    canManageChannel,
    canEditChannel,
    canAddChannelMembers,
    canRemoveChannelMembers,
    canManageChannelOverrides,
    canDeleteChannel,
    handleSaveChannelDetails,
    handleLeaveChannel,
    handleDeleteChannel,
    leavingChannel,
    deletingChannel,
    channelMembers,
    handleAddChannelMember,
    handleToggleChannelOverride,
    handleClearChannelOverride,
    handleRemoveChannelMember,
    pinnedUserIds,
    canPinThreads,
    togglePinUser,
    conversationByUserId,
    presenceByUserId,
    lastSeenByUserId,
    setPresenceStatus,
    activeConversation,
    handleSelectUser,
    messages,
    loadingMessages,
    loadingOlder,
    newMessageCount,
    mentionNewCount,
    offscreenMentionCount,
    mentionJumpLoading,
    isAtBottom,
    jumpToLatest,
    jumpToNextMention,
    messageListRef,
    handleMessageScroll,
    replySeenCounts,
    hoveredMessageId,
    setHoveredMessageId,
    reactionPickerMessageId,
    setReactionPickerMessageId,
    reactionDetailsOpenId: actions.reactionDetailsOpenId,
    reactionDetailsByMessageId: actions.reactionDetailsByMessageId,
    reactionDetailsLoadingId: actions.reactionDetailsLoadingId,
    reactionDetailsTabByMessageId: actions.reactionDetailsTabByMessageId,
    setReactionDetailsTabByMessageId: actions.setReactionDetailsTabByMessageId,
    replyReactionDetailsOpenId: actions.replyReactionDetailsOpenId,
    replyReactionDetailsByReplyId: actions.replyReactionDetailsByReplyId,
    replyReactionDetailsLoadingId: actions.replyReactionDetailsLoadingId,
    replyReactionDetailsTabByReplyId: actions.replyReactionDetailsTabByReplyId,
    setReplyReactionDetailsTabByReplyId: actions.setReplyReactionDetailsTabByReplyId,
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
    openInlineReplyForReply: actions.openInlineReplyForReply,
    openForwardPickerForReply: actions.openForwardPickerForReply,
    startEditingMessage: actions.startEditingMessage,
    cancelEditingMessage: actions.cancelEditingMessage,
    handleSaveEdit: actions.handleSaveEdit,
    handleToggleMessageReaction: actions.handleToggleMessageReaction,
    handleToggleReactionDetails: actions.handleToggleReactionDetails,
    handleToggleReplyReactionDetails: actions.handleToggleReplyReactionDetails,
    setImagePreview,
    setVideoPreview,
    downloadThreadAttachment,
    downloadThreadReplyAttachment,
    inlineReplyTarget: actions.inlineReplyTarget,
    setInlineReplyTarget: actions.setInlineReplyTarget,
    replyInlineTarget: actions.replyInlineTarget,
    setReplyInlineTarget: actions.setReplyInlineTarget,
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
    filteredForwardChannels,
    forwarding: actions.forwarding,
    forwardError: actions.forwardError,
    closeForwardPicker: actions.closeForwardPicker,
    handleForwardToUser: actions.handleForwardToUser,
    handleForwardToChannel: actions.handleForwardToChannel,
    showReplyPanel,
    replyOpen: actions.replyOpen,
    replyTarget: actions.replyTarget,
    replyPreviewExpanded: actions.replyPreviewExpanded,
    setReplyPreviewExpanded: actions.setReplyPreviewExpanded,
    replyAttachmentOpen: actions.replyAttachmentOpen,
    setReplyAttachmentOpen: actions.setReplyAttachmentOpen,
    replies: actions.replies,
    replyListRef: actions.replyListRef,
    replyLoadingOlder: actions.replyLoadingOlder,
    replyNewCount: actions.replyNewCount,
    replyMentionNewCount,
    handleReplyScroll,
    jumpToLatestReply: actions.jumpToLatestReply,
    jumpToNextReplyMention,
    hoveredReplyId,
    setHoveredReplyId,
    reactionPickerReplyId,
    setReactionPickerReplyId,
    handleToggleReplyReaction: actions.handleToggleReplyReaction,
    replyDraft: actions.replyDraft,
    setReplyDraft: actions.setReplyDraft,
    replyPendingAttachments: actions.replyPendingAttachments,
    replyFileInputRef: actions.replyFileInputRef,
    handleReplyPickAttachments: actions.handleReplyPickAttachments,
    handleReplyAttachmentChange: actions.handleReplyAttachmentChange,
    handleReplyRemoveAttachment: actions.handleReplyRemoveAttachment,
    replyRecording: actions.replyRecording,
    replyRecordingDuration: actions.replyRecordingDuration,
    startReplyRecording: actions.startReplyRecording,
    stopReplyRecording: actions.stopReplyRecording,
    cancelReplyRecording: actions.cancelReplyRecording,
    editingReplyId: actions.editingReplyId,
    editingReplyDraft: actions.editingReplyDraft,
    setEditingReplyDraft: actions.setEditingReplyDraft,
    editingReplyError: actions.editingReplyError,
    startEditingReply: actions.startEditingReply,
    cancelEditingReply: actions.cancelEditingReply,
    handleSaveReplyEdit: actions.handleSaveReplyEdit,
    replyDeleteConfirm: actions.replyDeleteConfirm,
    setReplyDeleteConfirm: actions.setReplyDeleteConfirm,
    handleDeleteReply: actions.handleDeleteReply,
    handleReplyKeyDown: actions.handleReplyKeyDown,
    replyError: actions.replyError,
    handleSendReply: actions.handleSendReply,
    closeReplyThread: actions.closeReplyThread
  };
}





























