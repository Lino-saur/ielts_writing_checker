import type { WritingRevisionResult, WritingScoreResult } from "@/lib/types";

export type RegressionCase = {
  id: string;
  taskType: "task1" | "task2";
  prompt: string;
  essay: string;
  expectedQuestionType?: string;
  expectedObligationIds?: string[];
};

export type EvaluationRun = {
  caseId: string;
  runId: string;
  attemptCount: number;
  score?: WritingScoreResult;
  revision?: WritingRevisionResult;
  followup?: {
    essay: string;
    score: WritingScoreResult;
    revision: WritingRevisionResult;
  };
  error?: string;
};

export type EvaluationMetrics = {
  totalRuns: number;
  completedRuns: number;
  contractSuccessRate: number;
  firstAttemptSuccessRate: number;
  exactHighlightQuoteRate: number;
  taskCheckCompletenessRate: number;
  overallBandConsistencyRate: number;
  revisionAlignmentRate: number;
  stableCaseRate: number;
  caseBandSpreads: Record<string, number>;
  closedLoopRuns: number;
  appliedIssueResolutionRate: number;
  repeatedIssueRate: number;
  newIssueRate: number;
  grammarNonRegressionRate: number;
  scoreChangeEvidenceRate: number;
};

function rate(passed: number, total: number) {
  return total ? Number((passed / total).toFixed(4)) : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCompletedRun(
  run: EvaluationRun
): run is EvaluationRun & { score: WritingScoreResult; revision: WritingRevisionResult } {
  if (run.error || !isRecord(run.score) || !isRecord(run.revision)) return false;
  const score = run.score as unknown as Record<string, unknown>;
  const revision = run.revision as unknown as Record<string, unknown>;
  const breakdown = score.bandBreakdown;
  if (!isRecord(breakdown)) return false;
  const criterionNames = ["taskAchievement", "coherenceAndCohesion", "lexicalResource", "grammaticalRangeAndAccuracy"];
  const criteriaAreValid = criterionNames.every((name) => {
    const criterion = breakdown[name];
    return isRecord(criterion) && typeof criterion.score === "number" && typeof criterion.rationale === "string";
  });
  return (
    criteriaAreValid &&
    typeof score.estimatedBand === "number" &&
    Array.isArray(score.taskChecks) &&
    Array.isArray(score.highlightedSentences) &&
    Array.isArray(revision.correctionNotes) &&
    typeof revision.annotatedEssay === "string"
  );
}

function expectedOverallBand(score: WritingScoreResult) {
  const values = Object.values(score.bandBreakdown).map((criterion) => criterion.score);
  return Math.max(0, Math.min(9, Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 2) / 2));
}

