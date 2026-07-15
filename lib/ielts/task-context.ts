import type { TaskType } from "@/lib/types";

export const VISUAL_FACTS_SCHEMA_VERSION = "visual-facts.v1" as const;

export type Task2QuestionType =
  | "opinion"
  | "discussion"
  | "advantages_disadvantages"
  | "problem_solution"
  | "two_part"
  | "mixed"
  | "unknown";

export type Task2ObligationId =
  | "state_position"
  | "discuss_view_one"
  | "discuss_view_two"
  | "give_own_opinion"
  | "explain_advantages"
  | "explain_disadvantages"
  | "make_outweigh_judgment"
  | "explain_causes"
  | "identify_problems_or_effects"
  | "propose_solutions"
  | "answer_explicit_question_one"
  | "answer_explicit_question_two"
  | "address_prompt_directly";

export type Task2Obligation = {
  id: Task2ObligationId;
  instruction: string;
};

export type Task2Analysis = {
  kind: "task2";
  questionType: Task2QuestionType;
  obligations: Task2Obligation[];
};

export type VisualFact = {
  statement: string;
  confidence: "high" | "medium" | "low";
};

export type VisualFacts = {
  schemaVersion: typeof VISUAL_FACTS_SCHEMA_VERSION;
  imageRelevant: boolean;
  visualType: "line_graph" | "bar_chart" | "pie_chart" | "table" | "map" | "process" | "mixed" | "unknown";
  title: string;
  units: string[];
  timePeriods: string[];
  categories: string[];
  keyFeatures: string[];
  facts: VisualFact[];
  unreadableAreas: string[];
};

export type Task1Analysis = {
  kind: "task1";
  visualFacts: VisualFacts;
};

export type EvaluationTaskContext = Task1Analysis | Task2Analysis;

export const VISUAL_FACTS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "imageRelevant",
    "visualType",
    "title",
    "units",
    "timePeriods",
    "categories",
    "keyFeatures",
    "facts",
    "unreadableAreas"
  ],
  properties: {
    schemaVersion: { type: "string", enum: [VISUAL_FACTS_SCHEMA_VERSION] },
    imageRelevant: { type: "boolean" },
    visualType: {
      type: "string",
      enum: ["line_graph", "bar_chart", "pie_chart", "table", "map", "process", "mixed", "unknown"]
    },
    title: { type: "string" },
    units: { type: "array", items: { type: "string" } },
    timePeriods: { type: "array", items: { type: "string" } },
    categories: { type: "array", items: { type: "string" } },
    keyFeatures: { type: "array", items: { type: "string" } },
    facts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["statement", "confidence"],
        properties: {
          statement: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] }
        }
      }
    },
    unreadableAreas: { type: "array", items: { type: "string" } }
  }
} as const;

const OBLIGATION_COPY: Record<Task2ObligationId, string> = {
  state_position: "State a clear position and maintain it throughout the response.",
  discuss_view_one: "Explain the first presented view fairly and with relevant support.",
  discuss_view_two: "Explain the second presented view fairly and with relevant support.",
  give_own_opinion: "Give the writer's own opinion explicitly and support it.",
  explain_advantages: "Explain the relevant advantages rather than merely listing them.",
  explain_disadvantages: "Explain the relevant disadvantages rather than merely listing them.",
  make_outweigh_judgment: "Make and justify a clear judgment about which side outweighs the other.",
  explain_causes: "Explain the causes or reasons requested by the question.",
  identify_problems_or_effects: "Identify and develop the requested problems, consequences, or effects.",
  propose_solutions: "Propose relevant solutions or measures and explain how they address the problem.",
  answer_explicit_question_one: "Answer the first explicit question in the prompt.",
  answer_explicit_question_two: "Answer the second explicit question in the prompt.",
  address_prompt_directly: "Address the prompt directly with a relevant, developed response."
};

function obligation(id: Task2ObligationId): Task2Obligation {
  return { id, instruction: OBLIGATION_COPY[id] };
}

