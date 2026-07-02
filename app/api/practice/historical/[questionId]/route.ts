import { NextResponse } from "next/server";
import { getHistoricalPracticeQuestion } from "@/lib/historical-practice";

export async function GET(
  _request: Request,
  context: { params: Promise<{ questionId: string }> }
) {
  const { questionId } = await context.params;
  const question = await getHistoricalPracticeQuestion(questionId);

  if (!question) {
    return NextResponse.json({ error: "HISTORICAL_QUESTION_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({
    question: {
      ...question,
      title: `${question.year} · ${question.date}`,
      tags: [question.category, question.type].filter(Boolean)
    }
  });
}
