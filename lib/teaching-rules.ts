import { db, ensureDatabase } from "@/lib/db";
import type { TaskType } from "@/lib/types";

type RuleStage = "score" | "grammar" | "optimization";

type PublishedRuleRow = {
  id: string;
  version: number;
  rule_origin: "ielts_official" | "courseware" | "system";
  principle: string;
  severity: "low" | "medium" | "high";
  source_title: string | null;
  source_section: string | null;
  knowledge_point_code: string | null;
};

export async function buildApplicableTeachingRulesPrompt(
  taskType: TaskType,
  stage: RuleStage
) {
  await ensureDatabase();
  const stageCondition =
    stage === "score"
      ? "AND NOT (tags_json ?| ARRAY['revision', 'stage:grammar', 'stage:optimization'])"
      : stage === "grammar"
        ? "AND ((tags_json ? 'stage:grammar') OR (tags_json ? 'revision') OR rule_category = 'grammar')"
        : "AND NOT (tags_json ? 'stage:grammar')";
  const result = await db.query<PublishedRuleRow>(
    `SELECT id, version, rule_origin, principle, severity,
            source_title, source_section, knowledge_point_code
     FROM teaching_rules
     WHERE status = 'published'
       AND (task_type = 'all' OR task_type = $1)
       ${stageCondition}
     ORDER BY
       CASE rule_origin
         WHEN 'ielts_official' THEN 0
         WHEN 'system' THEN 1
         ELSE 2
       END,
       priority DESC,
       updated_at DESC
     LIMIT 24`,
    [taskType]
  );

  if (!result.rows.length) {
    return "No additional published teaching rules are configured for this task.";
  }

  const lines = result.rows.map((rule) => {
    const source = [
      rule.source_title,
      rule.source_section,
      rule.knowledge_point_code
    ].filter(Boolean).join(" · ");
    return `- [${rule.id}@v${rule.version}] (${rule.rule_origin}, ${rule.severity}) ${rule.principle}${
      source ? ` Source: ${source}.` : ""
    }`;
  });
  return [
    "Apply the following published teaching rules when evaluating this response.",
    "Use only rules relevant to the actual essay evidence; do not force every rule to produce a finding.",
    ...lines
  ].join("\n");
}
