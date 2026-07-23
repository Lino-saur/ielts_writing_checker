import { NextResponse } from "next/server";
import { assertMediaDownloadAllowed, recordMediaDownload } from "@/lib/media-usage";
import { getSharedWritingReviewImage } from "@/lib/review-sharing";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    await assertMediaDownloadAllowed();
    const image = await getSharedWritingReviewImage(token);

    if (!image?.body) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const bytes = Buffer.from(await new Response(image.body).arrayBuffer());
    await recordMediaDownload(bytes.byteLength);

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": image.mimeType,
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "IMAGE_LOAD_FAILED";
    const isQuotaError = message === "MEDIA_DOWNLOAD_LIMIT_REACHED" || message === "MEDIA_DOWNLOADS_BLOCKED";
    return NextResponse.json(
      { error: isQuotaError ? message : "IMAGE_LOAD_FAILED" },
      { status: isQuotaError ? 429 : 500 }
    );
  }
}
