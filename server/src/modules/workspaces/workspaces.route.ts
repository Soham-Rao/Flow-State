import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";
import { workspaceCreationRateLimiter } from "../../middleware/rate-limit.js";
import { createWorkspaceSchema, joinWorkspaceSchema } from "./workspaces.schema.js";
import { createWorkspace, isPlatformOwner, joinWorkspace, listUserWorkspaces } from "./workspaces.service.js";

export const workspacesRouter = Router();

workspacesRouter.use(requireAuth);

workspacesRouter.get("/", async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await listUserWorkspaces(req.auth!.userId) });
  } catch (error) {
    next(error);
  }
});

workspacesRouter.get("/capabilities", (req, res) => {
  res.status(200).json({
    success: true,
    data: { canCreateWorkspace: isPlatformOwner(req.auth!.userId) }
  });
});

workspacesRouter.post("/join", workspaceCreationRateLimiter, async (req, res, next) => {
  try {
    const input = joinWorkspaceSchema.parse(req.body);
    res.status(200).json({ success: true, data: await joinWorkspace(req.auth!.userId, input) });
  } catch (error) {
    next(error);
  }
});

workspacesRouter.post(
  "/",
  workspaceCreationRateLimiter,
  async (req, res, next) => {
    try {
      const input = createWorkspaceSchema.parse(req.body);
      res.status(201).json({ success: true, data: await createWorkspace(req.auth!.userId, input) });
    } catch (error) {
      next(error);
    }
  }
);
