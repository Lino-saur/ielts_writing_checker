import { access, readFile } from "node:fs/promises";
import process from "node:process";

type RuleCategory =
  | "scoring"
  | "grammar"
  | "structure"
  | "argumentation"
  | "expression"
  | "framework";
type RuleSeverity = "low" | "medium" | "high";
type RuleTaskType = "all" | "task1" | "task2";

type SourceRule = {
  id: string;
  lesson: number;
  name: string;
  taskType?: RuleTaskType;
  questionTypes?: string[];
  tags?: string[];
  category: RuleCategory;
  principle: string;
  positiveExample?: string;
  negativeExample?: string;
  severity: RuleSeverity;
  priority: number;
  sourceSection: string;
  sourcePage: string;
};

const lessonTitles: Record<number, string> = {
  1: "强化写作 Lesson 1 - 小作文开班",
  2: "强化写作 Lesson 2 - 线图",
  3: "强化写作 Lesson 3 - 饼图",
  4: "强化写作 Lesson 4 - 柱图",
  5: "强化写作 Lesson 5 - 表图",
  6: "强化写作 Lesson 6 - 流程图与地图",
  7: "强化写作 Lesson 7 - 大作文评分标准",
  8: "强化写作 Lesson 8 - 大作文观点类",
  9: "强化写作 Lesson 9 - 大作文讨论类",
  10: "强化写作 Lesson 10 - 大作文问题解决类"
};

const categories = new Set<RuleCategory>([
  "scoring",
  "grammar",
  "structure",
  "argumentation",
  "expression",
  "framework"
]);
const severities = new Set<RuleSeverity>(["low", "medium", "high"]);
const taskTypes = new Set<RuleTaskType>(["all", "task1", "task2"]);

