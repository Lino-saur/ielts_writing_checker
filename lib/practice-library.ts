import { db, ensureDatabase } from "./db";
import { getReviewImageObject } from "./object-storage";
import type {
  PracticeQuestion,
  PracticeQuestionContentStatus,
  PracticeQuestionModule,
  PracticeQuestionSource,
  PracticeQuestionStatus,
  TaskType
} from "./types";

type PracticeQuestionRow = {
  id: string;
  source: PracticeQuestionSource;
  module: PracticeQuestionModule;
  book_number: number;
  test_number: number;
  task_type: TaskType;
  title: string;
  tags_json: string[] | null;
  prompt_text: string;
  source_ref: string | null;
  source_url: string | null;
  metadata_json: Record<string, unknown>;
  image_source_url: string | null;
  image_source_urls_json: string[] | null;
  image_object_key: string | null;
  image_name: string | null;
  image_mime_type: string | null;
  image_size_bytes: string | number | null;
  content_status: PracticeQuestionContentStatus;
  status: PracticeQuestionStatus;
  sort_order: number;
  created_at: Date | string;
  updated_at: Date | string;
};

export type PracticeQuestionFilters = {
  source?: PracticeQuestionSource;
  module?: PracticeQuestionModule;
  bookNumber?: number;
  testNumber?: number;
  taskType?: TaskType;
  contentStatus?: PracticeQuestionContentStatus;
  status?: PracticeQuestionStatus;
  limit?: number;
  offset?: number;
};

function mapPracticeQuestion(row: PracticeQuestionRow): PracticeQuestion {
  return {
    id: row.id,
    source: row.source,
    module: row.module,
    bookNumber: Number(row.book_number),
    testNumber: Number(row.test_number),
    taskType: row.task_type,
    title: row.title,
    tags: Array.isArray(row.tags_json) ? row.tags_json : [],
    prompt: row.prompt_text,
    sourceRef: row.source_ref,
    sourceUrl: row.source_url,
    metadata: row.metadata_json,
    imageSourceUrl: row.image_source_url,
    imageSourceUrls: Array.isArray(row.image_source_urls_json) ? row.image_source_urls_json : [],
    imageObjectKey: row.image_object_key,
    imageName: row.image_name,
    imageMimeType: row.image_mime_type,
    imageSizeBytes: row.image_size_bytes === null ? null : Number(row.image_size_bytes),
    contentStatus: row.content_status,
    status: row.status,
    sortOrder: Number(row.sort_order),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

function appendFilter(
  filters: string[],
  values: Array<string | number>,
  column: string,
  value: string | number | undefined
) {
  if (value === undefined) {
    return;
  }

  values.push(value);
  filters.push(`${column} = $${values.length}`);
}

export async function listPracticeQuestions(filters: PracticeQuestionFilters = {}) {
  await ensureDatabase();

  const values: Array<string | number> = [];
  const where: string[] = [];

  appendFilter(where, values, "source", filters.source ?? "cambridge_ielts");
  appendFilter(where, values, "module", filters.module ?? "academic");
  appendFilter(where, values, "book_number", filters.bookNumber);
  appendFilter(where, values, "test_number", filters.testNumber);
  appendFilter(where, values, "task_type", filters.taskType);
  appendFilter(where, values, "content_status", filters.contentStatus);
  appendFilter(where, values, "status", filters.status);

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const offset = Math.max(filters.offset ?? 0, 0);

  values.push(limit);
  const limitRef = `$${values.length}`;
  values.push(offset);
  const offsetRef = `$${values.length}`;

  const result = await db.query<PracticeQuestionRow>(
    `SELECT
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
     FROM practice_questions
     ${whereSql}
     ORDER BY book_number DESC, test_number ASC, task_type ASC
     LIMIT ${limitRef} OFFSET ${offsetRef}`,
    values
  );

  const countResult = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM practice_questions
     ${whereSql}`,
    values.slice(0, values.length - 2)
  );

  return {
    items: result.rows.map(mapPracticeQuestion),
    total: Number(countResult.rows[0]?.count || 0)
  };
}

export async function getPracticeQuestion(questionId: string) {
  await ensureDatabase();

  const result = await db.query<PracticeQuestionRow>(
    `SELECT
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
     FROM practice_questions
     WHERE id = $1
     LIMIT 1`,
    [questionId]
  );

  return result.rows[0] ? mapPracticeQuestion(result.rows[0]) : null;
}

export async function getPracticeQuestionImage(questionId: string) {
  await ensureDatabase();

  const result = await db.query<Pick<PracticeQuestionRow, "image_object_key" | "image_mime_type">>(
    `SELECT image_object_key, image_mime_type
     FROM practice_questions
     WHERE id = $1
     LIMIT 1`,
    [questionId]
  );

  const row = result.rows[0];
  if (!row?.image_object_key || !row.image_mime_type) {
    return null;
  }

  const response = await getReviewImageObject(row.image_object_key);

  return {
    mimeType: row.image_mime_type,
    body: response.body
  };
}
