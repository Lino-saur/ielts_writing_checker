import { describe, expect, it } from "vitest";
import { buildReviewProgress } from "../lib/ielts/review-progress";
import {
  rejectGrammarCorrectionsFlaggedByVerification,
  findOptimizationIntroducedGrammarIssues,
  isOptimizationExpansionSafe,
  shouldSkipArticleOptimization
} from "../lib/ielts/revision-quality";
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

  it("removes grammar suggestions whose replacements fail independent verification", () => {
    const proposal = {
      annotatedEssay: "Community service should [del#1]be[/del#1][add#1]create[/add#1] compulsory because [del#2]it[/del#2][add#2]which[/add#2] can help [del#3]studentss[/del#3][add#3]students[/add#3].",
      correctionNotes: [
        { id: "1", category: "clause_structure", original: "be", corrected: "create", reason: "Candidate." },
        { id: "2", category: "clause_structure", original: "it", corrected: "which", reason: "Candidate." },
        { id: "3", category: "word_form", original: "studentss", corrected: "students", reason: "Candidate." }
      ]
    };
    const verification = {
      annotatedEssay: "Community service [del#1]should create compulsory[/del#1][add#1]should be compulsory[/add#1] because [del#2]which[/del#2][add#2]it[/add#2] can help students.",
      correctionNotes: [
        { id: "1", category: "verb_pattern", original: "should create compulsory", corrected: "should be compulsory", reason: "The replacement is ungrammatical." },
        { id: "2", category: "clause_structure", original: "which", corrected: "it", reason: "The replacement cannot follow because." }
      ]
    };

    const filtered = rejectGrammarCorrectionsFlaggedByVerification(proposal, verification);

    expect(filtered.rejectedIds).toEqual(["1", "2"]);
    expect(filtered.revision.annotatedEssay).toBe(
      "Community service should be compulsory because it can help [del#3]studentss[/del#3][add#3]students[/add#3]."
    );
    expect(filtered.revision.correctionNotes.map((note) => note.id)).toEqual(["3"]);
  });

  it("keeps grammar suggestions when verification finds no replacement errors", () => {
    const proposal = {
      annotatedEssay: "It helps [del#1]studentss[/del#1][add#1]students[/add#1].",
      correctionNotes: [
        { id: "1", category: "word_form", original: "studentss", corrected: "students", reason: "Correct spelling." }
      ]
    };

    const filtered = rejectGrammarCorrectionsFlaggedByVerification(proposal, {
      annotatedEssay: "It helps students.",
      correctionNotes: []
    });

    expect(filtered.rejectedIds).toEqual([]);
    expect(filtered.revision).toEqual(proposal);
  });

  it("skips article optimization for incomplete essays", () => {
    expect(shouldSkipArticleOptimization("task1", "A short response.")).toBe(true);
    expect(shouldSkipArticleOptimization("task2", "A short response.")).toBe(true);
    expect(shouldSkipArticleOptimization("task2", "word ".repeat(250))).toBe(false);
  });

  it("rejects optimization edits that expand a source span into model-written content", () => {
    expect(isOptimizationExpansionSafe("more opportunities", "a wider range of employment opportunities")).toBe(true);
    expect(isOptimizationExpansionSafe(
      "Museums are good.",
      "Museums preserve collective memory, strengthen civic identity, support local tourism, and create accessible educational opportunities for every member of society."
    )).toBe(false);
  });
});
