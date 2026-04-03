import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { allowedOrigins, cspConnectSources, env, isAllowedOrigin } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundMiddleware } from "./middleware/not-found.js";
import { requestId } from "./middleware/request-id.js";
import { activityRouter } from "./modules/activity/activity.route.js";
import { announcementsRouter } from "./modules/announcements/announcements.route.js";
import { authRouter } from "./modules/auth/auth.route.js";
import { boardsRouter } from "./modules/boards/boards.route.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.route.js";
import { invitesRouter } from "./modules/invites/invites.route.js";
import { mentionsRouter } from "./modules/mentions/mentions.route.js";
import { rolesRouter } from "./modules/roles/roles.route.js";
import { threadsRouter } from "./modules/threads/threads.route.js";
import { healthRouter } from "./routes/health.route.js";

export const app = express();

const clientDistDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../client/dist"
);
const hasClientBuild = fs.existsSync(clientDistDir);

if (env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

morgan.token("request-id", (req) => (req as express.Request).requestId ?? "-");

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
app.use(morgan(env.NODE_ENV === "production"
  ? ':remote-addr :method :url :status :res[content-length] - :response-time ms req_id=:request-id'
  : ':method :url :status :response-time ms req_id=:request-id'));

app.locals.allowedOrigins = allowedOrigins;

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
