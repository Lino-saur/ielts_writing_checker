import { describe, expect, it } from "vitest";
import { buildReviewProgress } from "../lib/ielts/review-progress";
import { findOptimizationIntroducedGrammarIssues } from "../lib/ielts/revision-quality";
import type { WritingCheckResult } from "../lib/types";

function result(essayBand: number, grammarNotes: WritingCheckResult["correctionNotes"]): WritingCheckResult {
  return {
    taskType: "task2",
    wordCount: 5,
    estimatedBand: essayBand,
    targetBand: 7,
    bandBreakdown: {
      taskAchievement: { score: essayBand, rationale: "Evidence." },
      coherenceAndCohesion: { score: essayBand, rationale: "Evidence." },
      lexicalResource: { score: essayBand, rationale: "Evidence." },
      grammaticalRangeAndAccuracy: { score: essayBand, rationale: "Evidence." }
    },
    strengths: ["A", "B", "C"],
    highlightedSentences: [],
    priorityFixes: [],
    annotatedEssay: "",
    correctionNotes: grammarNotes,
    grammarRevision: { annotatedEssay: "", correctionNotes: grammarNotes },
    feedbackMode: "ai",
    providerUsed: "deepseek"
  };
}

describe("IELTS review loop", () => {
  it("classifies accepted prior issues as resolved or remaining and identifies new issues", () => {
    const priorNote = {
      id: "1",
      category: "subject_verb_agreement",
      original: "students is",
      corrected: "students are",
      reason: "Agreement."
    };
    const newNote = {
      id: "2",
      category: "articles",
      original: "in university",
      corrected: "at university",
      reason: "Article usage."
    };
    const priorResult = result(6, [priorNote]);
    const currentResult = result(6.5, [newNote]);

    const progress = buildReviewProgress("The students are at university.", currentResult, {
      parentReviewId: "parent-1",
      previousEssay: "The students is in university.",
      previousResult: priorResult,
      acceptedRevisionIds: ["grammar:1"]
    });

    expect(progress.resolvedIssues.map((issue) => issue.id)).toEqual(["grammar:1"]);
    expect(progress.remainingIssues).toEqual([]);
    expect(progress.newIssues.map((issue) => issue.id)).toEqual(["new:2"]);
    expect(progress.bandDelta).toBe(0.5);
  });

  it("detects grammar problems introduced by optimization replacements", () => {
    const optimizationNotes = [{
      id: "1",
      category: "clarity",
      original: "students are ready",
      corrected: "students is fully prepared",
      reason: "Rephrased."
    }];
    const auditNotes = [{
      id: "1",
      category: "subject_verb_agreement",
      original: "students is fully prepared",
      corrected: "students are fully prepared",
      reason: "Agreement."
    }];

    expect(findOptimizationIntroducedGrammarIssues("students are ready", optimizationNotes, auditNotes))
      .toEqual(auditNotes);
  });
});
