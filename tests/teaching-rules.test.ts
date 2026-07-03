import { describe, expect, it } from "vitest";
import {
  normalizeTeachingRuleFilters,
  validateTeachingRuleInput
} from "../lib/admin/teaching-rules";

describe("teaching rule management", () => {
  it("validates and normalizes an atomic teaching rule", () => {
    expect(
      validateTeachingRuleInput({
        name: " Clear position in the introduction ",
        taskType: "task2",
        origin: "ielts_official",
        questionTypes: ["观点类", "观点类"],
        tags: [" introduction ", "thesis"],
        category: "structure",
        principle: " The introduction must state a clear and consistent position. ",
        severity: "high",
        priority: 80,
        sourceTitle: "Writing Course",
        sourceSection: "Lesson 3",
        knowledgePointCode: "3.2",
        sourcePage: "12"
      })
    ).toMatchObject({
      name: "Clear position in the introduction",
      taskType: "task2",
      origin: "ielts_official",
      questionTypes: ["观点类"],
      tags: ["introduction", "thesis"],
      category: "structure",
      severity: "high",
      priority: 80,
      sourceSection: "Lesson 3",
      knowledgePointCode: "3.2"
    });
  });

  it("rejects invalid priority and normalizes list filters", () => {
    expect(() =>
      validateTeachingRuleInput({
        name: "Invalid rule",
        taskType: "task2",
        category: "structure",
        principle: "This principle is long enough.",
        severity: "medium",
        priority: 101
      })
    ).toThrow("INVALID_PRIORITY");

    expect(
      normalizeTeachingRuleFilters({
        q: " thesis ",
        taskType: "task2",
        origin: "ielts_official",
        category: "structure",
        status: "published",
        page: "2"
      })
    ).toMatchObject({
      q: "thesis",
      taskType: "task2",
      origin: "ielts_official",
      category: "structure",
      status: "published",
      page: 2,
      pageSize: 30
    });
  });
});
