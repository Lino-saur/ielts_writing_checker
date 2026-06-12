import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { getWritingReviewImage } from "@/lib/writing-reviews";

type RouteContext = {
  params: Promise<{
    reviewId: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  try {
    const session = await requireSession();
    const { reviewId } = await context.params;
    const image = await getWritingReviewImage(session.user.id, reviewId);

    if (!image?.body) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    return new NextResponse(image.body, {
      status: 200,
      headers: {
        "Cache-Control": "private, max-age=60",
        "Content-Type": image.mimeType
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
