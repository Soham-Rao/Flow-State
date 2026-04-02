import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";
import { assertPermission } from "../../utils/permissions.js";
import {
  createRole,
  deleteRole,
  listRoleAssignments,
  listRoles,
  updateRole,
  updateUserRoles
} from "./roles.service.js";
import { createRoleSchema, updateRoleSchema, updateUserRolesSchema } from "./roles.schema.js";

export const rolesRouter = Router();

rolesRouter.use(requireAuth);

rolesRouter.get("/", async (req, res, next) => {
  try {
    await assertPermission(req.auth!.userId, "manage_roles");
    const data = await listRoles();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

rolesRouter.get("/assignments", async (req, res, next) => {
  try {
    await assertPermission(req.auth!.userId, "manage_roles");
    const data = await listRoleAssignments();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

rolesRouter.post("/", async (req, res, next) => {
  try {
    await assertPermission(req.auth!.userId, "manage_roles");
    const body = createRoleSchema.parse(req.body);
    const data = await createRole(body, req.auth!.userId);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

rolesRouter.patch("/:roleId", async (req, res, next) => {
  try {
    await assertPermission(req.auth!.userId, "manage_roles");
    const body = updateRoleSchema.parse(req.body);
    const data = await updateRole(req.params.roleId, body, req.auth!.userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

rolesRouter.delete("/:roleId", async (req, res, next) => {
  try {
    await assertPermission(req.auth!.userId, "manage_roles");
    await deleteRole(req.params.roleId, req.auth!.userId);
    res.status(200).json({ success: true, data: { message: "Role deleted" } });
  } catch (error) {
    next(error);
  }
});

rolesRouter.patch("/assignments/users/:userId", async (req, res, next) => {
  try {
    await assertPermission(req.auth!.userId, "manage_roles");
    const body = updateUserRolesSchema.parse(req.body);
    const data = await updateUserRoles(req.params.userId, body.roleIds, req.auth!.userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});
