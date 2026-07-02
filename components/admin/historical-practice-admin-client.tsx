"use client";

import { FormEvent, useEffect, useState } from "react";
import { ActionButton, Surface } from "@/components/ui-kit";
import type {
  HistoricalImportance,
  HistoricalPracticeQuestion,
  HistoricalQuestionType
} from "@/lib/types";
import styles from "./historical-practice-admin.module.css";

type ListPayload = {
  items: HistoricalPracticeQuestion[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  years: number[];
  types: HistoricalQuestionType[];
};

type FormState = {
  date: string;
  taskType: "task1" | "task2";
  category: string;
  type: HistoricalQuestionType;
  importance: HistoricalImportance;
  prompt: string;
};

const EMPTY_FORM: FormState = {
  date: "",
  taskType: "task2",
  category: "",
  type: "观点类",
  importance: 3,
  prompt: ""
};

function ImportanceStars({ importance }: { importance: HistoricalImportance }) {
  return (
    <span
      className={styles.importanceStars}
      aria-label={`Importance: ${importance} out of 5 stars`}
      title={`${importance} / 5`}
    >
      <span className={styles.importanceStarsFilled} aria-hidden="true">
        {"★".repeat(importance)}
      </span>
      <span className={styles.importanceStarsEmpty} aria-hidden="true">
        {"★".repeat(5 - importance)}
      </span>
    </span>
  );
}

function getErrorMessage(payload: unknown) {
  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const error = (payload as { error?: unknown }).error;
    return typeof error === "string" ? error : "REQUEST_FAILED";
  }
  return "REQUEST_FAILED";
}

async function requestQuestionList(input: {
  q: string;
  year: string;
  type: string;
  page: number;
}) {
  const params = new URLSearchParams();
  if (input.q.trim()) params.set("q", input.q.trim());
  if (input.year) params.set("year", input.year);
  if (input.type) params.set("type", input.type);
  params.set("page", String(input.page));

  const response = await fetch(`/api/admin/historical-practice?${params.toString()}`, {
    cache: "no-store"
  });
  const payload = (await response.json()) as ListPayload | { error?: string };
  if (!response.ok || !("items" in payload)) {
    throw new Error(getErrorMessage(payload));
  }
  return payload;
}

