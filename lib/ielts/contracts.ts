import type { CorrectionNote, TaskCheck, TeachingRuleReference, WritingRevisionResult, WritingScoreResult } from "@/lib/types";
import { parseTeachingRuleReferences } from "@/lib/teaching-rules";
import {
  GRAMMAR_REVISION_CATEGORIES,
  OPTIMIZATION_REVISION_CATEGORIES
} from "./revision-categories";
import { countWords, getLocale, getTargetBand, type CheckInput, type ProviderConfig } from "./shared";
import type { EvaluationTaskContext } from "./task-context";

export const SCORE_SCHEMA_VERSION = "score.v1" as const;
export const REVISION_SCHEMA_VERSION = "revision.v1" as const;

const ruleIdsSchema = {
  type: "array",
  minItems: 0,
  maxItems: 3,
  items: { type: "string" }
} as const;

const criterionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["score", "rationale"],
  properties: {
    score: { type: "number", minimum: 0, maximum: 9 },
    rationale: { type: "string" }
  }
} as const;

export const SCORE_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "criteria", "taskChecks", "strengths", "highlightedSentences", "priorityFixes"],
  properties: {
    schemaVersion: { type: "string", enum: [SCORE_SCHEMA_VERSION] },
    criteria: {
      type: "object",
      additionalProperties: false,
      required: ["taskAchievement", "coherenceAndCohesion", "lexicalResource", "grammaticalRangeAndAccuracy"],
      properties: {
        taskAchievement: criterionSchema,
        coherenceAndCohesion: criterionSchema,
        lexicalResource: criterionSchema,
        grammaticalRangeAndAccuracy: criterionSchema
      }
    },
    taskChecks: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "status", "detail"],
        properties: {
          id: { type: "string" },
          status: { type: "string", enum: ["met", "partial", "missing", "not_applicable"] },
          detail: { type: "string" }
        }
      }
    },
    strengths: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "string" }
    },
    highlightedSentences: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sentence", "reason", "ruleIds"],
        properties: {
          sentence: { type: "string" },
          reason: { type: "string" },
          ruleIds: ruleIdsSchema
        }
      }
    },
    priorityFixes: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "ruleIds"],
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          ruleIds: ruleIdsSchema
        }
      }
    }
  }
} as const;

export function getRevisionResponseJsonSchema(stage: "grammar" | "optimization") {
  const categories = stage === "grammar" ? GRAMMAR_REVISION_CATEGORIES : OPTIMIZATION_REVISION_CATEGORIES;

  return {
    type: "object",
    additionalProperties: false,
    required: ["schemaVersion", "edits"],
    properties: {
      schemaVersion: { type: "string", enum: [REVISION_SCHEMA_VERSION] },
      edits: {
        type: "array",
        maxItems: 24,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["original", "occurrence", "replacement", "category", "reason", "ruleIds"],
          properties: {
            original: { type: "string" },
            occurrence: { type: "integer", minimum: 1 },
            replacement: { type: "string" },
            category: { type: "string", enum: [...categories] },
            reason: { type: "string" },
            ruleIds: ruleIdsSchema
          }
        }
      }
    }
  } as const;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, path: string): JsonRecord {
  if (!isRecord(value)) throw new Error(`${path} must be an object.`);
  return value;
}

function requireExactKeys(record: JsonRecord, keys: string[], path: string) {
  const expected = new Set(keys);
  const missing = keys.filter((key) => !(key in record));
  const unexpected = Object.keys(record).filter((key) => !expected.has(key));
  if (missing.length) throw new Error(`${path} is missing: ${missing.join(", ")}.`);
  if (unexpected.length) throw new Error(`${path} has unexpected fields: ${unexpected.join(", ")}.`);
}

function requireString(value: unknown, path: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${path} must be a non-empty string.`);
  return value.trim();
}

function requireSourceText(value: unknown, path: string, allowEmpty = false) {
  if (typeof value !== "string" || (!allowEmpty && value.length === 0)) {
    throw new Error(`${path} must be ${allowEmpty ? "a string" : "a non-empty string"}.`);
  }
  return value;
}

function requireStringArray(value: unknown, path: string, minimum: number, maximum: number) {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    throw new Error(`${path} must contain ${minimum === maximum ? `exactly ${minimum}` : `${minimum} to ${maximum}`} items.`);
  }
  return value.map((item, index) => requireString(item, `${path}[${index}]`));
}

function parseJsonObject(text: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.trim());
  } catch (error) {
    throw new Error(`Response is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  return requireRecord(parsed, "response");
}

