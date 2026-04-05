import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import { allowedOrigins, cspConnectSources, env, isAllowedOrigin } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundMiddleware } from "./middleware/not-found.js";
import { requestId } from "./middleware/request-id.js";
import { requestLogger } from "./middleware/request-logger.js";
import { activityRouter } from "./modules/activity/activity.route.js";
import { announcementsRouter } from "./modules/announcements/announcements.route.js";
import { authRouter } from "./modules/auth/auth.route.js";
import { boardsRouter } from "./modules/boards/boards.route.js";
import { bugReportsRouter } from "./modules/bug-reports/bug-reports.route.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.route.js";
import { invitesRouter } from "./modules/invites/invites.route.js";
import { mentionsRouter } from "./modules/mentions/mentions.route.js";
import { rolesRouter } from "./modules/roles/roles.route.js";
import { threadsRouter } from "./modules/threads/threads.route.js";
import { healthRouter } from "./routes/health.route.js";

export const app = express();

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const clientDistDir = path.resolve(
  currentDir,
  "../../client/dist"
);
const hasClientBuild = fs.existsSync(clientDistDir);

if (env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(requestId);
app.use(helmet({
  crossOriginResourcePolicy: { policy: "same-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      connectSrc: cspConnectSources,
      imgSrc: ["'self'", "data:", "blob:"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      fontSrc: ["'self'", "data:", "https:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"]
    }
  }
}));
app.use(cors({
  origin(origin, callback) {
    callback(null, isAllowedOrigin(origin));
  },
  credentials: false
}));
app.use(express.json({ limit: "1mb" }));
app.use(requestLogger);

app.locals.allowedOrigins = allowedOrigins;

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/boards", boardsRouter);
app.use("/api/bug-reports", bugReportsRouter);
app.use("/api/invites", invitesRouter);
app.use("/api/roles", rolesRouter);
app.use("/api/threads", threadsRouter);
app.use("/api/mentions", mentionsRouter);
app.use("/api/announcements", announcementsRouter);
app.use("/api/activity", activityRouter);
app.use("/api/dashboard", dashboardRouter);

if (env.NODE_ENV === "production" && hasClientBuild) {
  app.use(compression());
  app.use(express.static(clientDistDir));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDistDir, "index.html"));
  });
}

app.use(notFoundMiddleware);
app.use(errorHandler);

