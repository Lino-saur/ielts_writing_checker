import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { getMediaUsageDashboard, saveMediaUsageSettings } from "@/lib/admin/media-usage";

type RequestBody = {
  uploadLimitGb?: number | null;
  downloadLimitGb?: number | null;
  hardBlockUploads?: boolean;
  hardBlockDownloads?: boolean;
};

function gbToBytes(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return null;
  }

  if (value <= 0) {
    return null;
  }

  return Math.floor(value * 1024 * 1024 * 1024);
}

export async function GET() {
  try {
    await requireAdminSession();
    const data = await getMediaUsageDashboard();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminSession();
    const body = (await request.json()) as RequestBody;
    const settings = await saveMediaUsageSettings({
      uploadLimitBytes: gbToBytes(body.uploadLimitGb),
      downloadLimitBytes: gbToBytes(body.downloadLimitGb),
      hardBlockUploads: Boolean(body.hardBlockUploads),
      hardBlockDownloads: Boolean(body.hardBlockDownloads)
    });

    return NextResponse.json({ settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
