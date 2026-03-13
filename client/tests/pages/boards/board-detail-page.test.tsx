import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BoardDetailPage } from "@/pages/boards/board-detail-page";
import type { BoardCard, BoardComment, BoardDetail, BoardList } from "@/types/board";
import * as boardsApi from "@/lib/boards-api";

vi.mock("@/lib/boards-api", () => ({
  getBoardById: vi.fn(),
  createList: vi.fn(),
  deleteAttachment: vi.fn(),
  deleteBoard: vi.fn(),
  deleteList: vi.fn(),
  downloadAttachment: vi.fn(),
  reorderLists: vi.fn(),
  updateBoard: vi.fn(),
  updateList: vi.fn(),
  createAttachments: vi.fn(),
  createCard: vi.fn(),
  updateCard: vi.fn(),
  deleteCard: vi.fn(),
  moveCard: vi.fn(),
  createChecklist: vi.fn(),
  updateChecklist: vi.fn(),
  deleteChecklist: vi.fn(),
  createChecklistItem: vi.fn(),
  updateChecklistItem: vi.fn(),
  deleteChecklistItem: vi.fn(),
  createLabel: vi.fn(),
  updateLabel: vi.fn(),
  deleteLabel: vi.fn(),
  assignLabelToCard: vi.fn(),
  removeLabelFromCard: vi.fn(),
  assignMemberToCard: vi.fn(),
  removeMemberFromCard: vi.fn(),
  createBoardComment: vi.fn(),
  createListComment: vi.fn(),
  createCardComment: vi.fn(),
  toggleCommentReaction: vi.fn(),
  deleteComment: vi.fn(),
  getArchivedLists: vi.fn(),
  archiveBoard: vi.fn(),
  archiveList: vi.fn(),
  archiveCard: vi.fn(),
  restoreBoard: vi.fn(),
  restoreList: vi.fn(),
  restoreCard: vi.fn()
}));

const getBoardByIdMock = vi.mocked(boardsApi.getBoardById);
const createListMock = vi.mocked(boardsApi.createList);
const deleteBoardMock = vi.mocked(boardsApi.deleteBoard);
const deleteListMock = vi.mocked(boardsApi.deleteList);
const reorderListsMock = vi.mocked(boardsApi.reorderLists);
const updateBoardMock = vi.mocked(boardsApi.updateBoard);
const updateListMock = vi.mocked(boardsApi.updateList);
const createCardMock = vi.mocked(boardsApi.createCard);
const updateCardMock = vi.mocked(boardsApi.updateCard);
const deleteCardMock = vi.mocked(boardsApi.deleteCard);
const moveCardMock = vi.mocked(boardsApi.moveCard);
const createChecklistMock = vi.mocked(boardsApi.createChecklist);
const updateChecklistMock = vi.mocked(boardsApi.updateChecklist);
const deleteChecklistMock = vi.mocked(boardsApi.deleteChecklist);
const createChecklistItemMock = vi.mocked(boardsApi.createChecklistItem);
const updateChecklistItemMock = vi.mocked(boardsApi.updateChecklistItem);
const deleteChecklistItemMock = vi.mocked(boardsApi.deleteChecklistItem);
const createBoardCommentMock = vi.mocked(boardsApi.createBoardComment);
const createListCommentMock = vi.mocked(boardsApi.createListComment);
const createCardCommentMock = vi.mocked(boardsApi.createCardComment);
const toggleCommentReactionMock = vi.mocked(boardsApi.toggleCommentReaction);
const deleteCommentMock = vi.mocked(boardsApi.deleteComment);
const getArchivedListsMock = vi.mocked(boardsApi.getArchivedLists);
const archiveBoardMock = vi.mocked(boardsApi.archiveBoard);
const archiveListMock = vi.mocked(boardsApi.archiveList);
const archiveCardMock = vi.mocked(boardsApi.archiveCard);
const restoreBoardMock = vi.mocked(boardsApi.restoreBoard);
const restoreListMock = vi.mocked(boardsApi.restoreList);
const restoreCardMock = vi.mocked(boardsApi.restoreCard);

const baseAuthor = {
  id: "user-1",
  name: "Jane Doe",
  email: "jane@example.com",
  role: "admin",
  createdAt: "2026-03-12T10:00:00.000Z"
};