function allowedRuleKeys(rules: TeachingRuleReference[]) {
  return new Set(rules.map((rule) => `${rule.id}@v${rule.version ?? 1}`));
}

function validateRuleIds(value: unknown, path: string, allowedRules: TeachingRuleReference[], minimum = 0) {
  if (!Array.isArray(value) || value.length < minimum || value.length > 3) {
    throw new Error(`${path} must contain ${minimum} to 3 rule IDs.`);
  }
  const ids = value.map((item, index) => requireString(item, `${path}[${index}]`));
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) throw new Error(`${path} contains duplicate rule IDs.`);
  const allowed = allowedRuleKeys(allowedRules);
  const invalid = ids.filter((id) => !allowed.has(id));
  if (invalid.length) throw new Error(`${path} contains unavailable rule IDs: ${invalid.join(", ")}.`);
  return parseTeachingRuleReferences(ids.join(", "));
}

function validateBand(value: unknown, path: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 9 || value * 2 !== Math.round(value * 2)) {
    throw new Error(`${path} must be from 0 to 9 in 0.5 increments.`);
  }
  return value;
}

function calculateOverallBand(scores: number[]) {
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return Math.max(0, Math.min(9, Math.round(average * 2) / 2));
}

function requireDetailedReason(value: unknown, path: string) {
  return requireString(value, path);
}

function requireLocalizedRevisionReason(value: unknown, path: string, input: CheckInput) {
  const reason = requireDetailedReason(value, path);
  if (getLocale(input.locale) !== "zh-CN") {
    return reason;
  }

  const chineseCharacterCount = reason.match(/[\u3400-\u4dbf\u4e00-\u9fff]/g)?.length ?? 0;
  if (chineseCharacterCount < 4) {
    throw new Error(`${path} must contain a substantive Simplified Chinese explanation for locale zh-CN; English-only reasons are not allowed.`);
  }

  return reason;
}

