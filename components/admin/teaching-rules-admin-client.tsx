"use client";

import { FormEvent, useEffect, useState } from "react";
import { ActionButton, Surface } from "@/components/ui-kit";
import type {
  TeachingRule,
  TeachingRuleCategory,
  TeachingRuleOrigin,
  TeachingRuleSeverity,
  TeachingRuleStatus,
  TeachingRuleTaskType
} from "@/lib/admin/teaching-rules";
import styles from "./teaching-rules-admin.module.css";

type ListPayload = {
  items: TeachingRule[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  categories: TeachingRuleCategory[];
  statuses: TeachingRuleStatus[];
  taskTypes: TeachingRuleTaskType[];
};

type FormState = {
  name: string;
  taskType: TeachingRuleTaskType;
  origin: TeachingRuleOrigin;
  questionTypesText: string;
  tagsText: string;
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
};

const EMPTY_FORM: FormState = {
  name: "",
  taskType: "all",
  origin: "courseware",
  questionTypesText: "",
  tagsText: "",
  category: "structure",
  principle: "",
  positiveExample: "",
  negativeExample: "",
  severity: "medium",
  priority: 50,
  sourceTitle: "",
  sourceSection: "",
  knowledgePointCode: "",
  sourcePage: ""
};

const CATEGORY_LABELS: Record<TeachingRuleCategory, string> = {
  scoring: "Scoring",
  grammar: "Grammar",
  structure: "Structure",
  argumentation: "Argumentation",
  expression: "Expression",
  framework: "Writing framework"
};

const STATUS_LABELS: Record<TeachingRuleStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived"
};

const TASK_LABELS: Record<TeachingRuleTaskType, string> = {
  all: "Task 1 + Task 2",
  task1: "Task 1",
  task2: "Task 2"
};

const ORIGIN_LABELS: Record<TeachingRuleOrigin, string> = {
  ielts_official: "IELTS official",
  courseware: "Courseware",
  system: "System"
};

function parseCommaList(value: string) {
  return value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getErrorMessage(payload: unknown) {
  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const error = (payload as { error?: unknown }).error;
    return typeof error === "string" ? error : "REQUEST_FAILED";
  }
  return "REQUEST_FAILED";
}

function toFormState(rule: TeachingRule): FormState {
  return {
    name: rule.name,
    taskType: rule.taskType,
    origin: rule.origin,
    questionTypesText: rule.questionTypes.join(", "),
    tagsText: rule.tags.join(", "),
    category: rule.category,
    principle: rule.principle,
    positiveExample: rule.positiveExample,
    negativeExample: rule.negativeExample,
    severity: rule.severity,
    priority: rule.priority,
    sourceTitle: rule.sourceTitle,
    sourceSection: rule.sourceSection,
    knowledgePointCode: rule.knowledgePointCode,
    sourcePage: rule.sourcePage
  };
}

async function requestRuleList(input: {
  q: string;
  taskType: string;
  origin: string;
  category: string;
  status: string;
  page: number;
}) {
  const params = new URLSearchParams({ page: String(input.page) });
  if (input.q.trim()) params.set("q", input.q.trim());
  if (input.taskType) params.set("taskType", input.taskType);
  if (input.origin) params.set("origin", input.origin);
  if (input.category) params.set("category", input.category);
  if (input.status) params.set("status", input.status);
  const response = await fetch(`/api/admin/teaching-rules?${params.toString()}`, {
    cache: "no-store"
  });
  const payload = (await response.json()) as ListPayload | { error?: string };
  if (!response.ok || !("items" in payload)) throw new Error(getErrorMessage(payload));
  return payload;
}

