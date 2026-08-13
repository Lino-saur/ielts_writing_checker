export type GuidedWritingStance = "agree" | "partial" | "disagree" | "";

export type GuidedWritingDraft = {
  stance: GuidedWritingStance;
  introductionContext: string;
  introductionThesis: string;
  bodyOneTopic: string;
  bodyOneExplanation: string;
  bodyOneExample: string;
  bodyTwoTopic: string;
  bodyTwoExplanation: string;
  bodyTwoExample: string;
  conclusionRestatement: string;
};

export type GuidedWritingField = Exclude<keyof GuidedWritingDraft, "stance">;
export type GuidedSuggestionTarget = GuidedWritingField | "positionIdea" | "bodyOneIdea" | "bodyTwoIdea";

export function createEmptyGuidedWritingDraft(): GuidedWritingDraft {
  return {
    stance: "",
    introductionContext: "",
    introductionThesis: "",
    bodyOneTopic: "",
    bodyOneExplanation: "",
    bodyOneExample: "",
    bodyTwoTopic: "",
    bodyTwoExplanation: "",
    bodyTwoExample: "",
    conclusionRestatement: ""
  };
}

function paragraph(...sentences: string[]) {
  return sentences
    .map((sentence) => sentence.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .join(" ");
}

export function composeGuidedEssay(draft: GuidedWritingDraft) {
  return [
    paragraph(draft.introductionContext, draft.introductionThesis),
    paragraph(draft.bodyOneTopic, draft.bodyOneExplanation, draft.bodyOneExample),
    paragraph(draft.bodyTwoTopic, draft.bodyTwoExplanation, draft.bodyTwoExample),
    paragraph(draft.conclusionRestatement)
  ].filter(Boolean).join("\n\n");
}

export function getGuidedWritingCompletion(draft: GuidedWritingDraft) {
  const sections = getGuidedWritingSectionStatus(draft);
  return {
    completed: sections.filter(Boolean).length,
    total: sections.length
  };
}

export function getGuidedWritingSectionStatus(draft: GuidedWritingDraft) {
  return [
    Boolean(draft.stance),
    Boolean(draft.introductionContext.trim() && draft.introductionThesis.trim()),
    Boolean(draft.bodyOneTopic.trim() && draft.bodyOneExplanation.trim()),
    Boolean(draft.bodyTwoTopic.trim() && draft.bodyTwoExplanation.trim()),
    Boolean(draft.conclusionRestatement.trim())
  ];
}

export function buildGuidedSuggestionPrompt({
  taskPrompt,
  field,
  draft,
  locale
}: {
  taskPrompt: string;
  field: GuidedSuggestionTarget;
  draft: GuidedWritingDraft;
  locale: "en" | "zh-CN";
}) {
  const isPlanningTarget = field.endsWith("Idea");
  return `IELTS Task 2 prompt:\n${taskPrompt.trim()}\n\nCurrent guided outline:\n${JSON.stringify(draft)}\n\nActive field: ${field}\nInterface language: ${locale}\n\n${isPlanningTarget
    ? "Return one concise planning angle or thinking question in the interface language. Help the learner decide what to argue, but do not write an essay sentence for them."
    : "Return one short English suggestion for the active field. If the learner entered keywords or a partial sentence, turn only that material into a natural sentence."} Keep the learner's stance and existing ideas. Do not write another field, a paragraph, or a complete essay.`;
}

export function parseGuidedSuggestionResponse(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Guided suggestion must be JSON.");
  const parsed = JSON.parse(text.slice(start, end + 1)) as { suggestion?: unknown };
  if (typeof parsed.suggestion !== "string" || !parsed.suggestion.trim()) {
    throw new Error("Guided suggestion must contain a non-empty suggestion.");
  }
  const suggestion = parsed.suggestion.trim().replace(/\s+/g, " ");
  if (suggestion.length > 240) {
    throw new Error("Guided suggestion must contain at most 240 characters.");
  }
  if (suggestion.split(/\s+/).length > 35) {
    throw new Error("Guided suggestion must contain at most 35 words.");
  }
  return suggestion;
}
