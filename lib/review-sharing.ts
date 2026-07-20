import { randomBytes, randomUUID } from "node:crypto";
import { db, ensureDatabase } from "./db";
import type { Locale, WritingCheckResult, WritingReviewDetail } from "./types";

type ShareRow = {
  id: string;
  review_id: string;
  user_id: string;
  token: string;
  locale: Locale;
  revoked_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type SharedReviewRow = ShareRow & {
  task_type: WritingReviewDetail["taskType"];
  prompt_text: string;
  essay_text: string;
  result_json: WritingCheckResult;
  provider_used: WritingReviewDetail["providerUsed"];
  target_band: number | string;
  estimated_band: number | string;
  word_count: number;
  review_created_at: Date | string;
  review_updated_at: Date | string;
};

export type ReviewShareState = {
  active: boolean;
  token: string | null;
  createdAt: string | null;
};

export type SharedWritingReview = {
  locale: Locale;
  sharedAt: string;
  detail: Omit<WritingReviewDetail, "userId" | "result"> & { result: WritingCheckResult };
};

function mapShareState(row?: ShareRow): ReviewShareState {
  return {
    active: Boolean(row && !row.revoked_at),
    token: row && !row.revoked_at ? row.token : null,
    createdAt: row && !row.revoked_at ? new Date(row.created_at).toISOString() : null
  };
}

export async function getReviewShareState(userId: string, reviewId: string) {
  await ensureDatabase();
  const result = await db.query<ShareRow>(
    `SELECT id, review_id, user_id, token, locale, revoked_at, created_at, updated_at
     FROM writing_review_shares
     WHERE review_id = $1 AND user_id = $2
     LIMIT 1`,
    [reviewId, userId]
  );
  return mapShareState(result.rows[0]);
}

export async function createReviewShare(userId: string, reviewId: string, locale: Locale) {
  await ensureDatabase();
  const token = randomBytes(32).toString("base64url");
  const result = await db.query<ShareRow>(
    `INSERT INTO writing_review_shares (
       id, review_id, user_id, token, locale, created_at, updated_at, revoked_at
     )
     SELECT $1, wr.id, wr.user_id, $4, $5, NOW(), NOW(), NULL
     FROM writing_reviews wr
     WHERE wr.id = $2 AND wr.user_id = $3 AND wr.status = 'completed' AND wr.result_json IS NOT NULL
     ON CONFLICT (review_id)
     DO UPDATE SET
       token = CASE
         WHEN writing_review_shares.revoked_at IS NULL THEN writing_review_shares.token
         ELSE EXCLUDED.token
       END,
       locale = EXCLUDED.locale,
       created_at = CASE
         WHEN writing_review_shares.revoked_at IS NULL THEN writing_review_shares.created_at
         ELSE NOW()
       END,
       updated_at = NOW(),
       revoked_at = NULL
     RETURNING id, review_id, user_id, token, locale, revoked_at, created_at, updated_at`,
    [randomUUID(), reviewId, userId, token, locale]
  );

  if (!result.rows[0]) {
    throw new Error("REVIEW_NOT_SHAREABLE");
  }
  return mapShareState(result.rows[0]);
}

export async function revokeReviewShare(userId: string, reviewId: string) {
  await ensureDatabase();
  await db.query(
    `UPDATE writing_review_shares
     SET revoked_at = NOW(), updated_at = NOW()
     WHERE review_id = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [reviewId, userId]
  );
  return { active: false, token: null, createdAt: null } satisfies ReviewShareState;
}

export async function getSharedWritingReview(token: string): Promise<SharedWritingReview | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  await ensureDatabase();
  const result = await db.query<SharedReviewRow>(
    `SELECT
       shares.id, shares.review_id, shares.user_id, shares.token, shares.locale,
       shares.revoked_at, shares.created_at, shares.updated_at,
       reviews.task_type, reviews.prompt_text, reviews.essay_text, reviews.result_json,
       reviews.provider_used, reviews.target_band, reviews.estimated_band, reviews.word_count,
       reviews.created_at AS review_created_at, reviews.updated_at AS review_updated_at
     FROM writing_review_shares shares
     INNER JOIN writing_reviews reviews ON reviews.id = shares.review_id
     WHERE shares.token = $1
       AND shares.revoked_at IS NULL
       AND reviews.status = 'completed'
       AND reviews.result_json IS NOT NULL
     LIMIT 1`,
    [token]
  );
  const row = result.rows[0];
  if (!row) return null;

  return {
    locale: row.locale === "zh-CN" ? "zh-CN" : "en",
    sharedAt: new Date(row.created_at).toISOString(),
    detail: {
      id: row.review_id,
      taskType: row.task_type,
      prompt: row.prompt_text,
      essay: row.essay_text,
      targetBand: Number(row.target_band),
      estimatedBand: Number(row.estimated_band),
      wordCount: row.word_count,
      providerUsed: row.provider_used,
      result: row.result_json,
      status: "completed",
      progressPercent: 100,
      progressStage: "completed",
      errorCode: null,
      parentReviewId: null,
      acceptedRevisionIds: [],
      image: null,
      createdAt: new Date(row.review_created_at).toISOString(),
      updatedAt: new Date(row.review_updated_at).toISOString()
    }
  };
}
