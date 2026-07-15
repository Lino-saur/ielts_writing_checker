import { describe, expect, it } from "vitest";
import { classifyTask2Prompt, parseVisualFactsJsonResponse } from "../lib/ielts/task-context";
import regressionData from "../data/ielts-regression-cases.json";

describe("IELTS task context", () => {
  it.each([
    {
      prompt: "Some people think university should be free. To what extent do you agree or disagree?",
      type: "opinion",
      ids: ["state_position"]
    },
    {
      prompt: "Some people prefer working at home, while others prefer an office. Discuss both views and give your own opinion.",
      type: "discussion",
      ids: ["discuss_view_one", "discuss_view_two", "give_own_opinion"]
    },
    {
      prompt: "What are the advantages and disadvantages of international tourism?",
      type: "advantages_disadvantages",
      ids: ["explain_advantages", "explain_disadvantages"]
    },
    {
      prompt: "What problems does traffic congestion cause, and what measures can governments take?",
      type: "problem_solution",
      ids: ["identify_problems_or_effects", "propose_solutions"]
    },
    {
      prompt: "Why are fewer people reading newspapers? Is this a positive or negative development?",
      type: "mixed",
      ids: ["state_position", "explain_causes"]
    }
  ])("classifies $type prompts into explicit obligations", ({ prompt, type, ids }) => {
    const result = classifyTask2Prompt(prompt);
    expect(result.questionType).toBe(type);
    expect(result.obligations.map((item) => item.id)).toEqual(ids);
  });

  it("strictly validates extracted visual facts", () => {
    const result = parseVisualFactsJsonResponse(JSON.stringify({
      schemaVersion: "visual-facts.v1",
      imageRelevant: true,
      visualType: "line_graph",
      title: "Average commuting time",
      units: ["minutes"],
      timePeriods: ["2000", "2020"],
      categories: ["City A", "City B"],
      keyFeatures: ["Both cities increased", "City A remained higher"],
      facts: [{ statement: "City A rose from 30 to 45 minutes.", confidence: "high" }],
      unreadableAreas: []
    }));

    expect(result.visualType).toBe("line_graph");
    expect(result.facts[0].confidence).toBe("high");
  });

  it("rejects invented visual response fields", () => {
    expect(() => parseVisualFactsJsonResponse(JSON.stringify({
      schemaVersion: "visual-facts.v1",
      imageRelevant: true,
      visualType: "unknown",
      title: "",
      units: [],
      timePeriods: [],
      categories: [],
      keyFeatures: [],
      facts: [],
      unreadableAreas: [],
      inventedSummary: "unsupported"
    }))).toThrow("unexpected fields");
  });

  it("keeps the versioned regression dataset aligned with the classifier", () => {
    const task2Cases = regressionData.cases.filter((item) => item.taskType === "task2");
    task2Cases.forEach((item) => {
      const result = classifyTask2Prompt(item.prompt);
      expect(result.questionType, item.id).toBe(item.expectedQuestionType);
      expect(result.obligations.map((obligation) => obligation.id), item.id).toEqual(item.expectedObligationIds);
    });
  });
});
