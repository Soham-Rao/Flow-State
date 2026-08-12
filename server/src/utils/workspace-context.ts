import { AsyncLocalStorage } from "node:async_hooks";

import { ApiError } from "./api-error.js";

export interface WorkspaceRequestContext {
  workspaceId: string;
  userId: string;
}

const workspaceStorage = new AsyncLocalStorage<WorkspaceRequestContext>();

export function runWithWorkspaceContext<T>(context: WorkspaceRequestContext, callback: () => T): T {
  return workspaceStorage.run(context, callback);
}

export function getWorkspaceContext(): WorkspaceRequestContext {
  const context = workspaceStorage.getStore();
  if (!context) {
    throw new ApiError(500, "Workspace context is unavailable");
  }
  return context;
}

export function getCurrentWorkspaceId(): string {
  return getWorkspaceContext().workspaceId;
}

export function getOptionalWorkspaceId(): string | null {
  return workspaceStorage.getStore()?.workspaceId ?? null;
}
