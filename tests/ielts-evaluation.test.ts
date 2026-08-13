import { describe, expect, it } from "vitest";
import { evaluateRegressionRuns, type EvaluationRun, type RegressionCase } from "../lib/ielts/evaluation";
import type { WritingRevisionResult, WritingScoreResult } from "../lib/types";

const regressionCase: RegressionCase = {
  id: "case-1",
  taskType: "task2",
  prompt: "Do you agree or disagree?",
  essay: "I agree because the policy lowers costs.",
  expectedQuestionType: "opinion",
  expectedObligationIds: ["state_position"]
};

function score(estimatedBand: number): WritingScoreResult {
  return {
    taskType: "task2",
    wordCount: 7,
    estimatedBand,
    targetBand: 7,
    bandBreakdown: {
      taskAchievement: { score: 6.5, rationale: "The position is clear." },
      coherenceAndCohesion: { score: 7, rationale: "The response progresses clearly." },
      lexicalResource: { score: 6.5, rationale: "Vocabulary is appropriate." },
      grammaticalRangeAndAccuracy: { score: 7, rationale: "Grammar is controlled." }
    },
    taskChecks: [{ id: "state_position", status: "met", detail: "The writer agrees explicitly." }],
    strengths: ["Clear position", "Relevant reason", "Accurate grammar"],
    highlightedSentences: [{ sentence: "I agree because the policy lowers costs.", reason: "It gives a direct position." }],
    priorityFixes: [
      { title: "Develop", detail: "Add evidence." },
      { title: "Extend", detail: "Explain the mechanism." },
      { title: "Conclude", detail: "Restate the scope." }
    ],
    feedbackMode: "ai",
    providerUsed: "deepseek"
  };
}

const revision: WritingRevisionResult = {
  taskType: "task2",
  wordCount: 7,
  targetBand: 7,
  annotatedEssay: "I agree because the policy [del#1]lowers costs[/del#1][add#1]reduces household expenses[/add#1].",
  correctionNotes: [{
    id: "1",
    category: "lexical_choice",
    original: "lowers costs",
    corrected: "reduces household expenses",
    reason: "The original phrase is broad. The replacement is more precise."
  }],
  feedbackMode: "ai",
  providerUsed: "deepseek"
};

const cleanRevision: WritingRevisionResult = {
  ...revision,
  annotatedEssay: "I agree because the policy reduces household expenses.",
  correctionNotes: []
};

describe("IELTS regression metrics", () => {
  it("measures contract, semantic, alignment, and score stability rates", () => {
    const runs: EvaluationRun[] = [
      {
        caseId: "case-1",
        runId: "one",
        attemptCount: 1,
        score: score(7),
        revision,
        followup: {
          essay: "I agree because the policy reduces household expenses.",
          score: score(7),
          revision: cleanRevision
        }
      },
      { caseId: "case-1", runId: "two", attemptCount: 2, score: score(6.5), revision }
    ];
    const metrics = evaluateRegressionRuns([regressionCase], runs);

    expect(metrics.contractSuccessRate).toBe(1);
    expect(metrics.firstAttemptSuccessRate).toBe(0.5);
    expect(metrics.exactHighlightQuoteRate).toBe(1);
    expect(metrics.taskCheckCompletenessRate).toBe(1);
    expect(metrics.overallBandConsistencyRate).toBe(0.5);
    expect(metrics.revisionAlignmentRate).toBe(1);
    expect(metrics.stableCaseRate).toBe(1);
    expect(metrics.caseBandSpreads["case-1"]).toBe(0.5);
    expect(metrics.closedLoopRuns).toBe(1);
    expect(metrics.appliedIssueResolutionRate).toBe(1);
    expect(metrics.repeatedIssueRate).toBe(0);
    expect(metrics.newIssueRate).toBe(0);
    expect(metrics.grammarNonRegressionRate).toBe(1);
    expect(metrics.scoreChangeEvidenceRate).toBe(1);
  });

  it("counts initial grammar edits when the final audit is clean", () => {
    const initialRevision: WritingRevisionResult = {
      ...cleanRevision,
      grammarRevision: {
        annotatedEssay: "The [del#1]policy lower[/del#1][add#1]policy lowers[/add#1] costs.",
        correctionNotes: [{
          id: "grammar-1",
          category: "subject_verb_agreement",
          original: "policy lower",
          corrected: "policy lowers",
          reason: "The singular subject requires a singular verb."
        }]
      },
      finalGrammarRevision: {
        annotatedEssay: "The policy lowers costs.",
        correctionNotes: []
      }
    };
    const metrics = evaluateRegressionRuns([regressionCase], [{
      caseId: "case-1",
      runId: "clean-final-audit",
      attemptCount: 1,
      score: score(7),
      revision: initialRevision,
      followup: {
        essay: "The policy lowers costs.",
        score: score(7),
        revision: cleanRevision
      }
    }]);

    expect(metrics.appliedIssueResolutionRate).toBe(1);
  });
});
