import { closePool } from "../db/connection.js";
import { runAccountCleanup } from "../modules/account-cleanup/account-cleanup.service.js";
import { logger } from "../utils/logger.js";

async function main(): Promise<void> {
  const forceReport = process.argv.includes("--report");
  await runAccountCleanup(forceReport ? { mode: "report" } : {});
}

main()
  .catch((error) => {
    logger.error("accounts.cleanup_job_failed", { error });
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
