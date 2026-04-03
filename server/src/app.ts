import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
import { announcementsRouter } from "./modules/announcements/announcements.route.js";
import { activityRouter } from "./modules/activity/activity.route.js";
import { rolesRouter } from "./modules/roles/roles.route.js";
import { threadsRouter } from "./modules/threads/threads.route.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.route.js";
import { healthRouter } from "./routes/health.route.js";

export const app = express();

const clientDistDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../client/dist"
);
const hasClientBuild = fs.existsSync(clientDistDir);

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
app.use("/api/announcements", announcementsRouter);
app.use("/api/activity", activityRouter);
app.use("/api/dashboard", dashboardRouter);

if (env.NODE_ENV === "production" && hasClientBuild) {
  app.use(express.static(clientDistDir));
  app.get("*", (req, res, next) => {
    if (req.path === "/api" || req.path.startsWith("/api/") || req.path.startsWith("/socket.io")) {
      next();
      return;
    }

    res.sendFile(path.join(clientDistDir, "index.html"));
  });
}

app.use(notFoundMiddleware);
app.use(errorHandler);
