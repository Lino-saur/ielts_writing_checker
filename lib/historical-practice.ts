import { db, ensureDatabase } from "@/lib/db";
import { getReviewImageObject } from "@/lib/object-storage";
import type {
  HistoricalImportance,
  HistoricalPracticeQuestion,
  HistoricalQuestionType,
  TaskType
} from "@/lib/types";

const QUESTION_TYPES: HistoricalQuestionType[] = [
  "观点类",
  "讨论类",
  "问题解决类",
  "混合类"
];
const HISTORICAL_PAGE_SIZE = 24;

type HistoricalPracticeRow = {
  id: string;
  year: number;
  exam_date: string | Date;
  task_type: HistoricalPracticeQuestion["taskType"];
  category: string;
  question_type: HistoricalPracticeQuestion["type"];
  importance: number;
  prompt: string;
  image_object_key: string | null;
  image_name: string | null;
  image_mime_type: string | null;
  image_size_bytes: string | number | null;
};

export type HistoricalPracticeFilters = {
  taskType: TaskType | null;
  year: number | null;
  category: string | null;
  type: HistoricalQuestionType | null;
  importance: HistoricalImportance | null;
  page: number;
  pageSize: number;
};

export function normalizeHistoricalPracticeFilters(input: {
  taskType?: string | null;
  year?: string | null;
  category?: string | null;
  type?: string | null;
  importance?: string | null;
  page?: string | null;
}): HistoricalPracticeFilters {
  const parsedYear = Number.parseInt(input.year ?? "", 10);
  const parsedPage = Number.parseInt(input.page ?? "", 10);
  const parsedImportance = Number.parseInt(input.importance ?? "", 10);
  const category = input.category?.trim().slice(0, 80) ?? "";

  return {
    taskType:
      input.taskType === "task1" || input.taskType === "task2"
        ? input.taskType
        : null,
    year:
      Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100
        ? parsedYear
        : null,
    category: category || null,
    type: QUESTION_TYPES.includes(input.type as HistoricalQuestionType)
      ? (input.type as HistoricalQuestionType)
      : null,
    importance:
      Number.isInteger(parsedImportance) &&
      parsedImportance >= 1 &&
      parsedImportance <= 5
        ? (parsedImportance as HistoricalImportance)
        : null,
    page: Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    pageSize: HISTORICAL_PAGE_SIZE
  };
}

export function mapHistoricalPracticeRow(
  row: HistoricalPracticeRow
): HistoricalPracticeQuestion {
  return {
    id: row.id,
    year: Number(row.year),
    date:
      row.exam_date instanceof Date
        ? row.exam_date.toISOString().slice(0, 10)
        : row.exam_date.slice(0, 10),
    taskType: row.task_type,
    category: row.category,
    type: row.question_type,
    importance: Number(row.importance) as HistoricalImportance,
    prompt: row.prompt,
    imageObjectKey: row.image_object_key,
    imageName: row.image_name,
    imageMimeType: row.image_mime_type,
    imageSizeBytes: row.image_size_bytes == null ? null : Number(row.image_size_bytes)
  };
}

export async function listHistoricalPracticeQuestions(
  filters: HistoricalPracticeFilters = normalizeHistoricalPracticeFilters({})
) {
  await ensureDatabase();

  const conditions: string[] = [];
  const values: Array<string | number> = [];
  if (filters.taskType) {
    values.push(filters.taskType);
    conditions.push(`task_type = $${values.length}`);
  }
  if (filters.year) {
    values.push(filters.year);
    conditions.push(`year = $${values.length}`);
  }
  if (filters.category) {
    values.push(filters.category);
    conditions.push(`category = $${values.length}`);
  }
  if (filters.type) {
    values.push(filters.type);
    conditions.push(`question_type = $${values.length}`);
  }
  if (filters.importance) {
    values.push(filters.importance);
    conditions.push(`importance >= $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (filters.page - 1) * filters.pageSize;
  const itemValues = [...values, filters.pageSize, offset];
  const facetValues: Array<string> = [];
  const facetConditions: string[] = [];
  if (filters.taskType) {
    facetValues.push(filters.taskType);
    facetConditions.push(`task_type = $${facetValues.length}`);
  }
  const facetWhere = facetConditions.length
    ? `WHERE ${facetConditions.join(" AND ")}`
    : "";

  const [itemsResult, countResult, yearsResult, categoriesResult, typesResult] =
    await Promise.all([
      db.query<HistoricalPracticeRow>(
        `SELECT id, year, exam_date::text AS exam_date, task_type, category, question_type,
                importance, prompt,
                image_object_key, image_name, image_mime_type, image_size_bytes
         FROM historical_practice_questions
         ${where}
         ORDER BY exam_date DESC, id ASC
         LIMIT $${values.length + 1}
         OFFSET $${values.length + 2}`,
        itemValues
      ),
      db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM historical_practice_questions
         ${where}`,
        values
      ),
      db.query<{ year: number }>(
        `SELECT DISTINCT year
         FROM historical_practice_questions
         ORDER BY year DESC`
      ),
      db.query<{ category: string }>(
        `SELECT DISTINCT category
         FROM historical_practice_questions
         ${facetWhere}
         ORDER BY category ASC`,
        facetValues
      ),
      db.query<{ question_type: HistoricalQuestionType }>(
        `SELECT DISTINCT question_type
         FROM historical_practice_questions
         WHERE question_type IS NOT NULL
         ORDER BY question_type ASC`
      )
    ]);

  const total = Number(countResult.rows[0]?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));

  return {
    items: itemsResult.rows.map(mapHistoricalPracticeRow),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages,
    years: yearsResult.rows.map((row) => Number(row.year)),
    categories: categoriesResult.rows.map((row) => row.category),
    types: typesResult.rows.map((row) => row.question_type)
  };
}

export async function getHistoricalPracticeQuestion(questionId: string) {
  await ensureDatabase();
  const result = await db.query<HistoricalPracticeRow>(
    `SELECT id, year, exam_date::text AS exam_date, task_type, category, question_type,
            importance, prompt,
            image_object_key, image_name, image_mime_type, image_size_bytes
     FROM historical_practice_questions
     WHERE id = $1
     LIMIT 1`,
    [questionId]
  );
  return result.rows[0] ? mapHistoricalPracticeRow(result.rows[0]) : null;
}

export async function getHistoricalPracticeQuestionImage(questionId: string) {
  const question = await getHistoricalPracticeQuestion(questionId);
  if (!question?.imageObjectKey || !question.imageMimeType) {
    return null;
  }
  const response = await getReviewImageObject(question.imageObjectKey);
  return {
    body: response.body,
    mimeType: question.imageMimeType
  };
}
