import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";
import { getCurrentUser, loginUser, registerUser } from "./auth.service.js";
import { loginBodySchema, registerBodySchema } from "./auth.schema.js";

export const authRouter = Router();

authRouter.post("/register", async (req, res, next) => {
  try {
    const body = registerBodySchema.parse(req.body);
    const data = await registerUser(body);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const body = loginBodySchema.parse(req.body);
    const data = await loginUser(body);

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

authRouter.get("/me", requireAuth, (req, res, next) => {
  try {
    const data = getCurrentUser(req.auth!.userId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});
