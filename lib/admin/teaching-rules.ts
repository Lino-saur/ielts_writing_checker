import { randomUUID } from "node:crypto";
import { ApiError, requireBoundedString } from "@/lib/api-security";
import { db, ensureDatabase } from "@/lib/db";

export const TEACHING_RULE_CATEGORIES = [
  "scoring",
  "grammar",
  "structure",
  "argumentation",
  "expression",
  "framework"
] as const;
export const TEACHING_RULE_STATUSES = ["draft", "published", "archived"] as const;
export const TEACHING_RULE_SEVERITIES = ["low", "medium", "high"] as const;
export const TEACHING_RULE_TASK_TYPES = ["all", "task1", "task2"] as const;
export const TEACHING_RULE_ORIGINS = ["ielts_official", "courseware", "system"] as const;

export type TeachingRuleCategory = (typeof TEACHING_RULE_CATEGORIES)[number];
export type TeachingRuleStatus = (typeof TEACHING_RULE_STATUSES)[number];
export type TeachingRuleSeverity = (typeof TEACHING_RULE_SEVERITIES)[number];
export type TeachingRuleTaskType = (typeof TEACHING_RULE_TASK_TYPES)[number];
export type TeachingRuleOrigin = (typeof TEACHING_RULE_ORIGINS)[number];

