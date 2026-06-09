import { randomUUID } from "node:crypto";
import { db, ensureDatabase } from "./db";
import type { FeedbackEntry, FeedbackPayload, FeedbackStatus } from "./types";

type CreateFeedbackInput = FeedbackPayload & {
  userId: string;
};

type FeedbackRow = {
  id: string;
  user_id: string;
  kind: FeedbackEntry["kind"];
  status: FeedbackStatus;
  helpful: boolean | null;
  category: string | null;
  comment: string;
  page: string;
  task_type: FeedbackEntry["taskType"];
  target_band: number | string | null;
  provider_used: FeedbackEntry["providerUsed"];
  feedback_mode: FeedbackEntry["feedbackMode"];
  estimated_band: number | string | null;
  word_count: number | null;
  payload_json: Record<string, unknown> | null;
  created_at: Date | string;
};

export type FeedbackListFilters = {
  kind?: FeedbackEntry["kind"] | "all";
  status?: FeedbackStatus | "all";
  helpful?: "all" | "helpful" | "not_helpful" | "unrated";
  q?: string;
  limit?: number;
};

function mapFeedbackRow(row: FeedbackRow): FeedbackEntry {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    status: row.status,
    helpful: row.helpful,
    category: row.category,
    comment: row.comment,
    page: row.page,
    taskType: row.task_type,
    targetBand: row.target_band == null ? null : Number(row.target_band),
    providerUsed: row.provider_used,
    feedbackMode: row.feedback_mode,
    estimatedBand: row.estimated_band == null ? null : Number(row.estimated_band),
    wordCount: row.word_count,
    payload: row.payload_json ?? {},
    createdAt: new Date(row.created_at).toISOString()
  };
}

export async function createFeedback(input: CreateFeedbackInput) {
  await ensureDatabase();

  const createdAt = new Date().toISOString();
  const comment = input.comment?.trim() ?? "";
  const category = input.category?.trim() || null;

  await db.query(
    `INSERT INTO feedback_entries (
      id,
      user_id,
      kind,
      status,
      helpful,
      category,
      comment,
      page,
      task_type,
      target_band,
      provider_used,
      feedback_mode,
      estimated_band,
      word_count,
      payload_json,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16)`,
    [
      randomUUID(),
      input.userId,
      input.kind,
      "new",
      input.helpful,
      category,
      comment,
      input.page,
      input.taskType ?? null,
      input.targetBand ?? null,
      input.providerUsed ?? null,
      input.feedbackMode ?? null,
      input.estimatedBand ?? null,
      input.wordCount ?? null,
      JSON.stringify(input.context ?? {}),
      createdAt
    ]
  );

  return {
    ok: true,
    createdAt
  };
}

export async function listFeedbackEntries(filters: FeedbackListFilters = {}) {
  await ensureDatabase();

  const conditions: string[] = [];
  const values: Array<string | number | boolean> = [];

  if (filters.kind && filters.kind !== "all") {
    values.push(filters.kind);
    conditions.push(`kind = $${values.length}`);
  }

  if (filters.status && filters.status !== "all") {
    values.push(filters.status);
    conditions.push(`status = $${values.length}`);
  }

  if (filters.helpful === "helpful") {
    conditions.push("helpful = true");
  } else if (filters.helpful === "not_helpful") {
    conditions.push("helpful = false");
  } else if (filters.helpful === "unrated") {
    conditions.push("helpful IS NULL");
  }

  if (filters.q?.trim()) {
    values.push(`%${filters.q.trim()}%`);
    conditions.push(`(comment ILIKE $${values.length} OR page ILIKE $${values.length} OR user_id ILIKE $${values.length})`);
  }

  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
  values.push(limit);

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await db.query<FeedbackRow>(
    `SELECT
      id,
      user_id,
      kind,
      status,
      helpful,
      category,
      comment,
      page,
      task_type,
      target_band,
      provider_used,
      feedback_mode,
      estimated_band,
      word_count,
      payload_json,
      created_at
    FROM feedback_entries
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${values.length}`,
    values
  );

  return result.rows.map(mapFeedbackRow);
}
