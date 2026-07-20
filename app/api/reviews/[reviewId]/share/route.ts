import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { createReviewShare, getReviewShareState, revokeReviewShare } from "@/lib/review-sharing";
import type { Locale } from "@/lib/types";

type RouteContext = { params: Promise<{ reviewId: string }> };

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  const status = message === "UNAUTHORIZED" ? 401 : message === "REVIEW_NOT_SHAREABLE" ? 404 : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await requireSession();
    const { reviewId } = await context.params;
    return NextResponse.json(await getReviewShareState(session.user.id, reviewId));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await requireSession();
    const { reviewId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { locale?: Locale };
    const locale: Locale = body.locale === "zh-CN" ? "zh-CN" : "en";
    return NextResponse.json(await createReviewShare(session.user.id, reviewId, locale), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await requireSession();
    const { reviewId } = await context.params;
    return NextResponse.json(await revokeReviewShare(session.user.id, reviewId));
  } catch (error) {
    return errorResponse(error);
  }
}
