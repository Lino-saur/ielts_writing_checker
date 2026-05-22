import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { evaluateWritingScore } from "@/lib/ielts";
import { AiProvider, Locale, TargetBand, TaskType } from "@/lib/types";

type RequestBody = {
  taskType?: TaskType;
  prompt?: string;
  essay?: string;
  provider?: AiProvider;
  locale?: Locale;
  targetBand?: TargetBand;
};

export async function POST(request: Request) {
  try {
    await requireSession();
    const body = (await request.json()) as RequestBody;

    if (body.taskType !== "task1" && body.taskType !== "task2") {
      return NextResponse.json({ error: "taskType must be task1 or task2." }, { status: 400 });
    }

    const result = await evaluateWritingScore({
      taskType: body.taskType,
      prompt: body.prompt || "",
      essay: body.essay || "",
      provider: body.provider,
      locale: body.locale,
      targetBand: body.targetBand
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