export function parseScoreJsonResponse(
  text: string,
  input: CheckInput,
  providerName: ProviderConfig["name"],
  allowedRules: TeachingRuleReference[],
  taskContext?: EvaluationTaskContext
): WritingScoreResult {
  const root = parseJsonObject(text);
  requireExactKeys(root, ["schemaVersion", "criteria", "taskChecks", "strengths", "highlightedSentences", "priorityFixes"], "response");
  if (root.schemaVersion !== SCORE_SCHEMA_VERSION) throw new Error(`schemaVersion must be ${SCORE_SCHEMA_VERSION}.`);

  const criteria = requireRecord(root.criteria, "criteria");
  const criterionNames = [
    "taskAchievement",
    "coherenceAndCohesion",
    "lexicalResource",
    "grammaticalRangeAndAccuracy"
  ] as const;
  requireExactKeys(criteria, [...criterionNames], "criteria");

  const bandBreakdown = Object.fromEntries(criterionNames.map((name) => {
    const criterion = requireRecord(criteria[name], `criteria.${name}`);
    requireExactKeys(criterion, ["score", "rationale"], `criteria.${name}`);
    return [name, {
      score: validateBand(criterion.score, `criteria.${name}.score`),
      rationale: requireString(criterion.rationale, `criteria.${name}.rationale`)
    }];
  })) as WritingScoreResult["bandBreakdown"];

  if (!Array.isArray(root.taskChecks) || root.taskChecks.length < 1) {
    throw new Error("taskChecks must contain at least one item.");
  }
  const taskChecks = root.taskChecks.map((value, index) => {
    const item = requireRecord(value, `taskChecks[${index}]`);
    requireExactKeys(item, ["id", "status", "detail"], `taskChecks[${index}]`);
    const status = requireString(item.status, `taskChecks[${index}].status`);
    if (!["met", "partial", "missing", "not_applicable"].includes(status)) {
      throw new Error(`taskChecks[${index}].status is invalid.`);
    }
    return {
      id: requireString(item.id, `taskChecks[${index}].id`),
      status: status as TaskCheck["status"],
      detail: requireString(item.detail, `taskChecks[${index}].detail`)
    };
  });
  const expectedCheckIds = taskContext?.kind === "task2"
    ? taskContext.obligations.map((item) => item.id)
    : taskContext?.kind === "task1"
      ? ["image_relevance", "overview", "key_features", "data_accuracy"]
      : [];
  const actualCheckIds = taskChecks.map((item) => item.id);
  if (new Set(actualCheckIds).size !== actualCheckIds.length) throw new Error("taskChecks contains duplicate IDs.");
  const missingCheckIds = expectedCheckIds.filter((id) => !actualCheckIds.includes(id));
  const unexpectedCheckIds = expectedCheckIds.length
    ? actualCheckIds.filter((id) => !expectedCheckIds.includes(id))
    : [];
  if (missingCheckIds.length || unexpectedCheckIds.length) {
    throw new Error(`taskChecks IDs do not match the required checks. Missing: ${missingCheckIds.join(", ") || "none"}; unexpected: ${unexpectedCheckIds.join(", ") || "none"}.`);
  }

  const strengths = requireStringArray(root.strengths, "strengths", 3, 3);
  if (!Array.isArray(root.highlightedSentences) || root.highlightedSentences.length < 1 || root.highlightedSentences.length > 3) {
    throw new Error("highlightedSentences must contain 1 to 3 items.");
  }
  const highlightedSentences = root.highlightedSentences.map((value, index) => {
    const item = requireRecord(value, `highlightedSentences[${index}]`);
    requireExactKeys(item, ["sentence", "reason", "ruleIds"], `highlightedSentences[${index}]`);
    const sentence = requireString(item.sentence, `highlightedSentences[${index}].sentence`);
    if (!input.essay.includes(sentence)) {
      throw new Error(`highlightedSentences[${index}].sentence must be an exact substring of the essay.`);
    }
    return {
      sentence,
      reason: requireString(item.reason, `highlightedSentences[${index}].reason`),
      ruleReferences: validateRuleIds(item.ruleIds, `highlightedSentences[${index}].ruleIds`, allowedRules)
    };
  });

  if (!Array.isArray(root.priorityFixes) || root.priorityFixes.length !== 3) {
    throw new Error("priorityFixes must contain exactly 3 items.");
  }
  const priorityFixes = root.priorityFixes.map((value, index) => {
    const item = requireRecord(value, `priorityFixes[${index}]`);
    requireExactKeys(item, ["title", "detail", "ruleIds"], `priorityFixes[${index}]`);
    return {
      title: requireString(item.title, `priorityFixes[${index}].title`),
      detail: requireString(item.detail, `priorityFixes[${index}].detail`),
      ruleReferences: validateRuleIds(item.ruleIds, `priorityFixes[${index}].ruleIds`, allowedRules)
    };
  });

  const scores = criterionNames.map((name) => bandBreakdown[name].score);
  return {
    taskType: input.taskType,
    wordCount: countWords(input.essay),
    estimatedBand: calculateOverallBand(scores),
    targetBand: getTargetBand(input.targetBand),
    bandBreakdown,
    taskChecks,
    strengths,
    highlightedSentences,
    priorityFixes,
    feedbackMode: "ai",
    providerUsed: providerName
  };
}

function findOccurrence(text: string, needle: string, occurrence: number) {
  let fromIndex = 0;
  let foundIndex = -1;
  for (let index = 0; index < occurrence; index += 1) {
    foundIndex = text.indexOf(needle, fromIndex);
    if (foundIndex < 0) return -1;
    fromIndex = foundIndex + needle.length;
  }
  return foundIndex;
}

function canonicalizeAnchor(text: string) {
  const punctuation: Record<string, string> = {
    "‘": "'",
    "’": "'",
    "“": "\"",
    "”": "\"",
    "–": "-",
    "—": "-",
    "−": "-"
  };
  let canonical = "";
  const starts: number[] = [];
  const ends: number[] = [];

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (/\s/u.test(character)) {
      if (canonical.endsWith(" ")) {
        ends[ends.length - 1] = index + 1;
      } else {
        canonical += " ";
        starts.push(index);
        ends.push(index + 1);
      }
      continue;
    }
    canonical += punctuation[character] ?? character;
    starts.push(index);
    ends.push(index + 1);
  }

  return { canonical, starts, ends };
}

