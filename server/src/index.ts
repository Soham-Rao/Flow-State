import http from "node:http";

import { app } from "./app.js";
import { env } from "./config/env.js";
import { initializeDatabase } from "./db/init.js";
import { cleanupExpiredCards } from "./modules/boards/boards.service.js";
import { initSocket } from "./realtime/socket.js";

const CLEANUP_INTERVAL_MS = 60 * 1000;

async function startServer(): Promise<void> {
  await initializeDatabase();

  void cleanupExpiredCards().catch((error) => {
    console.error("Cleanup failed", error);
  });

  setInterval(() => {
    void cleanupExpiredCards().catch((error) => {
      console.error("Cleanup failed", error);
    });
  }, CLEANUP_INTERVAL_MS);

  const server = http.createServer(app);
  initSocket(server);

  server.listen(env.PORT, () => {
    console.log(`FlowState server listening on port ${env.PORT}`);
  });
}

void startServer().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
