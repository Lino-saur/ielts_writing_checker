import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import {
  apiErrorResponse,
  enforceRateLimit,
  readJsonBody,
  requireBoundedString,
  requireIdempotencyKey
} from "@/lib/api-security";
import { evaluateWriting } from "@/lib/ielts";
import { getEnergyState, getReviewEnergyCost } from "@/lib/energy";
import { beginReviewRequest, failReviewRequest } from "@/lib/review-requests";
import { getPracticeQuestion } from "@/lib/practice-library";
import { getHistoricalPracticeQuestion } from "@/lib/historical-practice";
import type { AiProvider, Locale, TargetBand, TaskType } from "@/lib/types";
import {
  createWritingReview,
  getWritingReview,
  loadTaskImageInputFromObject
} from "@/lib/writing-reviews";

const MAX_CHECK_BODY_BYTES = 64 * 1024;
const MAX_PROMPT_LENGTH = 10_000;
const MAX_ESSAY_LENGTH = 20_000;
const TARGET_BANDS: TargetBand[] = [5, 5.5, 6, 6.5, 7, 7.5, 8];
const PROVIDERS: AiProvider[] = ["deepseek", "gemini", "qianwen"];

export const maxDuration = 300;

type RequestBody = {
  practiceId?: string | null;
  historicalId?: string | null;
  taskType?: TaskType;
  prompt?: string;
  essay?: string;
  taskImageObjectKey?: string;
  taskImageName?: string;
  provider?: AiProvider;
  locale?: Locale;
  targetBand?: TargetBand;
};

