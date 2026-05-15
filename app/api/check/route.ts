import { NextResponse } from "next/server";
import { evaluateWriting } from "@/lib/ielts";
import { TaskType } from "@/lib/types";

type RequestBody = {
  taskType?: TaskType;
  prompt?: string;
  essay?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;

    if (body.taskType !== "task1" && body.taskType !== "task2") {
      return NextResponse.json({ error: "taskType must be task1 or task2." }, { status: 400 });
    }

    const result = await evaluateWriting({
      taskType: body.taskType,
      prompt: body.prompt || "",
      essay: body.essay || ""
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
