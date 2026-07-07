import { db, ensureDatabase } from "@/lib/db";
import type { RevisionStage, TaskType, TeachingRuleReference, WritingRevisionResult, WritingScoreResult } from "@/lib/types";

export type RuleStage = "score" | "grammar" | "optimization";

export type PublishedRuleRow = {
  id: string;
  version: number;
  task_type: "all" | TaskType;
  rule_origin: "ielts_official" | "courseware" | "system";
  question_types_json: string[] | null;
  tags_json: string[] | null;
  rule_category: "scoring" | "grammar" | "structure" | "argumentation" | "expression" | "framework";
  principle: string;
  severity: "low" | "medium" | "high";
  priority: number;
  source_title: string | null;
  source_section: string | null;
  knowledge_point_code: string | null;
};

export type TeachingRuleProfile = {
  questionTypes: string[];
  tags: string[];
};

const TASK1_VISUAL_TAGS = ["line-graph", "pie-chart", "bar-chart", "table", "process", "map"];

export function detectTeachingRuleProfile(taskType: TaskType, prompt: string): TeachingRuleProfile {
  const normalized = prompt.toLowerCase().replace(/\s+/g, " ");
  const questionTypes: string[] = [];
  const tags: string[] = [];

  if (taskType === "task1") {
    if (/\bline (?:graph|chart)s?\b/.test(normalized)) tags.push("line-graph");
    if (/\bpie (?:graph|chart)s?\b/.test(normalized)) tags.push("pie-chart");
    if (/\bbar (?:graph|chart)s?\b/.test(normalized)) tags.push("bar-chart");
    if (/\btables?\b/.test(normalized)) tags.push("table");
    if (/\b(?:process|diagram|life cycle|manufacturing|production|stages?)\b/.test(normalized)) {
      tags.push("process");
    }
    if (/\b(?:maps?|plans?|site selection)\b/.test(normalized)) tags.push("map");
    return { questionTypes, tags: [...new Set(tags)] };
  }

  const asksReasons = /\b(?:why|reasons?|causes?)\b/.test(normalized);
  const asksSolutions = /\b(?:solutions?|measures?|actions?|suggestions?|what can be done|how (?:can|could|should|to))\b/.test(
    normalized
  );
  const asksEvaluation =
    /\b(?:positive or negative|advantages? outweigh|outweigh the disadvantages?|benefits? outweigh|is it the best)\b/.test(
      normalized
    );
  const asksProblemsOrEffects = /\b(?:what problems?|what effects?|effects? (?:on|to))\b/.test(
    normalized
  );
  const presentsOpposingViews =
    /\bdiscuss both (?:views|sides)\b/.test(normalized) ||
    /\bsome people\b[\s\S]*\b(?:others|other people)\b/.test(normalized);

  if (asksReasons && asksEvaluation) {
    questionTypes.push("混合类");
    tags.push("mixed-essay");
  } else if (presentsOpposingViews || /\boutweigh\b/.test(normalized)) {
    questionTypes.push("讨论类");
    tags.push("discussion-essay");
    if (/\boutweigh\b/.test(normalized)) tags.push("outweigh");
  } else if ((asksReasons || asksProblemsOrEffects) && asksSolutions) {
    questionTypes.push("问题解决类");
    tags.push("problem-solution");
  } else if (
    /\b(?:agree or disagree|to what extent|positive or negative|is this (?:a )?positive|do you agree)\b/.test(
      normalized
    )
  ) {
    questionTypes.push("观点类");
    tags.push("opinion-essay");
  }

  return { questionTypes, tags };
}

function isStageApplicable(rule: PublishedRuleRow, stage: RuleStage) {
  const tags = rule.tags_json ?? [];
  if (stage === "score") {
    return !tags.some((tag) => tag === "revision" || tag.startsWith("stage:"));
  }
  if (stage === "grammar") {
    return (
      rule.rule_category === "grammar" ||
      tags.includes("stage:grammar") ||
      (tags.includes("revision") && !tags.includes("stage:optimization"))
    );
  }
  return rule.rule_category !== "grammar" && !tags.includes("stage:grammar");
}

function isScopeApplicable(rule: PublishedRuleRow, profile: TeachingRuleProfile) {
  const questionTypes = rule.question_types_json ?? [];
  if (
    profile.questionTypes.length &&
    questionTypes.length &&
    !questionTypes.some((type) => profile.questionTypes.includes(type))
  ) {
    return false;
  }

  const visualTags = (rule.tags_json ?? []).filter((tag) => TASK1_VISUAL_TAGS.includes(tag));
  if (
    profile.tags.some((tag) => TASK1_VISUAL_TAGS.includes(tag)) &&
    visualTags.length &&
    !visualTags.some((tag) => profile.tags.includes(tag))
  ) {
    return false;
  }
  return true;
}

