import type { CorrectionNote, RevisionStage } from "../types";
import { countWords, type CheckInput } from "./shared";

const NUMBERED_REVISION_PATTERN = /\[del#([A-Za-z0-9_-]+)\]([\s\S]*?)\[\/del#\1\]\[add#\1\]([\s\S]*?)\[\/add#\1\]/g;

type RevisionRange = { id: string; start: number; end: number };

function collectRevisionRanges(annotatedEssay: string, side: "original" | "corrected") {
  const ranges: RevisionRange[] = [];
  let sourceCursor = 0;
  let renderedCursor = 0;

  for (const match of annotatedEssay.matchAll(NUMBERED_REVISION_PATTERN)) {
    renderedCursor += annotatedEssay.slice(sourceCursor, match.index).length;
    const selectedText = side === "original" ? match[2] : match[3];
    ranges.push({
      id: match[1],
      start: renderedCursor,
      end: renderedCursor + selectedText.length
    });
    renderedCursor += selectedText.length;
    sourceCursor = match.index + match[0].length;
  }

  return ranges;
}

function rangesOverlap(left: RevisionRange, right: RevisionRange) {
  if (left.start === left.end) return left.start >= right.start && left.start <= right.end;
  if (right.start === right.end) return right.start >= left.start && right.start <= left.end;
  return left.start < right.end && right.start < left.end;
}

export function rejectGrammarCorrectionsFlaggedByVerification<T extends RevisionStage>(
  proposal: T,
  verification: RevisionStage
) {
  if (verification.correctionNotes.length === 0) {
    return { revision: proposal, rejectedIds: [] as string[] };
  }

  const proposalRanges = collectRevisionRanges(proposal.annotatedEssay, "corrected");
  const verificationRanges = collectRevisionRanges(verification.annotatedEssay, "original");
  const rejectedIds = proposalRanges
    .filter((proposalRange) => verificationRanges.some((verificationRange) =>
      rangesOverlap(proposalRange, verificationRange)
    ))
    .map((range) => range.id);
  if (rejectedIds.length === 0) {
    return { revision: proposal, rejectedIds };
  }

  const rejectedIdSet = new Set(rejectedIds);
  const annotatedEssay = proposal.annotatedEssay.replace(
    NUMBERED_REVISION_PATTERN,
    (markup, id: string, original: string) => rejectedIdSet.has(id) ? original : markup
  );
  return {
    revision: {
      ...proposal,
      annotatedEssay,
      correctionNotes: proposal.correctionNotes.filter((note) => !rejectedIdSet.has(note.id))
    },
    rejectedIds
  };
}

export function shouldSkipArticleOptimization(taskType: CheckInput["taskType"], essay: string) {
  const minimumWords = taskType === "task1" ? 150 : 250;
  return countWords(essay) < minimumWords;
}

export function isOptimizationExpansionSafe(original: string, replacement: string) {
  const originalWords = countWords(original);
  const replacementWords = countWords(replacement);
  const maximumAddedWords = Math.min(12, Math.max(4, Math.ceil(originalWords * 0.5)));
  return replacementWords - originalWords <= maximumAddedWords;
}

export function findOptimizationIntroducedGrammarIssues(
  essayBeforeOptimization: string,
  optimizationNotes: CorrectionNote[],
  auditNotes: CorrectionNote[]
) {
  return auditNotes.filter((auditNote) => {
    const existedBeforeOptimization = essayBeforeOptimization.includes(auditNote.original);
    const overlapsOptimizationReplacement = optimizationNotes.some((optimizationNote) =>
      Boolean(
        optimizationNote.corrected &&
        (auditNote.original.includes(optimizationNote.corrected) || optimizationNote.corrected.includes(auditNote.original))
      )
    );
    return !existedBeforeOptimization || overlapsOptimizationReplacement;
  });
}
