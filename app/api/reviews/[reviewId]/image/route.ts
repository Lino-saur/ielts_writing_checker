import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { assertMediaDownloadAllowed, recordMediaDownload } from "@/lib/media-usage";
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
    await assertMediaDownloadAllowed();
    const image = await getWritingReviewImage(session.user.id, reviewId);

    if (!image?.body) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const bytes = Buffer.from(await new Response(image.body).arrayBuffer());
    await recordMediaDownload(bytes.byteLength);

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Cache-Control": "private, max-age=60",
        "Content-Type": image.mimeType
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    const status =
      message === "UNAUTHORIZED"
        ? 401
        : message === "MEDIA_DOWNLOAD_LIMIT_REACHED" || message === "MEDIA_DOWNLOADS_BLOCKED"
          ? 429
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
