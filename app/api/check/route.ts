import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { evaluateWriting } from "@/lib/ielts";
import { getEnergyState, getReviewEnergyCost } from "@/lib/energy";
import { AiProvider, Locale, TargetBand, TaskImageInput, TaskType } from "@/lib/types";
import { createWritingReview, loadTaskImageInputFromObject } from "@/lib/writing-reviews";

type RequestBody = {
  taskType?: TaskType;
  prompt?: string;
  essay?: string;
  taskImage?: TaskImageInput | null;
  taskImageObjectKey?: string;
  taskImageName?: string;
  taskImageMimeType?: string;
  taskImageSizeBytes?: number;
  provider?: AiProvider;
  locale?: Locale;
  targetBand?: TargetBand;
};

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = (await request.json()) as RequestBody;

    if (body.taskType !== "task1" && body.taskType !== "task2") {
      return NextResponse.json({ error: "taskType must be task1 or task2." }, { status: 400 });
    }

    const currentEnergy = await getEnergyState(session.user.id);
    const cost = getReviewEnergyCost();

    if (currentEnergy.balance < cost) {
      return NextResponse.json(
        {
          error: "INSUFFICIENT_ENERGY",
          energy: currentEnergy,
          cost
        },
        { status: 402 }
      );
    }

    const resolvedTaskImage =
      body.taskImageObjectKey && body.taskImageName && body.taskImageMimeType
        ? await loadTaskImageInputFromObject({
            objectKey: body.taskImageObjectKey,
            name: body.taskImageName,
            mimeType: body.taskImageMimeType
          })
        : body.taskImage || null;

    const result = await evaluateWriting({
      taskType: body.taskType,
      prompt: body.prompt || "",
      essay: body.essay || "",
      taskImage: resolvedTaskImage,
      provider: body.provider,
      locale: body.locale,
      targetBand: body.targetBand
    });

    const savedReview = await createWritingReview({
      userId: session.user.id,
      prompt: body.prompt || "",
      essay: body.essay || "",
      taskImage: body.taskImage || null,
      taskImageObjectKey: body.taskImageObjectKey || null,
      taskImageName: body.taskImageName || null,
      taskImageMimeType: body.taskImageMimeType || null,
      taskImageSizeBytes: typeof body.taskImageSizeBytes === "number" ? body.taskImageSizeBytes : null,
      result
    });

    return NextResponse.json({
      result,
      energy: savedReview.energy,
      cost
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    const status = message === "UNAUTHORIZED" ? 401 : message === "AI_REVIEW_FAILED" ? 502 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