const makeComment = (overrides: Partial<BoardComment>): BoardComment => ({
  id: "comment-1",
  boardId: "board-1",
  listId: null,
  cardId: null,
  author: baseAuthor,
  body: "Comment body",
  createdAt: "2026-03-12T10:00:00.000Z",
  updatedAt: "2026-03-12T10:00:00.000Z",
  reactions: [],
  mentions: [],
  ...overrides
});

const baseCard: BoardCard = {
  id: "card-1",
  listId: "list-1",
  title: "Initial card",
  description: "",
  priority: "medium",
  coverColor: "none",
  dueDate: null,
  position: 0,
  createdBy: "user-1",
  archivedAt: null,
  doneEnteredAt: null,
  createdAt: "2026-03-12T10:00:00.000Z",
  updatedAt: "2026-03-12T10:00:00.000Z",
  checklists: [],
  attachments: [],
  labels: [],
  assignees: [],
  comments: []
};

const listOne: BoardList = {
  id: "list-1",
  boardId: "board-1",
  name: "To Do",
  position: 0,
  isDoneList: false,
  archivedAt: null,
  createdAt: "2026-03-12T10:00:00.000Z",
  updatedAt: "2026-03-12T10:00:00.000Z",
  cards: [baseCard],
  comments: []
};

const listTwo: BoardList = {
  id: "list-2",
  boardId: "board-1",
  name: "Done",
  position: 1,
  isDoneList: true,
  archivedAt: null,
  createdAt: "2026-03-12T10:00:00.000Z",
  updatedAt: "2026-03-12T10:00:00.000Z",
  cards: [],
  comments: []
};

const baseBoard: BoardDetail = {
  id: "board-1",
  name: "Product Board",
  description: "",
  background: "teal-gradient",
  retentionMode: "card_and_attachments",
  retentionMinutes: 10080,
  archiveRetentionMinutes: 10080,
  archivedAt: null,
  createdBy: "user-1",
  createdAt: "2026-03-12T10:00:00.000Z",
  updatedAt: "2026-03-12T10:00:00.000Z",
  lists: [listOne, listTwo],
  labels: [],
  members: [],
  comments: []
};

function cloneBoard(): BoardDetail {
  return JSON.parse(JSON.stringify(baseBoard)) as BoardDetail;
}