export async function POST(request: Request) {
  let reservedRequest: { userId: string; requestId: string } | null = null;
  let sessionUserId: string | null = null;

  try {
    const session = await requireSession();
    sessionUserId = session.user.id;
    await enforceRateLimit({
      scope: "ai-writing-check",
      subject: session.user.id,
      limit: 8,
      windowSeconds: 60
    });

    const requestId = requireIdempotencyKey(request);
    const body = await readJsonBody<RequestBody>(request, MAX_CHECK_BODY_BYTES);
    if (body.taskType !== "task1" && body.taskType !== "task2") {
      return NextResponse.json({ error: "INVALID_TASK_TYPE" }, { status: 400 });
    }

    const prompt = requireBoundedString(body.prompt, "prompt", { maxLength: MAX_PROMPT_LENGTH });
    const essay = requireBoundedString(body.essay, "essay", { maxLength: MAX_ESSAY_LENGTH });
    if (body.locale !== undefined && body.locale !== "en" && body.locale !== "zh-CN") {
      return NextResponse.json({ error: "INVALID_LOCALE" }, { status: 400 });
    }
    if (body.provider !== undefined && !PROVIDERS.includes(body.provider)) {
      return NextResponse.json({ error: "INVALID_PROVIDER" }, { status: 400 });
    }
    if (body.targetBand !== undefined && !TARGET_BANDS.includes(body.targetBand)) {
      return NextResponse.json({ error: "INVALID_TARGET_BAND" }, { status: 400 });
    }
    if (
      body.taskImageObjectKey !== undefined &&
      (typeof body.taskImageObjectKey !== "string" || body.taskImageObjectKey.length > 512)
    ) {
      return NextResponse.json({ error: "INVALID_TASK_IMAGE_OBJECT" }, { status: 400 });
    }
    if (
      body.taskImageName !== undefined &&
      (typeof body.taskImageName !== "string" || body.taskImageName.length > 180)
    ) {
      return NextResponse.json({ error: "INVALID_IMAGE_NAME" }, { status: 400 });
    }
    const practiceId = body.practiceId ?? undefined;
    const historicalId = body.historicalId ?? undefined;
    if (
      practiceId !== undefined &&
      (typeof practiceId !== "string" || practiceId.length < 1 || practiceId.length > 180)
    ) {
      return NextResponse.json({ error: "INVALID_PRACTICE_ID" }, { status: 400 });
    }
    if (
      historicalId !== undefined &&
      (typeof historicalId !== "string" || historicalId.length < 1 || historicalId.length > 180)
    ) {
      return NextResponse.json({ error: "INVALID_HISTORICAL_ID" }, { status: 400 });
    }
    if (practiceId && historicalId) {
      return NextResponse.json({ error: "MULTIPLE_PRACTICE_SOURCES" }, { status: 400 });
    }

    let taskType = body.taskType;
    let canonicalPrompt = prompt;
    let taskImageObjectKey = body.taskImageObjectKey;
    let taskImageName = body.taskImageName;

    if (practiceId) {
      const practiceQuestion = await getPracticeQuestion(practiceId);
      if (!practiceQuestion || practiceQuestion.status !== "published") {
        return NextResponse.json({ error: "PRACTICE_QUESTION_NOT_FOUND" }, { status: 404 });
      }

      taskType = practiceQuestion.taskType;
      canonicalPrompt = practiceQuestion.prompt;
      taskImageObjectKey = practiceQuestion.imageObjectKey ?? undefined;
      taskImageName = practiceQuestion.imageName ?? undefined;
    }
    if (historicalId) {
      const historicalQuestion = await getHistoricalPracticeQuestion(historicalId);
      if (!historicalQuestion) {
        return NextResponse.json({ error: "HISTORICAL_QUESTION_NOT_FOUND" }, { status: 404 });
      }

      taskType = "task2";
      canonicalPrompt = historicalQuestion.prompt;
      taskImageObjectKey = undefined;
      taskImageName = undefined;
    }

    const requestHash = createHash("sha256")
      .update(
        JSON.stringify({
          practiceId: practiceId || null,
          historicalId: historicalId || null,
          taskType,
          prompt: canonicalPrompt,
          essay,
          taskImageObjectKey: taskImageObjectKey || null,
          taskImageName: taskImageName || null,
          provider: body.provider || null,
          locale: body.locale || null,
          targetBand: body.targetBand || null
        })
      )
      .digest("hex");
    const reservation = await beginReviewRequest(session.user.id, requestId, requestHash);
    const cost = getReviewEnergyCost();

    if (reservation.status === "conflict") {
      return NextResponse.json({ error: "IDEMPOTENCY_KEY_REUSED" }, { status: 409 });
    }
    if (reservation.status === "pending") {
      return NextResponse.json({ error: "REVIEW_IN_PROGRESS" }, { status: 409 });
    }
    if (reservation.status === "failed") {
      return NextResponse.json({ error: "REVIEW_REQUEST_FAILED" }, { status: 409 });
    }
    if (reservation.status === "completed") {
      const [review, energy] = await Promise.all([
        getWritingReview(session.user.id, reservation.reviewId),
        getEnergyState(session.user.id)
      ]);
      if (!review) {
        throw new Error("REVIEW_RESULT_NOT_FOUND");
      }
      return NextResponse.json({
        result: review.result,
        energy,
        cost,
        idempotentReplay: true
      });
    }

    reservedRequest = { userId: session.user.id, requestId };
    const loadedImage =
      taskImageObjectKey && taskImageName
        ? await loadTaskImageInputFromObject({
            userId: session.user.id,
            objectKey: taskImageObjectKey,
            name: taskImageName
          })
        : null;

    const result = await evaluateWriting({
      taskType,
      prompt: canonicalPrompt,
      essay,
      taskImage: loadedImage?.taskImage ?? null,
      provider: body.provider,
      locale: body.locale,
      targetBand: body.targetBand
    });

    const savedReview = await createWritingReview({
      userId: session.user.id,
      prompt: canonicalPrompt,
      essay,
      taskImageObjectKey: loadedImage ? taskImageObjectKey || null : null,
      taskImageName: loadedImage?.taskImage.name ?? null,
      taskImageMimeType: loadedImage?.mimeType ?? null,
      taskImageSizeBytes: loadedImage?.sizeBytes ?? null,
      reviewRequestId: requestId,
      result
    });
    reservedRequest = null;
    const energy = await getEnergyState(session.user.id);

    return NextResponse.json({
      result,
      energy,
      cost,
      reviewId: savedReview.reviewId
    });
  } catch (error) {
    const normalized = apiErrorResponse(error);
    if (reservedRequest) {
      try {
        await failReviewRequest(
          reservedRequest.userId,
          reservedRequest.requestId,
          normalized.message
        );
      } catch (refundError) {
        console.error("[IELTS_CHECK][RESERVATION_REFUND_FAILED]", {
          requestId: reservedRequest.requestId,
          error: refundError instanceof Error ? refundError.message : "UNKNOWN_ERROR"
        });
      }
    }

    const energy =
      normalized.message === "INSUFFICIENT_ENERGY" && sessionUserId
        ? await getEnergyState(sessionUserId).catch(() => null)
        : null;

    return NextResponse.json(
      {
        error: normalized.message,
        ...(energy ? { energy, cost: getReviewEnergyCost() } : {})
      },
      {
        status: normalized.status,
        headers: normalized.retryAfterSeconds
          ? { "Retry-After": String(normalized.retryAfterSeconds) }
          : undefined
      }
    );
  }
}
