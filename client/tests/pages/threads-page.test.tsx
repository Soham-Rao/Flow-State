import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

import { ThreadsPage } from "@/pages/threads-page";

const listDmUsers = vi.fn();
const listDmConversations = vi.fn();
const getOrCreateDmConversation = vi.fn();
const listThreadMessages = vi.fn();
const listThreadReplies = vi.fn();
const createThreadMessage = vi.fn();
const createThreadReply = vi.fn();
const downloadThreadAttachment = vi.fn();

const getUnreadMentions = vi.fn();
const markThreadMentionsSeen = vi.fn();

vi.mock("@/lib/threads-api", () => ({
  listDmUsers: (...args: unknown[]) => listDmUsers(...args),
  listDmConversations: (...args: unknown[]) => listDmConversations(...args),
  getOrCreateDmConversation: (...args: unknown[]) => getOrCreateDmConversation(...args),
  listThreadMessages: (...args: unknown[]) => listThreadMessages(...args),
  listThreadReplies: (...args: unknown[]) => listThreadReplies(...args),
  createThreadMessage: (...args: unknown[]) => createThreadMessage(...args),
  createThreadReply: (...args: unknown[]) => createThreadReply(...args),
  downloadThreadAttachment: (...args: unknown[]) => downloadThreadAttachment(...args)
}));

vi.mock("@/lib/mentions-api", () => ({
  getUnreadMentions: (...args: unknown[]) => getUnreadMentions(...args),
  markThreadMentionsSeen: (...args: unknown[]) => markThreadMentionsSeen(...args),
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
    markThreadMentionsSeen.mockResolvedValue(null);
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
    expect(markThreadMentionsSeen).toHaveBeenCalledWith("conv-1");
  });
});





