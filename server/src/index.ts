import http from "node:http";

import { app } from "./app.js";
import { env } from "./config/env.js";
import { closePool } from "./db/connection.js";
import { initializeDatabase } from "./db/init.js";
import { cleanupExpiredCards } from "./modules/boards/boards.service.js";
import { runDueEmailReminderJob } from "./modules/notifications/notifications.service.js";
import { closeSocketServer, initSocket } from "./realtime/socket.js";
import { logger } from "./utils/logger.js";

const CLEANUP_INTERVAL_MS = 60 * 1000;
const DUE_EMAIL_REMINDER_INTERVAL_MS = 5 * 60 * 1000;

let cleanupInterval: NodeJS.Timeout | null = null;
let dueEmailReminderInterval: NodeJS.Timeout | null = null;
let server: http.Server | null = null;
let shuttingDown = false;

async function runCleanup(): Promise<void> {
  try {
    await cleanupExpiredCards();
  } catch (error) {
    logger.error("jobs.cleanup_failed", { error });
  }
}

async function runDueEmailReminders(): Promise<void> {
  try {
    await runDueEmailReminderJob();
  } catch (error) {
    logger.error("jobs.due_email_reminders_failed", { error });
  }
}

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.warn("server.shutdown_started", { signal });

  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }

  if (dueEmailReminderInterval) {
    clearInterval(dueEmailReminderInterval);
    dueEmailReminderInterval = null;
  }

  try {
    await closeSocketServer();
  } catch (error) {
    logger.error("server.shutdown_socket_failed", { signal, error });
  }

  await new Promise<void>((resolve) => {
    if (!server) {
      resolve();
      return;
    }

    server.close((error) => {
      if (error) {
        logger.error("server.shutdown_http_failed", { signal, error });
      }
      resolve();
    });
  });

  try {
    await closePool();
  } catch (error) {
    logger.error("server.shutdown_db_failed", { signal, error });
  }

  logger.info("server.shutdown_complete", { signal });
}

function registerProcessGuards(): void {
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM").finally(() => process.exit(0));
  });

  process.on("SIGINT", () => {
    void shutdown("SIGINT").finally(() => process.exit(0));
  });

  process.on("uncaughtException", (error) => {
    logger.error("process.uncaught_exception", { error });
    void shutdown("uncaughtException").finally(() => process.exit(1));
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("process.unhandled_rejection", { error: reason });
  });
}

async function startServer(): Promise<void> {
  registerProcessGuards();
  await initializeDatabase();
  await runCleanup();

  cleanupInterval = setInterval(() => {
    void runCleanup();
  }, CLEANUP_INTERVAL_MS);

  dueEmailReminderInterval = setInterval(() => {
    void runDueEmailReminders();
  }, DUE_EMAIL_REMINDER_INTERVAL_MS);

  server = http.createServer(app);
  initSocket(server);

  server.listen(env.PORT, () => {
    logger.info("server.started", {
      port: env.PORT,
      nodeEnv: env.NODE_ENV
    });
  });
}

void startServer().catch((error) => {
  logger.error("server.start_failed", { error });
  process.exit(1);
});
