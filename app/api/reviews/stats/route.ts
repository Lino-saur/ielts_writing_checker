import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { getWritingReviewStats } from "@/lib/writing-reviews";
import type { TaskType, WritingReviewTaskFilter } from "@/lib/types";

function parseInteger(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseTaskType(value: string | null): WritingReviewTaskFilter {
  return value === "task1" || value === "task2" ? (value as TaskType) : "all";
}

function parseRecentCount(value: string | null, fallback: number) {
  const parsed = parseInteger(value, fallback);
  return Math.min(Math.max(parsed, 1), 100);
}

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const taskType = parseTaskType(searchParams.get("taskType"));
    const recentCount = parseRecentCount(searchParams.get("recentCount"), 20);
    const data = await getWritingReviewStats(session.user.id, { taskType, recentCount });

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
