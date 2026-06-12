import { randomUUID } from "node:crypto";
import { db, ensureDatabase } from "./db";
import { consumeEnergyInTransaction, getReviewEnergyCost } from "./energy";
import { recordMediaUpload } from "./media-usage";
import { getReviewImageObject, putReviewImageObject } from "./object-storage";
import type {
  TaskImageInput,
  WritingCheckResult,
  WritingReviewDetail,
  WritingReviewListItem
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
  created_at: Date | string;
  updated_at: Date | string;
};

function mapReviewSummary(row: WritingReviewRow): WritingReviewListItem {
  return {
    id: row.id,
    taskType: row.task_type,
    targetBand: Number(row.target_band),
    estimatedBand: Number(row.estimated_band),
    wordCount: row.word_count,
    providerUsed: row.provider_used,
    hasImage: Boolean(row.image_object_key),
    createdAt: new Date(row.created_at).toISOString()
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
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const energy = await consumeEnergyInTransaction(client, input.userId, getReviewEnergyCost());

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
        status,
        error_code,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14, 'completed', NULL, $15, $16
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
        createdAt,
        createdAt
      ]
    );

    await client.query("COMMIT");

    if (imageSizeBytes) {
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

export async function listWritingReviews(userId: string, options?: { limit?: number; offset?: number }) {
  await ensureDatabase();

  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);
  const offset = Math.max(options?.offset ?? 0, 0);
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
      created_at,
      updated_at
     FROM writing_reviews
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  const totalResult = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM writing_reviews
     WHERE user_id = $1`,
    [userId]
  );

  return {
    items: result.rows.map(mapReviewSummary),
    total: Number(totalResult.rows[0]?.count || 0)
  };
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
  objectKey: string;
  name: string;
  mimeType: string;
}) {
  const response = await getReviewImageObject(input.objectKey);
  const bytes = Buffer.from(await response.arrayBuffer());

  return {
    name: input.name,
    mimeType: input.mimeType,
    dataUrl: `data:${input.mimeType};base64,${bytes.toString("base64")}`
  } satisfies TaskImageInput;
}
