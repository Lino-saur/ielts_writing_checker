import { describe, expect, it } from "vitest";
import {
  buildGuidedSuggestionPrompt,
  composeGuidedEssay,
  createEmptyGuidedWritingDraft,
  getGuidedWritingCompletion,
  parseGuidedSuggestionResponse
} from "../lib/ielts/guided-writing";

describe("guided writing", () => {
  it("assembles completed planning fields into IELTS paragraphs", () => {
    const draft = {
      ...createEmptyGuidedWritingDraft(),
      stance: "agree" as const,
      introductionContext: "Unpaid community service is often proposed as part of secondary education.",
      introductionThesis: "I agree because it develops responsibility and practical skills.",
      bodyOneTopic: "The first benefit is that students become more responsible.",
      bodyOneExplanation: "They learn that their actions can affect other people.",
      bodyOneExample: "For example, helping in a care home requires patience and reliability.",
      bodyTwoTopic: "Community work also develops practical skills.",
      bodyTwoExplanation: "Students must communicate and solve problems with others.",
      conclusionRestatement: "For these reasons, community service should be included in high school programmes."
    };

    expect(composeGuidedEssay(draft)).toBe(
      "Unpaid community service is often proposed as part of secondary education. I agree because it develops responsibility and practical skills.\n\n" +
      "The first benefit is that students become more responsible. They learn that their actions can affect other people. For example, helping in a care home requires patience and reliability.\n\n" +
      "Community work also develops practical skills. Students must communicate and solve problems with others.\n\n" +
      "For these reasons, community service should be included in high school programmes."
    );
  });

  it("counts completed guide sections without requiring optional examples", () => {
    const draft = {
      ...createEmptyGuidedWritingDraft(),
      stance: "partial" as const,
      introductionContext: "Context.",
      introductionThesis: "Thesis.",
      bodyOneTopic: "Point one.",
      bodyOneExplanation: "Explanation one.",
      bodyTwoTopic: "Point two.",
      bodyTwoExplanation: "Explanation two.",
      conclusionRestatement: "Conclusion."
    };

    expect(getGuidedWritingCompletion(draft)).toEqual({ completed: 5, total: 5 });
  });

  it("builds a field-scoped AI prompt and accepts one short suggestion", () => {
    const draft = {
      ...createEmptyGuidedWritingDraft(),
      stance: "agree" as const,
      bodyOneTopic: "responsibility"
    };
    const prompt = buildGuidedSuggestionPrompt({
      taskPrompt: "Should community service be compulsory?",
      field: "bodyOneTopic",
      draft,
      locale: "en"
    });

    expect(prompt).toContain("bodyOneTopic");
    expect(prompt).toContain("responsibility");
    expect(parseGuidedSuggestionResponse('{"suggestion":"One important benefit is that community service teaches students responsibility."}'))
      .toBe("One important benefit is that community service teaches students responsibility.");
  });

  it("rejects paragraph-length AI suggestions", () => {
    const longSuggestion = Array.from({ length: 36 }, () => "word").join(" ");
    expect(() => parseGuidedSuggestionResponse(JSON.stringify({ suggestion: longSuggestion })))
      .toThrow("at most 35 words");
  });
});
