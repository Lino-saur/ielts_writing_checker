import { randomUUID } from "node:crypto";
import { db, ensureDatabase } from "./db";
import { consumeEnergyInTransaction, getReviewEnergyCost } from "./energy";
import { recordMediaUpload } from "./media-usage";
import {
  getReviewImageObject,
  MAX_REVIEW_IMAGE_BYTES,
  putReviewImageObject,
  REVIEW_IMAGE_MIME_TYPES
} from "./object-storage";
import { normalizeRevisionCategory } from "./ielts/revision-categories";
import type {
  TaskImageInput,
  WritingCheckResult,
  WritingReviewDetail,
  WritingReviewListItem,
  WritingReviewStats,
  WritingReviewTaskFilter
} from "./types";

type WritingReviewRow = {
  id: string;
  user_id: string;
  task_type: WritingReviewDetail["taskType"];
  prompt_text: string;
  essay_text: string;
  result_json: WritingCheckResult;
  provider_used: WritingReviewDetail["providerUsed"];
  target_band: number | string;
  estimated_band: number | string;
  word_count: number;
  image_object_key: string | null;
  image_name: string | null;
  image_mime_type: string | null;
  parent_review_id: string | null;
  accepted_revision_ids: string[] | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type WritingReviewStatsRow = Pick<WritingReviewRow, "task_type" | "result_json" | "estimated_band" | "created_at">;

function buildReviewFilters(userId: string, options?: { taskType?: WritingReviewTaskFilter }) {
  const values: Array<string | number> = [userId];
  const conditions = ["user_id = $1"];

  if (options?.taskType && options.taskType !== "all") {
    values.push(options.taskType);
    conditions.push(`task_type = $${values.length}`);
  }

  return {
    whereClause: conditions.join(" AND "),
    values
  };
}

function buildPreview(text: string, maxLength: number) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) {
    return "";
  }

  if (compact.length <= maxLength) {
    return compact;
  }

  return `${compact.slice(0, maxLength - 1).trimEnd()}…`;
}

function mapReviewSummary(row: WritingReviewRow): WritingReviewListItem {
  return {
    id: row.id,
    taskType: row.task_type,
    targetBand: Number(row.target_band),
    estimatedBand: Number(row.estimated_band),
    wordCount: row.word_count,
    providerUsed: row.provider_used,
    hasImage: Boolean(row.image_object_key),
    createdAt: new Date(row.created_at).toISOString(),
    promptPreview: buildPreview(row.prompt_text, 132),
    essayPreview: buildPreview(row.essay_text, 168)
  };
}

