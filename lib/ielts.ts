import {
  buildAiRevisionFeedback,
  buildAiScoreFeedback,
  buildEvaluationTaskContext,
  isAiTimeoutError
} from "./ielts/ai";
import { CheckInput, WritingCheckResult, WritingRevisionResult, WritingScoreResult, countWords, getLocale, getTargetBand } from "./ielts/shared";
import type { WritingReviewProgressStage } from "./types";
import { buildReviewProgress } from "./ielts/review-progress";

function validateInput(input: CheckInput) {
  const cleanInput = {
    taskType: input.taskType,
    prompt: input.prompt.trim(),
    essay: input.essay.trim(),
    taskImage: input.taskImage ?? null,
    provider: input.provider,
    locale: getLocale(input.locale),
    targetBand: getTargetBand(input.targetBand),
    priorReview: input.priorReview
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
  const taskContext = await buildEvaluationTaskContext(cleanInput);
  return buildAiScoreFeedback(cleanInput, taskContext);
}

export async function evaluateWritingRevision(input: CheckInput): Promise<WritingRevisionResult> {
  const cleanInput = validateInput(input);
  const taskContext = await buildEvaluationTaskContext(cleanInput);
  return buildAiRevisionFeedback(cleanInput, taskContext);
}

export async function evaluateWriting(
  input: CheckInput,
  onProgress?: (progressPercent: number, progressStage: WritingReviewProgressStage) => void | Promise<void>
): Promise<WritingCheckResult> {
  try {
    const cleanInput = validateInput(input);
    await onProgress?.(10, "analyzing_task");
    const taskContext = await buildEvaluationTaskContext(cleanInput);
    await onProgress?.(20, "scoring");
    const scorePromise = buildAiScoreFeedback(cleanInput, taskContext).then(async (score) => {
      await onProgress?.(55, "scoring");
      return score;
    });
    const [scoreOutcome, revisionOutcome] = await Promise.allSettled([
      scorePromise,
      buildAiRevisionFeedback(cleanInput, taskContext, onProgress)
    ]);
    if (scoreOutcome.status === "rejected") {
      console.error("[IELTS_CHECK][PIPELINE_COMPONENT_FAILED]", {
        component: "score",
        errorType: scoreOutcome.reason instanceof Error ? scoreOutcome.reason.name : typeof scoreOutcome.reason,
        errorMessage: scoreOutcome.reason instanceof Error ? scoreOutcome.reason.message : String(scoreOutcome.reason)
      });
    }
    if (revisionOutcome.status === "rejected") {
      console.error("[IELTS_CHECK][PIPELINE_COMPONENT_FAILED]", {
        component: "revision",
        errorType: revisionOutcome.reason instanceof Error ? revisionOutcome.reason.name : typeof revisionOutcome.reason,
        errorMessage: revisionOutcome.reason instanceof Error ? revisionOutcome.reason.message : String(revisionOutcome.reason)
      });
    }
    if (scoreOutcome.status === "rejected") throw scoreOutcome.reason;
    if (revisionOutcome.status === "rejected") throw revisionOutcome.reason;
    const score = scoreOutcome.value;
    const revision = revisionOutcome.value;

    const result: WritingCheckResult = {
      taskType: score.taskType,
      wordCount: score.wordCount,
      estimatedBand: score.estimatedBand,
      targetBand: score.targetBand,
      bandBreakdown: score.bandBreakdown,
      taskChecks: score.taskChecks,
      strengths: score.strengths,
      highlightedSentences: score.highlightedSentences,
      priorityFixes: score.priorityFixes,
      annotatedEssay: revision.annotatedEssay,
      correctionNotes: revision.correctionNotes,
      grammarRevision: revision.grammarRevision,
      optimizationRevision: revision.optimizationRevision,
      finalGrammarRevision: revision.finalGrammarRevision,
      grammarQuality: revision.grammarQuality,
      feedbackMode: "ai",
      providerUsed: score.providerUsed
    };
    if (cleanInput.priorReview) {
      result.reviewProgress = buildReviewProgress(cleanInput.essay, result, cleanInput.priorReview);
    }
    await onProgress?.(94, "saving");
    return result;
  } catch (error) {
    const isTimeout = isAiTimeoutError(error);
    console.error("[IELTS_CHECK][AI_REVIEW_FAILED]", {
      taskType: input.taskType,
      locale: getLocale(input.locale),
      wordCount: countWords(input.essay || ""),
      errorType: error instanceof Error ? error.name : typeof error,
      timedOut: isTimeout
    });
    throw new Error(isTimeout ? "AI_REVIEW_TIMEOUT" : "AI_REVIEW_FAILED");
  }
}
