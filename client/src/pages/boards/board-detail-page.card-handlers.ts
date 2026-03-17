import { useCallback, useEffect } from "react";
import type React from "react";
import {
  archiveCard,
  assignLabelToCard,
  assignMemberToCard,
  createAttachments,
  createCardComment,
  createChecklist,
  createChecklistItem,
  deleteAttachment,
  deleteCard,
  deleteChecklist,
  deleteChecklistItem,
  downloadAttachment,
  removeLabelFromCard,
  removeMemberFromCard,
  updateCard,
  updateChecklist,
  updateChecklistItem
} from "@/lib/boards-api";
import { extractMentionIds } from "@/lib/mentions";
import type {
  BoardAttachment,
  BoardCard,
  BoardDetail,
  BoardList,
  BoardMember,
  Checklist,
  ChecklistItem
} from "@/types/board";
import {
  buildCardDraft,
  isCardDraftEqual,
  sortAttachments,
  sortCardsByPosition,
  sortChecklistItems,
  sortChecklists,
  toIsoFromDateTimeInput,
  trimOrNull,
  CardDraft,
  CARD_AUTO_SAVE_DELAY_MS
} from "@/pages/boards/board-detail-page.utils";

export interface BoardDetailCardHandlersParams {
  boardMembers: BoardMember[];
  selectedCardWithList: { card: BoardCard; list: BoardList } | null;
  selectedCardId: string | null;
  cardDraft: CardDraft | null;
  cardToDelete: BoardCard | null;
  setBoard: React.Dispatch<React.SetStateAction<BoardDetail | null>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  triggerSavedNotice: () => void;
  setSelectedCardId: React.Dispatch<React.SetStateAction<string | null>>;
  setCardDraft: React.Dispatch<React.SetStateAction<CardDraft | null>>;
  setCardSaveStatus: React.Dispatch<React.SetStateAction<"idle" | "saving" | "saved">>;
  setNewCardComment: React.Dispatch<React.SetStateAction<string>>;
  setNewChecklistTitle: React.Dispatch<React.SetStateAction<string>>;
  setNewChecklistItemTitles: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setChecklistTitleDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setChecklistItemTitleDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setChecklistToDelete: React.Dispatch<React.SetStateAction<Checklist | null>>;
  setChecklistItemToDelete: React.Dispatch<React.SetStateAction<{ item: ChecklistItem; cardId: string } | null>>;
  setAttachmentError: React.Dispatch<React.SetStateAction<string | null>>;
  setIsUploadingAttachments: React.Dispatch<React.SetStateAction<boolean>>;
  setScrollToChecklistId: React.Dispatch<React.SetStateAction<string | null>>;
  setCardToDelete: React.Dispatch<React.SetStateAction<BoardCard | null>>;
  lastSyncedCardRef: React.MutableRefObject<CardDraft | null>;
  cardAutoSaveTimeoutRef: React.MutableRefObject<number | null>;
  checklistSectionRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  scrollToChecklistId: string | null;
  checklistTitleDrafts: Record<string, string>;
  checklistItemTitleDrafts: Record<string, string>;
  newChecklistItemTitles: Record<string, string>;
  newChecklistTitle: string;
  newCardComment: string;
  checklistToDelete: Checklist | null;
  checklistItemToDelete: { item: ChecklistItem; cardId: string } | null;
  isArchivedOpen: boolean;
  loadArchivedLists: () => Promise<void>;
  clearCardAutosaveTimeout: () => void;
}