function validateRules(value: unknown): SourceRule[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Courseware rule source must be a non-empty array.");
  }
  const rules = value as SourceRule[];
  const ids = new Set<string>();
  for (const rule of rules) {
    const taskType = rule.taskType ?? (rule.lesson <= 6 ? "task1" : "task2");
    if (!rule.id.startsWith(`course_l${String(rule.lesson).padStart(2, "0")}_`)) {
      throw new Error(`Rule ${rule.id} does not use its lesson id prefix.`);
    }
    if (ids.has(rule.id)) throw new Error(`Duplicate rule id: ${rule.id}`);
    ids.add(rule.id);
    if (!lessonTitles[rule.lesson]) throw new Error(`Invalid lesson on ${rule.id}`);
    if (!rule.name?.trim() || !rule.principle?.trim() || !rule.sourceSection?.trim()) {
      throw new Error(`Incomplete rule: ${rule.id}`);
    }
    if (!categories.has(rule.category)) throw new Error(`Invalid category on ${rule.id}`);
    if (!severities.has(rule.severity)) throw new Error(`Invalid severity on ${rule.id}`);
    if (!taskTypes.has(taskType)) throw new Error(`Invalid task type on ${rule.id}`);
    if (!Number.isInteger(rule.priority) || rule.priority < 0 || rule.priority > 100) {
      throw new Error(`Invalid priority on ${rule.id}`);
    }
  }
  for (const lesson of Object.keys(lessonTitles).map(Number)) {
    if (!rules.some((rule) => rule.lesson === lesson)) {
      throw new Error(`Lesson ${lesson} has no extracted rules.`);
    }
  }
  return rules;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    try {
      await access(".env.local");
      process.loadEnvFile(".env.local");
    } catch {
      // Production and CI environments normally inject DATABASE_URL directly.
    }
  }

  const sourcePath = process.argv[2] ?? "data/courseware-teaching-rules.json";
  const rules = validateRules(JSON.parse(await readFile(sourcePath, "utf8")));
  const records = rules.map((rule) => ({
    id: rule.id,
    name: rule.name.trim(),
    task_type: rule.taskType ?? (rule.lesson <= 6 ? "task1" : "task2"),
    question_types_json: rule.questionTypes ?? [],
    tags_json: rule.tags ?? [],
    rule_category: rule.category,
    principle: rule.principle.trim(),
    positive_example: rule.positiveExample?.trim() || null,
    negative_example: rule.negativeExample?.trim() || null,
    severity: rule.severity,
    priority: rule.priority,
    source_title: lessonTitles[rule.lesson],
    source_section: rule.sourceSection.trim(),
    knowledge_point_code: `L${String(rule.lesson).padStart(2, "0")}-${String(
      rules.filter((item) => item.lesson === rule.lesson).findIndex((item) => item.id === rule.id) + 1
    ).padStart(2, "0")}`,
    source_page: rule.sourcePage
  }));

  const { db, ensureDatabase } = await import("../lib/db");
  try {
    await ensureDatabase();
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `INSERT INTO teaching_rules (
           id, name, task_type, question_types_json, tags_json, rule_origin,
           rule_category, principle, positive_example, negative_example,
           severity, priority, source_title, source_section, knowledge_point_code,
           source_page, status, version, published_at, created_at, updated_at
         )
         SELECT
           source.id, source.name, source.task_type, source.question_types_json,
           source.tags_json, 'courseware', source.rule_category, source.principle,
           source.positive_example, source.negative_example, source.severity,
           source.priority, source.source_title, source.source_section,
           source.knowledge_point_code, source.source_page,
           'draft', 0, NULL, NOW(), NOW()
         FROM jsonb_to_recordset($1::jsonb) AS source(
           id TEXT,
           name TEXT,
           task_type TEXT,
           question_types_json JSONB,
           tags_json JSONB,
           rule_category TEXT,
           principle TEXT,
           positive_example TEXT,
           negative_example TEXT,
           severity TEXT,
           priority INTEGER,
           source_title TEXT,
           source_section TEXT,
           knowledge_point_code TEXT,
           source_page TEXT
         )
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           task_type = EXCLUDED.task_type,
           question_types_json = EXCLUDED.question_types_json,
           tags_json = EXCLUDED.tags_json,
           rule_origin = EXCLUDED.rule_origin,
           rule_category = EXCLUDED.rule_category,
           principle = EXCLUDED.principle,
           positive_example = EXCLUDED.positive_example,
           negative_example = EXCLUDED.negative_example,
           severity = EXCLUDED.severity,
           priority = EXCLUDED.priority,
           source_title = EXCLUDED.source_title,
           source_section = EXCLUDED.source_section,
           knowledge_point_code = EXCLUDED.knowledge_point_code,
           source_page = EXCLUDED.source_page,
           updated_at = NOW()
         WHERE teaching_rules.status = 'draft'
         RETURNING id`,
        [JSON.stringify(records)]
      );
      await client.query("COMMIT");
      const storedResult = await client.query<{
        status: string;
        task_type: string;
        count: string;
      }>(
        `SELECT status, task_type, COUNT(*)::text AS count
         FROM teaching_rules
         WHERE rule_origin = 'courseware'
           AND id = ANY($1::text[])
         GROUP BY status, task_type
         ORDER BY status, task_type`,
        [records.map((rule) => rule.id)]
      );
      const lessonCounts = records.reduce<Record<string, number>>((counts, rule) => {
        counts[rule.source_title] = (counts[rule.source_title] ?? 0) + 1;
        return counts;
      }, {});
      console.log(
        JSON.stringify(
          {
            sourceRules: records.length,
            insertedOrUpdatedDrafts: result.rowCount,
            skippedPublishedOrArchived: records.length - (result.rowCount ?? 0),
            stored: storedResult.rows.map((row) => ({
              status: row.status,
              taskType: row.task_type,
              count: Number(row.count)
            })),
            lessonCounts
          },
          null,
          2
        )
      );
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(
    "Courseware teaching rule import failed.",
    error instanceof Error ? error.message : "UNKNOWN_ERROR"
  );
  process.exitCode = 1;
});
