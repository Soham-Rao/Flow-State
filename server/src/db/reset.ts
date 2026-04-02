import { pool } from "./connection.js";
import { clearDatabaseForTests } from "./init.js";

clearDatabaseForTests()
  .then(async () => {
    await pool.end();
  })
  .catch(async (error) => {
    console.error("Failed to reset database", error);
    await pool.end();
    process.exit(1);
  });
