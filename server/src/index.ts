import { app } from "./app.js";
import { env } from "./config/env.js";
import { initializeDatabase } from "./db/init.js";

initializeDatabase();

app.listen(env.PORT, () => {
  console.log(`FlowState server listening on port ${env.PORT}`);
});
