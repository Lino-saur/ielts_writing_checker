import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { getWritingReview, getWritingReviewThread } from "@/lib/writing-reviews";

type RouteContext = {
  params: Promise<{
    reviewId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await requireSession();
    const { reviewId } = await context.params;
    const wantsThread = new URL(request.url).searchParams.get("thread") === "1";
    const review = wantsThread
      ? await getWritingReviewThread(session.user.id, reviewId)
      : await getWritingReview(session.user.id, reviewId);

    if (!review) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json(review);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
