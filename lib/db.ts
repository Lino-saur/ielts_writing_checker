import { Pool } from "pg";

const DEFAULT_DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:5432/ielts_writing_checker";

type GlobalWithDb = typeof globalThis & {
  __ieltsPool?: Pool;
  __ieltsDbInitPromise?: Promise<void>;
};

const globalForDb = globalThis as GlobalWithDb;

function getConnectionString() {
  return process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
}

export const db =
  globalForDb.__ieltsPool ??
  new Pool({
    connectionString: getConnectionString(),
    ssl:
      process.env.POSTGRES_SSL === "false"
        ? false
        : process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__ieltsPool = db;
}

export async function ensureDatabase() {
  const existing = globalForDb.__ieltsDbInitPromise;
  if (existing) {
    return existing;
  }

  const initPromise = (async () => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS energy_accounts (
        user_id TEXT PRIMARY KEY,
        balance INTEGER NOT NULL,
        total_consumed INTEGER NOT NULL,
        total_recharged INTEGER NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS energy_transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        amount INTEGER NOT NULL,
        balance_after INTEGER NOT NULL,
        source TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );
    `);
  })();

  globalForDb.__ieltsDbInitPromise = initPromise;

  try {
    await initPromise;
  } catch (error) {
    globalForDb.__ieltsDbInitPromise = undefined;
    throw error;
  }
}
