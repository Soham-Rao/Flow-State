import { Router } from "express";
import multer from "multer";

import { requireAuth } from "../../middleware/require-auth.js";
import {
  archiveBoard,
  archiveCard,
  archiveList,
  assignLabelToCard,
  assignMemberToCard,
  cleanupExpiredCards,
  createAttachments,
  createBoard,
  createBoardComment,
  deleteComment,
  createCard,
  createCardComment,
  createChecklist,
  createChecklistItem,
  createLabel,
  createList,
  createListComment,
  deleteAttachment,
  deleteBoard,
  deleteCard,
  deleteChecklist,
  deleteChecklistItem,
  deleteLabel,
  deleteList,
  getArchivedLists,
  getAttachmentDownloadInfo,
  getBoardById,
  getBoards,
  moveCard,
  removeLabelFromCard,
  removeMemberFromCard,
  reorderLists,
  restoreBoard,
  restoreCard,
  restoreList,
  toggleCommentReaction,
  updateBoard,
  updateCard,
  updateChecklist,
  updateChecklistItem,
  updateLabel,
  updateList
} from "./boards.service.js";
import {
  assignAssigneeSchema,
  assignLabelSchema,
  commentReactionSchema,
  createBoardSchema,
  createCardSchema,
  createChecklistItemSchema,
  createChecklistSchema,
  createCommentSchema,
  createLabelSchema,
  createListSchema,
  moveCardSchema,
  reorderListsSchema,
  restoreArchiveSchema,
  updateBoardSchema,
  updateCardSchema,
  updateChecklistItemSchema,
  updateChecklistSchema,
  updateLabelSchema,
  updateListSchema
} from "./boards.schema.js";

export const boardsRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

boardsRouter.use(requireAuth);

boardsRouter.get("/", (_req, res) => {
  const data = getBoards();

  res.status(200).json({
    success: true,
    data
  });
});

