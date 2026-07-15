import type {
  CorrectionNote,
  ReviewIssueProgressItem,
  ReviewProgress,
  WritingCheckResult
} from "../types";
import type { PriorReviewContext } from "./shared";

type PriorIssue = {
  acceptedId: string;
  note: CorrectionNote;
};

function collectPriorIssues(result: WritingCheckResult): PriorIssue[] {
  const grammar = (result.grammarRevision?.correctionNotes ?? result.correctionNotes).map((note) => ({
    acceptedId: `grammar:${note.id}`,
    note
  }));
  const optimization = (result.optimizationRevision?.correctionNotes ?? []).map((note) => ({
    acceptedId: `optimization:${note.id}`,
    note
  }));
  const finalGrammar = (result.finalGrammarRevision?.correctionNotes ?? []).map((note) => ({
    acceptedId: `finalGrammar:${note.id}`,
    note
  }));
  return [...grammar, ...optimization, ...finalGrammar];
}

function toProgressItem(id: string, note: CorrectionNote, detail: string): ReviewIssueProgressItem {
  return {
    id,
    category: note.category ?? "other",
    original: note.original,
    corrected: note.corrected,
    detail,
    ruleReferences: note.ruleReferences
  };
}

export function buildReviewProgress(
  currentEssay: string,
  currentResult: WritingCheckResult,
  prior: PriorReviewContext
): ReviewProgress {
  const accepted = new Set(prior.acceptedRevisionIds);
  const priorIssues = collectPriorIssues(prior.previousResult)
    .filter((issue) => accepted.size === 0 || accepted.has(issue.acceptedId));
  const resolvedIssues: ReviewIssueProgressItem[] = [];
  const remainingIssues: ReviewIssueProgressItem[] = [];

  priorIssues.forEach(({ acceptedId, note }) => {
    const originalStillPresent = currentEssay.includes(note.original);
    const correctionPresent = !note.corrected || currentEssay.includes(note.corrected);
    const item = toProgressItem(
      acceptedId,
      note,
      originalStillPresent
        ? "The previously identified wording is still present in the submitted essay."
        : correctionPresent
          ? "The previously recommended correction is present and the original wording is absent."
          : "The original issue is absent after the student's revision."
    );
    (originalStillPresent ? remainingIssues : resolvedIssues).push(item);
  });

  const currentGrammarNotes = currentResult.finalGrammarRevision?.correctionNotes
    ?? currentResult.grammarRevision?.correctionNotes
    ?? currentResult.correctionNotes;
  const priorKeys = new Set(priorIssues.map(({ note }) => `${note.category ?? "other"}\u0000${note.original}`));
  const newIssues = currentGrammarNotes
    .filter((note) => !priorKeys.has(`${note.category ?? "other"}\u0000${note.original}`))
    .map((note) => toProgressItem(`new:${note.id}`, note, "This issue was not present in the accepted issue set from the previous review."));

  return {
    parentReviewId: prior.parentReviewId,
    previousBand: prior.previousResult.estimatedBand,
    bandDelta: Number((currentResult.estimatedBand - prior.previousResult.estimatedBand).toFixed(1)),
    resolvedIssues,
    remainingIssues,
    newIssues
  };
}