export function classifyTask2Prompt(prompt: string): Task2Analysis {
  const normalized = prompt.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
  const ids: Task2ObligationId[] = [];
  const add = (...values: Task2ObligationId[]) => {
    values.forEach((value) => {
      if (!ids.includes(value)) ids.push(value);
    });
  };

  const discussesBoth = /\bdiscuss both (?:views|sides)\b/.test(normalized);
  const asksOwnOpinion = /\b(?:give|include|state) your (?:own )?(?:opinion|view)\b|\bwhat is your (?:opinion|view)\b/.test(normalized);
  const asksAgreement = /\b(?:do you agree or disagree|to what extent do you agree|do you agree)\b/.test(normalized);
  const asksEvaluation = /\b(?:positive or negative development|is this (?:a )?positive or negative|beneficial or harmful)\b/.test(normalized);
  const asksAdvantages = /\badvantages?|benefits?\b/.test(normalized);
  const asksDisadvantages = /\bdisadvantages?|drawbacks?\b/.test(normalized);
  const asksOutweigh = /\boutweigh\b/.test(normalized);
  const asksCauses = /\b(?:what causes?|causes? (?:of|for)|reasons?|why (?:is|are|has|have|do|does|did))\b/.test(normalized);
  const asksProblemsOrEffects = /\b(?:problems?|negative effects?|consequences?|what effects?|effects? (?:does|do|on|to))\b/.test(normalized);
  const asksSolutions = /\b(?:solutions?|measures?|what can be done|how (?:can|could|should) (?:this|it|the problem|these))\b/.test(normalized);
  const explicitQuestionCount = (prompt.match(/\?/g) ?? []).length;

  if (discussesBoth) add("discuss_view_one", "discuss_view_two");
  if (asksOwnOpinion) add("give_own_opinion");
  if (asksAgreement || asksEvaluation) add("state_position");
  if (asksAdvantages) add("explain_advantages");
  if (asksDisadvantages) add("explain_disadvantages");
  if (asksOutweigh) add("make_outweigh_judgment", "state_position");
  if (asksCauses) add("explain_causes");
  if (asksProblemsOrEffects) add("identify_problems_or_effects");
  if (asksSolutions) add("propose_solutions");
  const usesGenericQuestionChecks = explicitQuestionCount >= 2 && !ids.length;
  if (usesGenericQuestionChecks) {
    add("answer_explicit_question_one", "answer_explicit_question_two");
  }
  if (!ids.length) add("address_prompt_directly");

  const families = [
    discussesBoth,
    asksAgreement || asksEvaluation,
    asksAdvantages || asksDisadvantages || asksOutweigh,
    asksCauses || asksProblemsOrEffects || asksSolutions,
    usesGenericQuestionChecks
  ].filter(Boolean).length;

  let questionType: Task2QuestionType = "unknown";
  if (families > 1 && !(discussesBoth && asksOwnOpinion) && !(asksOutweigh && asksAdvantages && asksDisadvantages)) {
    questionType = "mixed";
  } else if (discussesBoth) {
    questionType = "discussion";
  } else if (asksOutweigh || asksAdvantages || asksDisadvantages) {
    questionType = "advantages_disadvantages";
  } else if (asksCauses || asksProblemsOrEffects || asksSolutions) {
    questionType = "problem_solution";
  } else if (asksAgreement || asksEvaluation) {
    questionType = "opinion";
  } else if (explicitQuestionCount >= 2) {
    questionType = "two_part";
  }

  return {
    kind: "task2",
    questionType,
    obligations: ids.map(obligation)
  };
}

export function buildTextOnlyTaskContext(taskType: TaskType, prompt: string): EvaluationTaskContext | null {
  return taskType === "task2" ? classifyTask2Prompt(prompt) : null;
}

type JsonRecord = Record<string, unknown>;

function requireRecord(value: unknown, path: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object.`);
  }
  return value as JsonRecord;
}

function requireExactKeys(record: JsonRecord, keys: string[], path: string) {
  const expected = new Set(keys);
  const missing = keys.filter((key) => !(key in record));
  const unexpected = Object.keys(record).filter((key) => !expected.has(key));
  if (missing.length) throw new Error(`${path} is missing: ${missing.join(", ")}.`);
  if (unexpected.length) throw new Error(`${path} has unexpected fields: ${unexpected.join(", ")}.`);
}

function requireString(value: unknown, path: string, allowEmpty = false) {
  if (typeof value !== "string" || (!allowEmpty && !value.trim())) throw new Error(`${path} must be a string.`);
  return value.trim();
}

function requireStringArray(value: unknown, path: string) {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array.`);
  return value.map((item, index) => requireString(item, `${path}[${index}]`));
}

export function parseVisualFactsJsonResponse(text: string): VisualFacts {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.trim());
  } catch (error) {
    throw new Error(`Visual facts response is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  const root = requireRecord(parsed, "response");
  const keys = ["schemaVersion", "imageRelevant", "visualType", "title", "units", "timePeriods", "categories", "keyFeatures", "facts", "unreadableAreas"];
  requireExactKeys(root, keys, "response");
  if (root.schemaVersion !== VISUAL_FACTS_SCHEMA_VERSION) throw new Error(`schemaVersion must be ${VISUAL_FACTS_SCHEMA_VERSION}.`);
  if (typeof root.imageRelevant !== "boolean") throw new Error("imageRelevant must be a boolean.");
  const visualTypes: VisualFacts["visualType"][] = ["line_graph", "bar_chart", "pie_chart", "table", "map", "process", "mixed", "unknown"];
  if (!visualTypes.includes(root.visualType as VisualFacts["visualType"])) throw new Error("visualType is invalid.");
  if (!Array.isArray(root.facts)) throw new Error("facts must be an array.");
  const facts = root.facts.map((value, index) => {
    const fact = requireRecord(value, `facts[${index}]`);
    requireExactKeys(fact, ["statement", "confidence"], `facts[${index}]`);
    if (!(["high", "medium", "low"] as const).includes(fact.confidence as VisualFact["confidence"])) {
      throw new Error(`facts[${index}].confidence is invalid.`);
    }
    return {
      statement: requireString(fact.statement, `facts[${index}].statement`),
      confidence: fact.confidence as VisualFact["confidence"]
    };
  });

  return {
    schemaVersion: VISUAL_FACTS_SCHEMA_VERSION,
    imageRelevant: root.imageRelevant,
    visualType: root.visualType as VisualFacts["visualType"],
    title: requireString(root.title, "title", true),
    units: requireStringArray(root.units, "units"),
    timePeriods: requireStringArray(root.timePeriods, "timePeriods"),
    categories: requireStringArray(root.categories, "categories"),
    keyFeatures: requireStringArray(root.keyFeatures, "keyFeatures"),
    facts,
    unreadableAreas: requireStringArray(root.unreadableAreas, "unreadableAreas")
  };
}
