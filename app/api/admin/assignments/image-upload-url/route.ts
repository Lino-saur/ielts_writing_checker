import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { enforceRateLimit, readJsonBody } from "@/lib/api-security";
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
  const trimmed = value.trim() || "assignment-image";
  return trimmed.replace(/[^A-Za-z0-9._-]/g, "-");
}

export async function POST(request: Request) {
  try {
    const { adminUser } = await requireAdminSession();
    await enforceRateLimit({
      scope: "assignment-image-upload-url",
      subject: adminUser.id,
      limit: 30,
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

    const objectKey = `writing-assignments/${sanitizeSegment(adminUser.id)}/${randomUUID()}/${sanitizeFileName(fileName)}`;
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
    const message = error instanceof Error ? error.message : "Unknown error.";
    const status =
      message === "UNAUTHORIZED"
        ? 401
        : message === "FORBIDDEN"
          ? 403
          : message === "MEDIA_UPLOAD_LIMIT_REACHED" || message === "MEDIA_UPLOADS_BLOCKED"
            ? 429
            : message.startsWith("INVALID_")
              ? 400
              : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