function mapReviewDetail(row: WritingReviewRow): WritingReviewDetail {
  return {
    id: row.id,
    userId: row.user_id,
    taskType: row.task_type,
    prompt: row.prompt_text,
    essay: row.essay_text,
    targetBand: Number(row.target_band),
    estimatedBand: Number(row.estimated_band),
    wordCount: row.word_count,
    providerUsed: row.provider_used,
    result: row.result_json,
    parentReviewId: row.parent_review_id ?? null,
    acceptedRevisionIds: Array.isArray(row.accepted_revision_ids) ? row.accepted_revision_ids : [],
    image:
      row.image_object_key && row.image_name && row.image_mime_type
        ? {
            name: row.image_name,
            mimeType: row.image_mime_type,
            url: `/api/reviews/${encodeURIComponent(row.id)}/image`
          }
        : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

  if (!match) {
    throw new Error("INVALID_TASK_IMAGE_DATA");
  }

  return {
    mimeType: match[1],
    bytes: Buffer.from(match[2], "base64")
  };
}

function sanitizeFileName(name: string) {
  const trimmed = name.trim() || "task-image";
  return trimmed.replace(/[^A-Za-z0-9._-]/g, "-");
}

function sanitizeObjectKeySegment(value: string) {
  return value.replace(/[^A-Za-z0-9._-]/g, "-");
}

async function uploadTaskImage(userId: string, reviewId: string, image: TaskImageInput) {
  const parsed = parseDataUrl(image.dataUrl);
  const fileName = sanitizeFileName(image.name);
  const objectKey = `writing-reviews/${sanitizeObjectKeySegment(userId)}/${reviewId}/${fileName}`;

  await putReviewImageObject(objectKey, parsed.bytes, image.mimeType || parsed.mimeType);

  return {
    objectKey,
    name: image.name,
    mimeType: image.mimeType || parsed.mimeType
  };
}

export async function createWritingReview(input: {
  userId: string;
  prompt: string;
  essay: string;
  taskImage?: TaskImageInput | null;
  taskImageObjectKey?: string | null;
  taskImageName?: string | null;
  taskImageMimeType?: string | null;
  taskImageSizeBytes?: number | null;
  reviewRequestId?: string | null;
  reviewRequestLeaseToken?: string | null;
  parentReviewId?: string | null;
  acceptedRevisionIds?: string[];
  result: WritingCheckResult;
}) {
  await ensureDatabase();

  const reviewId = randomUUID();
  const createdAt = new Date().toISOString();
  const image = input.taskImage
    ? await uploadTaskImage(input.userId, reviewId, input.taskImage)
    : input.taskImageObjectKey && input.taskImageName && input.taskImageMimeType
      ? {
          objectKey: input.taskImageObjectKey,
          name: input.taskImageName,
          mimeType: input.taskImageMimeType,
          sizeBytes: input.taskImageSizeBytes ?? null
        }
      : null;
  const imageSizeBytes = image && "sizeBytes" in image ? image.sizeBytes ?? null : null;
  const shouldRecordMediaUpload = Boolean(input.taskImage && imageSizeBytes);
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const energy = input.reviewRequestId
      ? null
      : await consumeEnergyInTransaction(client, input.userId, getReviewEnergyCost());

    if (input.reviewRequestId) {
      const reservation = await client.query<{ status: string; lease_token: string | null }>(
        `SELECT status, lease_token
         FROM ai_review_requests
         WHERE id = $1 AND user_id = $2
         FOR UPDATE`,
        [input.reviewRequestId, input.userId]
      );

      if (
        reservation.rows[0]?.status !== "pending" ||
        !input.reviewRequestLeaseToken ||
        reservation.rows[0].lease_token !== input.reviewRequestLeaseToken
      ) {
        throw new Error("INVALID_REVIEW_RESERVATION");
      }
    }

    await client.query(
      `INSERT INTO writing_reviews (
        id,
        user_id,
        task_type,
        prompt_text,
        essay_text,
        result_json,
        provider_used,
        target_band,
        estimated_band,
        word_count,
        image_object_key,
        image_name,
        image_mime_type,
        image_size_bytes,
        parent_review_id,
        accepted_revision_ids,
        status,
        error_code,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, 'completed', NULL, $17, $18
      )`,
      [
        reviewId,
        input.userId,
        input.result.taskType,
        input.prompt.trim(),
        input.essay.trim(),
        JSON.stringify(input.result),
        input.result.providerUsed,
        input.result.targetBand,
        input.result.estimatedBand,
        input.result.wordCount,
        image?.objectKey ?? null,
        image?.name ?? null,
        image?.mimeType ?? null,
        imageSizeBytes,
        input.parentReviewId ?? null,
        JSON.stringify(input.acceptedRevisionIds ?? []),
        createdAt,
        createdAt
      ]
    );

    if (input.reviewRequestId) {
      await client.query(
        `UPDATE ai_review_requests
         SET status = 'completed', review_id = $3, error_code = NULL, updated_at = NOW()
         WHERE id = $1 AND user_id = $2 AND status = 'pending' AND lease_token = $4`,
        [input.reviewRequestId, input.userId, reviewId, input.reviewRequestLeaseToken]
      );
    }

    await client.query("COMMIT");

    if (shouldRecordMediaUpload && imageSizeBytes) {
      await recordMediaUpload(imageSizeBytes);
    }

    return {
      reviewId,
      energy
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listWritingReviews(
  userId: string,
  options?: { limit?: number; offset?: number; taskType?: WritingReviewTaskFilter }
) {
  await ensureDatabase();

  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);
  const offset = Math.max(options?.offset ?? 0, 0);
  const filters = buildReviewFilters(userId, options);
  const listValues = [...filters.values, limit, offset];
  const result = await db.query<WritingReviewRow>(
    `SELECT
      id,
      user_id,
      task_type,
      prompt_text,
      essay_text,
      result_json,
      provider_used,
      target_band,
      estimated_band,
      word_count,
      image_object_key,
      image_name,
      image_mime_type,
      parent_review_id,
      accepted_revision_ids,
      created_at,
      updated_at
     FROM writing_reviews
     WHERE ${filters.whereClause}
     ORDER BY created_at DESC
     LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
    listValues
  );

  const totalResult = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM writing_reviews
     WHERE ${filters.whereClause}`,
    filters.values
  );

  return {
    items: result.rows.map(mapReviewSummary),
    total: Number(totalResult.rows[0]?.count || 0)
  };
}

export async function getWritingReviewStats(
  userId: string,
  options?: { taskType?: WritingReviewTaskFilter; recentCount?: number }
) {
  await ensureDatabase();

  const recentCount = Math.min(Math.max(options?.recentCount ?? 20, 1), 100);
  const taskType = options?.taskType ?? "all";
  const filters = buildReviewFilters(userId, { taskType });
  const rows = await db.query<WritingReviewStatsRow>(
    `SELECT
      task_type,
      result_json,
      estimated_band,
      created_at
     FROM writing_reviews
     WHERE ${filters.whereClause}
     ORDER BY created_at DESC
     LIMIT $${filters.values.length + 1}`,
    [...filters.values, recentCount]
  );
  const orderedRows = [...rows.rows].reverse();
  const totalReviews = orderedRows.length;
  const categoryCounts = new Map<string, number>();
  let totalGrammarCorrections = 0;

  orderedRows.forEach((row) => {
    const grammarNotes = row.result_json.grammarRevision?.correctionNotes ?? row.result_json.correctionNotes ?? [];
    grammarNotes.forEach((note) => {
      const category = normalizeRevisionCategory(note.category);
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
      totalGrammarCorrections += 1;
    });
  });

  const grammarCategoryBreakdown = Array.from(categoryCounts.entries())
    .map(([category, count]) => ({
      category,
      count,
      percentage: totalGrammarCorrections ? Number(((count / totalGrammarCorrections) * 100).toFixed(1)) : 0
    }))
    .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category));

  const scoreTrend = orderedRows.map((row, index) => ({
    date: new Date(row.created_at).toISOString(),
    label: `#${index + 1}`,
    averageScore: Number(Number(row.estimated_band).toFixed(2)),
    reviewCount: 1
  }));

  const stats: WritingReviewStats = {
    taskType,
    recentCount,
    totalReviews,
    totalGrammarCorrections,
    grammarCategoryBreakdown,
    scoreTrend
  };

  return stats;
}

