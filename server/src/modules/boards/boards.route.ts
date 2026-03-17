import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";
import { boardsAttachmentsRouter } from "./boards.routes.attachments.js";
import { boardsBaseRouter } from "./boards.routes.base.js";
import { boardsCardsRouter } from "./boards.routes.cards.js";
import { boardsChecklistsRouter } from "./boards.routes.checklists.js";
import { boardsCommentsRouter } from "./boards.routes.comments.js";
import { boardsLabelsRouter } from "./boards.routes.labels.js";
import { boardsListsRouter } from "./boards.routes.lists.js";

export const boardsRouter = Router();

boardsRouter.use(requireAuth);

boardsRouter.use(boardsBaseRouter);
boardsRouter.use(boardsLabelsRouter);
boardsRouter.use(boardsListsRouter);
boardsRouter.use(boardsCardsRouter);
boardsRouter.use(boardsCommentsRouter);
boardsRouter.use(boardsAttachmentsRouter);
boardsRouter.use(boardsChecklistsRouter);
