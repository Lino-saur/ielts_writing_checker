import { randomUUID } from "node:crypto";
import { ApiError, requireBoundedString } from "@/lib/api-security";
import { db, ensureDatabase } from "@/lib/db";
import { mapHistoricalPracticeRow } from "@/lib/historical-practice";
import type {
  HistoricalPracticeQuestion,
  HistoricalQuestionType
} from "@/lib/types";

const QUESTION_TYPES: HistoricalQuestionType[] = [
  "观点类",
  "讨论类",
  "问题解决类",
  "混合类"
];

type HistoricalPracticeRow = {
  id: string;
  year: number;
  exam_date: string | Date;
  category: string;
  question_type: HistoricalQuestionType;
  prompt: string;
};

export type AdminHistoricalQuestionFilters = {
  q: string;
  year: number | null;
  type: HistoricalQuestionType | null;
  page: number;
  pageSize: number;
};

export type HistoricalQuestionInput = {
  date?: unknown;
  category?: unknown;
  type?: unknown;
  prompt?: unknown;
};

export function normalizeAdminHistoricalQuestionFilters(input: {
  q?: string | null;
  year?: string | null;
  type?: string | null;
  page?: string | null;
}): AdminHistoricalQuestionFilters {
  const parsedYear = Number.parseInt(input.year ?? "", 10);
  const parsedPage = Number.parseInt(input.page ?? "", 10);

  return {
    q: input.q?.trim().slice(0, 200) ?? "",
    year: Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100
      ? parsedYear
      : null,
    type: QUESTION_TYPES.includes(input.type as HistoricalQuestionType)
      ? (input.type as HistoricalQuestionType)
      : null,
    page: Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    pageSize: 30
  };
}

export function validateHistoricalQuestionInput(
  input: HistoricalQuestionInput
): Omit<HistoricalPracticeQuestion, "id"> {
  const date = requireBoundedString(input.date, "date", { maxLength: 10 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ApiError("INVALID_DATE", 400);
  }

  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
    throw new ApiError("INVALID_DATE", 400);
  }

  if (!QUESTION_TYPES.includes(input.type as HistoricalQuestionType)) {
    throw new ApiError("INVALID_QUESTION_TYPE", 400);
  }

  return {
    year: Number(date.slice(0, 4)),
    date,
    category: requireBoundedString(input.category, "category", { maxLength: 80 }),
    type: input.type as HistoricalQuestionType,
    prompt: requireBoundedString(input.prompt, "prompt", {
      minLength: 10,
      maxLength: 5000
    })
  };
}

export async function listAdminHistoricalQuestions(
  filters: AdminHistoricalQuestionFilters
) {
  await ensureDatabase();

  const conditions: string[] = [];
  const values: Array<string | number> = [];
  if (filters.q) {
    values.push(`%${filters.q}%`);
    conditions.push(
      `(id ILIKE $${values.length} OR category ILIKE $${values.length} OR prompt ILIKE $${values.length})`
    );
  }
  if (filters.year) {
    values.push(filters.year);
    conditions.push(`year = $${values.length}`);
  }
  if (filters.type) {
    values.push(filters.type);
    conditions.push(`question_type = $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (filters.page - 1) * filters.pageSize;
  const itemValues = [...values, filters.pageSize, offset];

  const [itemsResult, countResult, yearsResult] = await Promise.all([
    db.query<HistoricalPracticeRow>(
      `SELECT id, year, exam_date, category, question_type, prompt
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
    )
  ]);

  const total = Number(countResult.rows[0]?.count ?? 0);
  return {
    items: itemsResult.rows.map(mapHistoricalPracticeRow),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
    years: yearsResult.rows.map((row) => Number(row.year)),
    types: QUESTION_TYPES
  };
}

export async function createAdminHistoricalQuestion(input: HistoricalQuestionInput) {
  await ensureDatabase();
  const question = validateHistoricalQuestionInput(input);
  const id = `historical_${question.date.replaceAll("-", "")}_${randomUUID().slice(0, 8)}`;
  const result = await db.query<HistoricalPracticeRow>(
    `INSERT INTO historical_practice_questions (
       id, year, exam_date, category, question_type, prompt, created_at, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
     RETURNING id, year, exam_date, category, question_type, prompt`,
    [id, question.year, question.date, question.category, question.type, question.prompt]
  );
  return mapHistoricalPracticeRow(result.rows[0]);
}

export async function updateAdminHistoricalQuestion(
  id: unknown,
  input: HistoricalQuestionInput
) {
  await ensureDatabase();
  const questionId = requireBoundedString(id, "id", { maxLength: 180 });
  const question = validateHistoricalQuestionInput(input);
  const result = await db.query<HistoricalPracticeRow>(
    `UPDATE historical_practice_questions
     SET year = $2,
         exam_date = $3,
         category = $4,
         question_type = $5,
         prompt = $6,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, year, exam_date, category, question_type, prompt`,
    [
      questionId,
      question.year,
      question.date,
      question.category,
      question.type,
      question.prompt
    ]
  );

  if (!result.rows[0]) {
    throw new ApiError("HISTORICAL_QUESTION_NOT_FOUND", 404);
  }
  return mapHistoricalPracticeRow(result.rows[0]);
}
