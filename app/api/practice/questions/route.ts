import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { listPracticeQuestions } from "@/lib/practice-library";
import type { PracticeQuestionContentStatus, PracticeQuestionStatus, TaskType } from "@/lib/types";

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

function parseQuestionStatus(value: string | null): PracticeQuestionStatus | undefined {
  return value === "draft" || value === "published" || value === "archived" ? value : undefined;
}

export async function GET(request: Request) {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const data = await listPracticeQuestions({
      bookNumber: parseInteger(searchParams.get("book")),
      testNumber: parseInteger(searchParams.get("test")),
      taskType: parseTaskType(searchParams.get("taskType")),
      contentStatus: parseContentStatus(searchParams.get("contentStatus")),
      status: parseQuestionStatus(searchParams.get("status")),
      limit: parseInteger(searchParams.get("limit")),
      offset: parseInteger(searchParams.get("offset"))
    });

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
