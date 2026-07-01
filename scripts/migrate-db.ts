import { db, ensureDatabase } from "../lib/db";

async function main() {
  await ensureDatabase();
  console.log("Database migrations are up to date.");
}

main()
  .catch((error) => {
    console.error("Database migration failed.", error instanceof Error ? error.message : "UNKNOWN_ERROR");
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end();
  });
