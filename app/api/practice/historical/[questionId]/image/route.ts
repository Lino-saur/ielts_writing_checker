import { NextResponse } from "next/server";
import { getHistoricalPracticeQuestionImage } from "@/lib/historical-practice";
import { assertMediaDownloadAllowed, recordMediaDownload } from "@/lib/media-usage";

export async function GET(
  _request: Request,
  context: { params: Promise<{ questionId: string }> }
) {
  try {
    const { questionId } = await context.params;
    await assertMediaDownloadAllowed();
    const image = await getHistoricalPracticeQuestionImage(questionId);
    if (!image?.body) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const bytes = Buffer.from(await new Response(image.body).arrayBuffer());
    await recordMediaDownload(bytes.byteLength);
    return new NextResponse(bytes, {
      headers: {
        "Cache-Control": "public, max-age=300",
        "Content-Type": image.mimeType
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status =
      message === "MEDIA_DOWNLOAD_LIMIT_REACHED" || message === "MEDIA_DOWNLOADS_BLOCKED"
        ? 429
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
