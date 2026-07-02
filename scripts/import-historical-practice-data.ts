import { access, readFile } from "node:fs/promises";
import process from "node:process";
import type {
  HistoricalPracticeQuestion,
  HistoricalQuestionType
} from "../lib/types";

type SourceEntry = {
  id: string;
  date: string;
  type?: string;
  prompt: string;
};

type SourceData = {
  years: Record<string, Record<string, SourceEntry[]>>;
};

function normalizeQuestionType(value: string | undefined, prompt: string): HistoricalQuestionType {
  const rawType = value ?? "";

  if (rawType.includes("讨论类")) return "讨论类";
  if (rawType.includes("问题解决类") || rawType.includes("解决问题类")) return "问题解决类";
  if (rawType.includes("混合类")) return "混合类";
  if (rawType.includes("观点类")) return "观点类";

  const normalizedPrompt = prompt.toLowerCase();
  if (normalizedPrompt.includes("discuss both")) return "讨论类";
  if (
    normalizedPrompt.includes("problem") ||
    normalizedPrompt.includes("solution") ||
    normalizedPrompt.includes("cause")
  ) {
    return "问题解决类";
  }
  if (
    normalizedPrompt.includes("agree or disagree") ||
    normalizedPrompt.includes("to what extent") ||
    normalizedPrompt.includes("positive or negative") ||
    normalizedPrompt.includes("outweigh")
  ) {
    return "观点类";
  }
  return "混合类";
}

function normalizeDate(value: string) {
  const [year, month, day] = value.split(".").map((part) => Number.parseInt(part, 10));
  const date = [
    String(year),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0")
  ].join("-");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new Error(`Invalid historical question date: ${value}`);
  }
  return date;
}

function normalizePrompt(value: string) {
  return value
    .trim()
    .replace(/^（([AB])卷）\s*/u, "[$1] ")
    .replace(/^[\p{Script=Han}/]+类\s+(?:观点类|讨论类|问题解决类|混合类)\s+/u, "")
    .replace(/\s*(?:观点类|讨论类|问题解决类|观点)(?:[-（\s].*)?$/u, "")
    .trim();
}

function flattenSource(source: SourceData): HistoricalPracticeQuestion[] {
  const questions = Object.entries(source.years).flatMap(([year, categories]) =>
    Object.entries(categories).flatMap(([category, entries]) =>
      entries.map((entry) => ({
        id: entry.id,
        year: Number(year),
        date: normalizeDate(entry.date),
        taskType: "task2" as const,
        category,
        type: normalizeQuestionType(entry.type, entry.prompt),
        importance: 3 as const,
        prompt: normalizePrompt(entry.prompt),
        imageObjectKey: null,
        imageName: null,
        imageMimeType: null,
        imageSizeBytes: null
      }))
    )
  );
  const ids = new Set(questions.map((question) => question.id));

  if (ids.size !== questions.length) {
    throw new Error("Historical question source contains duplicate ids.");
  }
  if (questions.some((question) => !question.id || !question.category || !question.prompt)) {
    throw new Error("Historical question source contains incomplete records.");
  }
  return questions;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    try {
      await access(".env.local");
      process.loadEnvFile(".env.local");
    } catch {
      // Production and CI environments normally inject DATABASE_URL directly.
    }
  }

  const sourcePath = process.argv[2];
  if (!sourcePath) {
    throw new Error(
      "Usage: npm run db:import:historical -- /absolute/path/to/data.json"
    );
  }

  const source = JSON.parse(await readFile(sourcePath, "utf8")) as SourceData;
  const questions = flattenSource(source);
  const { db, ensureDatabase } = await import("../lib/db");

  try {
    await ensureDatabase();
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO historical_practice_questions (
           id, year, exam_date, category, question_type, prompt, created_at, updated_at
         )
         SELECT
           source.id,
           source.year,
           source.exam_date,
           source.category,
           source.question_type,
           source.prompt,
           NOW(),
           NOW()
         FROM jsonb_to_recordset($1::jsonb) AS source(
           id TEXT,
           year INTEGER,
           exam_date DATE,
           category TEXT,
           question_type TEXT,
           prompt TEXT
         )
         ON CONFLICT (id) DO UPDATE SET
           year = EXCLUDED.year,
           exam_date = EXCLUDED.exam_date,
           category = EXCLUDED.category,
           question_type = EXCLUDED.question_type,
           prompt = EXCLUDED.prompt,
           updated_at = NOW()`,
        [
          JSON.stringify(
            questions.map((question) => ({
              id: question.id,
              year: question.year,
              exam_date: question.date,
              category: question.category,
              question_type: question.type,
              prompt: question.prompt
            }))
          )
        ]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const countResult = await db.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM historical_practice_questions"
    );
    console.log(
      `Imported ${questions.length} historical questions. Database total: ${countResult.rows[0]?.count ?? 0}.`
    );
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(
    "Historical question import failed.",
    error instanceof Error ? error.message : "UNKNOWN_ERROR"
  );
  process.exitCode = 1;
});