function renderBoardPage(): void {
  render(
    <MemoryRouter initialEntries={["/boards/board-1"]}>
      <Routes>
        <Route path="/boards/:boardId" element={<BoardDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();

  getBoardByIdMock.mockResolvedValue(cloneBoard());

  createListMock.mockResolvedValue({
    id: "list-3",
    boardId: "board-1",
    name: "New List",
    position: 2,
    isDoneList: false,
    archivedAt: null,
    createdAt: "2026-03-12T10:00:00.000Z",
    updatedAt: "2026-03-12T10:00:00.000Z",
    cards: [],
    comments: []
  });

  deleteBoardMock.mockResolvedValue({ message: "Board deleted" });
  deleteListMock.mockResolvedValue({ message: "List deleted" });
  reorderListsMock.mockResolvedValue([listOne, listTwo]);
  updateBoardMock.mockResolvedValue(cloneBoard());
  updateListMock.mockResolvedValue({
    ...listOne,
    cards: [],
    comments: []
  });
  createCardMock.mockResolvedValue({
    ...baseCard,
    id: "card-2",
    title: "Created card",
    position: 1
  });
  updateCardMock.mockResolvedValue(baseCard);
  deleteCardMock.mockResolvedValue({ message: "Card deleted" });
  createChecklistMock.mockResolvedValue({
    id: "checklist-1",
    cardId: baseCard.id,
    title: "Checklist",
    position: 0,
    createdAt: "2026-03-12T10:00:00.000Z",
    updatedAt: "2026-03-12T10:00:00.000Z",
    items: []
  });
  updateChecklistMock.mockResolvedValue({
    id: "checklist-1",
    cardId: baseCard.id,
    title: "Checklist",
    position: 0,
    createdAt: "2026-03-12T10:00:00.000Z",
    updatedAt: "2026-03-12T10:00:00.000Z",
    items: []
  });
  deleteChecklistMock.mockResolvedValue({ message: "Checklist deleted" });
  createChecklistItemMock.mockResolvedValue({
    id: "item-1",
    checklistId: "checklist-1",
    title: "Checklist item",
    isDone: false,
    position: 0,
    createdAt: "2026-03-12T10:00:00.000Z",
    updatedAt: "2026-03-12T10:00:00.000Z"
  });
  updateChecklistItemMock.mockResolvedValue({
    id: "item-1",
    checklistId: "checklist-1",
    title: "Checklist item",
    isDone: false,
    position: 0,
    createdAt: "2026-03-12T10:00:00.000Z",
    updatedAt: "2026-03-12T10:00:00.000Z"
  });
  deleteChecklistItemMock.mockResolvedValue({ message: "Checklist item deleted" });
  moveCardMock.mockResolvedValue({
    sourceListId: "list-1",
    destinationListId: "list-1",
    sourceCards: [baseCard],
    destinationCards: [baseCard]
  });
  createBoardCommentMock.mockResolvedValue({
    id: "comment-1",
    boardId: baseBoard.id,
    listId: null,
    cardId: null,
    author: { id: "user-1", name: "Jane Doe", email: "jane@example.com", role: "admin", createdAt: "2026-03-12T10:00:00.000Z" },
    body: "Board note",
    createdAt: "2026-03-12T10:00:00.000Z",
    updatedAt: "2026-03-12T10:00:00.000Z",
    reactions: [],
    mentions: []
  });
  createListCommentMock.mockResolvedValue({
    id: "comment-2",
    boardId: baseBoard.id,
    listId: listOne.id,
    cardId: null,
    author: { id: "user-1", name: "Jane Doe", email: "jane@example.com", role: "admin", createdAt: "2026-03-12T10:00:00.000Z" },
    body: "List note",
    createdAt: "2026-03-12T10:00:00.000Z",
    updatedAt: "2026-03-12T10:00:00.000Z",
    reactions: [],
    mentions: []
  });
  createCardCommentMock.mockResolvedValue({
    id: "comment-3",
    boardId: baseBoard.id,
    listId: null,
    cardId: baseCard.id,
    author: { id: "user-1", name: "Jane Doe", email: "jane@example.com", role: "admin", createdAt: "2026-03-12T10:00:00.000Z" },
    body: "Card note",
    createdAt: "2026-03-12T10:00:00.000Z",
    updatedAt: "2026-03-12T10:00:00.000Z",
    reactions: [],
    mentions: []
  });
  toggleCommentReactionMock.mockResolvedValue({
    id: "comment-3",
    boardId: baseBoard.id,
    listId: null,
    cardId: baseCard.id,
    author: { id: "user-1", name: "Jane Doe", email: "jane@example.com", role: "admin", createdAt: "2026-03-12T10:00:00.000Z" },
    body: "Card note",
    createdAt: "2026-03-12T10:00:00.000Z",
    updatedAt: "2026-03-12T10:00:00.000Z",
    reactions: [{ emoji: "👍", count: 1 }],
    mentions: []
  });
  deleteCommentMock.mockResolvedValue({ message: "Comment deleted" });
  getArchivedListsMock.mockResolvedValue([]);
  archiveBoardMock.mockResolvedValue({ message: "Board archived" });
  archiveListMock.mockResolvedValue({ message: "List archived" });
  archiveCardMock.mockResolvedValue({ message: "Card archived" });
  restoreBoardMock.mockResolvedValue({ message: "Board restored" });
  restoreListMock.mockResolvedValue(baseBoard);
  restoreCardMock.mockResolvedValue(baseCard);
});

describe("BoardDetailPage cards", () => {
  it("creates a card in a list", async () => {
    createCardMock.mockResolvedValue({
      ...baseCard,
      id: "card-2",
      title: "New card from form",
      position: 1
    });

    renderBoardPage();

    await waitFor(() => {
      expect(getBoardByIdMock).toHaveBeenCalledWith("board-1");
    });

    const list = await screen.findByTestId("list-list-1");
    const listScope = within(list);

    fireEvent.change(listScope.getByPlaceholderText("New card title"), {
      target: { value: "New card from form" }
    });
    fireEvent.click(listScope.getByRole("button", { name: "Add Card" }));

    await waitFor(() => {
      expect(createCardMock).toHaveBeenCalledWith("list-1", {
        title: "New card from form"
      });
    });

    expect(await screen.findByText("New card from form")).toBeInTheDocument();
  });

  it("opens card modal and saves card updates", async () => {
    updateCardMock.mockResolvedValue({
      ...baseCard,
      title: "Updated card title",
      updatedAt: "2026-03-12T10:05:00.000Z"
    });

    renderBoardPage();

    const existingCard = await screen.findByText("Initial card");
    fireEvent.click(existingCard);

    expect(await screen.findByText("Edit Card")).toBeInTheDocument();

    vi.useFakeTimers();

    fireEvent.change(screen.getByPlaceholderText("Card title"), {
      target: { value: "Updated card title" }
    });

    await vi.advanceTimersByTimeAsync(2100);

    expect(updateCardMock).toHaveBeenCalledWith(
      "card-1",
      expect.objectContaining({
        title: "Updated card title"
      })
    );

    vi.useRealTimers();

    expect(await screen.findByText("Updated card title")).toBeInTheDocument();
  });

  it("creates a checklist from the card modal", async () => {
    createChecklistMock.mockResolvedValue({
      id: "checklist-1",
      cardId: baseCard.id,
      title: "Launch checklist",
      position: 0,
      createdAt: "2026-03-12T10:00:00.000Z",
      updatedAt: "2026-03-12T10:00:00.000Z",
      items: []
    });

    renderBoardPage();

    fireEvent.click(await screen.findByText("Initial card"));

    const input = await screen.findByPlaceholderText("New checklist title");
    fireEvent.change(input, { target: { value: "Launch checklist" } });
    fireEvent.click(screen.getByRole("button", { name: "Add checklist" }));

    await waitFor(() => {
      expect(createChecklistMock).toHaveBeenCalledWith("card-1", { title: "Launch checklist" });
    });

    expect(await screen.findByDisplayValue("Launch checklist")).toBeInTheDocument();
  });

  it("deletes a card after confirmation", async () => {
    renderBoardPage();

    fireEvent.click(await screen.findByText("Initial card"));
    fireEvent.click(await screen.findByRole("button", { name: "Delete card" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(deleteCardMock).toHaveBeenCalledWith("card-1");
    });

    await waitFor(() => {
      expect(screen.queryByText("Initial card")).not.toBeInTheDocument();
    });
  });
});


describe("BoardDetailPage comments and archive", () => {
  it("creates a board note", async () => {
    renderBoardPage();

    const input = await screen.findByPlaceholderText("Add a board note");
    fireEvent.change(input, { target: { value: "Board note" } });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));

    await waitFor(() => {
      expect(createBoardCommentMock).toHaveBeenCalledWith("board-1", {
        body: "Board note",
        mentions: []
      });
    });
  });

  it("expands list comments", async () => {
    const boardWithComments = cloneBoard();
    boardWithComments.lists[0].comments = [
      makeComment({ id: "comment-1", boardId: boardWithComments.id, listId: boardWithComments.lists[0].id, body: "First list note" }),
      makeComment({ id: "comment-2", boardId: boardWithComments.id, listId: boardWithComments.lists[0].id, body: "Second list note" }),
      makeComment({ id: "comment-3", boardId: boardWithComments.id, listId: boardWithComments.lists[0].id, body: "Third list note" })
    ];
    getBoardByIdMock.mockResolvedValue(boardWithComments);

    renderBoardPage();

    const list = await screen.findByTestId("list-list-1");
    const listScope = within(list);

    expect(listScope.queryByText("Third list note")).not.toBeInTheDocument();
    fireEvent.click(listScope.getByRole("button", { name: /show all/i }));

    expect(await listScope.findByText("Third list note")).toBeInTheDocument();

    fireEvent.click(listScope.getByRole("button", { name: /show less/i }));
    expect(listScope.queryByText("Third list note")).not.toBeInTheDocument();
  });

  it("opens archived lists modal", async () => {
    renderBoardPage();

    fireEvent.click(await screen.findByRole("button", { name: "Archived lists" }));

    expect(await screen.findByRole("heading", { name: "Archived lists" })).toBeInTheDocument();
    expect(getArchivedListsMock).toHaveBeenCalledWith("board-1");
  });
});
