import { NextResponse } from "next/server";
import { assertMediaDownloadAllowed, recordMediaDownload } from "@/lib/media-usage";
import { getPracticeQuestionImage } from "@/lib/practice-library";

type RouteContext = {
  params: Promise<{
    questionId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { questionId } = await context.params;
    await assertMediaDownloadAllowed();
    const image = await getPracticeQuestionImage(questionId);

    if (!image?.body) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const bytes = Buffer.from(await new Response(image.body).arrayBuffer());
    await recordMediaDownload(bytes.byteLength);

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=300",
        "Content-Type": image.mimeType
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    const status =
      message === "MEDIA_DOWNLOAD_LIMIT_REACHED" || message === "MEDIA_DOWNLOADS_BLOCKED" ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
