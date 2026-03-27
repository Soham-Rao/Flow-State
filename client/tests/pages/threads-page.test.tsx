import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

import { ThreadsPage } from "@/pages/threads-page";

const listDmUsers = vi.fn();
const listDmConversations = vi.fn();
const listChannelConversations = vi.fn();
const createChannel = vi.fn();
const updateChannel = vi.fn();
const leaveChannel = vi.fn();
const deleteChannel = vi.fn();
const listChannelMembers = vi.fn();
const addChannelMembers = vi.fn();
const updateChannelMemberOverrides = vi.fn();
const removeChannelMember = vi.fn();
const getOrCreateDmConversation = vi.fn();
const listThreadMessages = vi.fn();
const listThreadReplies = vi.fn();
const createThreadMessage = vi.fn();
const createThreadReply = vi.fn();
const createThreadMessageAttachments = vi.fn();
const createThreadReplyAttachments = vi.fn();
const createThreadVoiceNote = vi.fn();
const createThreadReplyVoiceNote = vi.fn();
const fetchThreadAttachmentBlob = vi.fn();
const fetchThreadReplyAttachmentBlob = vi.fn();
const fetchThreadVoiceNote = vi.fn();
const fetchThreadReplyVoiceNote = vi.fn();
const toggleThreadMessageReaction = vi.fn();
const toggleThreadReplyReaction = vi.fn();
const listThreadMessageReactionDetails = vi.fn();
const listThreadReplyReactionDetails = vi.fn();
const updateThreadMessage = vi.fn();
const updateThreadReply = vi.fn();
const deleteThreadMessage = vi.fn();
const deleteThreadReply = vi.fn();
const downloadThreadAttachment = vi.fn();
const downloadThreadReplyAttachment = vi.fn();

const getUnreadMentions = vi.fn();
const listUnreadThreadMentions = vi.fn();
const markThreadMessageMentionsSeen = vi.fn();
const markThreadReplyMentionIdsSeen = vi.fn();

vi.mock("@/lib/threads-api", () => ({
  listDmUsers: (...args: unknown[]) => listDmUsers(...args),
  listDmConversations: (...args: unknown[]) => listDmConversations(...args),
  listChannelConversations: (...args: unknown[]) => listChannelConversations(...args),
  createChannel: (...args: unknown[]) => createChannel(...args),
  updateChannel: (...args: unknown[]) => updateChannel(...args),
  leaveChannel: (...args: unknown[]) => leaveChannel(...args),
  deleteChannel: (...args: unknown[]) => deleteChannel(...args),
  listChannelMembers: (...args: unknown[]) => listChannelMembers(...args),
  addChannelMembers: (...args: unknown[]) => addChannelMembers(...args),
  updateChannelMemberOverrides: (...args: unknown[]) => updateChannelMemberOverrides(...args),
  removeChannelMember: (...args: unknown[]) => removeChannelMember(...args),
  getOrCreateDmConversation: (...args: unknown[]) => getOrCreateDmConversation(...args),
  listThreadMessages: (...args: unknown[]) => listThreadMessages(...args),
  listThreadReplies: (...args: unknown[]) => listThreadReplies(...args),
  createThreadMessage: (...args: unknown[]) => createThreadMessage(...args),
  createThreadReply: (...args: unknown[]) => createThreadReply(...args),
  createThreadMessageAttachments: (...args: unknown[]) => createThreadMessageAttachments(...args),
  createThreadReplyAttachments: (...args: unknown[]) => createThreadReplyAttachments(...args),
  createThreadVoiceNote: (...args: unknown[]) => createThreadVoiceNote(...args),
  createThreadReplyVoiceNote: (...args: unknown[]) => createThreadReplyVoiceNote(...args),
  fetchThreadAttachmentBlob: (...args: unknown[]) => fetchThreadAttachmentBlob(...args),
  fetchThreadReplyAttachmentBlob: (...args: unknown[]) => fetchThreadReplyAttachmentBlob(...args),
  fetchThreadVoiceNote: (...args: unknown[]) => fetchThreadVoiceNote(...args),
  fetchThreadReplyVoiceNote: (...args: unknown[]) => fetchThreadReplyVoiceNote(...args),
  toggleThreadMessageReaction: (...args: unknown[]) => toggleThreadMessageReaction(...args),
  toggleThreadReplyReaction: (...args: unknown[]) => toggleThreadReplyReaction(...args),
  listThreadMessageReactionDetails: (...args: unknown[]) => listThreadMessageReactionDetails(...args),
  listThreadReplyReactionDetails: (...args: unknown[]) => listThreadReplyReactionDetails(...args),
  updateThreadMessage: (...args: unknown[]) => updateThreadMessage(...args),
  updateThreadReply: (...args: unknown[]) => updateThreadReply(...args),
  deleteThreadMessage: (...args: unknown[]) => deleteThreadMessage(...args),
  deleteThreadReply: (...args: unknown[]) => deleteThreadReply(...args),
  downloadThreadAttachment: (...args: unknown[]) => downloadThreadAttachment(...args),
  downloadThreadReplyAttachment: (...args: unknown[]) => downloadThreadReplyAttachment(...args)
}));