export type TeachingRule = {
  id: string;
  name: string;
  taskType: TeachingRuleTaskType;
  origin: TeachingRuleOrigin;
  questionTypes: string[];
  tags: string[];
  category: TeachingRuleCategory;
  principle: string;
  positiveExample: string;
  negativeExample: string;
  severity: TeachingRuleSeverity;
  priority: number;
  sourceTitle: string;
  sourceSection: string;
  knowledgePointCode: string;
  sourcePage: string;
  status: TeachingRuleStatus;
  version: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type TeachingRuleRow = {
  id: string;
  name: string;
  task_type: TeachingRuleTaskType;
  rule_origin: TeachingRuleOrigin;
  question_types_json: string[] | null;
  tags_json: string[] | null;
  rule_category: TeachingRuleCategory;
  principle: string;
  positive_example: string | null;
  negative_example: string | null;
  severity: TeachingRuleSeverity;
  priority: number;
  source_title: string | null;
  source_section: string | null;
  knowledge_point_code: string | null;
  source_page: string | null;
  status: TeachingRuleStatus;
  version: number;
  published_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type TeachingRuleInput = {
  name?: unknown;
  taskType?: unknown;
  origin?: unknown;
  questionTypes?: unknown;
  tags?: unknown;
  category?: unknown;
  principle?: unknown;
  positiveExample?: unknown;
  negativeExample?: unknown;
  severity?: unknown;
  priority?: unknown;
  sourceTitle?: unknown;
  sourceSection?: unknown;
  knowledgePointCode?: unknown;
  sourcePage?: unknown;
};

export type TeachingRuleFilters = {
  q: string;
  taskType: TeachingRuleTaskType | null;
  origin: TeachingRuleOrigin | null;
  category: TeachingRuleCategory | null;
  status: TeachingRuleStatus | null;
  page: number;
  pageSize: number;
};

function optionalString(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === "") return "";
  return requireBoundedString(value, "value", { maxLength });
}

function toIsoString(value: Date | string | null) {
  return value ? new Date(value).toISOString() : null;
}

function mapTeachingRule(row: TeachingRuleRow): TeachingRule {
  return {
    id: row.id,
    name: row.name,
    taskType: row.task_type,
    origin: row.rule_origin,
    questionTypes: Array.isArray(row.question_types_json) ? row.question_types_json : [],
    tags: Array.isArray(row.tags_json) ? row.tags_json : [],
    category: row.rule_category,
    principle: row.principle,
    positiveExample: row.positive_example ?? "",
    negativeExample: row.negative_example ?? "",
    severity: row.severity,
    priority: Number(row.priority),
    sourceTitle: row.source_title ?? "",
    sourceSection: row.source_section ?? "",
    knowledgePointCode: row.knowledge_point_code ?? "",
    sourcePage: row.source_page ?? "",
    status: row.status,
    version: Number(row.version),
    publishedAt: toIsoString(row.published_at),
    createdAt: toIsoString(row.created_at) ?? "",
    updatedAt: toIsoString(row.updated_at) ?? ""
  };
}

export function normalizeTeachingRuleFilters(input: {
  q?: string | null;
  taskType?: string | null;
  origin?: string | null;
  category?: string | null;
  status?: string | null;
  page?: string | null;
}): TeachingRuleFilters {
  const parsedPage = Number.parseInt(input.page ?? "", 10);
  return {
    q: input.q?.trim().slice(0, 200) ?? "",
    taskType: TEACHING_RULE_TASK_TYPES.includes(input.taskType as TeachingRuleTaskType)
      ? (input.taskType as TeachingRuleTaskType)
      : null,
    origin: TEACHING_RULE_ORIGINS.includes(input.origin as TeachingRuleOrigin)
      ? (input.origin as TeachingRuleOrigin)
      : null,
    category: TEACHING_RULE_CATEGORIES.includes(input.category as TeachingRuleCategory)
      ? (input.category as TeachingRuleCategory)
      : null,
    status: TEACHING_RULE_STATUSES.includes(input.status as TeachingRuleStatus)
      ? (input.status as TeachingRuleStatus)
      : null,
    page: Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    pageSize: 30
  };
}

export function validateTeachingRuleInput(input: TeachingRuleInput) {
  const taskType = TEACHING_RULE_TASK_TYPES.includes(input.taskType as TeachingRuleTaskType)
    ? (input.taskType as TeachingRuleTaskType)
    : null;
  const category = TEACHING_RULE_CATEGORIES.includes(input.category as TeachingRuleCategory)
    ? (input.category as TeachingRuleCategory)
    : null;
  const severity = TEACHING_RULE_SEVERITIES.includes(input.severity as TeachingRuleSeverity)
    ? (input.severity as TeachingRuleSeverity)
    : null;
  const priority = Number(input.priority ?? 50);
  const origin = TEACHING_RULE_ORIGINS.includes(input.origin as TeachingRuleOrigin)
    ? (input.origin as TeachingRuleOrigin)
    : "courseware";
  const questionTypes = Array.isArray(input.questionTypes)
    ? [...new Set(
        input.questionTypes.map((value) =>
          requireBoundedString(value, "questionType", { maxLength: 80 })
        )
      )].slice(0, 20)
    : [];
  const tags = Array.isArray(input.tags)
    ? [...new Set(
        input.tags.map((value) =>
          requireBoundedString(value, "tag", { maxLength: 60 })
        )
      )].slice(0, 30)
    : [];

  if (!taskType) throw new ApiError("INVALID_TASK_TYPE", 400);
  if (!category) throw new ApiError("INVALID_RULE_CATEGORY", 400);
  if (!severity) throw new ApiError("INVALID_SEVERITY", 400);
  if (!Number.isInteger(priority) || priority < 0 || priority > 100) {
    throw new ApiError("INVALID_PRIORITY", 400);
  }

  return {
    name: requireBoundedString(input.name, "name", { minLength: 2, maxLength: 160 }),
    taskType,
    origin,
    questionTypes,
    tags,
    category,
    principle: requireBoundedString(input.principle, "principle", {
      minLength: 10,
      maxLength: 12_000
    }),
    positiveExample: optionalString(input.positiveExample, 8000),
    negativeExample: optionalString(input.negativeExample, 8000),
    severity,
    priority,
    sourceTitle: optionalString(input.sourceTitle, 240),
    sourceSection: optionalString(input.sourceSection, 240),
    knowledgePointCode: optionalString(input.knowledgePointCode, 80),
    sourcePage: optionalString(input.sourcePage, 80)
  };
}

const SELECT_FIELDS = `
  id, name, task_type, rule_origin, question_types_json, tags_json, rule_category, principle,
  positive_example, negative_example, severity, priority, source_title, source_section,
  knowledge_point_code, source_page,
  status, version, published_at, created_at, updated_at
`;

export async function listTeachingRules(filters: TeachingRuleFilters) {
  await ensureDatabase();
  const conditions: string[] = [];
  const values: Array<string | number> = [];
  if (filters.q) {
    values.push(`%${filters.q}%`);
    conditions.push(
      `(name ILIKE $${values.length}
        OR principle ILIKE $${values.length}
        OR source_title ILIKE $${values.length}
        OR source_section ILIKE $${values.length}
        OR knowledge_point_code ILIKE $${values.length}
        OR tags_json::text ILIKE $${values.length})`
    );
  }
  if (filters.taskType) {
    values.push(filters.taskType);
    conditions.push(`task_type = $${values.length}`);
  }
  if (filters.origin) {
    values.push(filters.origin);
    conditions.push(`rule_origin = $${values.length}`);
  }
  if (filters.category) {
    values.push(filters.category);
    conditions.push(`rule_category = $${values.length}`);
  }
  if (filters.status) {
    values.push(filters.status);
    conditions.push(`status = $${values.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (filters.page - 1) * filters.pageSize;
  const itemValues = [...values, filters.pageSize, offset];

  const [itemsResult, countResult] = await Promise.all([
    db.query<TeachingRuleRow>(
      `SELECT ${SELECT_FIELDS}
       FROM teaching_rules
       ${where}
       ORDER BY
         CASE status WHEN 'draft' THEN 0 WHEN 'published' THEN 1 ELSE 2 END,
         priority DESC,
         updated_at DESC
       LIMIT $${values.length + 1}
       OFFSET $${values.length + 2}`,
      itemValues
    ),
    db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM teaching_rules
       ${where}`,
      values
    )
  ]);
  const total = Number(countResult.rows[0]?.count ?? 0);
  return {
    items: itemsResult.rows.map(mapTeachingRule),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
    categories: TEACHING_RULE_CATEGORIES,
    statuses: TEACHING_RULE_STATUSES,
    taskTypes: TEACHING_RULE_TASK_TYPES,
    origins: TEACHING_RULE_ORIGINS
  };
}

