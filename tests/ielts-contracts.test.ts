import { describe, expect, it } from "vitest";
import {
  getRevisionResponseJsonSchema,
  parseRevisionJsonResponse,
  parseScoreJsonResponse
} from "../lib/ielts/contracts";
import type { CheckInput } from "../lib/ielts/shared";
import type { TeachingRuleReference } from "../lib/types";
import { classifyTask2Prompt } from "../lib/ielts/task-context";

const input: CheckInput = {
  taskType: "task2",
  prompt: "Some people prefer cities. To what extent do you agree or disagree?",
  essay: "Cities create more opportunities. However, cities can also be expensive. Cities remain attractive overall.",
  locale: "en",
  targetBand: 7
};

const rules: TeachingRuleReference[] = [
  { id: "task_response_position", version: 1 },
  { id: "grammar_subject_verb", version: 2 },
  { id: "optimization_clarity", version: 1 }
];
const taskContext = classifyTask2Prompt(input.prompt);

function scoreResponse(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    schemaVersion: "score.v1",
    criteria: {
      taskAchievement: { score: 6, rationale: "The response presents a relevant position." },
      coherenceAndCohesion: { score: 6.5, rationale: "The progression is generally clear." },
      lexicalResource: { score: 7, rationale: "Vocabulary is sufficiently varied." },
      grammaticalRangeAndAccuracy: { score: 7.5, rationale: "Sentences are controlled and accurate." }
    },
    taskChecks: [{ id: "state_position", status: "met", detail: "The position is stated clearly." }],
    strengths: ["Clear position", "Relevant contrast", "Controlled grammar"],
    highlightedSentences: [{
      sentence: "Cities create more opportunities.",
      reason: "This sentence states the central benefit directly.",
      ruleIds: ["task_response_position@v1"]
    }],
    priorityFixes: [
      { title: "Develop support", detail: "Explain why the opportunities matter.", ruleIds: ["task_response_position@v1"] },
      { title: "Add evidence", detail: "Support the cost contrast with an example.", ruleIds: [] },
      { title: "Strengthen conclusion", detail: "Restate the degree of agreement precisely.", ruleIds: ["task_response_position@v1"] }
    ],
    ...overrides
  });
}

