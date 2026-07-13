import { Pool } from "pg";

type GlobalWithDb = typeof globalThis & {
  __ieltsPool?: Pool;
  __ieltsDbInitPromise?: Promise<void>;
};

const globalForDb = globalThis as GlobalWithDb;
const CURRENT_SCHEMA_VERSION = 11;

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
    const migrationClient = await db.connect();

    try {
      const db = migrationClient;
      await db.query("BEGIN");
      await db.query("SELECT pg_advisory_xact_lock(hashtext('ielts-writing-checker-schema'))");
      await db.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL
        );
      `);
      const appliedMigration = await db.query<{ version: number }>(
        `SELECT COALESCE(MAX(version), 0)::integer AS version
         FROM schema_migrations`
      );
      const appliedVersion = Number(appliedMigration.rows[0]?.version || 0);

      if (appliedVersion >= CURRENT_SCHEMA_VERSION) {
        await db.query("COMMIT");
        return;
      }

      if (appliedVersion < 1) {
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
      CREATE TABLE IF NOT EXISTS ai_review_requests (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        request_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        energy_cost INTEGER NOT NULL,
        review_id TEXT,
        error_code TEXT,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
    `);

    await db.query(`
      ALTER TABLE ai_review_requests
      ADD COLUMN IF NOT EXISTS request_hash TEXT;
    `);

    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ai_review_requests_user_idempotency_idx
      ON ai_review_requests (user_id, id);
    `);

    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ai_review_requests_one_pending_per_user_idx
      ON ai_review_requests (user_id)
      WHERE status = 'pending';
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS ai_review_requests_user_created_idx
      ON ai_review_requests (user_id, created_at DESC);
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS api_rate_limits (
        scope TEXT NOT NULL,
        subject TEXT NOT NULL,
        bucket_key BIGINT NOT NULL,
        request_count INTEGER NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (scope, subject, bucket_key)
      );
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS api_rate_limits_updated_idx
      ON api_rate_limits (updated_at);
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS practice_questions (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        module TEXT NOT NULL DEFAULT 'academic',
        book_number INTEGER NOT NULL,
        test_number INTEGER NOT NULL,
        task_type TEXT NOT NULL,
        title TEXT NOT NULL,
        tags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        prompt_text TEXT NOT NULL DEFAULT '',
        source_ref TEXT,
        source_url TEXT,
        metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        image_source_url TEXT,
        image_source_urls_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        image_object_key TEXT,
        image_name TEXT,
        image_mime_type TEXT,
        image_size_bytes BIGINT,
        content_status TEXT NOT NULL DEFAULT 'placeholder',
        status TEXT NOT NULL DEFAULT 'draft',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
    `);

    await db.query(`
      ALTER TABLE practice_questions
      ADD COLUMN IF NOT EXISTS module TEXT NOT NULL DEFAULT 'academic';
    `);

    await db.query(`
      ALTER TABLE practice_questions
      ADD COLUMN IF NOT EXISTS tags_json JSONB NOT NULL DEFAULT '[]'::jsonb;
    `);

    await db.query(`
      ALTER TABLE practice_questions
      ADD COLUMN IF NOT EXISTS source_ref TEXT;
    `);

    await db.query(`
      ALTER TABLE practice_questions
      ADD COLUMN IF NOT EXISTS source_url TEXT;
    `);

    await db.query(`
      ALTER TABLE practice_questions
      ADD COLUMN IF NOT EXISTS metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb;
    `);

    await db.query(`
      ALTER TABLE practice_questions
      ADD COLUMN IF NOT EXISTS image_source_url TEXT;
    `);

    await db.query(`
      ALTER TABLE practice_questions
      ADD COLUMN IF NOT EXISTS image_source_urls_json JSONB NOT NULL DEFAULT '[]'::jsonb;
    `);

    await db.query(`
      ALTER TABLE practice_questions
      ADD COLUMN IF NOT EXISTS image_size_bytes BIGINT;
    `);

    await db.query(`
      ALTER TABLE practice_questions
      ADD COLUMN IF NOT EXISTS content_status TEXT NOT NULL DEFAULT 'placeholder';
    `);

    await db.query(`
      ALTER TABLE practice_questions
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
    `);

    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS practice_questions_source_module_book_test_task_idx
      ON practice_questions (source, module, book_number, test_number, task_type);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS practice_questions_status_sort_idx
      ON practice_questions (status, sort_order ASC, book_number ASC, test_number ASC, task_type ASC);
    `);

    await db.query(`
      INSERT INTO practice_questions (
        id,
        source,
        module,
        book_number,
        test_number,
        task_type,
        title,
        tags_json,
        prompt_text,
        source_ref,
        source_url,
        metadata_json,
        image_source_url,
        image_source_urls_json,
        image_object_key,
        image_name,
        image_mime_type,
        image_size_bytes,
        content_status,
        status,
        sort_order,
        created_at,
        updated_at
      )
      SELECT
        'cambridge_ielts_' || book_number || '_test_' || test_number || '_' || task_type,
        'cambridge_ielts',
        'academic',
        book_number,
        test_number,
        task_type,
        'C' || book_number || '-T' || test_number || '-' ||
          CASE WHEN task_type = 'task1' THEN 'T1' ELSE 'T2' END,
        '[]'::jsonb,
        '',
        NULL,
        NULL,
        '{}'::jsonb,
        NULL,
        '[]'::jsonb,
        NULL,
        NULL,
        NULL,
        NULL,
        'placeholder',
        'draft',
        (book_number * 100) + (test_number * 10) + CASE WHEN task_type = 'task1' THEN 1 ELSE 2 END,
        NOW(),
        NOW()
      FROM generate_series(5, 21) AS book_number
      CROSS JOIN generate_series(1, 4) AS test_number
      CROSS JOIN (VALUES ('task1'), ('task2')) AS task_types(task_type)
      ON CONFLICT (source, module, book_number, test_number, task_type) DO NOTHING;
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
      await db.query(
        `INSERT INTO schema_migrations (version, applied_at)
         VALUES (1, NOW())`
      );
      }
      if (appliedVersion < 2) {
        await db.query(`
          CREATE TABLE IF NOT EXISTS historical_practice_questions (
            id TEXT PRIMARY KEY,
            year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
            exam_date DATE NOT NULL,
            category TEXT NOT NULL,
            question_type TEXT NOT NULL CHECK (
              question_type IN ('观点类', '讨论类', '问题解决类', '混合类')
            ),
            prompt TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL
          );
        `);

        await db.query(`
          CREATE INDEX IF NOT EXISTS historical_practice_questions_date_idx
          ON historical_practice_questions (exam_date DESC, id ASC);
        `);

        await db.query(`
          CREATE INDEX IF NOT EXISTS historical_practice_questions_filters_idx
          ON historical_practice_questions (year DESC, category, question_type);
        `);

        await db.query(
          `INSERT INTO schema_migrations (version, applied_at)
           VALUES (2, NOW())`
        );
      }
      if (appliedVersion < 4) {
        await db.query(`
          ALTER TABLE historical_practice_questions
          ADD COLUMN IF NOT EXISTS task_type TEXT NOT NULL DEFAULT 'task2';
        `);
        await db.query(`
          ALTER TABLE historical_practice_questions
          ADD COLUMN IF NOT EXISTS image_source_urls_json JSONB NOT NULL DEFAULT '[]'::jsonb;
        `);
        await db.query(`
          ALTER TABLE historical_practice_questions
          ADD COLUMN IF NOT EXISTS image_object_key TEXT;
        `);
        await db.query(`
          ALTER TABLE historical_practice_questions
          ADD COLUMN IF NOT EXISTS image_name TEXT;
        `);
        await db.query(`
          ALTER TABLE historical_practice_questions
          ADD COLUMN IF NOT EXISTS image_mime_type TEXT;
        `);
        await db.query(`
          ALTER TABLE historical_practice_questions
          ADD COLUMN IF NOT EXISTS image_size_bytes BIGINT;
        `);
        await db.query(`
          ALTER TABLE historical_practice_questions
          ALTER COLUMN question_type DROP NOT NULL;
        `);
        await db.query(`
          ALTER TABLE historical_practice_questions
          DROP CONSTRAINT IF EXISTS historical_practice_questions_question_type_check;
        `);
        await db.query(`
          ALTER TABLE historical_practice_questions
          ADD CONSTRAINT historical_practice_questions_question_type_check
          CHECK (
            (task_type = 'task1' AND question_type IS NULL)
            OR
            (task_type = 'task2' AND question_type IN ('观点类', '讨论类', '问题解决类', '混合类'))
          );
        `);
        await db.query(`
          ALTER TABLE historical_practice_questions
          DROP CONSTRAINT IF EXISTS historical_practice_questions_task_type_check;
        `);
        await db.query(`
          ALTER TABLE historical_practice_questions
          ADD CONSTRAINT historical_practice_questions_task_type_check
          CHECK (task_type IN ('task1', 'task2'));
        `);
        await db.query(`
          CREATE INDEX IF NOT EXISTS historical_practice_questions_task_date_idx
          ON historical_practice_questions (task_type, exam_date DESC);
        `);
        await db.query(
          `INSERT INTO schema_migrations (version, applied_at)
           VALUES (4, NOW())`
        );
      }
      if (appliedVersion < 5) {
        await db.query(`
          ALTER TABLE historical_practice_questions
          ADD COLUMN IF NOT EXISTS importance INTEGER NOT NULL DEFAULT 3;
        `);
        await db.query(`
          ALTER TABLE historical_practice_questions
          DROP CONSTRAINT IF EXISTS historical_practice_questions_importance_check;
        `);
        await db.query(`
          ALTER TABLE historical_practice_questions
          ADD CONSTRAINT historical_practice_questions_importance_check
          CHECK (importance BETWEEN 1 AND 5);
        `);
        await db.query(`
          CREATE INDEX IF NOT EXISTS historical_practice_questions_importance_date_idx
          ON historical_practice_questions (importance DESC, exam_date DESC);
        `);
        await db.query(
          `INSERT INTO schema_migrations (version, applied_at)
           VALUES (5, NOW())`
        );
      }
      if (appliedVersion < 6) {
        await db.query(`
          CREATE TABLE IF NOT EXISTS teaching_rules (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            task_type TEXT NOT NULL CHECK (task_type IN ('all', 'task1', 'task2')),
            question_types_json JSONB NOT NULL DEFAULT '[]'::jsonb,
            tags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
            rule_category TEXT NOT NULL CHECK (
              rule_category IN ('scoring', 'grammar', 'structure', 'argumentation', 'expression', 'framework')
            ),
            principle TEXT NOT NULL,
            positive_example TEXT,
            negative_example TEXT,
            severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
            priority INTEGER NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
            source_title TEXT,
            source_section TEXT,
            knowledge_point_code TEXT,
            source_page TEXT,
            status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
            version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
            published_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL
          );
        `);
        await db.query(`
          CREATE INDEX IF NOT EXISTS teaching_rules_status_priority_idx
          ON teaching_rules (status, priority DESC, updated_at DESC);
        `);
        await db.query(`
          CREATE INDEX IF NOT EXISTS teaching_rules_scope_idx
          ON teaching_rules (task_type, rule_category, status);
        `);
        await db.query(
          `INSERT INTO schema_migrations (version, applied_at)
           VALUES (6, NOW())`
        );
      }
      if (appliedVersion < 7) {
        await db.query(`
          CREATE TABLE IF NOT EXISTS teaching_rule_versions (
            rule_id TEXT NOT NULL REFERENCES teaching_rules(id),
            version INTEGER NOT NULL CHECK (version > 0),
            snapshot_json JSONB NOT NULL,
            published_at TIMESTAMPTZ NOT NULL,
            PRIMARY KEY (rule_id, version)
          );
        `);
        await db.query(`
          CREATE INDEX IF NOT EXISTS teaching_rule_versions_published_idx
          ON teaching_rule_versions (published_at DESC);
        `);
        await db.query(
          `INSERT INTO schema_migrations (version, applied_at)
           VALUES (7, NOW())`
        );
      }
      if (appliedVersion < 8) {
        await db.query(`
          ALTER TABLE teaching_rules
          ADD COLUMN IF NOT EXISTS rule_origin TEXT NOT NULL DEFAULT 'system';
        `);
        await db.query(`
          ALTER TABLE teaching_rules
          DROP CONSTRAINT IF EXISTS teaching_rules_rule_origin_check;
        `);
        await db.query(`
          ALTER TABLE teaching_rules
          ADD CONSTRAINT teaching_rules_rule_origin_check
          CHECK (rule_origin IN ('ielts_official', 'courseware', 'system'));
        `);
        await db.query(`
          CREATE INDEX IF NOT EXISTS teaching_rules_origin_status_idx
          ON teaching_rules (rule_origin, status, priority DESC);
        `);
        await db.query(`
          INSERT INTO teaching_rules (
            id, name, task_type, question_types_json, tags_json, rule_origin,
            rule_category, principle, positive_example, negative_example,
            severity, priority, source_title, source_section, knowledge_point_code,
            source_page, status, version, published_at, created_at, updated_at
          )
          VALUES
            (
              'seed_ielts_task1_key_features', 'Select key features', 'task1', '[]'::jsonb,
              '["task-achievement","selection"]'::jsonb, 'ielts_official', 'scoring',
              'Identify and report the key features of the chart, graph, table, map, or process instead of describing every available detail.',
              NULL, NULL, 'high', 95, 'IELTS Academic Writing Assessment Criteria',
              'Task 1 · Task Achievement', 'TA-1', NULL, 'published', 1, NOW(), NOW(), NOW()
            ),
            (
              'seed_ielts_task1_overview', 'Provide a clear overview', 'task1', '[]'::jsonb,
              '["task-achievement","overview"]'::jsonb, 'ielts_official', 'structure',
              'Provide a clear overview that summarizes the most important trends, stages, changes, or differences.',
              NULL, NULL, 'high', 100, 'IELTS Academic Writing Assessment Criteria',
              'Task 1 · Task Achievement', 'TA-2', NULL, 'published', 1, NOW(), NOW(), NOW()
            ),
            (
              'seed_ielts_task1_comparisons', 'Make relevant comparisons', 'task1', '[]'::jsonb,
              '["task-achievement","comparison"]'::jsonb, 'ielts_official', 'argumentation',
              'Select important comparisons and trends and organize them meaningfully rather than presenting an unstructured list of details.',
              NULL, NULL, 'high', 90, 'IELTS Academic Writing Assessment Criteria',
              'Task 1 · Task Achievement', 'TA-3', NULL, 'published', 1, NOW(), NOW(), NOW()
            ),
            (
              'seed_ielts_task1_accuracy', 'Report data accurately', 'task1', '[]'::jsonb,
              '["task-achievement","accuracy"]'::jsonb, 'ielts_official', 'scoring',
              'Describe data, categories, dates, rankings, directions, stages, and trends accurately and only include information relevant to the task.',
              NULL, NULL, 'high', 100, 'IELTS Academic Writing Assessment Criteria',
              'Task 1 · Task Achievement', 'TA-4', NULL, 'published', 1, NOW(), NOW(), NOW()
            ),
            (
              'seed_ielts_task2_answer_question', 'Answer the question directly', 'task2', '[]'::jsonb,
              '["task-response","relevance"]'::jsonb, 'ielts_official', 'scoring',
              'Address every part of the task directly and keep the response relevant to the question.',
              NULL, NULL, 'high', 100, 'IELTS Writing Assessment Criteria',
              'Task 2 · Task Response', 'TR-1', NULL, 'published', 1, NOW(), NOW(), NOW()
            ),
            (
              'seed_ielts_task2_position', 'Maintain a clear position', 'task2', '[]'::jsonb,
              '["task-response","position"]'::jsonb, 'ielts_official', 'structure',
              'Present a clear position and maintain it consistently throughout the response.',
              NULL, NULL, 'high', 100, 'IELTS Writing Assessment Criteria',
              'Task 2 · Task Response', 'TR-2', NULL, 'published', 1, NOW(), NOW(), NOW()
            ),
            (
              'seed_ielts_task2_development', 'Develop supporting ideas', 'task2', '[]'::jsonb,
              '["task-response","development"]'::jsonb, 'ielts_official', 'argumentation',
              'Develop the main ideas sufficiently with relevant explanations, reasoning, and support.',
              NULL, NULL, 'high', 95, 'IELTS Writing Assessment Criteria',
              'Task 2 · Task Response', 'TR-3', NULL, 'published', 1, NOW(), NOW(), NOW()
            ),
            (
              'seed_ielts_task2_cohesion', 'Connect ideas logically', 'task2', '[]'::jsonb,
              '["coherence","cohesion","paragraph"]'::jsonb, 'ielts_official', 'structure',
              'Organize information and ideas logically so that body paragraphs are focused, relevant, and clearly connected.',
              NULL, NULL, 'high', 90, 'IELTS Writing Assessment Criteria',
              'Coherence and Cohesion', 'CC-1', NULL, 'published', 1, NOW(), NOW(), NOW()
            ),
            (
              'seed_system_task1_image_consistency', 'Check Task 1 image consistency', 'task1', '[]'::jsonb,
              '["image","accuracy","multimodal"]'::jsonb, 'system', 'scoring',
              'Compare claims about figures, categories, dates, rankings, directions, stages, and trends against the uploaded image. Treat conflicts as Task Achievement accuracy problems.',
              NULL, NULL, 'high', 100, 'System Review Rules',
              'Task 1 image consistency', 'SYS-T1-1', NULL, 'published', 1, NOW(), NOW(), NOW()
            ),
            (
              'seed_system_task1_image_relevance', 'Detect unrelated Task 1 images', 'task1', '[]'::jsonb,
              '["image","relevance","multimodal"]'::jsonb, 'system', 'scoring',
              'If the uploaded image is unrelated to the written prompt or does not match the expected Task 1 visual, explicitly report the mismatch.',
              NULL, NULL, 'high', 100, 'System Review Rules',
              'Task 1 image consistency', 'SYS-T1-2', NULL, 'published', 1, NOW(), NOW(), NOW()
            ),
            (
              'seed_system_task1_unreadable_values', 'Do not invent unreadable values', 'task1', '[]'::jsonb,
              '["image","uncertainty","multimodal"]'::jsonb, 'system', 'scoring',
              'Do not invent values that cannot be read confidently from the image. State the uncertainty and judge only what the visual supports.',
              NULL, NULL, 'high', 100, 'System Review Rules',
              'Task 1 image consistency', 'SYS-T1-3', NULL, 'published', 1, NOW(), NOW(), NOW()
            ),
            (
              'seed_system_task1_revision_accuracy', 'Correct inaccurate Task 1 claims', 'task1', '[]'::jsonb,
              '["image","revision"]'::jsonb, 'system', 'expression',
              'During revision, do not preserve clearly incorrect data claims. Correct or generalize them so the revised response remains consistent with the visible image.',
              NULL, NULL, 'high', 100, 'System Review Rules',
              'Task 1 revision', 'SYS-T1-4', NULL, 'published', 1, NOW(), NOW(), NOW()
            ),
            (
              'seed_system_task2_causal_chain', 'Develop a clear causal chain', 'task2', '[]'::jsonb,
              '["argumentation","causal-chain","development"]'::jsonb, 'system', 'argumentation',
              'When an argument depends on cause and effect, make each link explicit: A leads to B, B leads to C, and C leads to D. The chain must remain relevant, sufficiently explained, and connected to the question.',
              NULL, NULL, 'medium', 75, 'System Review Rules',
              'Task 2 idea development', 'SYS-T2-1', NULL, 'published', 1, NOW(), NOW(), NOW()
            ),
            (
              'seed_system_preserve_core_stance', 'Preserve the student’s core stance', 'all', '[]'::jsonb,
              '["revision"]'::jsonb, 'system', 'expression',
              'During revision, preserve the student’s core stance, major supporting points, and overall paragraph plan unless a change is required to correct a clear task-response or factual problem.',
              NULL, NULL, 'high', 95, 'System Review Rules',
              'Revision stages', 'SYS-REV-0', NULL, 'published', 1, NOW(), NOW(), NOW()
            ),
            (
              'seed_system_grammar_scope', 'Grammar revision scope', 'all', '[]'::jsonb,
              '["stage:grammar","revision"]'::jsonb, 'system', 'grammar',
              'For grammar revision, focus on tense, agreement, articles, prepositions, word form, sentence and clause structure, verb patterns, voice, pronoun reference, parallelism, punctuation, capitalization, collocation, naturalness, and other clear mechanics issues. Do not significantly expand ideas.',
              NULL, NULL, 'high', 100, 'System Review Rules',
              'Revision stages', 'SYS-REV-1', NULL, 'published', 1, NOW(), NOW(), NOW()
            ),
            (
              'seed_system_optimization_scope', 'Article optimization scope', 'all', '[]'::jsonb,
              '["stage:optimization","revision"]'::jsonb, 'system', 'expression',
              'For article optimization, improve idea development, cohesion, clarity, concision, lexical choice, paragraph flow, and task response quality while preserving the student’s core stance and keeping grammar correct.',
              NULL, NULL, 'high', 100, 'System Review Rules',
              'Revision stages', 'SYS-REV-2', NULL, 'published', 1, NOW(), NOW(), NOW()
            )
          ON CONFLICT (id) DO NOTHING;
        `);
        await db.query(`
          INSERT INTO teaching_rule_versions (rule_id, version, snapshot_json, published_at)
          SELECT id, version, to_jsonb(teaching_rules), COALESCE(published_at, NOW())
          FROM teaching_rules
          WHERE id LIKE 'seed_%' AND version > 0
          ON CONFLICT (rule_id, version) DO NOTHING;
        `);
        await db.query(
          `INSERT INTO schema_migrations (version, applied_at)
           VALUES (8, NOW())`
        );
      }
      if (appliedVersion < 9) {
        await db.query(`
          CREATE TABLE IF NOT EXISTS writing_assignments (
            id TEXT PRIMARY KEY,
            teacher_admin_user_id TEXT NOT NULL,
            title TEXT NOT NULL,
            task_type TEXT NOT NULL CHECK (task_type IN ('task1', 'task2')),
            prompt_text TEXT NOT NULL,
            instructions TEXT NOT NULL DEFAULT '',
            due_at TIMESTAMPTZ,
            status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'closed')),
            created_at TIMESTAMPTZ NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL
          );
        `);
        await db.query(`
          CREATE INDEX IF NOT EXISTS writing_assignments_teacher_created_idx
          ON writing_assignments (teacher_admin_user_id, created_at DESC);
        `);
        await db.query(`
          CREATE INDEX IF NOT EXISTS writing_assignments_status_due_idx
          ON writing_assignments (status, due_at ASC NULLS LAST);
        `);
        await db.query(`
          CREATE TABLE IF NOT EXISTS assignment_recipients (
            assignment_id TEXT NOT NULL REFERENCES writing_assignments(id) ON DELETE CASCADE,
            student_user_id TEXT NOT NULL,
            assigned_at TIMESTAMPTZ NOT NULL,
            PRIMARY KEY (assignment_id, student_user_id)
          );
        `);
        await db.query(`
          CREATE INDEX IF NOT EXISTS assignment_recipients_student_idx
          ON assignment_recipients (student_user_id, assigned_at DESC);
        `);
        await db.query(`
          CREATE TABLE IF NOT EXISTS assignment_submissions (
            id TEXT PRIMARY KEY,
            assignment_id TEXT NOT NULL REFERENCES writing_assignments(id) ON DELETE CASCADE,
            student_user_id TEXT NOT NULL,
            essay_text TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewed')),
            teacher_feedback TEXT,
            teacher_score NUMERIC(3, 1),
            reviewed_by_admin_user_id TEXT,
            submitted_at TIMESTAMPTZ NOT NULL,
            reviewed_at TIMESTAMPTZ,
            updated_at TIMESTAMPTZ NOT NULL,
            UNIQUE (assignment_id, student_user_id)
          );
        `);
        await db.query(`
          CREATE INDEX IF NOT EXISTS assignment_submissions_assignment_updated_idx
          ON assignment_submissions (assignment_id, updated_at DESC);
        `);
        await db.query(`
          CREATE INDEX IF NOT EXISTS assignment_submissions_student_updated_idx
          ON assignment_submissions (student_user_id, updated_at DESC);
        `);
        await db.query(
          `INSERT INTO schema_migrations (version, applied_at)
           VALUES (9, NOW())`
        );
      }
      if (appliedVersion < 10) {
        await db.query(`
          ALTER TABLE writing_assignments
          ADD COLUMN IF NOT EXISTS image_object_key TEXT;
        `);
        await db.query(`
          ALTER TABLE writing_assignments
          ADD COLUMN IF NOT EXISTS image_name TEXT;
        `);
        await db.query(`
          ALTER TABLE writing_assignments
          ADD COLUMN IF NOT EXISTS image_mime_type TEXT;
        `);
        await db.query(`
          ALTER TABLE writing_assignments
          ADD COLUMN IF NOT EXISTS image_size_bytes BIGINT;
        `);
        await db.query(`
          CREATE TABLE IF NOT EXISTS writing_classes (
            id TEXT PRIMARY KEY,
            teacher_admin_user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL
          );
        `);
        await db.query(`
          CREATE INDEX IF NOT EXISTS writing_classes_teacher_updated_idx
          ON writing_classes (teacher_admin_user_id, updated_at DESC);
        `);
        await db.query(`
          CREATE TABLE IF NOT EXISTS writing_class_students (
            class_id TEXT NOT NULL REFERENCES writing_classes(id) ON DELETE CASCADE,
            student_user_id TEXT NOT NULL,
            added_at TIMESTAMPTZ NOT NULL,
            PRIMARY KEY (class_id, student_user_id)
          );
        `);
        await db.query(`
          CREATE INDEX IF NOT EXISTS writing_class_students_student_idx
          ON writing_class_students (student_user_id, added_at DESC);
        `);
        await db.query(
          `INSERT INTO schema_migrations (version, applied_at)
           VALUES (10, NOW())`
        );
      }
      if (appliedVersion < 11) {
        await db.query(`
          ALTER TABLE writing_assignments
          ADD COLUMN IF NOT EXISTS allow_late_submission BOOLEAN NOT NULL DEFAULT FALSE;
        `);
        await db.query(`
          ALTER TABLE writing_assignments
          ADD COLUMN IF NOT EXISTS allow_resubmission BOOLEAN NOT NULL DEFAULT TRUE;
        `);
        await db.query(`
          ALTER TABLE writing_assignments
          ADD COLUMN IF NOT EXISTS late_due_at TIMESTAMPTZ;
        `);
        await db.query(`
          ALTER TABLE assignment_submissions
          ADD COLUMN IF NOT EXISTS teacher_feedback_items JSONB NOT NULL DEFAULT '[]'::jsonb;
        `);
        await db.query(`
          ALTER TABLE assignment_submissions
          ADD COLUMN IF NOT EXISTS teacher_score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb;
        `);
        await db.query(`
          ALTER TABLE assignment_submissions
          ADD COLUMN IF NOT EXISTS rewrite_required BOOLEAN NOT NULL DEFAULT FALSE;
        `);
        await db.query(`
          ALTER TABLE assignment_submissions
          ADD COLUMN IF NOT EXISTS is_late BOOLEAN NOT NULL DEFAULT FALSE;
        `);
        await db.query(`
          ALTER TABLE assignment_submissions
          ADD COLUMN IF NOT EXISTS late_submitted_at TIMESTAMPTZ;
        `);
        await db.query(
          `INSERT INTO schema_migrations (version, applied_at)
           VALUES (11, NOW())`
        );
      }
      await db.query("COMMIT");
    } catch (error) {
      await migrationClient.query("ROLLBACK");
      throw error;
    } finally {
      migrationClient.release();
    }
  })();

  globalForDb.__ieltsDbInitPromise = initPromise;

  try {
    await initPromise;
  } catch (error) {
    globalForDb.__ieltsDbInitPromise = undefined;
    throw error;
  }
}
