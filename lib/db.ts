import { Pool } from "pg";

type GlobalWithDb = typeof globalThis & {
  __ieltsPool?: Pool;
  __ieltsDbInitPromise?: Promise<void>;
};

const globalForDb = globalThis as GlobalWithDb;

function getConnectionString() {
  return process.env.DATABASE_URL;
}

export const db =
  globalForDb.__ieltsPool ??
  new Pool({
    connectionString: getConnectionString(),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
    ssl:
      process.env.POSTGRES_SSL === "false"
        ? false
        : process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false
  });

if (!(db as Pool & { __ieltsErrorListenerAttached?: boolean }).__ieltsErrorListenerAttached) {
  db.on("error", (error) => {
    console.error("[DB][POOL_ERROR]", {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
  });
  (db as Pool & { __ieltsErrorListenerAttached?: boolean }).__ieltsErrorListenerAttached = true;
}

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
        order_id TEXT,
        source TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );
    `);

    await db.query(`
      ALTER TABLE energy_transactions
      ADD COLUMN IF NOT EXISTS order_id TEXT;
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS energy_transactions_user_created_idx
      ON energy_transactions (user_id, created_at DESC);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS energy_transactions_order_id_idx
      ON energy_transactions (order_id);
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

    await db.query(`
      CREATE TABLE IF NOT EXISTS recharge_products (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        energy_amount INTEGER NOT NULL,
        bonus_energy_amount INTEGER NOT NULL DEFAULT 0,
        price_cents INTEGER NOT NULL,
        currency TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS recharge_orders (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        product_code TEXT NOT NULL,
        product_name TEXT NOT NULL,
        provider TEXT NOT NULL,
        status TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        currency TEXT NOT NULL,
        energy_amount INTEGER NOT NULL,
        bonus_energy_amount INTEGER NOT NULL DEFAULT 0,
        total_energy_amount INTEGER NOT NULL,
        provider_order_id TEXT,
        paid_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS recharge_products_status_sort_idx
      ON recharge_products (status, sort_order ASC, created_at ASC);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS recharge_orders_user_created_idx
      ON recharge_orders (user_id, created_at DESC);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS recharge_orders_status_created_idx
      ON recharge_orders (status, created_at DESC);
    `);

    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS recharge_orders_provider_order_id_idx
      ON recharge_orders (provider, provider_order_id)
      WHERE provider_order_id IS NOT NULL;
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS writing_reviews (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        task_type TEXT NOT NULL,
        prompt_text TEXT NOT NULL,
        essay_text TEXT NOT NULL,
        result_json JSONB NOT NULL,
        provider_used TEXT NOT NULL,
        target_band NUMERIC(3, 1) NOT NULL,
        estimated_band NUMERIC(3, 1) NOT NULL,
        word_count INTEGER NOT NULL,
        image_object_key TEXT,
        image_name TEXT,
        image_mime_type TEXT,
        image_size_bytes BIGINT,
        status TEXT NOT NULL DEFAULT 'completed',
        error_code TEXT,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
    `);

    await db.query(`
      ALTER TABLE writing_reviews
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed';
    `);

    await db.query(`
      ALTER TABLE writing_reviews
      ADD COLUMN IF NOT EXISTS error_code TEXT;
    `);

    await db.query(`
      ALTER TABLE writing_reviews
      ADD COLUMN IF NOT EXISTS image_size_bytes BIGINT;
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS writing_reviews_user_created_idx
      ON writing_reviews (user_id, created_at DESC);
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS media_usage_monthly (
        month_key TEXT PRIMARY KEY,
        upload_bytes BIGINT NOT NULL DEFAULT 0,
        download_bytes BIGINT NOT NULL DEFAULT 0,
        upload_count INTEGER NOT NULL DEFAULT 0,
        download_count INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS media_quota_settings (
        id TEXT PRIMARY KEY,
        upload_limit_bytes BIGINT,
        download_limit_bytes BIGINT,
        hard_block_uploads BOOLEAN NOT NULL DEFAULT FALSE,
        hard_block_downloads BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMPTZ NOT NULL
      );
    `);

    await db.query(`
      INSERT INTO media_quota_settings (
        id,
        upload_limit_bytes,
        download_limit_bytes,
        hard_block_uploads,
        hard_block_downloads,
        updated_at
      )
      VALUES ('global', NULL, NULL, FALSE, FALSE, NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS support_inbox_entries (
        id TEXT PRIMARY KEY,
        resend_email_id TEXT UNIQUE,
        from_email TEXT NOT NULL,
        from_name TEXT,
        to_email TEXT,
        subject TEXT NOT NULL DEFAULT '',
        text_content TEXT NOT NULL DEFAULT '',
        html_content TEXT,
        status TEXT NOT NULL DEFAULT 'new',
        reply_count INTEGER NOT NULL DEFAULT 0,
        last_replied_at TIMESTAMPTZ,
        raw_payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        received_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS support_inbox_entries_received_idx
      ON support_inbox_entries (received_at DESC);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS support_inbox_entries_status_received_idx
      ON support_inbox_entries (status, received_at DESC);
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS support_inbox_replies (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL REFERENCES support_inbox_entries(id) ON DELETE CASCADE,
        admin_user_id TEXT,
        to_email TEXT NOT NULL,
        subject TEXT NOT NULL,
        body_text TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS support_inbox_replies_entry_created_idx
      ON support_inbox_replies (entry_id, created_at DESC);
    `);

    await db.query(`
      INSERT INTO recharge_products (
        id, code, name, energy_amount, bonus_energy_amount, price_cents, currency, status, sort_order, created_at, updated_at
      )
      VALUES
        ('prod_energy_30', 'energy_30', '30 Energy', 30, 0, 990, 'USD', 'active', 10, NOW(), NOW()),
        ('prod_energy_80', 'energy_80', '80 Energy', 80, 10, 2490, 'USD', 'active', 20, NOW(), NOW()),
        ('prod_energy_200', 'energy_200', '200 Energy', 200, 40, 5990, 'USD', 'active', 30, NOW(), NOW())
      ON CONFLICT (code) DO NOTHING;
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
