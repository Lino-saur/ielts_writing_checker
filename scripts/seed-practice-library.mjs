import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  ssl:
    process.env.POSTGRES_SSL === "false"
      ? false
      : process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false
});

try {
  await pool.query(`
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

  await pool.query(`
    ALTER TABLE practice_questions
    ADD COLUMN IF NOT EXISTS module TEXT NOT NULL DEFAULT 'academic';
  `);

  await pool.query(`
    ALTER TABLE practice_questions
    ADD COLUMN IF NOT EXISTS tags_json JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);

  await pool.query(`
    ALTER TABLE practice_questions
    ADD COLUMN IF NOT EXISTS source_ref TEXT;
  `);

  await pool.query(`
    ALTER TABLE practice_questions
    ADD COLUMN IF NOT EXISTS source_url TEXT;
  `);

  await pool.query(`
    ALTER TABLE practice_questions
    ADD COLUMN IF NOT EXISTS metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb;
  `);

  await pool.query(`
    ALTER TABLE practice_questions
    ADD COLUMN IF NOT EXISTS image_source_url TEXT;
  `);

  await pool.query(`
    ALTER TABLE practice_questions
    ADD COLUMN IF NOT EXISTS image_source_urls_json JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);

  await pool.query(`
    ALTER TABLE practice_questions
    ADD COLUMN IF NOT EXISTS image_size_bytes BIGINT;
  `);

  await pool.query(`
    ALTER TABLE practice_questions
    ADD COLUMN IF NOT EXISTS content_status TEXT NOT NULL DEFAULT 'placeholder';
  `);

  await pool.query(`
    ALTER TABLE practice_questions
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS practice_questions_source_module_book_test_task_idx
    ON practice_questions (source, module, book_number, test_number, task_type);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS practice_questions_status_sort_idx
    ON practice_questions (status, sort_order ASC, book_number ASC, test_number ASC, task_type ASC);
  `);

  const result = await pool.query(`
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
    FROM generate_series(5, 20) AS book_number
    CROSS JOIN generate_series(1, 4) AS test_number
    CROSS JOIN (VALUES ('task1'), ('task2')) AS task_types(task_type)
    ON CONFLICT (source, module, book_number, test_number, task_type) DO NOTHING
    RETURNING id;
  `);

  console.log(`Seeded ${result.rowCount} Cambridge IELTS practice question placeholders.`);
} finally {
  await pool.end();
}