export function TeachingRulesAdminClient() {
  const [data, setData] = useState<ListPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingStatus, setEditingStatus] = useState<TeachingRuleStatus>("draft");
  const [editingVersion, setEditingVersion] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [query, setQuery] = useState("");
  const [taskType, setTaskType] = useState("");
  const [origin, setOrigin] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [activeFilters, setActiveFilters] = useState({
    q: "",
    taskType: "", origin: "",
    category: "",
    status: ""
  });

  useEffect(() => {
    let cancelled = false;
    requestRuleList({ q: "", taskType: "", origin: "", category: "", status: "", page: 1 })
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "REQUEST_FAILED");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function updateForm(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...patch }));
    setDirty(true);
    setSuccess(null);
  }

  async function loadRules(page: number, filters = activeFilters) {
    setLoading(true);
    setError(null);
    try {
      setData(await requestRuleList({ ...filters, page }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "REQUEST_FAILED");
    } finally {
      setLoading(false);
    }
  }

  function beginCreate() {
    setEditingId(null);
    setEditingStatus("draft");
    setEditingVersion(0);
    setForm(EMPTY_FORM);
    setDirty(false);
    setError(null);
    setSuccess(null);
  }

  function beginEdit(rule: TeachingRule) {
    setEditingId(rule.id);
    setEditingStatus(rule.status);
    setEditingVersion(rule.version);
    setForm(toFormState(rule));
    setDirty(false);
    setError(null);
    setSuccess(null);
  }

  function buildPayload() {
    return {
      name: form.name,
      taskType: form.taskType,
      origin: form.origin,
      questionTypes: parseCommaList(form.questionTypesText),
      tags: parseCommaList(form.tagsText),
      category: form.category,
      principle: form.principle,
      positiveExample: form.positiveExample,
      negativeExample: form.negativeExample,
      severity: form.severity,
      priority: form.priority,
      sourceTitle: form.sourceTitle,
      sourceSection: form.sourceSection,
      knowledgePointCode: form.knowledgePointCode,
      sourcePage: form.sourcePage
    };
  }

  async function saveCurrentRule() {
    const response = await fetch("/api/admin/teaching-rules", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(editingId ? { id: editingId } : {}),
        ...buildPayload()
      })
    });
    const payload = (await response.json()) as { rule?: TeachingRule; error?: string };
    if (!response.ok || !payload.rule) throw new Error(getErrorMessage(payload));
    setEditingId(payload.rule.id);
    setEditingStatus(payload.rule.status);
    setEditingVersion(payload.rule.version);
    setForm(toFormState(payload.rule));
    setDirty(false);
    return payload.rule;
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const rule = await saveCurrentRule();
      setSuccess(rule.version > 0 ? "Changes saved as draft. Publish again when ready." : "Draft saved.");
      await loadRules(data?.page ?? 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "REQUEST_FAILED");
    } finally {
      setSaving(false);
    }
  }

  async function handleRuleAction(action: "publish" | "archive") {
    if (saving) return;
    if (action === "archive" && !window.confirm("Archive this teaching rule?")) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      let ruleId = editingId;
      if (action === "publish" && (!ruleId || dirty)) {
        ruleId = (await saveCurrentRule()).id;
      }
      if (!ruleId) throw new Error("SAVE_RULE_FIRST");
      const response = await fetch("/api/admin/teaching-rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ruleId, action })
      });
      const payload = (await response.json()) as { rule?: TeachingRule; error?: string };
      if (!response.ok || !payload.rule) throw new Error(getErrorMessage(payload));
      beginEdit(payload.rule);
      setSuccess(action === "publish" ? `Published as version ${payload.rule.version}.` : "Rule archived.");
      await loadRules(data?.page ?? 1);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "REQUEST_FAILED");
    } finally {
      setSaving(false);
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const filters = { q: query, taskType, origin, category, status };
    setActiveFilters(filters);
    await loadRules(1, filters);
  }

  return (
    <div className={styles.wrap}>
      <Surface className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Knowledge Operations</p>
          <h1 className={styles.title}>Teaching rules</h1>
          <p className={styles.body}>
            Turn courseware principles into structured, searchable rules. Only explicitly
            published versions will be eligible for future review workflows.
          </p>
        </div>
        <ActionButton variant="primary" onClick={beginCreate}>Add rule</ActionButton>
      </Surface>

      <form className={styles.filters} onSubmit={handleSearch}>
        <label className={styles.field}>
          <span>Search</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, principle, source or tag"
          />
        </label>
        <label className={styles.field}>
          <span>Task</span>
          <select value={taskType} onChange={(event) => setTaskType(event.target.value)}>
            <option value="">All tasks</option>
            {(["all", "task1", "task2"] as TeachingRuleTaskType[]).map((option) => (
              <option key={option} value={option}>{TASK_LABELS[option]}</option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All categories</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Source</span>
          <select value={origin} onChange={(event) => setOrigin(event.target.value)}>
            <option value="">All sources</option>
            {Object.entries(ORIGIN_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <ActionButton type="submit">Apply</ActionButton>
      </form>

      <div className={styles.workspace}>
        <Surface className={styles.listPanel}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Rule library</h2>
              <p>{data ? `${data.total} matching rules` : "Loading rules…"}</p>
            </div>
            {data ? <span className={styles.pageMeta}>Page {data.page} / {data.totalPages}</span> : null}
          </div>

          {loading ? (
            <div className={styles.emptyState}>Loading rules…</div>
          ) : data?.items.length ? (
            <div className={styles.ruleList}>
              {data.items.map((rule) => (
                <button
                  key={rule.id}
                  type="button"
                  className={`${styles.ruleCard} ${editingId === rule.id ? styles.ruleCardActive : ""}`}
                  onClick={() => beginEdit(rule)}
                >
                  <span className={styles.cardTopline}>
                    <strong>{rule.name}</strong>
                    <span className={`${styles.statusBadge} ${styles[`status_${rule.status}`]}`}>
                      {STATUS_LABELS[rule.status]}
                    </span>
                  </span>
                  <span className={styles.cardMeta}>
                    {TASK_LABELS[rule.taskType]} · {ORIGIN_LABELS[rule.origin]} · {CATEGORY_LABELS[rule.category]} · Priority {rule.priority}
                  </span>
                  <span className={styles.principlePreview}>{rule.principle}</span>
                  {rule.tags.length ? (
                    <span className={styles.tagRow}>
                      {rule.tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>No rules match these filters.</div>
          )}

          {data && data.totalPages > 1 ? (
            <div className={styles.pagination}>
              <ActionButton disabled={loading || data.page <= 1} onClick={() => void loadRules(data.page - 1)}>
                Previous
              </ActionButton>
              <ActionButton disabled={loading || data.page >= data.totalPages} onClick={() => void loadRules(data.page + 1)}>
                Next
              </ActionButton>
            </div>
          ) : null}
        </Surface>

        <Surface as="form" className={styles.editor} onSubmit={handleSave}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.editorEyebrow}>{editingId ? "Edit rule" : "New rule"}</p>
              <h2>{editingId ? form.name || "Untitled rule" : "Create teaching rule"}</h2>
            </div>
            {editingId ? (
              <span className={styles.versionBadge}>
                {STATUS_LABELS[editingStatus]} · v{editingVersion}
              </span>
            ) : null}
          </div>

          <div className={styles.formGrid}>
            <label className={`${styles.field} ${styles.spanTwo}`}>
              <span>Rule name</span>
              <input
                required
                minLength={2}
                maxLength={160}
                value={form.name}
                onChange={(event) => updateForm({ name: event.target.value })}
                placeholder="e.g. Opinion essay introduction must state a clear position"
              />
            </label>
            <label className={styles.field}>
              <span>Task scope</span>
              <select
                value={form.taskType}
                onChange={(event) => updateForm({ taskType: event.target.value as TeachingRuleTaskType })}
              >
                {(["all", "task1", "task2"] as TeachingRuleTaskType[]).map((option) => (
                  <option key={option} value={option}>{TASK_LABELS[option]}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Rule category</span>
              <select
                value={form.category}
                onChange={(event) => updateForm({ category: event.target.value as TeachingRuleCategory })}
              >
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Rule source</span>
              <select
                value={form.origin}
                onChange={(event) => updateForm({ origin: event.target.value as TeachingRuleOrigin })}
              >
                {Object.entries(ORIGIN_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Severity</span>
              <select
                value={form.severity}
                onChange={(event) => updateForm({ severity: event.target.value as TeachingRuleSeverity })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Priority (0–100)</span>
              <input
                type="number"
                min={0}
                max={100}
                required
                value={form.priority}
                onChange={(event) => updateForm({ priority: Number(event.target.value) })}
              />
            </label>
            <label className={styles.field}>
              <span>Applicable question types</span>
              <input
                value={form.questionTypesText}
                onChange={(event) => updateForm({ questionTypesText: event.target.value })}
                placeholder="观点类, 讨论类"
              />
            </label>
            <label className={styles.field}>
              <span>Retrieval tags</span>
              <input
                value={form.tagsText}
                onChange={(event) => updateForm({ tagsText: event.target.value })}
                placeholder="introduction, thesis, position"
              />
            </label>
          </div>

          <label className={styles.field}>
            <span>Teaching principle</span>
            <textarea
              required
              minLength={10}
              maxLength={12000}
              value={form.principle}
              onChange={(event) => updateForm({ principle: event.target.value })}
              placeholder="State the principle in a way that can be applied during review."
            />
          </label>

          <div className={styles.exampleGrid}>
            <label className={styles.field}>
              <span>Positive example</span>
              <textarea
                value={form.positiveExample}
                onChange={(event) => updateForm({ positiveExample: event.target.value })}
                placeholder="A correct application of this principle"
              />
            </label>
            <label className={styles.field}>
              <span>Negative example</span>
              <textarea
                value={form.negativeExample}
                onChange={(event) => updateForm({ negativeExample: event.target.value })}
                placeholder="A common mistake or counterexample"
              />
            </label>
          </div>

          <div className={styles.sourceGrid}>
            <label className={styles.field}>
              <span>Source courseware</span>
              <input
                value={form.sourceTitle}
                onChange={(event) => updateForm({ sourceTitle: event.target.value })}
                placeholder="Course or lesson title"
              />
            </label>
            <label className={styles.field}>
              <span>Chapter / lesson</span>
              <input
                value={form.sourceSection}
                onChange={(event) => updateForm({ sourceSection: event.target.value })}
                placeholder="Lesson 3 · Introductions"
              />
            </label>
            <label className={styles.field}>
              <span>Knowledge point code</span>
              <input
                value={form.knowledgePointCode}
                onChange={(event) => updateForm({ knowledgePointCode: event.target.value })}
                placeholder="3.2"
              />
            </label>
            <label className={styles.field}>
              <span>Page / section</span>
              <input
                value={form.sourcePage}
                onChange={(event) => updateForm({ sourcePage: event.target.value })}
                placeholder="Page 12 / Lesson 3"
              />
            </label>
          </div>

          {editingStatus === "published" && dirty ? (
            <div className={styles.warning}>
              Saving changes will return this rule to draft. Review it before publishing again.
            </div>
          ) : null}
          {error ? <div className={styles.error} role="alert">{error}</div> : null}
          {success ? <div className={styles.success} role="status">{success}</div> : null}

          <div className={styles.editorActions}>
            <ActionButton type="submit" variant="primary" disabled={saving}>
              {saving ? "Saving…" : editingId ? "Save draft" : "Create draft"}
            </ActionButton>
            {editingStatus !== "archived" ? (
              <ActionButton type="button" disabled={saving} onClick={() => void handleRuleAction("publish")}>
                Publish
              </ActionButton>
            ) : null}
            {editingId && editingStatus !== "archived" ? (
              <ActionButton type="button" disabled={saving} onClick={() => void handleRuleAction("archive")}>
                Archive
              </ActionButton>
            ) : null}
            {editingId ? <ActionButton type="button" onClick={beginCreate}>Cancel editing</ActionButton> : null}
          </div>
        </Surface>
      </div>
    </div>
  );
}
