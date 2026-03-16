import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundMiddleware } from "./middleware/not-found.js";
import { authRouter } from "./modules/auth/auth.route.js";
import { boardsRouter } from "./modules/boards/boards.route.js";
import { invitesRouter } from "./modules/invites/invites.route.js";
import { mentionsRouter } from "./modules/mentions/mentions.route.js";
import { rolesRouter } from "./modules/roles/roles.route.js";
import { threadsRouter } from "./modules/threads/threads.route.js";
import { healthRouter } from "./routes/health.route.js";

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/boards", boardsRouter);
app.use("/api/invites", invitesRouter);
app.use("/api/roles", rolesRouter);
app.use("/api/threads", threadsRouter);
app.use("/api/mentions", mentionsRouter);

app.use(notFoundMiddleware);
app.use(errorHandler);