describe("IELTS JSON contracts", () => {
  it("uses stage-specific category enums in revision schemas", () => {
    const grammarSchema = getRevisionResponseJsonSchema("grammar");
    const optimizationSchema = getRevisionResponseJsonSchema("optimization");

    expect(grammarSchema.properties.edits.items.properties.category.enum).toContain("subject_verb_agreement");
    expect(grammarSchema.properties.edits.maxItems).toBe(200);
    expect(grammarSchema.properties.edits.items.properties.category.enum).toContain("word_order");
    expect(grammarSchema.properties.edits.items.properties.category.enum).not.toContain("clarity");
    expect(grammarSchema.properties.edits.items.properties.original.description).toContain("smallest exact source span");
    expect(grammarSchema.properties.edits.items.properties.original.description).toContain("never combine multiple errors");
    expect(optimizationSchema.properties.edits.items.properties.category.enum).toContain("clarity");
    expect(optimizationSchema.properties.edits.maxItems).toBe(24);
    expect(optimizationSchema.properties.edits.items.properties.category.enum).not.toContain("subject_verb_agreement");
  });

  it("validates score output and derives deterministic server fields", () => {
    const parsed = parseScoreJsonResponse(scoreResponse(), input, "deepseek", rules, taskContext);

    expect(parsed.estimatedBand).toBe(7);
    expect(parsed.taskType).toBe("task2");
    expect(parsed.wordCount).toBe(14);
    expect(parsed.targetBand).toBe(7);
    expect(parsed.providerUsed).toBe("deepseek");
    expect(parsed.highlightedSentences[0].ruleReferences).toEqual([
      { id: "task_response_position", version: 1 }
    ]);
  });

  it("rejects score responses with non-exact essay quotes", () => {
    const invalid = JSON.parse(scoreResponse());
    invalid.highlightedSentences[0].sentence = "Cities offer opportunities.";

    expect(() => parseScoreJsonResponse(JSON.stringify(invalid), input, "deepseek", rules, taskContext)).toThrow(
      "must be an exact substring"
    );
  });

  it("rejects unavailable rule references and unexpected fields", () => {
    const invalidRule = JSON.parse(scoreResponse());
    invalidRule.priorityFixes[0].ruleIds = ["invented@v1"];
    expect(() => parseScoreJsonResponse(JSON.stringify(invalidRule), input, "deepseek", rules, taskContext)).toThrow(
      "unavailable rule IDs"
    );

    expect(() => parseScoreJsonResponse(scoreResponse({ estimatedBand: 9 }), input, "deepseek", rules, taskContext)).toThrow(
      "unexpected fields"
    );
  });

  it("requires task checks to match every classified question obligation", () => {
    const invalid = JSON.parse(scoreResponse());
    invalid.taskChecks = [{ id: "discuss_view_one", status: "met", detail: "Wrong obligation." }];
    expect(() => parseScoreJsonResponse(JSON.stringify(invalid), input, "deepseek", rules, taskContext)).toThrow(
      "taskChecks IDs do not match"
    );
  });

  it("builds annotated revision markup and IDs from exact edit anchors", () => {
    const response = JSON.stringify({
      schemaVersion: "revision.v1",
      edits: [
        {
          original: "Cities",
          occurrence: 2,
          replacement: "They",
          category: "clarity",
          reason: "The repeated noun makes the progression mechanical. Replacing it with a clear pronoun improves sentence flow without changing the meaning.",
          ruleIds: ["optimization_clarity@v1"]
        },
        {
          original: "more opportunities",
          occurrence: 1,
          replacement: "a wider range of employment opportunities",
          category: "lexical_choice",
          reason: "The original phrase is too general for the claim. The replacement identifies the relevant kind of opportunity and makes the point more precise.",
          ruleIds: ["optimization_clarity@v1"]
        }
      ]
    });

    const parsed = parseRevisionJsonResponse(response, input, "qianwen", rules, "optimization");

    expect(parsed.annotatedEssay).toBe(
      "Cities create [del#1]more opportunities[/del#1][add#1]a wider range of employment opportunities[/add#1]. However, cities can also be expensive. [del#2]Cities[/del#2][add#2]They[/add#2] remain attractive overall."
    );
    expect(parsed.correctionNotes.map((note) => note.id)).toEqual(["1", "2"]);
    expect(parsed.correctionNotes[1].original).toBe("Cities");
  });

  it("accepts an empty revision and rejects overlapping edits", () => {
    const empty = parseRevisionJsonResponse(
      JSON.stringify({ schemaVersion: "revision.v1", edits: [] }),
      input,
      "deepseek",
      rules,
      "grammar"
    );
    expect(empty.annotatedEssay).toBe(input.essay);
    expect(empty.correctionNotes).toEqual([]);

    const overlapping = JSON.stringify({
      schemaVersion: "revision.v1",
      edits: [
        {
          original: "Cities create more opportunities",
          occurrence: 1,
          replacement: "Cities offer more opportunities",
          category: "clarity",
          reason: "The original wording is indirect in context. The replacement states the claim more directly and preserves its meaning.",
          ruleIds: ["optimization_clarity@v1"]
        },
        {
          original: "more opportunities",
          occurrence: 1,
          replacement: "more jobs",
          category: "lexical_choice",
          reason: "The original noun is broad and underspecified. The replacement makes the intended employment meaning explicit.",
          ruleIds: ["optimization_clarity@v1"]
        }
      ]
    });
    expect(() => parseRevisionJsonResponse(overlapping, input, "deepseek", rules, "optimization")).toThrow("overlap");
  });

  it("shrinks a broad grammar correction to the smallest changed word", () => {
    const grammarInput = {
      ...input,
      essay: "Some people thinks unpaid community service should be compulsory in high school."
    };
    const response = JSON.stringify({
      schemaVersion: "revision.v1",
      edits: [{
        original: grammarInput.essay,
        occurrence: 1,
        replacement: "Some people think unpaid community service should be compulsory in high school.",
        category: "subject_verb_agreement",
        reason: "The plural subject requires the base verb form.",
        ruleIds: ["grammar_subject_verb@v2"]
      }]
    });

    const parsed = parseRevisionJsonResponse(response, grammarInput, "deepseek", rules, "grammar");

    expect(parsed.annotatedEssay).toBe(
      "Some people [del#1]thinks[/del#1][add#1]think[/add#1] unpaid community service should be compulsory in high school."
    );
    expect(parsed.correctionNotes[0].original).toBe("thinks");
    expect(parsed.correctionNotes[0].corrected).toBe("think");
  });

  it("splits separate grammar errors that the model combines in one sentence", () => {
    const grammarInput = {
      ...input,
      essay: "Some people thinks community service matters and it help students."
    };
    const response = JSON.stringify({
      schemaVersion: "revision.v1",
      edits: [{
        original: grammarInput.essay,
        occurrence: 1,
        replacement: "Some people think community service matters and it helps students.",
        category: "subject_verb_agreement",
        reason: "Both verbs must agree with their subjects.",
        ruleIds: ["grammar_subject_verb@v2"]
      }]
    });

    const parsed = parseRevisionJsonResponse(response, grammarInput, "deepseek", rules, "grammar");

    expect(parsed.annotatedEssay).toBe(
      "Some people [del#1]thinks[/del#1][add#1]think[/add#1] community service matters and it [del#2]help[/del#2][add#2]helps[/add#2] students."
    );
    expect(parsed.correctionNotes.map((note) => [note.original, note.corrected])).toEqual([
      ["thinks", "think"],
      ["help", "helps"]
    ]);
  });

  it("preserves exact whitespace anchors and accepts deletion edits", () => {
    const deletionInput = {
      ...input,
      essay: "Cities are very expensive."
    };
    const response = JSON.stringify({
      schemaVersion: "revision.v1",
      edits: [
        {
          original: " very",
          occurrence: 1,
          replacement: "",
          category: "concision",
          reason: "The intensifier is unnecessary here and weakens the precision of the statement.",
          ruleIds: ["optimization_clarity@v1"]
        }
      ]
    });

    const parsed = parseRevisionJsonResponse(response, deletionInput, "deepseek", rules, "optimization");

    expect(parsed.annotatedEssay).toBe("Cities are[del#1] very[/del#1][add#1][/add#1] expensive.");
    expect(parsed.correctionNotes[0].original).toBe(" very");
    expect(parsed.correctionNotes[0].corrected).toBe("");
  });

  it("accepts concise non-empty edit reasons regardless of language length", () => {
    const response = JSON.stringify({
      schemaVersion: "revision.v1",
      edits: [
        {
          original: "Cities",
          occurrence: 1,
          replacement: "Urban areas",
          category: "lexical_choice",
          reason: "避免重复。",
          ruleIds: ["optimization_clarity@v1"]
        }
      ]
    });

    const parsed = parseRevisionJsonResponse(response, input, "deepseek", rules, "optimization");
    expect(parsed.correctionNotes[0].reason).toBe("避免重复。");
  });

  it("localizes English-only revision reasons instead of failing the Chinese review", () => {
    const response = JSON.stringify({
      schemaVersion: "revision.v1",
      edits: [
        {
          original: "more opportunities",
          occurrence: 1,
          replacement: "more employment opportunities",
          category: "clarity",
          reason: "The replacement makes the intended employment meaning more precise.",
          ruleIds: ["optimization_clarity@v1"]
        }
      ]
    });

    const parsed = parseRevisionJsonResponse(
      response,
      { ...input, locale: "zh-CN" },
      "qianwen",
      rules,
      "optimization"
    );

    expect(parsed.correctionNotes[0].reason).toContain("表达更清晰");
    expect(parsed.correctionNotes[0].reason).not.toContain("The replacement");
  });

  it("accepts a Chinese reason that quotes a long English revision", () => {
    const response = JSON.stringify({
      schemaVersion: "revision.v1",
      edits: [
        {
          original: "more opportunities",
          occurrence: 1,
          replacement: "a wider range of employment opportunities",
          category: "clarity",
          reason: "将 more opportunities 调整为 a wider range of employment opportunities，能够明确机会的具体范围，使论点表达更加准确。",
          ruleIds: ["optimization_clarity@v1"]
        }
      ]
    });

    const parsed = parseRevisionJsonResponse(
      response,
      { ...input, locale: "zh-CN" },
      "qianwen",
      rules,
      "optimization"
    );

    expect(parsed.correctionNotes[0].reason).toContain("明确机会的具体范围");
  });

  it("accepts word order and safely normalizes unknown same-stage category wording", () => {
    const wordOrderResponse = JSON.stringify({
      schemaVersion: "revision.v1",
      edits: [
        {
          original: "Cities create",
          occurrence: 1,
          replacement: "Cities often create",
          category: "word_order",
          reason: "Places the frequency adverb in its natural position.",
          ruleIds: ["grammar_subject_verb@v2"]
        }
      ]
    });
    const unknownResponse = wordOrderResponse.replace('"word_order"', '"syntax_order"');
    const crossStageResponse = wordOrderResponse.replace('"word_order"', '"clarity"');

    expect(parseRevisionJsonResponse(wordOrderResponse, input, "deepseek", rules, "grammar").correctionNotes[0].category)
      .toBe("word_order");
    expect(parseRevisionJsonResponse(unknownResponse, input, "deepseek", rules, "grammar").correctionNotes[0].category)
      .toBe("other");
    expect(() => parseRevisionJsonResponse(crossStageResponse, input, "deepseek", rules, "grammar"))
      .toThrow("not allowed for the grammar stage");
  });

  it("drops no-op edits without rejecting the remaining revision response", () => {
    const response = JSON.stringify({
      schemaVersion: "revision.v1",
      edits: [
        {
          original: "Cities",
          occurrence: 1,
          replacement: "Cities",
          category: "other",
          reason: "No actual change is required.",
          ruleIds: ["grammar_subject_verb@v2"]
        }
      ]
    });

    const parsed = parseRevisionJsonResponse(response, input, "deepseek", rules, "grammar");
    expect(parsed.annotatedEssay).toBe(input.essay);
    expect(parsed.correctionNotes).toEqual([]);
  });

  it("resolves safe anchor differences in whitespace and Unicode punctuation", () => {
    const anchorInput = { ...input, essay: "Cities use “smart transport” — especially trains." };
    const response = JSON.stringify({
      schemaVersion: "revision.v1",
      edits: [
        {
          original: "“smart   transport” - especially",
          occurrence: 1,
          replacement: "efficient public transport, especially",
          category: "clarity",
          reason: "The replacement is more precise and reads smoothly.",
          ruleIds: ["optimization_clarity@v1"]
        }
      ]
    });

    const parsed = parseRevisionJsonResponse(response, anchorInput, "deepseek", rules, "optimization");
    expect(parsed.correctionNotes[0].original).toBe("“smart transport” — especially");
    expect(parsed.annotatedEssay).toContain("[del#1]“smart transport” — especially[/del#1]");
  });
});