export async function createTeachingRule(input: TeachingRuleInput) {
  await ensureDatabase();
  const rule = validateTeachingRuleInput(input);
  const result = await db.query<TeachingRuleRow>(
    `INSERT INTO teaching_rules (
       id, name, task_type, rule_origin, question_types_json, tags_json, rule_category, principle,
       positive_example, negative_example, severity, priority, source_title, source_section,
       knowledge_point_code, source_page,
       status, version, created_at, updated_at
     )
     VALUES (
       $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
       'draft', 0, NOW(), NOW()
     )
     RETURNING ${SELECT_FIELDS}`,
    [
      `rule_${randomUUID()}`,
      rule.name,
      rule.taskType,
      rule.origin,
      JSON.stringify(rule.questionTypes),
      JSON.stringify(rule.tags),
      rule.category,
      rule.principle,
      rule.positiveExample || null,
      rule.negativeExample || null,
      rule.severity,
      rule.priority,
      rule.sourceTitle || null,
      rule.sourceSection || null,
      rule.knowledgePointCode || null,
      rule.sourcePage || null
    ]
  );
  return mapTeachingRule(result.rows[0]);
}

export async function updateTeachingRule(id: unknown, input: TeachingRuleInput) {
  await ensureDatabase();
  const ruleId = requireBoundedString(id, "id", { maxLength: 180 });
  const rule = validateTeachingRuleInput(input);
  const result = await db.query<TeachingRuleRow>(
    `UPDATE teaching_rules
     SET name = $2,
         task_type = $3,
         rule_origin = $4,
         question_types_json = $5::jsonb,
         tags_json = $6::jsonb,
         rule_category = $7,
         principle = $8,
         positive_example = $9,
         negative_example = $10,
         severity = $11,
         priority = $12,
         source_title = $13,
         source_section = $14,
         knowledge_point_code = $15,
         source_page = $16,
         status = CASE WHEN status = 'published' THEN 'draft' ELSE status END,
         published_at = CASE WHEN status = 'published' THEN NULL ELSE published_at END,
         updated_at = NOW()
     WHERE id = $1
     RETURNING ${SELECT_FIELDS}`,
    [
      ruleId,
      rule.name,
      rule.taskType,
      rule.origin,
      JSON.stringify(rule.questionTypes),
      JSON.stringify(rule.tags),
      rule.category,
      rule.principle,
      rule.positiveExample || null,
      rule.negativeExample || null,
      rule.severity,
      rule.priority,
      rule.sourceTitle || null,
      rule.sourceSection || null,
      rule.knowledgePointCode || null,
      rule.sourcePage || null
    ]
  );
  if (!result.rows[0]) throw new ApiError("TEACHING_RULE_NOT_FOUND", 404);
  return mapTeachingRule(result.rows[0]);
}

export async function publishTeachingRule(id: unknown) {
  await ensureDatabase();
  const ruleId = requireBoundedString(id, "id", { maxLength: 180 });
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<TeachingRuleRow>(
      `UPDATE teaching_rules
       SET status = 'published',
           version = version + 1,
           published_at = NOW(),
           updated_at = NOW()
       WHERE id = $1 AND status <> 'archived'
       RETURNING ${SELECT_FIELDS}`,
      [ruleId]
    );
    if (!result.rows[0]) throw new ApiError("TEACHING_RULE_NOT_FOUND", 404);
    const rule = mapTeachingRule(result.rows[0]);
    await client.query(
      `INSERT INTO teaching_rule_versions (rule_id, version, snapshot_json, published_at)
       VALUES ($1, $2, $3::jsonb, NOW())`,
      [rule.id, rule.version, JSON.stringify(rule)]
    );
    await client.query("COMMIT");
    return rule;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function archiveTeachingRule(id: unknown) {
  await ensureDatabase();
  const ruleId = requireBoundedString(id, "id", { maxLength: 180 });
  const result = await db.query<TeachingRuleRow>(
    `UPDATE teaching_rules
     SET status = 'archived',
         updated_at = NOW()
     WHERE id = $1
     RETURNING ${SELECT_FIELDS}`,
    [ruleId]
  );
  if (!result.rows[0]) throw new ApiError("TEACHING_RULE_NOT_FOUND", 404);
  return mapTeachingRule(result.rows[0]);
}
