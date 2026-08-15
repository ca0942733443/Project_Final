import { app } from "./app";
import { env } from "./config/env";
import { checkDatabaseConnection, pool } from "./db/pool";

async function startServer() {
  await checkDatabaseConnection();

  const server = app.listen(env.apiPort, () => {
    console.log(`API ready at http://localhost:${env.apiPort}`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down`);
    server.close(() => {
      void pool.end().finally(() => process.exit(0));
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

startServer().catch((error) => {
  console.error("Unable to start API", error);
  process.exit(1);
});
