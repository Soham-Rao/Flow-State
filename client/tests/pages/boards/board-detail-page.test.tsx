import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BoardDetailPage } from "@/pages/boards/board-detail-page";
import type { BoardCard, BoardDetail, BoardList } from "@/types/board";
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
  deleteChecklistItem: vi.fn()
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

const baseCard: BoardCard = {
  id: "card-1",
  listId: "list-1",
  title: "Initial card",
  description: "",
  priority: "medium",
  dueDate: null,
  position: 0,
  createdBy: "user-1",
  archivedAt: null,
  doneEnteredAt: null,
  createdAt: "2026-03-12T10:00:00.000Z",
  updatedAt: "2026-03-12T10:00:00.000Z",
  checklists: [],
  attachments: []
};

const listOne: BoardList = {
  id: "list-1",
  boardId: "board-1",
  name: "To Do",
  position: 0,
  isDoneList: false,
  createdAt: "2026-03-12T10:00:00.000Z",
  updatedAt: "2026-03-12T10:00:00.000Z",
  cards: [baseCard]
};

const listTwo: BoardList = {
  id: "list-2",
  boardId: "board-1",
  name: "Done",
  position: 1,
  isDoneList: true,
  createdAt: "2026-03-12T10:00:00.000Z",
  updatedAt: "2026-03-12T10:00:00.000Z",
  cards: []
};

const baseBoard: BoardDetail = {
  id: "board-1",
  name: "Product Board",
  description: "",
  background: "teal-gradient",
  retentionMode: "card_and_attachments",
  retentionMinutes: 10080,
  createdBy: "user-1",
  createdAt: "2026-03-12T10:00:00.000Z",
  updatedAt: "2026-03-12T10:00:00.000Z",
  lists: [listOne, listTwo]
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
    createdAt: "2026-03-12T10:00:00.000Z",
    updatedAt: "2026-03-12T10:00:00.000Z",
    cards: []
  });

  deleteBoardMock.mockResolvedValue({ message: "Board deleted" });
  deleteListMock.mockResolvedValue({ message: "List deleted" });
  reorderListsMock.mockResolvedValue([listOne, listTwo]);
  updateBoardMock.mockResolvedValue(cloneBoard());
  updateListMock.mockResolvedValue({
    ...listOne,
    cards: []
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
