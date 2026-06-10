import { buildAiRevisionFeedback, buildAiScoreFeedback } from "./ielts/ai";
import { CheckInput, WritingCheckResult, WritingRevisionResult, WritingScoreResult, countWords, getLocale, getTargetBand } from "./ielts/shared";

function validateInput(input: CheckInput) {
  const cleanInput = {
    taskType: input.taskType,
    prompt: input.prompt.trim(),
    essay: input.essay.trim(),
    provider: input.provider,
    locale: getLocale(input.locale),
    targetBand: getTargetBand(input.targetBand)
  };

  if (!cleanInput.prompt) {
    throw new Error("Prompt is required.");
  }

  if (!cleanInput.essay) {
    throw new Error("Essay is required.");
  }

  return cleanInput;
}

export async function evaluateWritingScore(input: CheckInput): Promise<WritingScoreResult> {
  const cleanInput = validateInput(input);
  return buildAiScoreFeedback(cleanInput);
}

export async function evaluateWritingRevision(input: CheckInput): Promise<WritingRevisionResult> {
  const cleanInput = validateInput(input);
  return buildAiRevisionFeedback(cleanInput);
}

export async function evaluateWriting(input: CheckInput): Promise<WritingCheckResult> {
  try {
    const [score, revision] = await Promise.all([evaluateWritingScore(input), evaluateWritingRevision(input)]);

    return {
      taskType: score.taskType,
      wordCount: score.wordCount,
      estimatedBand: score.estimatedBand,
      targetBand: score.targetBand,
      bandBreakdown: score.bandBreakdown,
      strengths: score.strengths,
      highlightedSentences: score.highlightedSentences,
      priorityFixes: score.priorityFixes,
      annotatedEssay: revision.annotatedEssay,
      correctionNotes: revision.correctionNotes,
      feedbackMode: "ai",
      providerUsed: score.providerUsed
    };
  } catch (error) {
    console.error("[IELTS_CHECK][AI_REVIEW_FAILED]", {
      taskType: input.taskType,
      locale: getLocale(input.locale),
      wordCount: countWords(input.essay || ""),
      error: error instanceof Error ? error.message : String(error)
    });
    throw new Error("AI_REVIEW_FAILED");
  }
}