function findEditAnchor(text: string, needle: string, occurrence: number) {
  const exactStart = findOccurrence(text, needle, occurrence);
  if (exactStart >= 0) return { start: exactStart, end: exactStart + needle.length, original: needle };

  const source = canonicalizeAnchor(text);
  const canonicalNeedle = canonicalizeAnchor(needle).canonical.trim();
  if (!canonicalNeedle) return null;
  const canonicalStart = findOccurrence(source.canonical, canonicalNeedle, occurrence);
  if (canonicalStart < 0) return null;
  const canonicalEnd = canonicalStart + canonicalNeedle.length;
  const start = source.starts[canonicalStart];
  const end = source.ends[canonicalEnd - 1];
  if (start === undefined || end === undefined) return null;
  return { start, end, original: text.slice(start, end) };
}

export function parseRevisionJsonResponse(
  text: string,
  input: CheckInput,
  providerName: ProviderConfig["name"],
  allowedRules: TeachingRuleReference[],
  stage: "grammar" | "optimization"
): WritingRevisionResult {
  const root = parseJsonObject(text);
  requireExactKeys(root, ["schemaVersion", "edits"], "response");
  if (root.schemaVersion !== REVISION_SCHEMA_VERSION) throw new Error(`schemaVersion must be ${REVISION_SCHEMA_VERSION}.`);
  if (!Array.isArray(root.edits)) throw new Error("edits must be an array.");
  if (root.edits.length > 24) throw new Error("edits must contain at most 24 items.");

  const allowedCategories = new Set<string>(stage === "grammar" ? GRAMMAR_REVISION_CATEGORIES : OPTIMIZATION_REVISION_CATEGORIES);
  const oppositeCategories = new Set<string>(stage === "grammar" ? OPTIMIZATION_REVISION_CATEGORIES : GRAMMAR_REVISION_CATEGORIES);
  const positionedEdits = root.edits.flatMap((value, index) => {
    const item = requireRecord(value, `edits[${index}]`);
    requireExactKeys(item, ["original", "occurrence", "replacement", "category", "reason", "ruleIds"], `edits[${index}]`);
    const suppliedOriginal = requireSourceText(item.original, `edits[${index}].original`);
    const replacement = requireSourceText(item.replacement, `edits[${index}].replacement`, true);
    if (suppliedOriginal === replacement) return [];
    if (!Number.isInteger(item.occurrence) || (item.occurrence as number) < 1) {
      throw new Error(`edits[${index}].occurrence must be a positive integer.`);
    }
    const occurrence = item.occurrence as number;
    const anchor = findEditAnchor(input.essay, suppliedOriginal, occurrence);
    if (!anchor) throw new Error(`edits[${index}].original occurrence ${occurrence} was not found in the current essay.`);
    const { start, end, original } = anchor;
    const suppliedCategory = requireString(item.category, `edits[${index}].category`);
    if (oppositeCategories.has(suppliedCategory) && !allowedCategories.has(suppliedCategory)) {
      throw new Error(`edits[${index}].category is not allowed for the ${stage} stage: ${suppliedCategory}.`);
    }
    const category = allowedCategories.has(suppliedCategory) ? suppliedCategory : "other";
    return [{
      start,
      end,
      original,
      replacement,
      category,
      reason: requireLocalizedRevisionReason(item.reason, `edits[${index}].reason`, input),
      ruleReferences: validateRuleIds(item.ruleIds, `edits[${index}].ruleIds`, allowedRules, 1)
    }];
  }).sort((left, right) => left.start - right.start || left.end - right.end);

  for (let index = 1; index < positionedEdits.length; index += 1) {
    if (positionedEdits[index].start < positionedEdits[index - 1].end) {
      throw new Error(`edits[${index - 1}] and edits[${index}] overlap.`);
    }
  }

  let cursor = 0;
  const essayParts: string[] = [];
  const correctionNotes: CorrectionNote[] = [];
  positionedEdits.forEach((edit, index) => {
    const id = String(index + 1);
    essayParts.push(
      input.essay.slice(cursor, edit.start),
      `[del#${id}]${edit.original}[/del#${id}][add#${id}]${edit.replacement}[/add#${id}]`
    );
    cursor = edit.end;
    correctionNotes.push({
      id,
      category: edit.category,
      original: edit.original,
      corrected: edit.replacement,
      reason: edit.reason,
      ruleReferences: edit.ruleReferences
    });
  });
  essayParts.push(input.essay.slice(cursor));

  return {
    taskType: input.taskType,
    wordCount: countWords(input.essay),
    targetBand: getTargetBand(input.targetBand),
    annotatedEssay: essayParts.join(""),
    correctionNotes,
    feedbackMode: "ai",
    providerUsed: providerName
  };
}
