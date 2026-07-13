import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { getStudentWritingAssignment } from "@/lib/writing-assignments";

type RouteContext = {
  params: Promise<{
    assignmentId: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  try {
    const session = await requireSession();
    const { assignmentId } = await context.params;
    const assignment = await getStudentWritingAssignment(session.user.id, assignmentId);

    if (!assignment) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ assignment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
