import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { listWritingReviews } from "@/lib/writing-reviews";

function parseInteger(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const limit = parseInteger(searchParams.get("limit"), 20);
    const offset = parseInteger(searchParams.get("offset"), 0);
    const data = await listWritingReviews(session.user.id, { limit, offset });

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
