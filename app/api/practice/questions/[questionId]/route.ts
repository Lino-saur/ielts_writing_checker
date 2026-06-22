import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { getPracticeQuestion } from "@/lib/practice-library";

export async function GET(
  _request: Request,
  context: { params: Promise<{ questionId: string }> }
) {
  try {
    await requireSession();
    const { questionId } = await context.params;
    const question = await getPracticeQuestion(questionId);

    if (!question) {
      return NextResponse.json({ error: "PRACTICE_QUESTION_NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ question });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