function rankRule(rule: PublishedRuleRow, profile: TeachingRuleProfile) {
  const questionTypes = rule.question_types_json ?? [];
  const tags = rule.tags_json ?? [];
  const originScore =
    rule.rule_origin === "ielts_official" ? 10_000 : rule.rule_origin === "system" ? 8_000 : 0;
  const questionTypeScore = questionTypes.some((type) => profile.questionTypes.includes(type))
    ? 2_000
    : 0;
  const tagScore = tags.filter((tag) => profile.tags.includes(tag)).length * 500;
  return originScore + questionTypeScore + tagScore + rule.priority;
}

export function selectApplicableTeachingRules(
  rules: PublishedRuleRow[],
  profile: TeachingRuleProfile,
  stage: RuleStage,
  limit = 24
) {
  return rules
    .filter((rule) => isStageApplicable(rule, stage) && isScopeApplicable(rule, profile))
    .sort((left, right) => {
      const scoreDifference = rankRule(right, profile) - rankRule(left, profile);
      return scoreDifference || right.priority - left.priority || left.id.localeCompare(right.id);
    })
    .slice(0, limit);
}

export type ApplicableTeachingRulesContext = {
  prompt: string;
  rules: TeachingRuleReference[];
};

export async function buildApplicableTeachingRulesContext(
  taskType: TaskType,
  stage: RuleStage,
  prompt: string
): Promise<ApplicableTeachingRulesContext> {
  await ensureDatabase();
  const profile = detectTeachingRuleProfile(taskType, prompt);
  const conditions = [
    "status = 'published'",
    "(task_type = 'all' OR task_type = $1)"
  ];
  const values: Array<string | string[]> = [taskType];
  if (profile.questionTypes.length) {
    values.push(profile.questionTypes);
    conditions.push(
      `(jsonb_array_length(question_types_json) = 0 OR question_types_json ?| $${values.length}::text[])`
    );
  }
  const visualTags = profile.tags.filter((tag) => TASK1_VISUAL_TAGS.includes(tag));
  if (visualTags.length) {
    values.push(visualTags);
    conditions.push(
      `(NOT (tags_json ?| ARRAY['line-graph','pie-chart','bar-chart','table','process','map'])
        OR tags_json ?| $${values.length}::text[])`
    );
  }
  if (stage === "score") {
    conditions.push(
      `NOT (tags_json ?| ARRAY['revision','stage:grammar','stage:optimization'])`
    );
  } else if (stage === "grammar") {
    conditions.push(
      `(rule_category = 'grammar'
        OR tags_json ? 'stage:grammar'
        OR (tags_json ? 'revision' AND NOT (tags_json ? 'stage:optimization')))`
    );
  } else {
    conditions.push(`rule_category <> 'grammar' AND NOT (tags_json ? 'stage:grammar')`);
  }
  const result = await db.query<PublishedRuleRow>(
    `SELECT id, version, task_type, rule_origin, question_types_json, tags_json,
            rule_category, principle, severity, priority,
            source_title, source_section, knowledge_point_code
     FROM teaching_rules
     WHERE ${conditions.join("\n       AND ")}
     ORDER BY priority DESC, updated_at DESC
     LIMIT 200`,
    values
  );
  const selectedRules = selectApplicableTeachingRules(result.rows, profile, stage);

  if (!selectedRules.length) {
    return {
      prompt: "No additional published teaching rules are configured for this task.",
      rules: []
    };
  }

  const lines = selectedRules.map((rule) => {
    const source = [
      rule.source_title,
      rule.source_section,
      rule.knowledge_point_code
    ].filter(Boolean).join(" · ");
    return `- [${rule.id}@v${rule.version}] (${rule.rule_origin}, ${rule.severity}) ${rule.principle}${
      source ? ` Source: ${source}.` : ""
    }`;
  });
  return {
    prompt: [
      `Detected rule scope: ${
        [...profile.questionTypes, ...profile.tags].join(", ") || `${taskType} general`
      }.`,
      "Apply the following published teaching rules when evaluating this response.",
      "Use only rules relevant to the actual essay evidence; do not force every rule to produce a finding.",
      "When citing a rule, copy its exact id and version from the square brackets.",
      ...lines
    ].join("\n"),
    rules: selectedRules.map((rule) => ({
      id: rule.id,
      version: rule.version,
      sourceTitle: rule.source_title ?? undefined,
      sourceSection: rule.source_section ?? undefined,
      knowledgePointCode: rule.knowledge_point_code ?? undefined
    }))
  };
}

