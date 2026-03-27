import type { ActivityLogEntry } from "@/types/activity";

function getActorName(entry: ActivityLogEntry): string {
  return entry.actor.displayName || entry.actor.name || "Someone";
}

function getMetadataString(metadata: Record<string, unknown> | null, key: string): string | null {
  if (!metadata) return null;
  const value = metadata[key];
  return typeof value === "string" ? value : null;
}

export function formatActivityLabel(entry: ActivityLogEntry, currentUserId?: string | null): string {
  const actor = getActorName(entry);
  const metadata = entry.metadata ?? null;
  const boardName = getMetadataString(metadata, "boardName");
  const listName = getMetadataString(metadata, "listName");
  const cardTitle = getMetadataString(metadata, "cardTitle");
  const toListName = getMetadataString(metadata, "toListName");
  const checklistTitle = getMetadataString(metadata, "checklistTitle");
  const itemTitle = getMetadataString(metadata, "itemTitle");

  switch (entry.type) {
    case "board.created":
      return actor + " created board " + (boardName ?? "a board");
    case "board.updated":
      return actor + " updated board " + (boardName ?? "a board");
    case "board.archived":
      return actor + " archived board " + (boardName ?? "a board");
    case "board.restored":
      return actor + " restored board " + (boardName ?? "a board");
    case "board.deleted":
      return actor + " deleted board " + (boardName ?? "a board");
    case "list.created":
      return actor + " created list " + (listName ?? "a list");
    case "list.updated":
      return actor + " updated list " + (listName ?? "a list");
    case "list.deleted":
      return actor + " deleted list " + (listName ?? "a list");
    case "list.archived":
      return actor + " archived list " + (listName ?? "a list");
    case "list.restored":
      return actor + " restored list " + (listName ?? "a list");
    case "list.reordered":
      return actor + " reordered lists";
    case "card.created":
      return actor + " created card " + (cardTitle ?? "a card");
    case "card.updated":
      return actor + " updated card " + (cardTitle ?? "a card");
    case "card.deleted":
      return actor + " deleted card " + (cardTitle ?? "a card");
    case "card.archived":
      return actor + " archived card " + (cardTitle ?? "a card");
    case "card.restored":
      return actor + " restored card " + (cardTitle ?? "a card");
    case "card.moved":
      return actor + " moved " + (cardTitle ? "" + cardTitle + "" : "a card") + (toListName ? " to " + toListName : "");
    case "comment.created":
      return actor + " commented";
    case "mention.board": {
      const isSelfMention = currentUserId && entry.mentionedUserId === currentUserId;
      return actor + " mentioned " + (isSelfMention ? "you" : "someone");
    }
    case "mention.thread": {
      const isSelfMention = currentUserId && entry.mentionedUserId === currentUserId;
      return actor + " mentioned " + (isSelfMention ? "you" : "someone");
    }
    case "checklist.created":
      return actor + " added checklist " + (checklistTitle ?? "a checklist");
    case "checklist.updated":
      return actor + " updated checklist " + (checklistTitle ?? "a checklist");
    case "checklist.deleted":
      return actor + " deleted checklist " + (checklistTitle ?? "a checklist");
    case "checklist.item.created":
      return actor + " added checklist item " + (itemTitle ?? "an item");
    case "checklist.item.updated":
      return actor + " updated checklist item " + (itemTitle ?? "an item");
    case "checklist.item.deleted":
      return actor + " deleted checklist item " + (itemTitle ?? "an item");
    case "checklist.item.completed":
      return actor + " completed checklist item " + (itemTitle ?? "an item");
    case "checklist.item.uncompleted":
      return actor + " reopened checklist item " + (itemTitle ?? "an item");
    default:
      return actor + " " + entry.type.replace(/[._]/g, " ");
  }
}

export function formatActivityTime(entry: ActivityLogEntry): string {
  const date = new Date(entry.createdAt);
  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function getActivitySnippet(entry: ActivityLogEntry): string | null {
  return getMetadataString(entry.metadata ?? null, "snippet");
}

