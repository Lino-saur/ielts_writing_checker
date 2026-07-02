import { access } from "node:fs/promises";
import process from "node:process";

async function main() {
  if (!process.env.DATABASE_URL) {
    try {
      await access(".env.local");
      process.loadEnvFile(".env.local");
    } catch {
      // Production and CI environments normally inject DATABASE_URL directly.
    }
  }

  const { db, ensureDatabase } = await import("../lib/db");
  try {
    await ensureDatabase();
    console.log("Database migrations are up to date.");
  } finally {
    await db.end();
  }
}

main()
  .catch((error) => {
    console.error("Database migration failed.", error instanceof Error ? error.message : "UNKNOWN_ERROR");
    process.exitCode = 1;
  });
