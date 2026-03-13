import { app } from "./app.js";
import { env } from "./config/env.js";
import { initializeDatabase } from "./db/init.js";
import { cleanupExpiredCards } from "./modules/boards/boards.service.js";

initializeDatabase();

const CLEANUP_INTERVAL_MS = 60 * 1000;

void cleanupExpiredCards().catch((error) => {
  console.error("Cleanup failed", error);
});

setInterval(() => {
  void cleanupExpiredCards().catch((error) => {
    console.error("Cleanup failed", error);
  });
}, CLEANUP_INTERVAL_MS);

app.listen(env.PORT, () => {
  console.log(`FlowState server listening on port ${env.PORT}`);
});
