import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { apiErrorResponse, enforceRateLimit, readJsonBody } from "@/lib/api-security";
import { createFeedback } from "@/lib/feedback";
import type { FeedbackPayload } from "@/lib/types";

type RequestBody = FeedbackPayload;

const VALID_TARGET_BANDS = new Set([5, 5.5, 6, 6.5, 7, 7.5, 8]);
const VALID_FEEDBACK_KINDS = new Set(["review", "product", "bug", "feature_request"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidFeedbackProvider(provider: RequestBody["providerUsed"]) {
  return provider === "deepseek" || provider === "gemini" || provider === "qianwen";
}

function validateFeedbackBody(body: RequestBody) {
  if (!VALID_FEEDBACK_KINDS.has(body.kind)) {
    throw new Error("INVALID_FEEDBACK_KIND");
  }

  if (body.helpful !== null && typeof body.helpful !== "boolean") {
    throw new Error("INVALID_FEEDBACK_HELPFUL");
  }

  if (typeof body.page !== "string" || body.page.trim().length === 0) {
    throw new Error("INVALID_FEEDBACK_PAGE");
  }

  if (body.category != null && typeof body.category !== "string") {
    throw new Error("INVALID_FEEDBACK_CATEGORY");
  }

  if (body.comment != null && typeof body.comment !== "string") {
    throw new Error("INVALID_FEEDBACK_COMMENT");
  }

  if (body.comment && body.comment.length > 2000) {
    throw new Error("FEEDBACK_COMMENT_TOO_LONG");
  }

  if (body.taskType != null && body.taskType !== "task1" && body.taskType !== "task2") {
    throw new Error("INVALID_FEEDBACK_TASK_TYPE");
  }

  if (body.targetBand != null && !VALID_TARGET_BANDS.has(body.targetBand)) {
    throw new Error("INVALID_FEEDBACK_TARGET_BAND");
  }

  if (body.providerUsed != null && !isValidFeedbackProvider(body.providerUsed)) {
    throw new Error("INVALID_FEEDBACK_PROVIDER");
  }

  if (body.feedbackMode != null && body.feedbackMode !== "ai") {
    throw new Error("INVALID_FEEDBACK_MODE");
  }

  if (body.estimatedBand != null && (!Number.isFinite(body.estimatedBand) || body.estimatedBand < 0 || body.estimatedBand > 9)) {
    throw new Error("INVALID_FEEDBACK_ESTIMATED_BAND");
  }

  if (body.wordCount != null && (!Number.isInteger(body.wordCount) || body.wordCount < 0)) {
    throw new Error("INVALID_FEEDBACK_WORD_COUNT");
  }

  if (body.context != null && !isRecord(body.context)) {
    throw new Error("INVALID_FEEDBACK_CONTEXT");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    await enforceRateLimit({ scope: "feedback-create", subject: session.user.id, limit: 10, windowSeconds: 300 });
    const body = await readJsonBody<RequestBody>(request, 64 * 1024);

    validateFeedbackBody(body);

    const saved = await createFeedback({
      ...body,
      userId: session.user.id,
      context: {
        ...(body.context ?? {}),
        uid: session.user.id
      },
      page: body.page.trim()
    });

    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    const normalized = apiErrorResponse(error);
    const status = normalized.message.startsWith("INVALID_") || normalized.message === "FEEDBACK_COMMENT_TOO_LONG"
      ? 400
      : normalized.status;
    return NextResponse.json(
      { error: normalized.message },
      { status, headers: normalized.retryAfterSeconds ? { "Retry-After": String(normalized.retryAfterSeconds) } : undefined }
    );
  }
}
