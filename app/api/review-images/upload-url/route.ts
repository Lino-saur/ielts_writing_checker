import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { createPresignedReviewImageUploadUrl } from "@/lib/object-storage";

type RequestBody = {
  fileName?: string;
  mimeType?: string;
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
    const body = (await request.json()) as RequestBody;
    const mimeType = body.mimeType?.trim() || "";
    const fileName = body.fileName?.trim() || "";

    if (!mimeType.startsWith("image/")) {
      return NextResponse.json({ error: "INVALID_IMAGE_TYPE" }, { status: 400 });
    }

    const objectKey = `writing-reviews/${sanitizeSegment(session.user.id)}/${randomUUID()}/${sanitizeFileName(fileName)}`;
    const signed = createPresignedReviewImageUploadUrl({
      key: objectKey,
      mimeType
    });

    return NextResponse.json({
      objectKey,
      uploadUrl: signed.uploadUrl,
      headers: signed.headers
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
