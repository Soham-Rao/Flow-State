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

rolesRouter.get("/", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "manage_roles");
    const data = listRoles();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

rolesRouter.get("/assignments", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "manage_roles");
    const data = listRoleAssignments();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

rolesRouter.post("/", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "manage_roles");
    const body = createRoleSchema.parse(req.body);
    const data = createRole(body, req.auth!.userId);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

rolesRouter.patch("/:roleId", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "manage_roles");
    const body = updateRoleSchema.parse(req.body);
    const data = updateRole(req.params.roleId, body, req.auth!.userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

rolesRouter.delete("/:roleId", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "manage_roles");
    deleteRole(req.params.roleId, req.auth!.userId);
    res.status(200).json({ success: true, data: { message: "Role deleted" } });
  } catch (error) {
    next(error);
  }
});

rolesRouter.patch("/assignments/users/:userId", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "manage_roles");
    const body = updateUserRolesSchema.parse(req.body);
    const data = updateUserRoles(req.params.userId, body.roleIds, req.auth!.userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});
