import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";
import { assertPermission } from "../../utils/permissions.js";
import { updateInviteRolesSchema } from "../roles/roles.schema.js";
import { createInviteSchema } from "./invites.schema.js";
import { createInvite, listInvites, lookupInvite, revokeInvite, updateInviteRoles } from "./invites.service.js";

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

invitesRouter.get("/", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "invite_users");
    const data = listInvites();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

invitesRouter.post("/", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "invite_users");
    const body = createInviteSchema.parse(req.body ?? {});
    const data = createInvite(body, req.auth!.userId);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

invitesRouter.delete("/:inviteId", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "invite_users");
    revokeInvite(req.params.inviteId);
    res.status(200).json({ success: true, data: { message: "Invite revoked" } });
  } catch (error) {
    next(error);
  }
});

invitesRouter.patch("/:inviteId/roles", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "manage_roles");
    const body = updateInviteRolesSchema.parse(req.body ?? {});
    const data = updateInviteRoles(req.params.inviteId, body.roleIds, req.auth!.userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});