export async function getWritingReview(userId: string, reviewId: string) {
  await ensureDatabase();

  const result = await db.query<WritingReviewRow>(
    `SELECT
      id,
      user_id,
      task_type,
      prompt_text,
      essay_text,
      result_json,
      provider_used,
      target_band,
      estimated_band,
      word_count,
      image_object_key,
      image_name,
      image_mime_type,
      parent_review_id,
      accepted_revision_ids,
      created_at,
      updated_at
     FROM writing_reviews
     WHERE id = $1 AND user_id = $2
     LIMIT 1`,
    [reviewId, userId]
  );

  if (!result.rows[0]) {
    return null;
  }

  return mapReviewDetail(result.rows[0]);
}

export async function getWritingReviewImage(userId: string, reviewId: string) {
  await ensureDatabase();

  const result = await db.query<Pick<WritingReviewRow, "image_object_key" | "image_mime_type">>(
    `SELECT image_object_key, image_mime_type
     FROM writing_reviews
     WHERE id = $1 AND user_id = $2
     LIMIT 1`,
    [reviewId, userId]
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

export async function loadTaskImageInputFromObject(input: {
  userId: string;
  objectKey: string;
  name: string;
}) {
  const userKeyPrefix = `writing-reviews/${sanitizeObjectKeySegment(input.userId)}/`;
  if (!input.objectKey.startsWith(userKeyPrefix)) {
    const practiceImage = await db.query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1
        FROM practice_questions
        WHERE image_object_key = $1 AND status = 'published'
      ) AS exists`,
      [input.objectKey]
    );
    if (!practiceImage.rows[0]?.exists) {
      throw new Error("INVALID_TASK_IMAGE_OBJECT");
    }
  }

  const response = await getReviewImageObject(input.objectKey);
  const responseMimeType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() || "";
  const declaredSize = Number(response.headers.get("content-length"));

  if (!REVIEW_IMAGE_MIME_TYPES.has(responseMimeType)) {
    await response.body?.cancel();
    throw new Error("INVALID_IMAGE_TYPE");
  }
  if (Number.isFinite(declaredSize) && declaredSize > MAX_REVIEW_IMAGE_BYTES) {
    await response.body?.cancel();
    throw new Error("INVALID_IMAGE_SIZE");
  }
  if (!response.body) {
    throw new Error("IMAGE_LOAD_FAILED");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    totalBytes += value.byteLength;
    if (totalBytes > MAX_REVIEW_IMAGE_BYTES) {
      await reader.cancel();
      throw new Error("INVALID_IMAGE_SIZE");
    }
    chunks.push(value);
  }

  const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), totalBytes);

  return {
    taskImage: {
      name: sanitizeFileName(input.name).slice(0, 180),
      mimeType: responseMimeType,
      dataUrl: `data:${responseMimeType};base64,${bytes.toString("base64")}`
    } satisfies TaskImageInput,
    sizeBytes: totalBytes,
    mimeType: responseMimeType
  };
}