export function useBoardDetailCardHandlers({
  boardMembers,
  selectedCardWithList,
  selectedCardId,
  cardDraft,
  cardToDelete,
  setBoard,
  setError,
  triggerSavedNotice,
  setSelectedCardId,
  setCardDraft,
  setCardSaveStatus,
  setNewCardComment,
  setNewChecklistTitle,
  setNewChecklistItemTitles,
  setChecklistTitleDrafts,
  setChecklistItemTitleDrafts,
  setChecklistToDelete,
  setChecklistItemToDelete,
  setAttachmentError,
  setIsUploadingAttachments,
  setScrollToChecklistId,
  setCardToDelete,
  lastSyncedCardRef,
  cardAutoSaveTimeoutRef,
  checklistSectionRefs,
  scrollToChecklistId,
  checklistTitleDrafts,
  checklistItemTitleDrafts,
  newChecklistItemTitles,
  newChecklistTitle,
  checklistToDelete,
  checklistItemToDelete,
  newCardComment,
  isArchivedOpen,
  loadArchivedLists,
  clearCardAutosaveTimeout
}: BoardDetailCardHandlersParams): {
  openCardEditor: (card: BoardCard, checklistId?: string) => void;
  closeCardEditor: () => void;
  handleCardDraftChange: (updater: (current: CardDraft) => CardDraft) => void;
  onArchiveCard: () => Promise<void>;
  onDeleteCard: () => Promise<void>;
  onToggleCardLabel: (cardId: string, labelId: string, nextValue: boolean) => Promise<void>;
  onToggleAssignee: (cardId: string, userId: string, nextValue: boolean) => Promise<void>;
  onCreateCardComment: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onCreateChecklist: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onSaveChecklistTitle: (cardId: string, checklist: Checklist) => Promise<void>;
  onDeleteChecklist: () => Promise<void>;
  onCreateChecklistItem: (cardId: string, checklistId: string, event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onSaveChecklistItemTitle: (cardId: string, checklistId: string, item: ChecklistItem) => Promise<void>;
  onToggleChecklistItem: (cardId: string, checklistId: string, item: ChecklistItem, nextValue: boolean) => Promise<void>;
  onDeleteChecklistItem: () => Promise<void>;
  onUploadAttachments: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onDownloadAttachment: (attachment: BoardAttachment) => Promise<void>;
  onDownloadAllAttachments: (card: BoardCard) => Promise<void>;
  onDeleteAttachment: (attachmentId: string) => Promise<void>;
} {
  const updateCardInBoard = useCallback((cardId: string, updater: (card: BoardCard) => BoardCard): void => {
    setBoard((current) => {
      if (!current) return current;
      return {
        ...current,
        lists: current.lists.map((list) => ({
          ...list,
          cards: list.cards.map((card) => (card.id === cardId ? updater(card) : card))
        }))
      };
    });
  }, [setBoard]);

  const replaceCardInBoard = useCallback((updated: BoardCard): void => {
    setBoard((current) => {
      if (!current) return current;
      return {
        ...current,
        lists: current.lists.map((list) => {
          if (list.id !== updated.listId) return list;
          const exists = list.cards.some((card) => card.id === updated.id);
          const nextCards = exists
            ? list.cards.map((card) => (card.id === updated.id ? updated : card))
            : [...list.cards, updated];
          return { ...list, cards: sortCardsByPosition(nextCards) };
        })
      };
    });
  }, [setBoard]);

  const updateCardChecklists = useCallback(
    (cardId: string, updater: (checklists: Checklist[]) => Checklist[]): void => {
      updateCardInBoard(cardId, (card) => ({
        ...card,
        checklists: sortChecklists(updater(card.checklists ?? []))
      }));
    },
    [updateCardInBoard]
  );

  const updateChecklistInCard = useCallback(
    (cardId: string, checklistId: string, updater: (checklist: Checklist) => Checklist): void => {
      updateCardChecklists(cardId, (checklists) =>
        checklists.map((checklist) => (checklist.id === checklistId ? updater(checklist) : checklist))
      );
    },
    [updateCardChecklists]
  );

  const updateChecklistItemsInCard = useCallback(
    (cardId: string, checklistId: string, updater: (items: ChecklistItem[]) => ChecklistItem[]): void => {
      updateChecklistInCard(cardId, checklistId, (checklist) => ({
        ...checklist,
        items: sortChecklistItems(updater(checklist.items ?? []))
      }));
    },
    [updateChecklistInCard]
  );

  const updateCardAttachments = useCallback(
    (cardId: string, updater: (attachments: BoardAttachment[]) => BoardAttachment[]): void => {
      updateCardInBoard(cardId, (card) => ({
        ...card,
        attachments: sortAttachments(updater(card.attachments ?? []))
      }));
    },
    [updateCardInBoard]
  );

  const onToggleCardLabel = async (cardId: string, labelId: string, nextValue: boolean): Promise<void> => {
    try {
      const updated = nextValue
        ? await assignLabelToCard(cardId, labelId)
        : await removeLabelFromCard(cardId, labelId);
      replaceCardInBoard(updated);
      setError(null);
      triggerSavedNotice();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Failed to update label");
    }
  };

  const onToggleAssignee = async (cardId: string, userId: string, nextValue: boolean): Promise<void> => {
    try {
      const updated = nextValue
        ? await assignMemberToCard(cardId, userId)
        : await removeMemberFromCard(cardId, userId);
      replaceCardInBoard(updated);
      setError(null);
      triggerSavedNotice();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Failed to update assignees");
    }
  };

  const onCreateCardComment = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!selectedCardWithList) return;
    const body = newCardComment.trim();
    if (body.length < 1) return;
    try {
      const mentions = extractMentionIds(body, boardMembers);
      const created = await createCardComment(selectedCardWithList.card.id, { body, mentions });
      updateCardInBoard(selectedCardWithList.card.id, (card) => ({
        ...card,
        comments: [...(card.comments ?? []), created]
      }));
      setNewCardComment("");
      setError(null);
      triggerSavedNotice();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to add comment");
    }
  };

  const onCreateChecklist = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!selectedCardWithList) return;
    const title = newChecklistTitle.trim();
    if (title.length < 1) { setError("Checklist title cannot be empty."); return; }
    try {
      const created = await createChecklist(selectedCardWithList.card.id, { title });
      updateCardChecklists(selectedCardWithList.card.id, (checklists) => [...checklists, created]);
      setNewChecklistTitle("");
      setError(null);
      triggerSavedNotice();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create checklist");
    }
  };

  const onSaveChecklistTitle = async (cardId: string, checklist: Checklist): Promise<void> => {
    const draft = checklistTitleDrafts[checklist.id] ?? checklist.title;
    const title = draft.trim();
    if (title.length < 1) {
      setChecklistTitleDrafts((current) => ({ ...current, [checklist.id]: checklist.title }));
      setError("Checklist title cannot be empty.");
      return;
    }
    if (title === checklist.title) return;
    try {
      const updated = await updateChecklist(checklist.id, { title });
      updateChecklistInCard(cardId, checklist.id, () => updated);
      setChecklistTitleDrafts((current) => ({ ...current, [checklist.id]: updated.title }));
      setError(null);
      triggerSavedNotice();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update checklist");
    }
  };

  const onDeleteChecklist = async (): Promise<void> => {
    if (!checklistToDelete) return;
    try {
      await deleteChecklist(checklistToDelete.id);
      updateCardChecklists(checklistToDelete.cardId, (checklists) =>
        checklists.filter((checklist) => checklist.id !== checklistToDelete.id)
      );
      setChecklistTitleDrafts((current) => {
        const next = { ...current };
        delete next[checklistToDelete.id];
        return next;
      });
      setChecklistItemTitleDrafts((current) => {
        const next = { ...current };
        checklistToDelete.items.forEach((item) => {
          delete next[item.id];
        });
        return next;
      });
      setNewChecklistItemTitles((current) => {
        const next = { ...current };
        delete next[checklistToDelete.id];
        return next;
      });
      setChecklistToDelete(null);
      setError(null);
      triggerSavedNotice();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete checklist");
    }
  };

  const onCreateChecklistItem = async (
    cardId: string,
    checklistId: string,
    event: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();
    const title = (newChecklistItemTitles[checklistId] ?? "").trim();
    if (title.length < 1) { setError("Checklist item cannot be empty."); return; }
    try {
      const created = await createChecklistItem(checklistId, { title });
      updateChecklistItemsInCard(cardId, checklistId, (items) => [...items, created]);
      setNewChecklistItemTitles((current) => ({ ...current, [checklistId]: "" }));
      setError(null);
      triggerSavedNotice();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create checklist item");
    }
  };

  const onSaveChecklistItemTitle = async (
    cardId: string,
    checklistId: string,
    item: ChecklistItem
  ): Promise<void> => {
    const draft = checklistItemTitleDrafts[item.id] ?? item.title;
    const title = draft.trim();
    if (title.length < 1) {
      setChecklistItemTitleDrafts((current) => ({ ...current, [item.id]: item.title }));
      setError("Checklist item cannot be empty.");
      return;
    }
    if (title === item.title) return;
    try {
      const updated = await updateChecklistItem(item.id, { title });
      updateChecklistItemsInCard(cardId, checklistId, (items) =>
        items.map((entry) => (entry.id === item.id ? updated : entry))
      );
      setChecklistItemTitleDrafts((current) => ({ ...current, [item.id]: updated.title }));
      setError(null);
      triggerSavedNotice();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update checklist item");
    }
  };

  const onToggleChecklistItem = async (
    cardId: string,
    checklistId: string,
    item: ChecklistItem,
    nextValue: boolean
  ): Promise<void> => {
    try {
      const updated = await updateChecklistItem(item.id, { isDone: nextValue });
      updateChecklistItemsInCard(cardId, checklistId, (items) =>
        items.map((entry) => (entry.id === item.id ? updated : entry))
      );
      setError(null);
      triggerSavedNotice();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update checklist item");
    }
  };

  const onDeleteChecklistItem = async (): Promise<void> => {
    if (!checklistItemToDelete) return;
    const { item, cardId } = checklistItemToDelete;
    try {
      await deleteChecklistItem(item.id);
      updateChecklistItemsInCard(cardId, item.checklistId, (items) =>
        items.filter((entry) => entry.id !== item.id)
      );
      setChecklistItemTitleDrafts((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      setChecklistItemToDelete(null);
      setError(null);
      triggerSavedNotice();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete checklist item");
    }
  };

  const onUploadAttachments = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    if (!selectedCardWithList) return;
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    setIsUploadingAttachments(true);
    setAttachmentError(null);
    try {
      const created = await createAttachments(selectedCardWithList.card.id, files);
      updateCardAttachments(selectedCardWithList.card.id, (current) => [...current, ...created]);
      triggerSavedNotice();
    } catch (uploadError) {
      setAttachmentError(uploadError instanceof Error ? uploadError.message : "Failed to upload attachments");
    } finally {
      setIsUploadingAttachments(false);
      event.target.value = "";
    }
  };

  const onDownloadAttachment = async (attachment: BoardAttachment): Promise<void> => {
    try {
      await downloadAttachment(attachment.id, attachment.originalName);
      setAttachmentError(null);
    } catch (downloadError) {
      setAttachmentError(downloadError instanceof Error ? downloadError.message : "Failed to download attachment");
    }
  };

  const onDownloadAllAttachments = useCallback(async (card: BoardCard): Promise<void> => {
    const attachments = sortAttachments(card.attachments ?? []);
    if (attachments.length === 0) return;
    try {
      for (const attachment of attachments) {
        await downloadAttachment(attachment.id, attachment.originalName);
      }
      setError(null);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Failed to download attachments");
    }
  }, [setError]);

  const onDeleteAttachment = async (attachmentId: string): Promise<void> => {
    if (!selectedCardWithList) return;
    try {
      await deleteAttachment(attachmentId);
      updateCardAttachments(selectedCardWithList.card.id, (current) =>
        current.filter((attachment) => attachment.id !== attachmentId)
      );
      setAttachmentError(null);
      triggerSavedNotice();
    } catch (deleteError) {
      setAttachmentError(deleteError instanceof Error ? deleteError.message : "Failed to delete attachment");
    }
  };

  const openCardEditor = (card: BoardCard, checklistId?: string): void => {
    const draft = buildCardDraft(card);
    setSelectedCardId(card.id);
    setCardDraft(draft);
    lastSyncedCardRef.current = draft;
    setCardSaveStatus("saved");
    setNewCardComment("");
    setNewChecklistTitle("");
    setNewChecklistItemTitles({});
    setChecklistTitleDrafts({});
    setChecklistItemTitleDrafts({});
    setChecklistToDelete(null);
    setChecklistItemToDelete(null);
    setAttachmentError(null);
    setIsUploadingAttachments(false);
    setScrollToChecklistId(checklistId ?? null);
  };

  const closeCardEditor = (): void => {
    setSelectedCardId(null);
    setCardDraft(null);
    setCardSaveStatus("idle");
    setNewCardComment("");
    clearCardAutosaveTimeout();
    lastSyncedCardRef.current = null;
    setNewChecklistTitle("");
    setNewChecklistItemTitles({});
    setChecklistTitleDrafts({});
    setChecklistItemTitleDrafts({});
    setChecklistToDelete(null);
    setChecklistItemToDelete(null);
    setAttachmentError(null);
    setIsUploadingAttachments(false);
    setScrollToChecklistId(null);
  };

  useEffect(() => {
    if (!selectedCardWithList || !cardDraft) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCardEditor();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedCardWithList, cardDraft]);

  useEffect(() => {
    if (!scrollToChecklistId || !selectedCardWithList || !cardDraft) return;
    const target = checklistSectionRefs.current[scrollToChecklistId];
    if (!target) return;
    window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    setScrollToChecklistId(null);
  }, [scrollToChecklistId, selectedCardWithList, cardDraft, checklistSectionRefs, setScrollToChecklistId]);

  const handleCardDraftChange = useCallback((updater: (current: CardDraft) => CardDraft): void => {
    setCardDraft((current) => (current ? updater(current) : current));
  }, [setCardDraft]);

  const runCardAutosave = useCallback(async (draft: CardDraft, cardId: string): Promise<void> => {
    if (!selectedCardWithList || selectedCardWithList.card.id !== cardId) return;
    const title = draft.title.trim();
    if (title.length < 1) {
      setError("Card title cannot be empty.");
      setCardSaveStatus("idle");
      return;
    }
    const dueDateIso = toIsoFromDateTimeInput(draft.dueDate);
    if (draft.dueDate && !dueDateIso) {
      setCardSaveStatus("idle");
      return;
    }
    setCardSaveStatus("saving");
    try {
      const updated = await updateCard(cardId, {
        title,
        description: trimOrNull(draft.description),
        priority: draft.priority,
        coverColor: draft.coverColor,
        dueDate: dueDateIso
      });
      setBoard((current) => {
        if (!current) return current;
        return {
          ...current,
          lists: current.lists.map((list) => {
            if (list.id !== updated.listId) return list;
            return { ...list, cards: sortCardsByPosition(list.cards.map((card) => card.id === updated.id ? updated : card)) };
          })
        };
      });
      const nextDraft = buildCardDraft(updated);
      lastSyncedCardRef.current = nextDraft;
      setCardDraft(nextDraft);
      setError(null);
      setCardSaveStatus("saved");
      triggerSavedNotice();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update card");
      setCardSaveStatus("idle");
    }
  }, [selectedCardWithList, setBoard, setCardDraft, setError, setCardSaveStatus, triggerSavedNotice, lastSyncedCardRef]);

  useEffect(() => {
    if (!selectedCardWithList || !cardDraft) return;
    const synced = lastSyncedCardRef.current;
    if (synced && isCardDraftEqual(cardDraft, synced)) {
      clearCardAutosaveTimeout();
      setCardSaveStatus("saved");
      return;
    }
    const dueDateIso = toIsoFromDateTimeInput(cardDraft.dueDate);
    if (cardDraft.dueDate && !dueDateIso) {
      clearCardAutosaveTimeout();
      return;
    }
    clearCardAutosaveTimeout();
    setCardSaveStatus("saving");
    cardAutoSaveTimeoutRef.current = window.setTimeout(() => {
      void runCardAutosave(cardDraft, selectedCardWithList.card.id);
    }, CARD_AUTO_SAVE_DELAY_MS);
    return () => {
      clearCardAutosaveTimeout();
    };
  }, [cardDraft, selectedCardWithList, runCardAutosave, clearCardAutosaveTimeout, setCardSaveStatus, cardAutoSaveTimeoutRef, lastSyncedCardRef]);

  const onArchiveCard = useCallback(async (): Promise<void> => {
    if (!selectedCardWithList) return;
    try {
      await archiveCard(selectedCardWithList.card.id);
      setBoard((current) => {
        if (!current) return current;
        return {
          ...current,
          lists: current.lists.map((list) =>
            list.id === selectedCardWithList.list.id
              ? { ...list, cards: list.cards.filter((card) => card.id !== selectedCardWithList.card.id) }
              : list
          )
        };
      });
      setSelectedCardId(null);
      setCardDraft(null);
      triggerSavedNotice();
      if (isArchivedOpen) void loadArchivedLists();
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Failed to archive card");
    }
  }, [selectedCardWithList, setBoard, setSelectedCardId, setCardDraft, triggerSavedNotice, isArchivedOpen, loadArchivedLists, setError]);

  const onDeleteCard = async (): Promise<void> => {
    if (!cardToDelete) return;
    try {
      await deleteCard(cardToDelete.id);
      setBoard((current) => {
        if (!current) return current;
        return {
          ...current,
          lists: current.lists.map((list) => {
            if (list.id !== cardToDelete.listId) return list;
            const nextCards = list.cards
              .filter((card) => card.id !== cardToDelete.id)
              .map((card, index) => ({ ...card, position: index }));
            return { ...list, cards: nextCards };
          })
        };
      });
      if (selectedCardId === cardToDelete.id) closeCardEditor();
      setCardToDelete(null);
      setError(null);
      triggerSavedNotice();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete card");
    }
  };

  return {
    openCardEditor,
    closeCardEditor,
    handleCardDraftChange,
    onArchiveCard,
    onDeleteCard,
    onToggleCardLabel,
    onToggleAssignee,
    onCreateCardComment,
    onCreateChecklist,
    onSaveChecklistTitle,
    onDeleteChecklist,
    onCreateChecklistItem,
    onSaveChecklistItemTitle,
    onToggleChecklistItem,
    onDeleteChecklistItem,
    onUploadAttachments,
    onDownloadAttachment,
    onDownloadAllAttachments,
    onDeleteAttachment
  };
}
