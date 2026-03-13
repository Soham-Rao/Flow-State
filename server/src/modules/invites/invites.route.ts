import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";
import { ApiError } from "../../utils/api-error.js";
import { createInviteSchema } from "./invites.schema.js";
import { createInvite, listInvites, lookupInvite, revokeInvite } from "./invites.service.js";

export const invitesRouter = Router();

invitesRouter.get("/lookup/:token", (req, res, next) => {
  try {
    const token = req.params.token;
    const data = lookupInvite(token);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

invitesRouter.use(requireAuth);

function assertAdmin(role: string | undefined): void {
  if (role !== "admin") {
    throw new ApiError(403, "Only admins can manage invites");
  }
}

invitesRouter.get("/", (req, res, next) => {
  try {
    assertAdmin(req.auth?.role);
    const data = listInvites();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

invitesRouter.post("/", (req, res, next) => {
  try {
    assertAdmin(req.auth?.role);
    const body = createInviteSchema.parse(req.body ?? {});
    const data = createInvite(body, req.auth!.userId);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

invitesRouter.delete("/:inviteId", (req, res, next) => {
  try {
    assertAdmin(req.auth?.role);
    revokeInvite(req.params.inviteId);
    res.status(200).json({ success: true, data: { message: "Invite revoked" } });
  } catch (error) {
    next(error);
  }
});
