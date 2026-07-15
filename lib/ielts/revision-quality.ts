import type { CorrectionNote } from "../types";

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
