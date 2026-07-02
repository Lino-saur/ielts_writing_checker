import { NextResponse } from "next/server";
import { listHistoricalPracticeQuestions } from "@/lib/historical-practice";

export async function GET() {
  return NextResponse.json({
    items: await listHistoricalPracticeQuestions()
  });
}