vi.mock("@/lib/mentions-api", () => ({
  getUnreadMentions: (...args: unknown[]) => getUnreadMentions(...args),
  listUnreadThreadMentions: (...args: unknown[]) => listUnreadThreadMentions(...args),
  markThreadMessageMentionsSeen: (...args: unknown[]) => markThreadMessageMentionsSeen(...args),
  markThreadReplyMentionIdsSeen: (...args: unknown[]) => markThreadReplyMentionIdsSeen(...args),
  markCommentMentionsSeen: vi.fn()
}));

describe("ThreadsPage", () => {
  beforeEach(() => {
    listDmUsers.mockResolvedValue([
      {
        id: "user-1",
        name: "Ada Lovelace",
        displayName: "Ada",
        username: "ada",
        email: "ada@example.com",
        role: "member"
      },
      {
        id: "user-2",
        name: "Grace Hopper",
        displayName: "Grace",
        username: "grace",
        email: "grace@example.com",
        role: "member"
      }
    ]);

    listChannelConversations.mockResolvedValue([]);

    listDmConversations.mockResolvedValue([
      {
        id: "conv-1",
        type: "dm",
        otherUser: {
          id: "user-2",
          name: "Grace Hopper",
          displayName: "Grace",
          username: "grace",
          email: "grace@example.com",
          role: "member"
        },
        lastMessageAt: new Date().toISOString(),
        lastMessagePreview: "Hello",
        unreadMentions: 2
      }
    ]);

    getOrCreateDmConversation.mockResolvedValue({
      id: "conv-1",
      type: "dm",
      otherUser: {
        id: "user-2",
        name: "Grace Hopper",
        displayName: "Grace",
        username: "grace",
        email: "grace@example.com",
        role: "member"
      },
      lastMessageAt: new Date().toISOString(),
      lastMessagePreview: "Hello",
      unreadMentions: 2
    });

    listThreadMessages.mockResolvedValue([
      {
        id: "msg-1",
        conversationId: "conv-1",
        author: {
          id: "user-2",
          name: "Grace Hopper",
          displayName: "Grace",
          username: "grace",
          email: "grace@example.com",
          role: "member"
        },
        body: "Hello Ada",
        isForwarded: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
        reactions: [],
        replyCount: 0,
        attachments: [],
        voiceNote: null
      }
    ]);

    listThreadReplies.mockResolvedValue([]);
    createThreadMessage.mockResolvedValue(null);
    createThreadReply.mockResolvedValue(null);
    getUnreadMentions.mockResolvedValue({ total: 2, threads: 2, comments: 0 });
    listUnreadThreadMentions.mockResolvedValue([
      {
        id: "mention-1",
        mentionType: "message",
        conversationId: "conv-1",
        conversationType: "dm",
        conversationLabel: "Grace",
        messageId: "msg-1",
        replyId: null,
        body: "Hello Ada",
        createdAt: Date.now()
      }
    ]);
    markThreadMessageMentionsSeen.mockResolvedValue(null);
    markThreadReplyMentionIdsSeen.mockResolvedValue(null);
  });

  it("renders dm list and opens a conversation", async () => {
    render(
      <MemoryRouter>
        <ThreadsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Grace")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Grace/i }));

    expect(await screen.findByText("Hello Ada")).toBeInTheDocument();
    await waitFor(() => {
      expect(markThreadMessageMentionsSeen).toHaveBeenCalledWith(["msg-1"]);
    });
  });
});