export function HistoricalPracticeAdminClient() {
  const [data, setData] = useState<ListPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("");
  const [type, setType] = useState("");
  const [activeFilters, setActiveFilters] = useState({ q: "", year: "", type: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    let cancelled = false;

    requestQuestionList({ q: "", year: "", type: "", page: 1 })
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "REQUEST_FAILED");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function loadQuestions(
    page: number,
    filters = activeFilters
  ) {
    setLoading(true);
    setError(null);
    try {
      setData(await requestQuestionList({ ...filters, page }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "REQUEST_FAILED");
    } finally {
      setLoading(false);
    }
  }

  function beginCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setSuccess(null);
  }

  function beginEdit(question: HistoricalPracticeQuestion) {
    setEditingId(question.id);
    setForm({
      date: question.date,
      taskType: question.taskType,
      category: question.category,
      type: question.type ?? "观点类",
      importance: question.importance,
      prompt: question.prompt
    });
    setError(null);
    setSuccess(null);
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const filters = { q: query, year, type };
    setActiveFilters(filters);
    await loadQuestions(1, filters);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/admin/historical-practice", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          ...form
        })
      });
      const payload = (await response.json()) as {
        question?: HistoricalPracticeQuestion;
        error?: string;
      };
      if (!response.ok || !payload.question) {
        throw new Error(getErrorMessage(payload));
      }

      setEditingId(payload.question.id);
      setForm({
          date: payload.question.date,
          taskType: payload.question.taskType,
          category: payload.question.category,
          type: payload.question.type ?? "观点类",
          importance: payload.question.importance,
        prompt: payload.question.prompt
      });
      setSuccess(editingId ? "Question updated." : "Question created.");
      await loadQuestions(editingId ? data?.page ?? 1 : 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "REQUEST_FAILED");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <Surface className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Content Management</p>
          <h1 className={styles.title}>Historical writing questions</h1>
          <p className={styles.body}>
            Search the Task 2 archive, correct existing records, or add a newly collected
            question. Changes are immediately available in the public practice library.
          </p>
        </div>
        <ActionButton variant="primary" onClick={beginCreate}>
          Add question
        </ActionButton>
      </Surface>

      <form className={styles.filters} onSubmit={handleSearch}>
        <label className={styles.field}>
          <span>Search</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Prompt, category or ID"
          />
        </label>
        <label className={styles.field}>
          <span>Year</span>
          <select value={year} onChange={(event) => setYear(event.target.value)}>
            <option value="">All years</option>
            {data?.years.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Type</span>
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="">All types</option>
            {data?.types.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <ActionButton type="submit">Apply filters</ActionButton>
      </form>

      <div className={styles.workspace}>
        <Surface className={styles.listPanel}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Question library</h2>
              <p>{data ? `${data.total} matching records` : "Loading records…"}</p>
            </div>
            {data ? <span className={styles.pageMeta}>Page {data.page} / {data.totalPages}</span> : null}
          </div>

          {loading ? (
            <div className={styles.emptyState}>Loading questions…</div>
          ) : data?.items.length ? (
            <div className={styles.questionList}>
              {data.items.map((question) => (
                <button
                  key={question.id}
                  type="button"
                  className={`${styles.questionCard} ${
                    editingId === question.id ? styles.questionCardActive : ""
                  }`}
                  onClick={() => beginEdit(question)}
                >
                  <span className={styles.cardTopline}>
                    <strong>{question.date}</strong>
                    <span className={styles.cardMeta}>
                      <span className={styles.taskBadge}>
                        {question.taskType === "task1" ? "Task 1" : question.type}
                      </span>
                      <ImportanceStars importance={question.importance} />
                    </span>
                  </span>
                  <span className={styles.category}>{question.category}</span>
                  <span className={styles.prompt}>{question.prompt}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>No questions match these filters.</div>
          )}

          {data && data.totalPages > 1 ? (
            <div className={styles.pagination}>
              <ActionButton
                disabled={loading || data.page <= 1}
                onClick={() => void loadQuestions(data.page - 1)}
              >
                Previous
              </ActionButton>
              <ActionButton
                disabled={loading || data.page >= data.totalPages}
                onClick={() => void loadQuestions(data.page + 1)}
              >
                Next
              </ActionButton>
            </div>
          ) : null}
        </Surface>

        <Surface as="form" className={styles.editor} onSubmit={handleSave}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.editorEyebrow}>{editingId ? "Edit record" : "New record"}</p>
              <h2>{editingId ? "Update question" : "Add historical question"}</h2>
            </div>
            {editingId ? <span className={styles.idBadge}>{editingId}</span> : null}
          </div>

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Task</span>
              <select
                value={form.taskType}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    taskType: event.target.value as "task1" | "task2"
                  }))
                }
              >
                <option value="task1">Task 1</option>
                <option value="task2">Task 2</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Exam date</span>
              <input
                type="date"
                required
                value={form.date}
                onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
              />
            </label>
            <label className={styles.field}>
              <span>Importance</span>
              <select
                value={form.importance}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    importance: Number(event.target.value) as HistoricalImportance
                  }))
                }
              >
                {[5, 4, 3, 2, 1].map((importance) => (
                  <option key={importance} value={importance}>
                    {"★".repeat(importance)}{"☆".repeat(5 - importance)} · {importance} / 5
                  </option>
                ))}
              </select>
            </label>
            {form.taskType === "task2" ? <label className={styles.field}>
              <span>Question type</span>
              <select
                required
                value={form.type}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    type: event.target.value as HistoricalQuestionType
                  }))
                }
              >
                {(data?.types ?? ["观点类", "讨论类", "问题解决类", "混合类"]).map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label> : null}
          </div>

          <label className={styles.field}>
            <span>Category</span>
            <input
              required
              maxLength={80}
              value={form.category}
              onChange={(event) =>
                setForm((current) => ({ ...current, category: event.target.value }))
              }
              placeholder="e.g. 教育 / 科技 / 社会"
            />
          </label>

          <label className={styles.field}>
            <span>Question prompt</span>
            <textarea
              required
              minLength={10}
              maxLength={5000}
              value={form.prompt}
              onChange={(event) =>
                setForm((current) => ({ ...current, prompt: event.target.value }))
              }
              placeholder={`Enter the complete ${form.taskType === "task1" ? "Task 1" : "Task 2"} prompt`}
            />
            <small>{form.prompt.length} / 5000</small>
          </label>

          {error ? <div className={styles.error} role="alert">{error}</div> : null}
          {success ? <div className={styles.success} role="status">{success}</div> : null}

          <div className={styles.editorActions}>
            <ActionButton type="submit" variant="primary" disabled={saving}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Create question"}
            </ActionButton>
            {editingId ? <ActionButton onClick={beginCreate}>Cancel editing</ActionButton> : null}
          </div>
        </Surface>
      </div>
    </div>
  );
}
