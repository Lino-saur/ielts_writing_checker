import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { saveAssignmentFeedback } from "@/lib/writing-assignments";

export async function PATCH(request: Request) {
  try {
    const { adminUser } = await requireAdminSession();
    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body.submissionId !== "string" || !body.submissionId.trim()) {
      return NextResponse.json({ error: "INVALID_SUBMISSION_ID" }, { status: 400 });
    }

    const result = await saveAssignmentFeedback({
      adminUserId: adminUser.id,
      submissionId: body.submissionId,
      feedback: body.feedback,
      score: body.score,
      feedbackItems: body.feedbackItems,
      scoreBreakdown: body.scoreBreakdown,
      rewriteRequired: body.rewriteRequired
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    const status =
      message === "UNAUTHORIZED"
        ? 401
        : message === "FORBIDDEN"
          ? 403
          : message === "SUBMISSION_NOT_FOUND"
            ? 404
            : message.startsWith("INVALID_")
              ? 400
              : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
