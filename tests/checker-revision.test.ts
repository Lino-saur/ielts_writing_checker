import { describe, expect, it } from "vitest";
import {
  groupRevisionEditsByCategory,
  materializeRevisionEssay,
  materializeVerifiedOptimizationEssay,
  parseAnnotatedEssay
} from "../app/checker/checker-revision";

describe("checker revision helpers", () => {
  it("aligns annotated edits with their correction notes", () => {
    const parsed = parseAnnotatedEssay(
      "Students [del#sv1]is[/del#sv1][add#sv1]are[/add#sv1] ready.",
      [
        {
          id: "sv1",
          category: "subject_verb_agreement",
          original: "is",
          corrected: "are",
          reason: "A plural subject requires a plural verb."
        }
      ]
    );

    expect(parsed.edits).toHaveLength(1);
    expect(parsed.edits[0].note?.id).toBe("sv1");
    expect(parsed.parts.map((part) => part.type)).toEqual(["plain", "edit", "plain"]);
  });

  it("groups edits by normalized display category", () => {
    const parsed = parseAnnotatedEssay(
      "[del#a]is[/del#a][add#a]are[/add#a] and [del#b]in Monday[/del#b][add#b]on Monday[/add#b]",
      [
        {
          id: "a",
          category: "subject_verb_agreement",
          original: "is",
          corrected: "are",
          reason: "Agreement."
        },
        {
          id: "b",
          category: "preposition",
          original: "in Monday",
          corrected: "on Monday",
          reason: "Use on with days."
        }
      ]
    );

    const groups = groupRevisionEditsByCategory(parsed.edits, "en");
    expect(groups.map((group) => group.key)).toEqual(["subject_verb_agreement", "preposition"]);
  });

  it("materializes only accepted revisions and keeps ignored or pending text", () => {
    const annotated =
      "Students [del#a]is[/del#a][add#a]are[/add#a] ready [del#b]in Monday[/del#b][add#b]on Monday[/add#b].";
    const notes = [
      {
        id: "a",
        category: "subject_verb_agreement",
        original: "is",
        corrected: "are",
        reason: "Agreement."
      },
      {
        id: "b",
        category: "preposition",
        original: "in Monday",
        corrected: "on Monday",
        reason: "Use on with days."
      }
    ];

    expect(materializeRevisionEssay(annotated, notes, { a: "accepted", b: "ignored" })).toBe(
      "Students are ready in Monday."
    );
    expect(materializeRevisionEssay(annotated, notes, {})).toBe(
      "Students is ready in Monday."
    );
  });

  it("uses the grammar-verified final essay when all optimization edits are accepted", () => {
    const result = materializeVerifiedOptimizationEssay(
      {
        annotatedEssay: "Students [del#o1]learn quick[/del#o1][add#o1]learn quickly[/add#o1].",
        correctionNotes: [
          { id: "o1", original: "learn quick", corrected: "learn quickly", reason: "Improve the phrasing." }
        ]
      },
      { o1: "accepted" },
      {
        annotatedEssay: "[del#f1]Students learns quickly[/del#f1][add#f1]Students learn quickly[/add#f1].",
        correctionNotes: [
          { id: "f1", original: "Students learns quickly", corrected: "Students learn quickly", reason: "Use plural agreement." }
        ]
      }
    );

    expect(result).toEqual({
      essay: "Students learn quickly.",
      appliedFinalGrammarIds: ["f1"]
    });
  });

  it("only auto-applies uniquely anchored final grammar fixes after partial optimization", () => {
    const result = materializeVerifiedOptimizationEssay(
      {
        annotatedEssay: "It is [del#o1]very good[/del#o1][add#o1]beneficial[/add#o1]. Students is [del#o2]ready[/del#o2][add#o2]prepared[/add#o2].",
        correctionNotes: [
          { id: "o1", original: "very good", corrected: "beneficial", reason: "Use more precise wording." },
          { id: "o2", original: "ready", corrected: "prepared", reason: "Use more precise wording." }
        ]
      },
      { o1: "accepted", o2: "ignored" },
      {
        annotatedEssay: "It is beneficial. [del#f1]Students is[/del#f1][add#f1]Students are[/add#f1] ready.",
        correctionNotes: [
          { id: "f1", original: "Students is", corrected: "Students are", reason: "Use plural agreement." }
        ]
      }
    );

    expect(result.essay).toBe("It is beneficial. Students are ready.");
    expect(result.appliedFinalGrammarIds).toEqual(["f1"]);
  });
});
