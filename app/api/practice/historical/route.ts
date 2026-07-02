import { NextResponse } from "next/server";
import {
  listHistoricalPracticeQuestions,
  normalizeHistoricalPracticeFilters
} from "@/lib/historical-practice";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await listHistoricalPracticeQuestions(
      normalizeHistoricalPracticeFilters({
        taskType: searchParams.get("task"),
        year: searchParams.get("year"),
        category: searchParams.get("category"),
        type: searchParams.get("type"),
        page: searchParams.get("page")
      })
    );
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
