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
    const page = Math.max(parseInteger(searchParams.get("page")) ?? 1, 1);
    const pageSize = 24;
    const tag = searchParams.get("tag")?.trim().slice(0, 80) || undefined;
    const data = await listPracticeQuestions({
      bookNumber: parseInteger(searchParams.get("book")),
      testNumber: parseInteger(searchParams.get("test")),
      taskType: parseTaskType(searchParams.get("task") ?? searchParams.get("taskType")),
      tag,
      contentStatus: parseContentStatus(searchParams.get("contentStatus")),
      status: "published",
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    const totalPages = Math.max(1, Math.ceil(data.total / pageSize));
    return NextResponse.json({
      ...data,
      page,
      pageSize,
      totalPages
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
