import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { getAdminFeedbackDashboard, normalizeAdminFeedbackFilters } from "@/lib/admin/feedback";

export async function GET(request: Request) {
  try {
    await requireAdminSession();

    const { searchParams } = new URL(request.url);
    const filters = normalizeAdminFeedbackFilters({
      kind: searchParams.get("kind") || undefined,
      status: searchParams.get("status") || undefined,
      helpful: searchParams.get("helpful") || undefined,
      q: searchParams.get("q") || undefined
    });
    const data = await getAdminFeedbackDashboard(filters);

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
