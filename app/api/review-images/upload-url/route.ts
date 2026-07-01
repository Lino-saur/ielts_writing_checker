import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { apiErrorResponse, enforceRateLimit, readJsonBody } from "@/lib/api-security";
import { reserveMediaUpload } from "@/lib/media-usage";
import {
  createPresignedReviewImageUploadUrl,
  MAX_REVIEW_IMAGE_BYTES,
  REVIEW_IMAGE_MIME_TYPES
} from "@/lib/object-storage";

type RequestBody = {
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
};

function sanitizeSegment(value: string) {
  return value.replace(/[^A-Za-z0-9._-]/g, "-");
}

function sanitizeFileName(value: string) {
  const trimmed = value.trim() || "task-image";
  return trimmed.replace(/[^A-Za-z0-9._-]/g, "-");
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    await enforceRateLimit({
      scope: "review-image-upload-url",
      subject: session.user.id,
      limit: 20,
      windowSeconds: 60
    });
    const body = await readJsonBody<RequestBody>(request, 32 * 1024);
    const mimeType = body.mimeType?.trim().toLowerCase() || "";
    const fileName = body.fileName?.trim() || "";
    const fileSize = Number(body.fileSize);

    if (!REVIEW_IMAGE_MIME_TYPES.has(mimeType)) {
      return NextResponse.json({ error: "INVALID_IMAGE_TYPE" }, { status: 400 });
    }

    if (!Number.isInteger(fileSize) || fileSize <= 0 || fileSize > MAX_REVIEW_IMAGE_BYTES) {
      return NextResponse.json({ error: "INVALID_IMAGE_SIZE" }, { status: 400 });
    }
    if (!fileName || fileName.length > 180) {
      return NextResponse.json({ error: "INVALID_IMAGE_NAME" }, { status: 400 });
    }

    const objectKey = `writing-reviews/${sanitizeSegment(session.user.id)}/${randomUUID()}/${sanitizeFileName(fileName)}`;
    const signed = createPresignedReviewImageUploadUrl({
      key: objectKey,
      mimeType,
      contentLength: fileSize
    });
    await reserveMediaUpload(fileSize);

    return NextResponse.json({
      objectKey,
      uploadUrl: signed.uploadUrl,
      headers: signed.headers
    });
  } catch (error) {
    const normalized = apiErrorResponse(error);
    const status =
      normalized.message === "MEDIA_UPLOAD_LIMIT_REACHED" || normalized.message === "MEDIA_UPLOADS_BLOCKED"
        ? 429
        : normalized.status;
    return NextResponse.json(
      { error: normalized.message },
      {
        status,
        headers: normalized.retryAfterSeconds
          ? { "Retry-After": String(normalized.retryAfterSeconds) }
          : undefined
      }
    );
  }
}
