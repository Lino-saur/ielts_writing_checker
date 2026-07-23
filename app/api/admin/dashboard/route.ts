import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { getAdminDashboardData } from "@/lib/admin/dashboard";

export async function GET() {
  try {
    await requireAdminSession();
    return NextResponse.json(await getAdminDashboardData());
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500 });
  }
}
