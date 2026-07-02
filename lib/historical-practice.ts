import { db, ensureDatabase } from "@/lib/db";
import type { HistoricalPracticeQuestion } from "@/lib/types";

type HistoricalPracticeRow = {
  id: string;
  year: number;
  exam_date: string | Date;
  category: string;
  question_type: HistoricalPracticeQuestion["type"];
  prompt: string;
};

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
    category: row.category,
    type: row.question_type,
    prompt: row.prompt
  };
}

export async function listHistoricalPracticeQuestions() {
  await ensureDatabase();
  const result = await db.query<HistoricalPracticeRow>(
    `SELECT id, year, exam_date, category, question_type, prompt
     FROM historical_practice_questions
     ORDER BY exam_date DESC, id ASC`
  );
  return result.rows.map(mapHistoricalPracticeRow);
}

export async function getHistoricalPracticeQuestion(questionId: string) {
  await ensureDatabase();
  const result = await db.query<HistoricalPracticeRow>(
    `SELECT id, year, exam_date, category, question_type, prompt
     FROM historical_practice_questions
     WHERE id = $1
     LIMIT 1`,
    [questionId]
  );
  return result.rows[0] ? mapHistoricalPracticeRow(result.rows[0]) : null;
}
