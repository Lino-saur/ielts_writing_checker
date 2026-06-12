import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { createFeedback } from "@/lib/feedback";
import type { FeedbackPayload } from "@/lib/types";

type RequestBody = FeedbackPayload;

const VALID_TARGET_BANDS = new Set([5, 5.5, 6, 6.5, 7, 7.5, 8]);
const VALID_FEEDBACK_KINDS = new Set(["review", "product", "bug", "feature_request"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

  if (body.providerUsed != null && body.providerUsed !== "deepseek") {
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
    const body = (await request.json()) as RequestBody;

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
    const message = error instanceof Error ? error.message : "Unknown error.";
    const status = message === "UNAUTHORIZED" ? 401 : message.startsWith("INVALID_") || message === "FEEDBACK_COMMENT_TOO_LONG" ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
