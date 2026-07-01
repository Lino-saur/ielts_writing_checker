import { NextResponse } from "next/server";
import { listPracticeQuestions } from "@/lib/practice-library";
import type { PracticeQuestionContentStatus, TaskType } from "@/lib/types";

function parseInteger(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseTaskType(value: string | null): TaskType | undefined {
  return value === "task1" || value === "task2" ? value : undefined;
}

function parseContentStatus(value: string | null): PracticeQuestionContentStatus | undefined {
  return value === "placeholder" || value === "complete" ? value : undefined;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await listPracticeQuestions({
      bookNumber: parseInteger(searchParams.get("book")),
      testNumber: parseInteger(searchParams.get("test")),
      taskType: parseTaskType(searchParams.get("taskType")),
      contentStatus: parseContentStatus(searchParams.get("contentStatus")),
      status: "published",
      limit: parseInteger(searchParams.get("limit")),
      offset: parseInteger(searchParams.get("offset"))
    });

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
