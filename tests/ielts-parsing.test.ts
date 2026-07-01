import { describe, expect, it } from "vitest";
import {
  cleanModelText,
  normalizeRevisionResult,
  normalizeScoreResult,
  parseRevisionStructuredResponse,
  parseScoreStructuredResponse
} from "../lib/ielts/parsing";

const scoreResponse = `
===TASK_TYPE===
task2
===ESTIMATED_BAND===
6.7
===TASK_ACHIEVEMENT===
score: 6.7
rationale: The position is relevant and mostly developed.
===COHERENCE_AND_COHESION===
score: 6.2
rationale: Paragraphing is clear.
===LEXICAL_RESOURCE===
score: 6.8
rationale: Vocabulary is varied.
===GRAMMATICAL_RANGE_AND_ACCURACY===
score: 5.9
rationale: Several agreement errors remain.
===STRENGTHS===
- Clear position
- Relevant examples
===HIGHLIGHTED_SENTENCES===
1. sentence: This is the strongest sentence. reason: It states the position clearly.
===PRIORITY_FIXES===
1. title: Agreement detail: Check singular subjects and verbs.
===END===
`;

describe("IELTS structured response parsing", () => {
  it("removes code fences and hidden thinking", () => {
    expect(cleanModelText("```json\n<think>secret</think>\n{\"ok\":true}\n```")).toBe('{"ok":true}');
  });

  it("parses and normalizes a score response", () => {
    const parsed = parseScoreStructuredResponse(scoreResponse);
    const normalized = normalizeScoreResult(
      parsed,
      {
        taskType: "task2",
        prompt: "Prompt",
        essay: "This essay contains exactly five words.",
        locale: "en",
        targetBand: 7
      },
      "qianwen"
    );

    expect(normalized.estimatedBand).toBe(6.5);
    expect(normalized.bandBreakdown.grammaticalRangeAndAccuracy.score).toBe(6);
    expect(normalized.wordCount).toBe(6);
    expect(normalized.targetBand).toBe(7);
    expect(normalized.providerUsed).toBe("qianwen");
    expect(normalized.priorityFixes[0].title).toBe("Agreement");
  });

  it("adds revision ids and repairs weak reasons", () => {
    const parsed = parseRevisionStructuredResponse(`
===TASK_TYPE===
task2
===ANNOTATED_ESSAY===
Students [del]is[/del][add]are[/add] responsible.
===CORRECTION_NOTES===
1. id: sv1 category: subject_verb_agreement original: is corrected: are reason: grammar mistake
===END===
`);
    const normalized = normalizeRevisionResult(
      parsed,
      {
        taskType: "task2",
        prompt: "Prompt",
        essay: "Students is responsible.",
        locale: "en",
        targetBand: 7
      },
      "deepseek"
    );

    expect(normalized.annotatedEssay).toContain("[del#sv1]is[/del#sv1][add#sv1]are[/add#sv1]");
    expect(normalized.correctionNotes[0].reason.length).toBeGreaterThan(24);
  });

  it("rejects responses without required tagged sections", () => {
    expect(() => parseScoreStructuredResponse("not a structured response")).toThrow(
      "Model response did not include tagged sections"
    );
  });
});