boardsRouter.post("/", (req, res, next) => {
  try {
    const body = createBoardSchema.parse(req.body);
    const data = createBoard(body, req.auth!.userId);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.get("/:boardId", async (req, res, next) => {
  try {
    await cleanupExpiredCards();
    const data = getBoardById(req.params.boardId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.patch("/:boardId", (req, res, next) => {
  try {
    const body = updateBoardSchema.parse(req.body);
    const data = updateBoard(req.params.boardId, body);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.get("/:boardId/archived-lists", (req, res, next) => {
  try {
    const data = getArchivedLists(req.params.boardId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.post("/:boardId/archive", (req, res, next) => {
  try {
    const data = archiveBoard(req.params.boardId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.post("/:boardId/restore", (req, res, next) => {
  try {
    const data = restoreBoard(req.params.boardId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.post("/:boardId/comments", (req, res, next) => {
  try {
    const body = createCommentSchema.parse(req.body);
    const data = createBoardComment(req.params.boardId, body, req.auth!.userId);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.delete("/:boardId", (req, res, next) => {
  try {
    deleteBoard(req.params.boardId);

    res.status(200).json({
      success: true,
      data: {
        message: "Board deleted"
      }
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.post("/:boardId/labels", (req, res, next) => {
  try {
    const body = createLabelSchema.parse(req.body);
    const data = createLabel(req.params.boardId, body);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.patch("/labels/:labelId", (req, res, next) => {
  try {
    const body = updateLabelSchema.parse(req.body);
    const data = updateLabel(req.params.labelId, body);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.delete("/labels/:labelId", (req, res, next) => {
  try {
    deleteLabel(req.params.labelId);

    res.status(200).json({
      success: true,
      data: {
        message: "Label deleted"
      }
    });
  } catch (error) {
    next(error);
  }
});


boardsRouter.post("/:boardId/lists", (req, res, next) => {
  try {
    const body = createListSchema.parse(req.body);
    const data = createList(req.params.boardId, body);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.post("/:boardId/lists/reorder", (req, res, next) => {
  try {
    const body = reorderListsSchema.parse(req.body);
    const data = reorderLists(req.params.boardId, body);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.patch("/lists/:listId", (req, res, next) => {
  try {
    const body = updateListSchema.parse(req.body);
    const data = updateList(req.params.listId, body);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.delete("/lists/:listId", (req, res, next) => {
  try {
    deleteList(req.params.listId);

    res.status(200).json({
      success: true,
      data: {
        message: "List deleted"
      }
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.post("/lists/:listId/archive", (req, res, next) => {
  try {
    archiveList(req.params.listId);

    res.status(200).json({
      success: true,
      data: { message: "List archived" }
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.post("/lists/:listId/restore", (req, res, next) => {
  try {
    const body = restoreArchiveSchema.parse(req.body ?? {});
    const data = restoreList(req.params.listId, body.renameConflicts ?? false);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.post("/lists/:listId/comments", (req, res, next) => {
  try {
    const body = createCommentSchema.parse(req.body);
    const data = createListComment(req.params.listId, body, req.auth!.userId);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.post("/lists/:listId/cards", (req, res, next) => {
  try {
    const body = createCardSchema.parse(req.body);
    const data = createCard(req.params.listId, body, req.auth!.userId);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.patch("/cards/:cardId", (req, res, next) => {
  try {
    const body = updateCardSchema.parse(req.body);
    const data = updateCard(req.params.cardId, body);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.post("/cards/:cardId/archive", (req, res, next) => {
  try {
    const data = archiveCard(req.params.cardId, req.auth!.userId, req.auth!.role);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.post("/cards/:cardId/restore", (req, res, next) => {
  try {
    const body = restoreArchiveSchema.parse(req.body ?? {});
    const data = restoreCard(req.params.cardId, body.renameConflicts ?? false);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.post("/cards/:cardId/comments", (req, res, next) => {
  try {
    const body = createCommentSchema.parse(req.body);
    const data = createCardComment(req.params.cardId, body, req.auth!.userId);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.delete("/comments/:commentId", (req, res, next) => {
  try {
    deleteComment(req.params.commentId, req.auth!.userId, req.auth!.role);

    res.status(200).json({
      success: true,
      data: {
        message: "Comment deleted"
      }
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.post("/comments/:commentId/reactions", (req, res, next) => {
  try {
    const body = commentReactionSchema.parse(req.body);
    const data = toggleCommentReaction(req.params.commentId, req.auth!.userId, body);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});


boardsRouter.post("/cards/:cardId/labels", (req, res, next) => {
  try {
    const body = assignLabelSchema.parse(req.body);
    const data = assignLabelToCard(req.params.cardId, body);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.delete("/cards/:cardId/labels/:labelId", (req, res, next) => {
  try {
    const data = removeLabelFromCard(req.params.cardId, req.params.labelId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.post("/cards/:cardId/assignees", (req, res, next) => {
  try {
    const body = assignAssigneeSchema.parse(req.body);
    const data = assignMemberToCard(req.params.cardId, body);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.delete("/cards/:cardId/assignees/:userId", (req, res, next) => {
  try {
    const data = removeMemberFromCard(req.params.cardId, req.params.userId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});


boardsRouter.post("/cards/move", (req, res, next) => {
  try {
    const body = moveCardSchema.parse(req.body);
    const data = moveCard(body);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.delete("/cards/:cardId", async (req, res, next) => {
  try {
    await deleteCard(req.params.cardId, req.auth!.userId, req.auth!.role);

    res.status(200).json({
      success: true,
      data: {
        message: "Card deleted"
      }
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.post("/cards/:cardId/attachments", upload.array("files", 10), async (req, res, next) => {
  try {
    const files = (req.files ?? []) as Express.Multer.File[];
    const data = await createAttachments(req.params.cardId, files);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.get("/attachments/:attachmentId/download", (req, res, next) => {
  try {
    const attachment = getAttachmentDownloadInfo(req.params.attachmentId);
    res.download(attachment.filePath, attachment.originalName);
  } catch (error) {
    next(error);
  }
});

boardsRouter.delete("/attachments/:attachmentId", async (req, res, next) => {
  try {
    await deleteAttachment(req.params.attachmentId);

    res.status(200).json({
      success: true,
      data: {
        message: "Attachment deleted"
      }
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.post("/cards/:cardId/checklists", (req, res, next) => {
  try {
    const body = createChecklistSchema.parse(req.body);
    const data = createChecklist(req.params.cardId, body);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.patch("/checklists/:checklistId", (req, res, next) => {
  try {
    const body = updateChecklistSchema.parse(req.body);
    const data = updateChecklist(req.params.checklistId, body);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.delete("/checklists/:checklistId", (req, res, next) => {
  try {
    deleteChecklist(req.params.checklistId);

    res.status(200).json({
      success: true,
      data: {
        message: "Checklist deleted"
      }
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.post("/checklists/:checklistId/items", (req, res, next) => {
  try {
    const body = createChecklistItemSchema.parse(req.body);
    const data = createChecklistItem(req.params.checklistId, body);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.patch("/checklist-items/:itemId", (req, res, next) => {
  try {
    const body = updateChecklistItemSchema.parse(req.body);
    const data = updateChecklistItem(req.params.itemId, body);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.delete("/checklist-items/:itemId", (req, res, next) => {
  try {
    deleteChecklistItem(req.params.itemId);

    res.status(200).json({
      success: true,
      data: {
        message: "Checklist item deleted"
      }
    });
  } catch (error) {
    next(error);
  }
});
