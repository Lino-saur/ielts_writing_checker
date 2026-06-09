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

    await db.query(`
      CREATE TABLE IF NOT EXISTS feedback_entries (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        helpful BOOLEAN,
        category TEXT,
        comment TEXT NOT NULL DEFAULT '',
        page TEXT NOT NULL,
        task_type TEXT,
        target_band NUMERIC(3, 1),
        provider_used TEXT,
        feedback_mode TEXT,
        estimated_band NUMERIC(3, 1),
        word_count INTEGER,
        payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL
      );
    `);

    await db.query(`
      ALTER TABLE feedback_entries
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new';
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id TEXT PRIMARY KEY,
        auth_user_id TEXT NOT NULL UNIQUE,
        email TEXT,
        display_name TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
    `);

    await db.query(`
      ALTER TABLE admin_users
      ADD COLUMN IF NOT EXISTS email TEXT;
    `);

    await db.query(`
      ALTER TABLE admin_users
      ADD COLUMN IF NOT EXISTS display_name TEXT;
    `);

    await db.query(`
      ALTER TABLE admin_users
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
    `);

    await db.query(`
      ALTER TABLE admin_users
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    `);

    await db.query(`
      ALTER TABLE admin_users
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    `);

    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS admin_users_auth_user_id_idx
      ON admin_users (auth_user_id);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS admin_users_email_idx
      ON admin_users (email);
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
