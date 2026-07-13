import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { submitStudentAssignment } from "@/lib/writing-assignments";

type RouteContext = {
  params: Promise<{
    assignmentId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await requireSession();
    const { assignmentId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const result = await submitStudentAssignment({
      userId: session.user.id,
      assignmentId,
      essay: body.essay
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    const status =
      message === "UNAUTHORIZED"
        ? 401
        : message === "ASSIGNMENT_NOT_FOUND"
          ? 404
          : message === "ASSIGNMENT_CLOSED"
            ? 409
            : message === "ASSIGNMENT_DEADLINE_PASSED" || message === "RESUBMISSION_NOT_ALLOWED"
              ? 409
              : message.startsWith("INVALID_")
                ? 400
                : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
