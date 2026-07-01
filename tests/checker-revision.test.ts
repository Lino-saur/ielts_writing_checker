import { describe, expect, it } from "vitest";
import {
  groupRevisionEditsByCategory,
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
});
