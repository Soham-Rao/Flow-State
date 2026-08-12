import type { NextFunction, Request, Response } from "express";

import { resolveWorkspaceForUser } from "../modules/workspaces/workspaces.service.js";
import { ApiError } from "../utils/api-error.js";
import { runWithWorkspaceContext } from "../utils/workspace-context.js";

export async function requireWorkspace(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.auth) {
      throw new ApiError(401, "Authentication is required");
    }

    const requestedWorkspace = req.header("x-workspace-id")?.trim() || null;
    const workspace = await resolveWorkspaceForUser(req.auth.userId, requestedWorkspace);
    req.workspace = workspace;

    runWithWorkspaceContext(
      { workspaceId: workspace.id, userId: req.auth.userId },
      () => next()
    );
  } catch (error) {
    next(error);
  }
}
