import { Router } from "express";

import { inviteLookupRateLimiter } from "../../middleware/rate-limit.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireWorkspace } from "../../middleware/require-workspace.js";
import { buildSecurityRequestContext } from "../../utils/request-context.js";
import { assertPermission } from "../../utils/permissions.js";
import { hashAuditValue, recordAuditLog } from "../security/audit.service.js";
import { updateInviteRolesSchema } from "../roles/roles.schema.js";
import { createInviteSchema } from "./invites.schema.js";
import { acceptInviteForExistingUser, createInvite, listInvites, lookupInvite, revokeInvite, updateInviteRoles } from "./invites.service.js";

export const invitesRouter = Router();

invitesRouter.get("/lookup/:token", inviteLookupRateLimiter, async (req, res, next) => {
  try {
    const token = req.params.token;
    const context = buildSecurityRequestContext(req);
    const data = await lookupInvite(token);

    await recordAuditLog({
      action: "invites.lookup.success",
      targetType: "invite_token",
      targetId: hashAuditValue(token),
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
      metadata: {
        method: context.method,
        path: context.path,
        status: data.status
      }
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    const context = buildSecurityRequestContext(req);
    await recordAuditLog({
      action: "invites.lookup.failure",
      targetType: "invite_token",
      targetId: hashAuditValue(req.params.token),
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
      metadata: {
        method: context.method,
        path: context.path
      }
    });
    next(error);
  }
});

invitesRouter.post("/accept/:token", requireAuth, inviteLookupRateLimiter, async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: await acceptInviteForExistingUser(req.params.token, req.auth!.userId)
    });
  } catch (error) {
    next(error);
  }
});

invitesRouter.use(requireAuth, requireWorkspace);

invitesRouter.get("/", async (req, res, next) => {
  try {
    await assertPermission(req.auth!.userId, "invite_users");
    const data = await listInvites();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

invitesRouter.post("/", async (req, res, next) => {
  try {
    await assertPermission(req.auth!.userId, "invite_users");
    const body = createInviteSchema.parse(req.body ?? {});
    const data = await createInvite(body, req.auth!.userId);
    const context = buildSecurityRequestContext(req);

    await recordAuditLog({
      actorId: req.auth!.userId,
      action: "invites.create.success",
      targetType: "invite",
      targetId: data.id,
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
      metadata: {
        invitedEmailHash: data.email ? hashAuditValue(data.email) : null,
        roleIds: data.roleIds
      }
    });

    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

invitesRouter.delete("/:inviteId", async (req, res, next) => {
  try {
    await assertPermission(req.auth!.userId, "invite_users");
    await revokeInvite(req.params.inviteId);
    const context = buildSecurityRequestContext(req);

    await recordAuditLog({
      actorId: req.auth!.userId,
      action: "invites.revoke.success",
      targetType: "invite",
      targetId: req.params.inviteId,
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId
    });

    res.status(200).json({ success: true, data: { message: "Invite revoked" } });
  } catch (error) {
    next(error);
  }
});

invitesRouter.patch("/:inviteId/roles", async (req, res, next) => {
  try {
    await assertPermission(req.auth!.userId, "manage_roles");
    const body = updateInviteRolesSchema.parse(req.body ?? {});
    const data = await updateInviteRoles(req.params.inviteId, body.roleIds, req.auth!.userId);
    const context = buildSecurityRequestContext(req);

    await recordAuditLog({
      actorId: req.auth!.userId,
      action: "invites.roles.updated",
      targetType: "invite",
      targetId: req.params.inviteId,
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
      metadata: {
        roleIds: data.roleIds
      }
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});
