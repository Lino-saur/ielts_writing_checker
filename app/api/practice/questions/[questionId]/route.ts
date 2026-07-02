import { NextResponse } from "next/server";
import { getPracticeQuestion } from "@/lib/practice-library";

export async function GET(
  _request: Request,
  context: { params: Promise<{ questionId: string }> }
) {
  try {
    const { questionId } = await context.params;
    const question = await getPracticeQuestion(questionId);

    if (!question || question.status !== "published") {
      return NextResponse.json({ error: "PRACTICE_QUESTION_NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ question });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
