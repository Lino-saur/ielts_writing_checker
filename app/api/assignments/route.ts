import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { listStudentWritingAssignments } from "@/lib/writing-assignments";

export async function GET() {
  try {
    const session = await requireSession();
    const items = await listStudentWritingAssignments(session.user.id);

    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
