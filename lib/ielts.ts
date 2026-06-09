import { buildAiRevisionFeedback, buildAiScoreFeedback } from "./ielts/ai";
import { buildHeuristicFeedback, toRevisionResult, toScoreResult } from "./ielts/heuristic";
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

  try {
    return await buildAiScoreFeedback(cleanInput);
  } catch (error) {
    console.error("[IELTS_CHECK][SCORE][FALLBACK_TO_HEURISTIC]", {
      taskType: cleanInput.taskType,
      locale: cleanInput.locale,
      wordCount: countWords(cleanInput.essay),
      error: error instanceof Error ? error.message : String(error)
    });
    return toScoreResult(buildHeuristicFeedback(cleanInput));
  }
}

export async function evaluateWritingRevision(input: CheckInput): Promise<WritingRevisionResult> {
  const cleanInput = validateInput(input);

  try {
    return await buildAiRevisionFeedback(cleanInput);
  } catch (error) {
    console.error("[IELTS_CHECK][REVISION][FALLBACK_TO_HEURISTIC]", {
      taskType: cleanInput.taskType,
      locale: cleanInput.locale,
      wordCount: countWords(cleanInput.essay),
      error: error instanceof Error ? error.message : String(error)
    });
    return toRevisionResult(buildHeuristicFeedback(cleanInput));
  }
}

export async function evaluateWriting(input: CheckInput): Promise<WritingCheckResult> {
  const [score, revision] = await Promise.all([
    evaluateWritingScore(input),
    evaluateWritingRevision(input)
  ]);

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
    feedbackMode: score.feedbackMode === "ai" && revision.feedbackMode === "ai" ? "ai" : "heuristic",
    providerUsed: score.feedbackMode === "ai" ? score.providerUsed : revision.providerUsed
  };
}