export async function buildApplicableTeachingRulesPrompt(
  taskType: TaskType,
  stage: RuleStage,
  prompt: string
) {
  return (await buildApplicableTeachingRulesContext(taskType, stage, prompt)).prompt;
}

export function parseTeachingRuleReferences(value: string | undefined) {
  if (!value || value.trim().toLowerCase() === "none") return [];
  const references = [
    ...value.matchAll(/\[?([A-Za-z0-9_-]+)@v(\d+)\]?/gi)
  ].map((match) => ({
    id: match[1],
    version: Number(match[2])
  }));
  return [...new Map(references.map((reference) => [reference.id, reference])).values()].slice(0, 3);
}

function createAllowedRuleMap(rules: TeachingRuleReference[]) {
  return new Map(rules.map((rule) => [`${rule.id}@v${rule.version ?? 0}`, rule]));
}

function resolveRuleReferences(
  references: TeachingRuleReference[] | undefined,
  allowedRules: Map<string, TeachingRuleReference>
) {
  return (references ?? [])
    .map((reference) =>
      allowedRules.get(`${reference.id}@v${reference.version ?? 0}`)
    )
    .filter((reference): reference is TeachingRuleReference => Boolean(reference));
}

export function hydrateTeachingRuleReferences<
  T extends WritingScoreResult | WritingRevisionResult
>(result: T, allowedRules: TeachingRuleReference[]): T {
  const allowedRuleMap = createAllowedRuleMap(allowedRules);
  const referenceGroups: TeachingRuleReference[][] = [];
  if ("highlightedSentences" in result) {
    result.highlightedSentences.forEach((item) => referenceGroups.push(item.ruleReferences ?? []));
    result.priorityFixes.forEach((item) => referenceGroups.push(item.ruleReferences ?? []));
  } else {
    result.correctionNotes.forEach((item) => referenceGroups.push(item.ruleReferences ?? []));
    result.grammarRevision?.correctionNotes.forEach((item) =>
      referenceGroups.push(item.ruleReferences ?? [])
    );
    result.optimizationRevision?.correctionNotes.forEach((item) =>
      referenceGroups.push(item.ruleReferences ?? [])
    );
  }

  referenceGroups.forEach((references) => {
    const resolved = resolveRuleReferences(references, allowedRuleMap);
    references.splice(
      0,
      references.length,
      ...resolved
    );
  });
  return result;
}

function enforceStageRuleReferences(
  stage: RevisionStage,
  allowedRules: Map<string, TeachingRuleReference>
): RevisionStage {
  const correctionNotes = stage.correctionNotes
    .map((note) => ({
      ...note,
      ruleReferences: resolveRuleReferences(note.ruleReferences, allowedRules)
    }))
    .filter((note) => note.ruleReferences.length > 0);
  const allowedEditIds = new Set(correctionNotes.map((note) => note.id));
  const annotatedEssay = stage.annotatedEssay.replace(
    /\[del#([A-Za-z0-9_-]+)\]([\s\S]*?)\[\/del#\1\]\[add#\1\]([\s\S]*?)\[\/add#\1\]/g,
    (_match, id: string, original: string) =>
      allowedEditIds.has(id)
        ? _match
        : original
  );
  return { annotatedEssay, correctionNotes };
}

export function enforceRevisionRuleReferences(
  result: WritingRevisionResult,
  allowedRules: TeachingRuleReference[]
) {
  const allowedRuleMap = createAllowedRuleMap(allowedRules);
  const primary = enforceStageRuleReferences(
    {
      annotatedEssay: result.annotatedEssay,
      correctionNotes: result.correctionNotes
    },
    allowedRuleMap
  );
  result.annotatedEssay = primary.annotatedEssay;
  result.correctionNotes = primary.correctionNotes;
  if (result.grammarRevision) {
    result.grammarRevision = enforceStageRuleReferences(result.grammarRevision, allowedRuleMap);
  }
  if (result.optimizationRevision) {
    result.optimizationRevision = enforceStageRuleReferences(
      result.optimizationRevision,
      allowedRuleMap
    );
  }
  return result;
}
