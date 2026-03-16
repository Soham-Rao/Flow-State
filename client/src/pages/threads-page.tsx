import { ArrowRight, ChevronsLeft, CornerUpLeft, MessageSquareText, Mic, Paperclip, Search, Send, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { MentionsField } from "@/components/mentions/mentions-input";
import { Button } from "@/components/ui/button";
import { UserHoverCard } from "@/components/users/user-hover-card";
import { extractMentionIds } from "@/lib/mentions";
import { markThreadMentionsSeen } from "@/lib/mentions-api";
import {
  createThreadMessage,
  createThreadMessageAttachments,
  createThreadReply,
  getOrCreateDmConversation,
  listDmConversations,
  listDmUsers,
  listThreadMessages,
  listThreadReplies,
  toggleThreadMessageReaction,
  toggleThreadReplyReaction,
  downloadThreadAttachment
} from "@/lib/threads-api";
import { useAuthStore } from "@/stores/auth-store";
import { useMentionStore } from "@/stores/mentions-store";
import type { BoardMember } from "@/types/board";
import type { DmConversationSummary, ThreadMessageSummary, ThreadReplySummary, ThreadUserSummary } from "@/types/threads";

const presencePalette = {
  online: "bg-emerald-400",
  idle: "bg-amber-400",
  dnd: "bg-rose-400",
  focus: "bg-sky-400"
} as const;

const THREAD_REACTION_CHOICES = ["👍", "🎉", "❤️"];

type PresenceState = keyof typeof presencePalette;

function formatTimestamp(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleString();
}

function formatPreview(text: string | null): string {
  if (!text) return "No messages yet";
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

function getInitial(value: string | null | undefined): string {
  if (!value) return "U";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed[0].toUpperCase() : "U";
}

export function ThreadsPage(): JSX.Element {
  const user = useAuthStore((state) => state.user);
  const [searchParams, setSearchParams] = useSearchParams();

  const [dmUsers, setDmUsers] = useState<ThreadUserSummary[]>([]);
  const [dmConversations, setDmConversations] = useState<DmConversationSummary[]>([]);
  const [activeConversation, setActiveConversation] = useState<DmConversationSummary | null>(null);
  const [messages, setMessages] = useState<ThreadMessageSummary[]>([]);
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
  const [activeTab, setActiveTab] = useState<"dms" | "channels">("dms");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);

  const refreshMentions = useMentionStore((state) => state.refresh);
  const mentionCounts = useMentionStore((state) => state.counts);

  const replyCloseTimer = useRef<number | null>(null);
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
    return dmUsers.map((user) => ({
      id: user.id,
      name: user.name,
      displayName: user.displayName,
      username: user.username,
      email: user.email,
      role: user.role === "admin" ? "admin" : "member",
      createdAt: new Date().toISOString()
    }));
  }, [dmUsers]);

  const presenceByUserId = useMemo(() => {
    const states: PresenceState[] = ["online", "idle", "dnd", "focus"];
    const map = new Map<string, PresenceState>();
    dmUsers.forEach((user, index) => {
      map.set(user.id, states[index % states.length]);
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

  const filteredForwardUsers = useMemo(() => {
    const query = forwardSearch.trim().toLowerCase();
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
  }, [dmUsers, forwardSearch]);

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

  useEffect(() => {
    if (loadingMessages) return;
    if (messages.length === 0) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollToBottom("auto"));
    });
  }, [loadingMessages]);
  
  const handleSelectUser = async (user: ThreadUserSummary) => {
    try {
      setLoadingMessages(true);
      const conversation = await getOrCreateDmConversation(user.id);
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
      if (user?.id) {
        mentionSet.delete(user.id);
      }
      const created = await createThreadMessage(activeConversation.id, {
        body: trimmed,
        mentions: Array.from(mentionSet),
        hasAttachments
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
      setSendError(error instanceof Error ? error.message : "Unable to send message right now.");
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

  const totalMentions = mentionCounts?.total ?? 0;
  const showReplyPanel = replyTarget || replyOpen;

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4 overflow-hidden lg:flex-row">
      <aside className="flex w-full flex-col rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm lg:max-w-[320px] lg:h-full">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {activeTab === "channels" ? "Channels" : "Direct messages"}
          </p>
          {totalMentions > 0 && activeTab === "dms" && (
            <span className="rounded-full bg-rose-500/90 px-2 py-0.5 text-[10px] font-semibold text-white">
              {totalMentions}
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
          <Search className="h-4 w-4" />
          <input
            className="w-full bg-transparent text-sm text-foreground outline-none"
            placeholder={activeTab === "channels" ? "Search channels" : "Search teammates"}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs">
          <button
            type="button"
            className={`flex-1 rounded-full border px-3 py-1 font-semibold transition ${
              activeTab === "dms"
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border/60 text-muted-foreground hover:border-primary/30"
            }`}
            onClick={() => setSearchParams({ tab: "dms" })}
          >
            DMs
          </button>
          <button
            type="button"
            className={`flex-1 rounded-full border px-3 py-1 font-semibold transition ${
              activeTab === "channels"
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border/60 text-muted-foreground hover:border-primary/30"
            }`}
            onClick={() => setSearchParams({ tab: "channels" })}
          >
            Channels
          </button>
        </div>

        <div className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
          {activeTab === "channels" && (
            <div className="rounded-xl border border-dashed border-border/70 p-4 text-xs text-muted-foreground">
              Channels are coming next. You will see shared spaces here soon.
            </div>
          )}

          {activeTab === "dms" && (
            <>
              {loading && (
                <div className="text-xs text-muted-foreground">Loading direct messages...</div>
              )}
              {!loading && filteredDmUsers.length === 0 && (
                <div className="text-xs text-muted-foreground">No teammates yet.</div>
              )}
              {!loading &&
                filteredDmUsers.map((user) => {
                  const conversation = conversationByUserId.get(user.id);
                  const presence = presenceByUserId.get(user.id) ?? "online";
                  const isActive = activeConversation?.otherUser.id === user.id;
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleSelectUser(user)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition ${
                        isActive
                          ? "border-primary/60 bg-primary/10"
                          : "border-border/60 bg-background/60 hover:border-primary/30 hover:bg-primary/5"
                      }`}
                    >
                      <UserHoverCard user={user}>
                        <div className="relative">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-transparent text-sm font-semibold">
                            {user.displayName?.[0] ?? user.username?.[0] ?? "U"}
                          </div>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${
                              presencePalette[presence]
                            }`}
                          />
                        </div>
                      </UserHoverCard>
                      <div className="min-w-0 flex-1">
                        <UserHoverCard user={user}>
                          <p className="truncate text-sm font-semibold">
                            {user.displayName ?? user.name}
                          </p>
                        </UserHoverCard>
                        <p className="truncate text-xs text-muted-foreground">
                          {conversation ? formatPreview(conversation.lastMessagePreview) : "Start a DM"}
                        </p>
                      </div>
                      {conversation && conversation.unreadMentions > 0 && (
                        <span className="rounded-full bg-rose-500/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                          {conversation.unreadMentions}
                        </span>
                      )}
                    </button>
                  );
                })}
            </>
          )}
        </div>
      </aside>

      <section className="relative flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/70 bg-card/60 shadow-sm">
        {!activeConversation && activeTab === "dms" && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
            <Users className="h-10 w-10 text-muted-foreground" />
            Pick a teammate on the left to start a DM.
          </div>
        )}

        {activeTab === "channels" && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
            <MessageSquareText className="h-10 w-10 text-muted-foreground" />
            Channels are on the way. For now, keep using DMs.
          </div>
        )}

        {activeConversation && activeTab === "dms" && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-card/95 px-4 py-3 backdrop-blur">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Direct message</p>
                <UserHoverCard user={activeConversation.otherUser}>
                  <h3 className="text-lg font-semibold">
                    {activeConversation.otherUser.displayName ?? activeConversation.otherUser.name}
                  </h3>
                </UserHoverCard>
                <p className="text-xs text-muted-foreground">@{activeConversation.otherUser.username ?? "username"}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MessageSquareText className="h-4 w-4" />
                {activeConversation.lastMessageAt
                  ? `Last message ${formatTimestamp(activeConversation.lastMessageAt)}`
                  : "No activity yet"}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4">
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-2" ref={messageListRef} onScroll={handleMessageScroll}>
                {loadingMessages && (
                  <div className="text-xs text-muted-foreground">Loading messages...</div>
                )}
                {!loadingMessages && messages.length === 0 && (
                  <div className="text-xs text-muted-foreground">No messages yet. Say hello!</div>
                )}
                {!loadingMessages &&
                  messages.map((message, index) => {
                    const isMine = message.author.id === user?.id;
                    const previous = messages[index - 1];
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
                    const showReactionPicker = reactionPickerMessageId === message.id;
                    const hasReactions = message.reactions.length > 0;
                    const bubble = (
                      <div
                        className={`max-w-[75%] rounded-2xl border px-4 py-3 ${
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
                        <p className="whitespace-pre-line text-[15px] text-foreground">{message.body}</p>
                        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>{formatTimestamp(message.createdAt)}</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="rounded-full border border-border/60 px-2 py-0.5 text-xs text-muted-foreground hover:text-primary"
                              onClick={() => openInlineReply(message)}
                              aria-label="Reply inline"
                            >
                              <CornerUpLeft className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-xs text-muted-foreground hover:text-primary"
                              onClick={() => openReplyThread(message)}
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
                              onClick={() => openForwardPicker(message)}
                              aria-label="Forward message"
                            >
                              <ArrowRight className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
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
                                void handleToggleMessageReaction(message.id, reaction.emoji);
                              }}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    ) : null;

                    const attachmentStrip = message.attachments.length > 0 ? (
                      <div className={`mt-2 flex flex-col gap-1 ${isMine ? "items-end" : "items-start"}`}>
                        {message.attachments.map((attachment) => (
                          <button
                            key={attachment.id}
                            type="button"
                            className="flex items-center gap-2 rounded-md border border-border/60 bg-background/80 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                            onClick={() => downloadThreadAttachment(attachment.id, attachment.originalName)}
                          >
                            <Paperclip className="h-3 w-3" />
                            <span className="max-w-[200px] truncate">{attachment.originalName}</span>
                          </button>
                        ))}
                      </div>
                    ) : null;

                    const actionRail = isHovered ? (
                      <div className={`flex flex-col items-center gap-1 self-center ${isMine ? "mr-0.5" : "ml-0.5"}`}>
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
                          <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-background/90 p-1 shadow-sm">
                            {THREAD_REACTION_CHOICES.map((emoji) => (
                              <button
                                key={`${message.id}-${emoji}-pick`}
                                type="button"
                                className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-primary"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleToggleMessageReaction(message.id, emoji);
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
                        {bubble}
                        {attachmentStrip}
                        {reactionStrip}
                      </div>
                    );

                    return (
                      <div
                        key={message.id}
                        className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                        onMouseEnter={() => setHoveredMessageId(message.id)}
                        onMouseLeave={() => {
                          setHoveredMessageId((current) => (current === message.id ? null : current));
                          setReactionPickerMessageId((current) => (current === message.id ? null : current));
                        }}
                      >
                        <div className={`flex items-start ${isMine ? "gap-0.5" : "gap-2"}`}>
                          {isMine ? actionRail : avatarSlot}
                          {messageBody}
                          {isMine ? avatarSlot : actionRail}
                        </div>
                      </div>
                    );
                  })}
              </div>

              <div className="sticky bottom-0 rounded-xl border border-border/70 bg-background/90 p-3 backdrop-blur">
                {inlineReplyTarget && (
                  <div className="mb-2 flex items-center justify-between rounded-md border border-border/70 bg-card/70 px-2.5 py-1 text-xs text-muted-foreground">
                    <span>Replying to <span className="font-semibold text-foreground">{inlineReplyTarget.author.displayName ?? inlineReplyTarget.author.username ?? inlineReplyTarget.author.name}</span></span>
                    <button
                      type="button"
                      className="text-[11px] text-muted-foreground hover:text-foreground"
                      onClick={() => setInlineReplyTarget(null)}
                    >
                      Cancel
                    </button>
                  </div>
                )}
                <MentionsField
                  multiline
                  rows={3}
                  value={messageDraft}
                  onChange={setMessageDraft}
                  members={mentionMembers}
                  placeholder="Write a message..."
                  onKeyDown={handleMessageKeyDown}
                />
                {pendingAttachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {pendingAttachments.map((file, index) => (
                      <div key={`${file.name}-${index}`} className="flex items-center gap-2 rounded-md border border-border/60 bg-background/80 px-2 py-1 text-[11px] text-muted-foreground">
                        <span className="max-w-[200px] truncate">{file.name}</span>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => handleRemoveAttachment(index)}
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
                  onChange={handleAttachmentChange}
                />
                {sendError && <p className="mt-2 text-xs text-rose-500">{sendError}</p>}
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
                      onClick={handlePickAttachments}
                    >
                      <Paperclip className="h-4 w-4" />
                      Attachments
                    </button>
                    <span className="ml-3 inline-flex items-center gap-2">
                      <Mic className="h-4 w-4" />
                      Voice
                    </span>
                  </div>
                  <Button size="sm" onClick={handleSendMessage} disabled={sending}>
                    <Send className="mr-2 h-4 w-4" />
                    Send
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {forwardOpen && forwardTarget && (
          <div className="absolute inset-0 z-30">
            <div className="absolute inset-0 bg-background/40" onClick={closeForwardPicker} />
            <div className="absolute left-1/2 top-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border/70 bg-card/95 p-4 shadow-xl">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Forward message</p>
                <Button variant="ghost" size="sm" onClick={closeForwardPicker}>
                  Close
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Select a DM to forward this message.</p>
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                <Search className="h-4 w-4" />
                <input
                  className="w-full bg-transparent text-sm text-foreground outline-none"
                  placeholder="Search teammates"
                  value={forwardSearch}
                  onChange={(event) => setForwardSearch(event.target.value)}
                />
              </div>
              <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                {filteredForwardUsers.length === 0 && (
                  <p className="text-xs text-muted-foreground">No teammates found.</p>
                )}
                {filteredForwardUsers.map((member) => (
                  <button
                    key={`forward-${member.id}`}
                    type="button"
                    onClick={() => handleForwardToUser(member)}
                    disabled={forwarding}
                    className="flex w-full items-center gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-left text-sm transition hover:border-primary/30 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <UserHoverCard user={member}>
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-transparent text-sm font-semibold">
                        {getInitial(member.displayName ?? member.username ?? member.name)}
                      </div>
                    </UserHoverCard>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{member.displayName ?? member.name}</p>
                      <p className="truncate text-xs text-muted-foreground">@{member.username ?? "username"}</p>
                    </div>
                  </button>
                ))}
              </div>
              {forwardError && <p className="mt-2 text-xs text-rose-500">{forwardError}</p>}
            </div>
          </div>
        )}

        {showReplyPanel && (
          <div className="absolute inset-0 z-20">
            <div
              className={`absolute inset-0 bg-background/40 transition-opacity ${replyOpen ? "opacity-100" : "opacity-0"}`}
              onClick={closeReplyThread}
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
                  <Button variant="ghost" size="sm" onClick={closeReplyThread}>
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
                        <p className="text-[13px] text-foreground">
                          {replyPreviewExpanded || (replyTarget.body?.length ?? 0) <= 160
                            ? replyTarget.body
                            : `${replyTarget.body?.slice(0, 160)}…`}
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                          <p className="text-[11px] text-muted-foreground">{formatTimestamp(replyTarget.createdAt)}</p>
                          {(replyTarget.body?.length ?? 0) > 160 && (
                            <button
                              type="button"
                              className="text-[11px] font-semibold text-primary/80 hover:text-primary"
                              onClick={() => setReplyPreviewExpanded((prev) => !prev)}
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
                  const isMine = reply.author.id === user?.id;
                  const previous = replies[index - 1];
                  const showAvatar = !previous || previous.author.id !== reply.author.id;
                  const initial = getInitial(
                    reply.author.displayName ?? reply.author.username ?? reply.author.name
                  );
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
                      <p className="mt-2 text-[11px] text-muted-foreground">{formatTimestamp(reply.createdAt)}</p>
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
                              void handleToggleReplyReaction(reply.id, reaction.emoji);
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  ) : null;

                  const actionRail = isHovered ? (
                    <div className={`flex flex-col items-center gap-1 self-center ${isMine ? "mr-0.5" : "ml-0.5"}`}>
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
                        <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-background/90 p-1 shadow-sm">
                          {THREAD_REACTION_CHOICES.map((emoji) => (
                            <button
                              key={`${reply.id}-${emoji}-pick`}
                              type="button"
                              className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-primary"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleToggleReplyReaction(reply.id, emoji);
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
                      {bubble}
                      {reactionStrip}
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
                      <div className={`flex items-start ${isMine ? "gap-0.5" : "gap-2"}`}>
                        {isMine ? actionRail : avatarSlot}
                        {replyBody}
                        {isMine ? avatarSlot : actionRail}
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
                  onChange={setReplyDraft}
                  members={mentionMembers}
                  placeholder="Reply with a mention..."
                  onKeyDown={handleReplyKeyDown}
                />
                {replyError && <p className="mt-2 text-xs text-rose-500">{replyError}</p>}
                <div className="mt-3 flex justify-end">
                  <Button size="sm" onClick={handleSendReply}>
                    <Send className="mr-2 h-3 w-3" />
                    Send reply
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}