function revisionIsAligned(revision: WritingRevisionResult) {
  const matches = [...revision.annotatedEssay.matchAll(
    /\[del#([A-Za-z0-9_-]+)\]([\s\S]*?)\[\/del#\1\]\[add#\1\]([\s\S]*?)\[\/add#\1\]/g
  )];
  const editIds = matches.map((match) => match[1]);
  const noteIds = revision.correctionNotes.map((note) => note.id);
  if (new Set(editIds).size !== editIds.length || new Set(noteIds).size !== noteIds.length) return false;
  if (editIds.length !== noteIds.length) return false;
  return editIds.every((id) => noteIds.includes(id)) && noteIds.every((id) => editIds.includes(id));
}

function materializeAnnotatedEssay(annotatedEssay: string) {
  return annotatedEssay
    .replace(/\[del#([A-Za-z0-9_-]+)\][\s\S]*?\[\/del#\1\]\[add#\1\]([\s\S]*?)\[\/add#\1\]/g, "$2")
    .replace(/\[del\][\s\S]*?\[\/del\]\[add\]([\s\S]*?)\[\/add\]/g, "$1");
}

export function materializeRecommendedEssay(revision: WritingRevisionResult) {
  const grammarEssay = revision.grammarRevision
    ? materializeAnnotatedEssay(revision.grammarRevision.annotatedEssay)
    : materializeAnnotatedEssay(revision.annotatedEssay);
  const optimizedEssay = revision.optimizationRevision
    ? materializeAnnotatedEssay(revision.optimizationRevision.annotatedEssay)
    : grammarEssay;
  return revision.finalGrammarRevision
    ? materializeAnnotatedEssay(revision.finalGrammarRevision.annotatedEssay)
    : optimizedEssay;
}

function grammarNotes(revision: WritingRevisionResult) {
  return revision.finalGrammarRevision?.correctionNotes
    ?? revision.grammarRevision?.correctionNotes
    ?? revision.correctionNotes;
}

function taskChecksWorsened(before: WritingScoreResult, after: WritingScoreResult) {
  const rank = { met: 3, not_applicable: 3, partial: 2, missing: 1 } as const;
  const beforeById = new Map((before.taskChecks ?? []).map((check) => [check.id, check.status]));
  return (after.taskChecks ?? []).some((check) => {
    const previous = beforeById.get(check.id);
    return previous ? rank[check.status] < rank[previous] : false;
  });
}

export function evaluateRegressionRuns(cases: RegressionCase[], runs: EvaluationRun[]): EvaluationMetrics {
  const casesById = new Map(cases.map((item) => [item.id, item]));
  const completed = runs.filter(isCompletedRun);
  let highlightCount = 0;
  let exactHighlightCount = 0;
  let taskChecksComplete = 0;
  let overallBandsConsistent = 0;
  let revisionsAligned = 0;
  let closedLoopRuns = 0;
  let appliedIssueCount = 0;
  let resolvedAppliedIssueCount = 0;
  let followupIssueCount = 0;
  let repeatedIssueCount = 0;
  let newIssueCount = 0;
  let grammarNonRegressions = 0;
  let scoreChangesWithEvidence = 0;

  completed.forEach((run) => {
    const regressionCase = casesById.get(run.caseId);
    run.score.highlightedSentences.forEach((highlight) => {
      highlightCount += 1;
      if (regressionCase?.essay.includes(highlight.sentence)) exactHighlightCount += 1;
    });

    const expectedIds = regressionCase?.taskType === "task2"
      ? regressionCase.expectedObligationIds ?? []
      : ["image_relevance", "overview", "key_features", "data_accuracy"];
    const actualIds = run.score.taskChecks?.map((check) => check.id) ?? [];
    if (
      expectedIds.length === actualIds.length &&
      expectedIds.every((id) => actualIds.includes(id)) &&
      new Set(actualIds).size === actualIds.length
    ) {
      taskChecksComplete += 1;
    }
    if (run.score.estimatedBand === expectedOverallBand(run.score)) overallBandsConsistent += 1;
    if (revisionIsAligned(run.revision)) revisionsAligned += 1;

    if (run.followup) {
      closedLoopRuns += 1;
      const initialNotes = grammarNotes(run.revision);
      const followupNotes = grammarNotes(run.followup.revision);
      appliedIssueCount += initialNotes.length;
      resolvedAppliedIssueCount += initialNotes.filter((note) =>
        !run.followup?.essay.includes(note.original) && (!note.corrected || run.followup?.essay.includes(note.corrected))
      ).length;
      followupIssueCount += followupNotes.length;
      const repeated = followupNotes.filter((followupNote) =>
        initialNotes.some((initialNote) =>
          (initialNote.category ?? "other") === (followupNote.category ?? "other") &&
          (followupNote.original === initialNote.original ||
            Boolean(initialNote.corrected && followupNote.original.includes(initialNote.corrected)))
        )
      );
      repeatedIssueCount += repeated.length;
      newIssueCount += Math.max(0, followupNotes.length - repeated.length);
      if (
        run.followup.score.bandBreakdown.grammaticalRangeAndAccuracy.score >=
        run.score.bandBreakdown.grammaticalRangeAndAccuracy.score
      ) {
        grammarNonRegressions += 1;
      }
      if (
        run.followup.score.estimatedBand >= run.score.estimatedBand ||
        repeated.length > 0 ||
        followupNotes.length > 0 ||
        taskChecksWorsened(run.score, run.followup.score)
      ) {
        scoreChangesWithEvidence += 1;
      }
    }
  });

  const bandsByCase = new Map<string, number[]>();
  completed.forEach((run) => {
    const bands = bandsByCase.get(run.caseId) ?? [];
    bands.push(run.score.estimatedBand);
    bandsByCase.set(run.caseId, bands);
  });
  const caseBandSpreads = Object.fromEntries(
    [...bandsByCase.entries()].map(([caseId, bands]) => [caseId, Math.max(...bands) - Math.min(...bands)])
  );
  const repeatedCaseSpreads = [...bandsByCase.values()]
    .filter((bands) => bands.length >= 2)
    .map((bands) => Math.max(...bands) - Math.min(...bands));

  return {
    totalRuns: runs.length,
    completedRuns: completed.length,
    contractSuccessRate: rate(completed.length, runs.length),
    firstAttemptSuccessRate: rate(completed.filter((run) => run.attemptCount === 1).length, runs.length),
    exactHighlightQuoteRate: rate(exactHighlightCount, highlightCount),
    taskCheckCompletenessRate: rate(taskChecksComplete, completed.length),
    overallBandConsistencyRate: rate(overallBandsConsistent, completed.length),
    revisionAlignmentRate: rate(revisionsAligned, completed.length),
    stableCaseRate: rate(repeatedCaseSpreads.filter((spread) => spread <= 0.5).length, repeatedCaseSpreads.length),
    caseBandSpreads,
    closedLoopRuns,
    appliedIssueResolutionRate: rate(resolvedAppliedIssueCount, appliedIssueCount),
    repeatedIssueRate: rate(repeatedIssueCount, followupIssueCount),
    newIssueRate: rate(newIssueCount, followupIssueCount),
    grammarNonRegressionRate: rate(grammarNonRegressions, closedLoopRuns),
    scoreChangeEvidenceRate: rate(scoreChangesWithEvidence, closedLoopRuns)
  };
}
