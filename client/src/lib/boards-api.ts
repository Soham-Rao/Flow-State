import { apiRequest } from "@/lib/api-client";
import type {
  BoardBackground,
  BoardCard,
  BoardDetail,
  BoardList,
  BoardSummary,
  CardPriority,
  MoveCardResult
} from "@/types/board";

interface CreateBoardInput {
  name: string;
  description?: string;
  background: BoardBackground;
}

interface UpdateBoardInput {
  name?: string;
  description?: string;
  background?: BoardBackground;
}

interface CreateListInput {
  name: string;
  isDoneList: boolean;
}

interface UpdateListInput {
  name?: string;
  isDoneList?: boolean;
}

interface CreateCardInput {
  title: string;
  description?: string;
  priority?: CardPriority;
  dueDate?: string;
}

interface UpdateCardInput {
  title?: string;
  description?: string;
  priority?: CardPriority;
  dueDate?: string | null;
}

interface MoveCardInput {
  cardId: string;
  sourceListId: string;
  destinationListId: string;
  destinationIndex: number;
}

export function getBoards(): Promise<BoardSummary[]> {
  return apiRequest<BoardSummary[]>("/boards", {
    method: "GET",
    auth: true
  });
}

export function getBoardById(boardId: string): Promise<BoardDetail> {
  return apiRequest<BoardDetail>(`/boards/${boardId}`, {
    method: "GET",
    auth: true
  });
}

export function createBoard(input: CreateBoardInput): Promise<BoardDetail> {
  return apiRequest<BoardDetail>("/boards", {
    method: "POST",
    auth: true,
    body: JSON.stringify(input)
  });
}

export function updateBoard(boardId: string, input: UpdateBoardInput): Promise<BoardDetail> {
  return apiRequest<BoardDetail>(`/boards/${boardId}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(input)
  });
}

export function deleteBoard(boardId: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/boards/${boardId}`, {
    method: "DELETE",
    auth: true
  });
}

export function createList(boardId: string, input: CreateListInput): Promise<BoardList> {
  return apiRequest<BoardList>(`/boards/${boardId}/lists`, {
    method: "POST",
    auth: true,
    body: JSON.stringify(input)
  });
}

export function updateList(listId: string, input: UpdateListInput): Promise<BoardList> {
  return apiRequest<BoardList>(`/boards/lists/${listId}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(input)
  });
}

export function deleteList(listId: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/boards/lists/${listId}`, {
    method: "DELETE",
    auth: true
  });
}

export function reorderLists(boardId: string, listIds: string[]): Promise<BoardList[]> {
  return apiRequest<BoardList[]>(`/boards/${boardId}/lists/reorder`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ listIds })
  });
}

export function createCard(listId: string, input: CreateCardInput): Promise<BoardCard> {
  return apiRequest<BoardCard>(`/boards/lists/${listId}/cards`, {
    method: "POST",
    auth: true,
    body: JSON.stringify(input)
  });
}

export function updateCard(cardId: string, input: UpdateCardInput): Promise<BoardCard> {
  return apiRequest<BoardCard>(`/boards/cards/${cardId}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(input)
  });
}

export function deleteCard(cardId: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/boards/cards/${cardId}`, {
    method: "DELETE",
    auth: true
  });
}

export function moveCard(input: MoveCardInput): Promise<MoveCardResult> {
  return apiRequest<MoveCardResult>("/boards/cards/move", {
    method: "POST",
    auth: true,
    body: JSON.stringify(input)
  });
}
