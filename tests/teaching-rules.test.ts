import { describe, expect, it } from "vitest";
import {
  normalizeTeachingRuleFilters,
  validateTeachingRuleInput
} from "../lib/admin/teaching-rules";
import {
  detectTeachingRuleProfile,
  enforceRevisionRuleReferences,
  hydrateTeachingRuleReferences,
  parseTeachingRuleReferences,
  selectApplicableTeachingRules,
  type PublishedRuleRow
} from "../lib/teaching-rules";

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

  it("detects Task 1 visuals and Task 2 question types", () => {
    expect(
      detectTeachingRuleProfile("task1", "The two pie charts below show household spending.")
    ).toEqual({ questionTypes: [], tags: ["pie-chart"] });
    expect(
      detectTeachingRuleProfile(
        "task2",
        "Discuss both views and give your own opinion."
      ).questionTypes
    ).toEqual(["讨论类"]);
    expect(
      detectTeachingRuleProfile(
        "task2",
        "Why is this happening and do the advantages outweigh the disadvantages?"
      ).questionTypes
    ).toEqual(["混合类"]);
    expect(
      detectTeachingRuleProfile(
        "task2",
        "What are the causes and what measures could be taken?"
      ).questionTypes
    ).toEqual(["问题解决类"]);
  });

  it("selects matching course rules without mixing specific question types", () => {
    const makeRule = (
      id: string,
      questionTypes: string[],
      tags: string[]
    ): PublishedRuleRow => ({
      id,
      version: 1,
      task_type: "task2",
      rule_origin: "courseware",
      question_types_json: questionTypes,
      tags_json: tags,
      rule_category: "argumentation",
      principle: "A sufficiently detailed principle for this test.",
      severity: "high",
      priority: 80,
      source_title: "Course",
      source_section: "Lesson",
      knowledge_point_code: id
    });
    const selected = selectApplicableTeachingRules(
      [
        makeRule("opinion", ["观点类"], ["opinion-essay"]),
        makeRule("discussion", ["讨论类"], ["discussion-essay"]),
        makeRule("general", [], ["task-response"])
      ],
      { questionTypes: ["观点类"], tags: ["opinion-essay"] },
      "score"
    );

    expect(selected.map((rule) => rule.id)).toEqual(["opinion", "general"]);
    expect(
      parseTeachingRuleReferences("[opinion@v2]; general@v1 / [opinion@v2]")
    ).toEqual([
      { id: "opinion", version: 2 },
      { id: "general", version: 1 }
    ]);
  });

  it("keeps only revisions supported by the selected rule snapshot", () => {
    const allowedRule = {
      id: "course_l07_grammar_accuracy",
      version: 1,
      sourceTitle: "强化写作 Lesson 7 - 大作文评分标准",
      knowledgePointCode: "L07-09"
    };
    const result = enforceRevisionRuleReferences(
      {
        taskType: "task2",
        wordCount: 5,
        targetBand: 6.5,
        annotatedEssay:
          "Students [del#1]is[/del#1][add#1]are[/add#1] ready and [del#2]nice[/del#2][add#2]excellent[/add#2].",
        correctionNotes: [
          {
            id: "1",
            original: "is",
            corrected: "are",
            reason: "The plural subject requires a plural verb.",
            ruleReferences: [{ id: allowedRule.id, version: 1 }]
          },
          {
            id: "2",
            original: "nice",
            corrected: "excellent",
            reason: "This wording sounds stronger.",
            ruleReferences: []
          }
        ],
        feedbackMode: "ai",
        providerUsed: "deepseek"
      },
      [allowedRule]
    );

    expect(result.annotatedEssay).toContain("[del#1]is[/del#1][add#1]are[/add#1]");
    expect(result.annotatedEssay).toContain("nice.");
    expect(result.annotatedEssay).not.toContain("[del#2]");
    expect(result.correctionNotes).toHaveLength(1);
    expect(result.correctionNotes[0].ruleReferences?.[0]).toEqual(allowedRule);
  });

  it("hydrates scoring citations only from the selected rule snapshot", () => {
    const result = hydrateTeachingRuleReferences(
      {
        taskType: "task2",
        wordCount: 10,
        estimatedBand: 6.5,
        targetBand: 6.5,
        bandBreakdown: {
          taskAchievement: { score: 6.5, rationale: "Relevant." },
          coherenceAndCohesion: { score: 6.5, rationale: "Clear." },
          lexicalResource: { score: 6.5, rationale: "Adequate." },
          grammaticalRangeAndAccuracy: { score: 6.5, rationale: "Mostly accurate." }
        },
        strengths: [],
        highlightedSentences: [],
        priorityFixes: [
          {
            title: "Position",
            detail: "State the position directly.",
            ruleReferences: [
              { id: "allowed", version: 2 },
              { id: "not_selected", version: 1 }
            ]
          }
        ],
        feedbackMode: "ai",
        providerUsed: "deepseek"
      },
      [{ id: "allowed", version: 2, knowledgePointCode: "TR-2" }]
    );

    expect(result.priorityFixes[0].ruleReferences).toEqual([
      { id: "allowed", version: 2, knowledgePointCode: "TR-2" }
    ]);
  });
});
