import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { listRecentAdminGrants } from "@/lib/admin/energy";

export async function GET(request: Request) {
  try {
    await requireAdminSession();

    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") || 12);
    const items = await listRecentAdminGrants(limit);

    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
