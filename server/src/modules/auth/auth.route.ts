import { Router } from "express";

import {
  forgotPasswordRateLimiter,
  loginRateLimiter,
  registerRateLimiter,
  resetPasswordRateLimiter
} from "../../middleware/rate-limit.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireWorkspace } from "../../middleware/require-workspace.js";
import { buildSecurityRequestContext } from "../../utils/request-context.js";
import {
  forgotPasswordBodySchema,
  loginBodySchema,
  registerBodySchema,
  resetPasswordBodySchema,
  updateProfileSchema
} from "./auth.schema.js";
import {
  getCurrentUser,
  getAccountUser,
  loginUser,
  registerUser,
  requestPasswordReset,
  resetPassword,
  updateProfile
} from "./auth.service.js";

export const authRouter = Router();

authRouter.post("/register", registerRateLimiter, async (req, res, next) => {
  try {
    const body = registerBodySchema.parse(req.body);
    const context = buildSecurityRequestContext(req);
    const data = await registerUser(body, context);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", loginRateLimiter, async (req, res, next) => {
  try {
    const body = loginBodySchema.parse(req.body);
    const context = buildSecurityRequestContext(req);
    const data = await loginUser(body, context);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/forgot-password", forgotPasswordRateLimiter, async (req, res, next) => {
  try {
    const body = forgotPasswordBodySchema.parse(req.body);
    const context = buildSecurityRequestContext(req);
    const data = await requestPasswordReset(body, context);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/reset-password", resetPasswordRateLimiter, async (req, res, next) => {
  try {
    const body = resetPasswordBodySchema.parse(req.body);
    const context = buildSecurityRequestContext(req);
    const data = await resetPassword(body, context);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", requireAuth, (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      message: "Logged out successfully"
    }
  });
});

authRouter.get("/me", requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const data = await getCurrentUser(req.auth!.userId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/account", requireAuth, async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await getAccountUser(req.auth!.userId) });
  } catch (error) {
    next(error);
  }
});

authRouter.patch("/me", requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const body = updateProfileSchema.parse(req.body);
    const data = await updateProfile(req.auth!.userId, body);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});
