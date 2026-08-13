import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { apiErrorResponse, enforceRateLimit, readJsonBody, requireBoundedString } from "@/lib/api-security";
import { generateGuidedWritingSuggestion } from "@/lib/ielts/guided-suggestion-server";
import {
  createEmptyGuidedWritingDraft,
  type GuidedSuggestionTarget,
  type GuidedWritingDraft
} from "@/lib/ielts/guided-writing";

const MAX_BODY_BYTES = 16 * 1024;
const SUGGESTION_TARGETS = new Set<GuidedSuggestionTarget>([
  "positionIdea",
  "bodyOneIdea",
  "bodyTwoIdea",
  "introductionContext",
  "introductionThesis",
  "bodyOneTopic",
  "bodyOneExplanation",
  "bodyOneExample",
  "bodyTwoTopic",
  "bodyTwoExplanation",
  "bodyTwoExample",
  "conclusionRestatement"
]);

type RequestBody = {
  taskPrompt?: string;
  field?: string;
  draft?: Partial<GuidedWritingDraft>;
  locale?: "en" | "zh-CN";
};

function readDraft(value: RequestBody["draft"]): GuidedWritingDraft {
  const empty = createEmptyGuidedWritingDraft();
  if (!value || typeof value !== "object") return empty;
  const stance = value.stance === "agree" || value.stance === "partial" || value.stance === "disagree"
    ? value.stance
    : "";
  return Object.fromEntries(Object.entries({ ...empty, ...value }).map(([key, fieldValue]) => [
    key,
    key === "stance" ? stance : typeof fieldValue === "string" ? fieldValue.slice(0, 800) : ""
  ])) as GuidedWritingDraft;
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    await enforceRateLimit({
      scope: "guided-writing-suggestion",
      subject: session.user.id,
      limit: 30,
      windowSeconds: 60
    });
    const body = await readJsonBody<RequestBody>(request, MAX_BODY_BYTES);
    const taskPrompt = requireBoundedString(body.taskPrompt, "taskPrompt", { maxLength: 10_000 });
    if (!body.field || !SUGGESTION_TARGETS.has(body.field as GuidedSuggestionTarget)) {
      return NextResponse.json({ error: "INVALID_GUIDED_WRITING_FIELD" }, { status: 400 });
    }
    const suggestion = await generateGuidedWritingSuggestion({
      taskPrompt,
      field: body.field as GuidedSuggestionTarget,
      draft: readDraft(body.draft),
      locale: body.locale === "zh-CN" ? "zh-CN" : "en"
    });
    return NextResponse.json({ suggestion });
  } catch (error) {
    const normalized = apiErrorResponse(error);
    return NextResponse.json({ error: normalized.message }, { status: normalized.status });
  }
}
