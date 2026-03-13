import { apiRequest } from "@/lib/api-client";
import { getSessionToken } from "@/lib/session";
import type {
  BoardBackground,
  BoardCard,
  BoardAttachment,
  BoardDetail,
  BoardList,
  BoardSummary,
  CardPriority,
  Checklist,
  ChecklistItem,
  MoveCardResult
} from "@/types/board";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

interface CreateBoardInput {
  name: string;
  description?: string;
  background: BoardBackground;
  retentionMode?: "attachments_only" | "card_and_attachments";
  retentionMinutes?: number;
}

interface UpdateBoardInput {
  name?: string;
  description?: string;
  background?: BoardBackground;
  retentionMode?: "attachments_only" | "card_and_attachments";
  retentionMinutes?: number;
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

interface CreateChecklistInput {
  title: string;
}

interface UpdateChecklistInput {
  title?: string;
}

interface CreateChecklistItemInput {
  title: string;
}

interface UpdateChecklistItemInput {
  title?: string;
  isDone?: boolean;
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


export function createChecklist(cardId: string, input: CreateChecklistInput): Promise<Checklist> {
  return apiRequest<Checklist>(`/boards/cards/${cardId}/checklists`, {
    method: "POST",
    auth: true,
    body: JSON.stringify(input)
  });
}

export function updateChecklist(checklistId: string, input: UpdateChecklistInput): Promise<Checklist> {
  return apiRequest<Checklist>(`/boards/checklists/${checklistId}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(input)
  });
}

export function deleteChecklist(checklistId: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/boards/checklists/${checklistId}`, {
    method: "DELETE",
    auth: true
  });
}

export function createChecklistItem(
  checklistId: string,
  input: CreateChecklistItemInput
): Promise<ChecklistItem> {
  return apiRequest<ChecklistItem>(`/boards/checklists/${checklistId}/items`, {
    method: "POST",
    auth: true,
    body: JSON.stringify(input)
  });
}

export function updateChecklistItem(
  itemId: string,
  input: UpdateChecklistItemInput
): Promise<ChecklistItem> {
  return apiRequest<ChecklistItem>(`/boards/checklist-items/${itemId}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(input)
  });
}

export function deleteChecklistItem(itemId: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/boards/checklist-items/${itemId}`, {
    method: "DELETE",
    auth: true
  });
}


export async function createAttachments(cardId: string, files: File[]): Promise<BoardAttachment[]> {
  const token = getSessionToken();
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  const response = await fetch(`${API_BASE_URL}/boards/cards/${cardId}/attachments`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData
  });

  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; data?: BoardAttachment[]; error?: { message?: string } }
    | null;

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error?.message ?? "Attachment upload failed");
  }

  return payload.data ?? [];
}

export async function deleteAttachment(attachmentId: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/boards/attachments/${attachmentId}`, {
    method: "DELETE",
    auth: true
  });
}

export async function downloadAttachment(attachmentId: string, filename: string): Promise<void> {
  const token = getSessionToken();
  const response = await fetch(`${API_BASE_URL}/boards/attachments/${attachmentId}/download`, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });

  if (!response.ok) {
    throw new Error("Failed to download attachment");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
