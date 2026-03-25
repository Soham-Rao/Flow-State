import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { markThreadMentionsSeen } from "@/lib/mentions-api";
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
const BOTTOM_SCROLL_THRESHOLD = 140;

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
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [videoPreview, setVideoPreview] = useState<{ url: string; name: string } | null>(null);
  const [imagePreview, setImagePreview] = useState<{ url: string; name: string } | null>(null);

  const refreshMentions = useMentionStore((state) => state.refresh);
  const mentionCounts = useMentionStore((state) => state.counts);

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
  const compressedHistoryRef = useRef<CompressedMessagePage[]>([]);
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
      role: userEntry.role === "admin" ? "admin" : "member",
      createdAt: new Date().toISOString()
    }));
  }, [activeConversation?.type, channelMembers, dmUsers]);

  const dmMentionTotal = useMemo(() => (
    dmConversations.reduce((sum, conversation) => sum + (conversation.unreadMentions ?? 0), 0)
  ), [dmConversations]);

  const channelMentionTotal = useMemo(() => (
    channelConversations.reduce((sum, conversation) => sum + (conversation.unreadMentions ?? 0), 0)
  ), [channelConversations]);

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
          setNewMessageCount(0);
        } else {
          setNewMessageCount((count) => count + newOnes.length);
        }
      }
      if (!changed) return prev;
      return trimIfNeeded(updated);
    });
  };

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

    const refreshConversations = async (): Promise<RefreshConversationsResult> => {
    const [nextDm, nextChannels] = await Promise.all([
      listDmConversations(),
      listChannelConversations()
    ]);
    setDmConversations(nextDm);
    setChannelConversations(nextChannels);
    return { nextDm, nextChannels };
  };
const actions = useThreadActions({
    activeConversation,
    userId: user?.id,
    messages,
    setMessages,
    refreshConversations,
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
    replies: actions.replies,
    setMessages,
    refreshConversations,
    setSendError: actions.setSendError
  });

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

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
        const data = await listThreadMessages(activeConversation.id, { limit: MESSAGES_PAGE_SIZE });
        if (!active) return;
        pendingScrollRef.current = true;
        userAtBottomRef.current = true;
        lastMessageIdRef.current = null;
        setMessages(data);
        setHasMoreMessages(data.length == MESSAGES_PAGE_SIZE);
        setNewMessageCount(0);

        await markThreadMentionsSeen(activeConversation.id);
        await refreshMentions();
        if (activeConversation.type === "dm") {
          setDmConversations((prev) =>
            prev.map((conversation) =>
              conversation.id === activeConversation.id
                ? { ...conversation, unreadMentions: 0 }
                : conversation
            )
          );
        } else {
          setChannelConversations((prev) =>
            prev.map((conversation) =>
              conversation.id === activeConversation.id
                ? { ...conversation, unreadMentions: 0 }
                : conversation
            )
          );
        }
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
    container.scrollTo({ top: container.scrollHeight, behavior });
  };

  const jumpToLatest = () => {
    userAtBottomRef.current = true;
    pendingScrollRef.current = true;
    scrollToBottom("smooth");
    setNewMessageCount(0);
  };

  const handleMessageScroll = () => {
    const container = messageListRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const atBottom = distanceFromBottom < BOTTOM_SCROLL_THRESHOLD;
    userAtBottomRef.current = atBottom;
    if (atBottom && newMessageCount > 0) {
      setNewMessageCount(0);
    }
    if (container.scrollTop <= TOP_FETCH_THRESHOLD) {
      void loadOlderMessages();
    }
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
        const [nextMessages, refreshed] = await Promise.all([
        listThreadMessages(activeConversation.id, { limit: MESSAGES_PAGE_SIZE }),
        refreshConversations()
        ]);
        if (cancelled) return;
        mergeLatestMessages(nextMessages);
        await markThreadMentionsSeen(activeConversation.id);
        await refreshMentions();

              const nextDm = refreshed.nextDm;
      const nextChannels = refreshed.nextChannels;
      if (activeConversation.type === "dm") {
        setActiveConversation((prev) => {
          if (!prev || prev.type !== "dm") return prev;
          const next = nextDm.find((item) => item.id === prev.id);
          if (!next) return prev;
          if (next.lastMessageAt === prev.lastMessageAt && next.unreadMentions === prev.unreadMentions) {
            return prev;
          }
          return next;
        });
      } else {
        setActiveConversation((prev) => {
          if (!prev || prev.type !== "channel") return prev;
          const next = nextChannels.find((item) => item.id === prev.id);
          if (!next) return prev;
          if (next.lastMessageAt === prev.lastMessageAt && next.unreadMentions === prev.unreadMentions) {
            return prev;
          }
          return next;
        });
      }
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
    dmMentionTotal,
    channelMentionTotal,
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
    jumpToLatest,
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
    replyListRef: actions.replyListRef,
    replyLoadingOlder: actions.replyLoadingOlder,
    replyNewCount: actions.replyNewCount,
    handleReplyScroll: actions.handleReplyScroll,
    jumpToLatestReply: actions.jumpToLatestReply,
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



























