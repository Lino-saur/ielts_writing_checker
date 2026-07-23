"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ActionButton } from "@/components/ui-kit";
import type {
  AdminWritingAssignment,
  AdminWritingAssignmentSubmission,
  AssignmentFeedbackItem,
  AssignmentScoreBreakdown,
  TaskType,
  WritingClass
} from "@/lib/types";
import styles from "./assignments-admin.module.css";

type UserSearchItem = {
  id: string;
  email: string | null;
  name: string | null;
};

type AssignmentsPayload = {
  items: AdminWritingAssignment[];
};

type ClassesPayload = {
  items: WritingClass[];
};

type AssignmentImage = {
  objectKey: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
};

type FeedbackDraft = {
  score: string;
  feedback: string;
  scoreBreakdown: Record<keyof AssignmentScoreBreakdown, { score: string; comment: string }>;
  feedbackItems: AssignmentFeedbackItem[];
  rewriteRequired: boolean;
};

type AdminAssignmentFilter = "all" | "pending_feedback" | "unsubmitted" | "reviewed" | "closed";
type FeedbackDimensionKey = keyof AssignmentScoreBreakdown;

const FEEDBACK_DIMENSIONS: Array<{ key: FeedbackDimensionKey; label: string }> = [
  { key: "taskAchievement", label: "TR / TA" },
  { key: "coherenceAndCohesion", label: "CC" },
  { key: "lexicalResource", label: "LR" },
  { key: "grammaticalRangeAndAccuracy", label: "GRA" }
];

const QUICK_FEEDBACK = [
  "审题方向基本正确，但主体段需要补充更具体的解释和例子。",
  "段落之间的逻辑连接还可以更清晰，建议明确主题句和递进关系。",
  "词汇选择整体可理解，但存在搭配不自然的问题，建议优先修正高频表达。",
  "语法错误影响了部分句子的准确性，建议先处理主谓一致、时态和从句结构。"
] as const;

function formatDate(value: string | null) {
  if (!value) {
    return "无截止时间";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function toDateTimeLocal(value: string | null) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function studentLabel(student: UserSearchItem) {
  return student.email || student.name || student.id;
}

function statusLabel(submission: AdminWritingAssignmentSubmission) {
  if (submission.rewriteRequired) {
    return "需重写";
  }
  return submission.status === "reviewed" ? "已反馈" : "待反馈";
}

function defaultScoreBreakdown(submission?: AdminWritingAssignmentSubmission): FeedbackDraft["scoreBreakdown"] {
  return FEEDBACK_DIMENSIONS.reduce(
    (breakdown, dimension) => ({
      ...breakdown,
      [dimension.key]: {
        score:
          submission?.teacherScoreBreakdown[dimension.key].score === null ||
          submission?.teacherScoreBreakdown[dimension.key].score === undefined
            ? ""
            : String(submission.teacherScoreBreakdown[dimension.key].score),
        comment: submission?.teacherScoreBreakdown[dimension.key].comment ?? ""
      }
    }),
    {} as FeedbackDraft["scoreBreakdown"]
  );
}

function createFeedbackDraft(submission: AdminWritingAssignmentSubmission): FeedbackDraft {
  return {
    score: submission.teacherScore === null ? "" : String(submission.teacherScore),
    feedback: submission.teacherFeedback ?? "",
    scoreBreakdown: defaultScoreBreakdown(submission),
    feedbackItems: submission.teacherFeedbackItems,
    rewriteRequired: submission.rewriteRequired
  };
}

export function AssignmentsAdminClient() {
  const [items, setItems] = useState<AdminWritingAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("task2");
  const [prompt, setPrompt] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [lateDueAt, setLateDueAt] = useState("");
  const [allowLateSubmission, setAllowLateSubmission] = useState(false);
  const [allowResubmission, setAllowResubmission] = useState(true);
  const [studentQuery, setStudentQuery] = useState("");
  const [searchingStudents, setSearchingStudents] = useState(false);
  const [studentResults, setStudentResults] = useState<UserSearchItem[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<UserSearchItem[]>([]);
  const [classes, setClasses] = useState<WritingClass[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [className, setClassName] = useState("");
  const [classStudentQuery, setClassStudentQuery] = useState("");
  const [classStudentResults, setClassStudentResults] = useState<UserSearchItem[]>([]);
  const [classStudents, setClassStudents] = useState<UserSearchItem[]>([]);
  const [savingClass, setSavingClass] = useState(false);
  const [assignmentImage, setAssignmentImage] = useState<AssignmentImage | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [assignmentFilter, setAssignmentFilter] = useState<AdminAssignmentFilter>("all");
  const [assignmentActionId, setAssignmentActionId] = useState<string | null>(null);
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, FeedbackDraft>>({});
  const [feedbackSavingId, setFeedbackSavingId] = useState<string | null>(null);

  const selectedStudentIds = useMemo(() => new Set(selectedStudents.map((student) => student.id)), [selectedStudents]);
  const selectedClassStudentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of classes) {
      if (selectedClassIds.includes(item.id)) {
        for (const student of item.students) {
          ids.add(student.id);
        }
      }
    }
    return ids;
  }, [classes, selectedClassIds]);
  const assignmentStudentIds = useMemo(
    () => [...new Set([...selectedStudents.map((student) => student.id), ...selectedClassStudentIds])],
    [selectedClassStudentIds, selectedStudents]
  );
  const filteredAssignments = useMemo(
    () =>
      items.filter((assignment) => {
        if (assignmentFilter === "closed") {
          return assignment.status === "closed";
        }
        if (assignmentFilter === "pending_feedback") {
          return assignment.submissions.some((submission) => submission.status === "submitted");
        }
        if (assignmentFilter === "unsubmitted") {
          return assignment.recipientCount > assignment.submittedCount;
        }
        if (assignmentFilter === "reviewed") {
          return assignment.submittedCount > 0 && assignment.reviewedCount === assignment.submittedCount;
        }
        return true;
      }),
    [assignmentFilter, items]
  );

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/assignments", { cache: "no-store" });
      const data = (await response.json()) as AssignmentsPayload | { error?: string };
      if (!response.ok || !("items" in data)) {
        throw new Error("LOAD_FAILED");
      }
      setItems(data.items);
    } catch {
      setError("作业列表加载失败。");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadClasses = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/assignment-classes", { cache: "no-store" });
      const data = (await response.json()) as ClassesPayload | { error?: string };
      if (!response.ok || !("items" in data)) {
        throw new Error("LOAD_FAILED");
      }
      setClasses(data.items);
    } catch {
      setError("班级/分组加载失败。");
    }
  }, []);

  useEffect(() => {
    void loadAssignments();
    void loadClasses();
  }, [loadAssignments, loadClasses]);

  useEffect(() => {
    const query = studentQuery.trim();
    if (query.length < 2) {
      setStudentResults([]);
      return;
    }

    const controller = new AbortController();
    setSearchingStudents(true);
    fetch(`/api/admin/users/search?q=${encodeURIComponent(query)}`, {
      cache: "no-store",
      signal: controller.signal
    })
      .then(async (response) => {
        const data = (await response.json()) as { items?: UserSearchItem[] };
        if (!response.ok) {
          throw new Error("SEARCH_FAILED");
        }
        setStudentResults(data.items ?? []);
      })
      .catch((searchError) => {
        if (searchError instanceof Error && searchError.name === "AbortError") {
          return;
        }
        setStudentResults([]);
      })
      .finally(() => setSearchingStudents(false));

    return () => controller.abort();
  }, [studentQuery]);

  useEffect(() => {
    const query = classStudentQuery.trim();
    if (query.length < 2) {
      setClassStudentResults([]);
      return;
    }

    const controller = new AbortController();
    fetch(`/api/admin/users/search?q=${encodeURIComponent(query)}`, {
      cache: "no-store",
      signal: controller.signal
    })
      .then(async (response) => {
        const data = (await response.json()) as { items?: UserSearchItem[] };
        if (!response.ok) {
          throw new Error("SEARCH_FAILED");
        }
        setClassStudentResults(data.items ?? []);
      })
      .catch((searchError) => {
        if (searchError instanceof Error && searchError.name === "AbortError") {
          return;
        }
        setClassStudentResults([]);
      });

    return () => controller.abort();
  }, [classStudentQuery]);

  function addStudent(student: UserSearchItem) {
    if (selectedStudentIds.has(student.id)) {
      return;
    }
    setSelectedStudents((current) => [...current, student]);
    setStudentQuery("");
    setStudentResults([]);
  }

  function removeStudent(studentId: string) {
    setSelectedStudents((current) => current.filter((student) => student.id !== studentId));
  }

  function addClassStudent(student: UserSearchItem) {
    if (classStudents.some((item) => item.id === student.id)) {
      return;
    }
    setClassStudents((current) => [...current, student]);
    setClassStudentQuery("");
    setClassStudentResults([]);
  }

  function removeClassStudent(studentId: string) {
    setClassStudents((current) => current.filter((student) => student.id !== studentId));
  }

  async function handleCreateClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingClass(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/assignment-classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: className,
          studentIds: classStudents.map((student) => student.id)
        })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "CREATE_CLASS_FAILED");
      }
      setClassName("");
      setClassStudents([]);
      await loadClasses();
    } catch {
      setError("创建班级/分组失败，请检查名称和学生。");
    } finally {
      setSavingClass(false);
    }
  }

  async function handleImageChange(file: File | null) {
    if (!file) {
      return;
    }

    setUploadingImage(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/assignments/image-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size
        })
      });
      const data = (await response.json()) as {
        objectKey?: string;
        uploadUrl?: string;
        headers?: Record<string, string>;
        error?: string;
      };
      if (!response.ok || !data.objectKey || !data.uploadUrl) {
        throw new Error(data.error || "UPLOAD_URL_FAILED");
      }

      const uploadResponse = await fetch(data.uploadUrl, {
        method: "PUT",
        headers: data.headers ?? { "Content-Type": file.type },
        body: file
      });
      if (!uploadResponse.ok) {
        throw new Error("UPLOAD_FAILED");
      }

      setAssignmentImage({
        objectKey: data.objectKey,
        name: file.name,
        mimeType: file.type,
        sizeBytes: file.size
      });
    } catch {
      setError("图片上传失败，请确认格式为 JPG / PNG / WebP，且小于 8MB。");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleCreateAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/assignments", {
        method: editingAssignmentId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingAssignmentId
            ? {
                action: "update",
                assignmentId: editingAssignmentId,
                title,
                taskType,
                prompt,
                instructions,
                dueAt: dueAt ? new Date(dueAt).toISOString() : null,
                lateDueAt: lateDueAt ? new Date(lateDueAt).toISOString() : null,
                allowLateSubmission,
                allowResubmission,
                taskImageObjectKey: assignmentImage?.objectKey ?? null,
                taskImageName: assignmentImage?.name ?? null,
                taskImageMimeType: assignmentImage?.mimeType ?? null,
                taskImageSizeBytes: assignmentImage?.sizeBytes ?? null
              }
            : {
                title,
                taskType,
                prompt,
                instructions,
                dueAt: dueAt ? new Date(dueAt).toISOString() : null,
                lateDueAt: lateDueAt ? new Date(lateDueAt).toISOString() : null,
                allowLateSubmission,
                allowResubmission,
                studentIds: assignmentStudentIds,
                taskImageObjectKey: assignmentImage?.objectKey ?? null,
                taskImageName: assignmentImage?.name ?? null,
                taskImageMimeType: assignmentImage?.mimeType ?? null,
                taskImageSizeBytes: assignmentImage?.sizeBytes ?? null
              }
        )
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || (editingAssignmentId ? "UPDATE_FAILED" : "CREATE_FAILED"));
      }

      setEditingAssignmentId(null);
      setTitle("");
      setTaskType("task2");
      setPrompt("");
      setInstructions("");
      setDueAt("");
      setLateDueAt("");
      setAllowLateSubmission(false);
      setAllowResubmission(true);
      setSelectedStudents([]);
      setSelectedClassIds([]);
      setAssignmentImage(null);
      await loadAssignments();
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "CREATE_FAILED";
      setError(
        message.startsWith("INVALID_")
          ? "请检查标题、题目、学生和截止时间。"
          : editingAssignmentId
            ? "保存作业失败。"
            : "创建作业失败。"
      );
    } finally {
      setSaving(false);
    }
  }

  function beginEditAssignment(assignment: AdminWritingAssignment) {
    setEditingAssignmentId(assignment.id);
    setTitle(assignment.title);
    setTaskType(assignment.taskType);
    setPrompt(assignment.prompt);
    setInstructions(assignment.instructions);
    setDueAt(toDateTimeLocal(assignment.dueAt));
    setLateDueAt(toDateTimeLocal(assignment.lateDueAt));
    setAllowLateSubmission(assignment.allowLateSubmission);
    setAllowResubmission(assignment.allowResubmission);
    setAssignmentImage(null);
    setSelectedStudents([]);
    setSelectedClassIds([]);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEditAssignment() {
    setEditingAssignmentId(null);
    setTitle("");
    setTaskType("task2");
    setPrompt("");
    setInstructions("");
    setDueAt("");
    setLateDueAt("");
    setAllowLateSubmission(false);
    setAllowResubmission(true);
    setAssignmentImage(null);
    setSelectedStudents([]);
    setSelectedClassIds([]);
  }

  async function handleSaveFeedback(submissionId: string) {
    const draft = feedbackDrafts[submissionId];
    if (!draft?.feedback.trim()) {
      setError("请先填写反馈内容。");
      return;
    }

    setFeedbackSavingId(submissionId);
    setError(null);
    try {
      const response = await fetch("/api/admin/assignments/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          score: draft.score || null,
          feedback: draft.feedback,
          scoreBreakdown: Object.fromEntries(
            FEEDBACK_DIMENSIONS.map((dimension) => [
              dimension.key,
              {
                score: draft.scoreBreakdown[dimension.key].score || null,
                comment: draft.scoreBreakdown[dimension.key].comment
              }
            ])
          ),
          feedbackItems: draft.feedbackItems,
          rewriteRequired: draft.rewriteRequired
        })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "SAVE_FAILED");
      }
      await loadAssignments();
    } catch {
      setError("保存反馈失败。");
    } finally {
      setFeedbackSavingId(null);
    }
  }

  async function handleAssignmentAction(
    assignment: AdminWritingAssignment,
    action: "close" | "reopen" | "duplicate" | "delete"
  ) {
    if (action === "delete" && !window.confirm("确认删除这份尚未有学生提交的作业？")) {
      return;
    }

    setAssignmentActionId(assignment.id);
    setError(null);
    try {
      const response = await fetch("/api/admin/assignments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "duplicate"
            ? {
                action: "duplicate",
                assignmentId: assignment.id
              }
            : action === "delete"
              ? {
                  action: "delete",
                  assignmentId: assignment.id
                }
            : {
                action: "set_status",
                assignmentId: assignment.id,
                status: action === "close" ? "closed" : "assigned"
              }
        )
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "ACTION_FAILED");
      }
      await loadAssignments();
    } catch {
      setError(action === "duplicate" ? "复制作业失败。" : action === "delete" ? "删除失败；已有提交的作业不能删除。" : "更新作业状态失败。");
    } finally {
      setAssignmentActionId(null);
    }
  }

  function updateFeedbackDraft(submission: AdminWritingAssignmentSubmission, patch: Partial<FeedbackDraft>) {
    setFeedbackDrafts((current) => ({
      ...current,
      [submission.id]: {
        ...(current[submission.id] ?? createFeedbackDraft(submission)),
        ...patch
      }
    }));
  }

  function updateScoreDimension(
    submission: AdminWritingAssignmentSubmission,
    dimension: FeedbackDimensionKey,
    patch: Partial<FeedbackDraft["scoreBreakdown"][FeedbackDimensionKey]>
  ) {
    const draft = feedbackDrafts[submission.id] ?? createFeedbackDraft(submission);
    updateFeedbackDraft(submission, {
      scoreBreakdown: {
        ...draft.scoreBreakdown,
        [dimension]: {
          ...draft.scoreBreakdown[dimension],
          ...patch
        }
      }
    });
  }

  function appendQuickFeedback(submission: AdminWritingAssignmentSubmission, text: string) {
    const draft = feedbackDrafts[submission.id] ?? createFeedbackDraft(submission);
    updateFeedbackDraft(submission, {
      feedback: draft.feedback ? `${draft.feedback}\n${text}` : text
    });
  }

  function addFeedbackItem(submission: AdminWritingAssignmentSubmission) {
    const draft = feedbackDrafts[submission.id] ?? createFeedbackDraft(submission);
    updateFeedbackDraft(submission, {
      feedbackItems: [
        ...draft.feedbackItems,
        {
          id: `manual-${Date.now()}`,
          quote: "",
          category: "other",
          comment: "",
          suggestion: "",
          ruleReference: null
        }
      ]
    });
  }

  function updateFeedbackItem(
    submission: AdminWritingAssignmentSubmission,
    itemId: string,
    patch: Partial<AssignmentFeedbackItem>
  ) {
    const draft = feedbackDrafts[submission.id] ?? createFeedbackDraft(submission);
    updateFeedbackDraft(submission, {
      feedbackItems: draft.feedbackItems.map((item) => (item.id === itemId ? { ...item, ...patch } : item))
    });
  }

  function removeFeedbackItem(submission: AdminWritingAssignmentSubmission, itemId: string) {
    const draft = feedbackDrafts[submission.id] ?? createFeedbackDraft(submission);
    updateFeedbackDraft(submission, {
      feedbackItems: draft.feedbackItems.filter((item) => item.id !== itemId)
    });
  }

  return (
    <main className={styles.page}>
      <section className={styles.header}>
        <div>
          <p className={styles.eyebrow}>教学工作台</p>
          <h1>作文作业</h1>
          <p>给学生布置 Task 1 / Task 2 作文，查看提交，并写入老师反馈。</p>
        </div>
        <ActionButton onClick={loadAssignments} disabled={loading}>
          刷新
        </ActionButton>
      </section>

      {error ? <p className={styles.error}>{error}</p> : null}

      <form className={styles.form} onSubmit={handleCreateAssignment}>
        <div className={styles.formHeader}>
          <div>
            <h2>{editingAssignmentId ? "编辑作业" : "新建作业"}</h2>
            {editingAssignmentId ? <p className={styles.formNote}>编辑不会变更已指派学生；如需调整学生名单，建议复制作业后重新发布。</p> : null}
          </div>
          <div className={styles.formActions}>
            {editingAssignmentId ? (
              <ActionButton onClick={cancelEditAssignment} disabled={saving}>
                取消编辑
              </ActionButton>
            ) : null}
            <ActionButton type="submit" variant="primary" disabled={saving}>
              {saving ? (editingAssignmentId ? "保存中..." : "发布中...") : editingAssignmentId ? "保存修改" : "发布作业"}
            </ActionButton>
          </div>
        </div>

        <div className={styles.grid}>
          <label>
            <span>标题</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：观点类 Task 2 练习" />
          </label>
          <label>
            <span>类型</span>
            <select value={taskType} onChange={(event) => setTaskType(event.target.value as TaskType)}>
              <option value="task1">Task 1</option>
              <option value="task2">Task 2</option>
            </select>
          </label>
          <label>
            <span>截止时间</span>
            <input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
          </label>
        </div>

        <div className={styles.policyBox}>
          <label>
            <input
              type="checkbox"
              checked={allowLateSubmission}
              onChange={(event) => setAllowLateSubmission(event.target.checked)}
            />
            <span>允许截止后补交</span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={allowResubmission}
              onChange={(event) => setAllowResubmission(event.target.checked)}
            />
            <span>允许学生重复提交/修改提交</span>
          </label>
          <label>
            <span>最终补交截止时间（可选）</span>
            <input
              type="datetime-local"
              value={lateDueAt}
              onChange={(event) => setLateDueAt(event.target.value)}
              disabled={!allowLateSubmission}
            />
          </label>
        </div>

        <label>
          <span>题目</span>
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={5} placeholder="粘贴作文题目" />
        </label>
        <label>
          <span>作业说明（可选）</span>
          <textarea
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            rows={3}
            placeholder="例如：按课堂框架完成，注意让步段"
          />
        </label>

        {!editingAssignmentId ? (
          <>
            <div className={styles.studentPicker}>
              <label>
                <span>按邮箱指派学生</span>
                <input
                  value={studentQuery}
                  onChange={(event) => setStudentQuery(event.target.value)}
                  placeholder="输入学生邮箱搜索"
                />
              </label>
              {studentQuery.trim().length >= 2 ? (
                <div className={styles.searchResults}>
                  {searchingStudents ? <p>搜索中...</p> : null}
                  {!searchingStudents && studentResults.length === 0 ? <p>没有匹配学生</p> : null}
                  {studentResults.map((student) => (
                    <button key={student.id} type="button" onClick={() => addStudent(student)}>
                      {studentLabel(student)}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className={styles.selectedStudents}>
                {selectedStudents.map((student) => (
                  <span key={student.id}>
                    {studentLabel(student)}
                    <button type="button" onClick={() => removeStudent(student.id)} aria-label={`移除 ${studentLabel(student)}`}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className={styles.classSelector}>
              <span>按班级/分组指派</span>
              {classes.length === 0 ? <p>暂无分组，可在下方先创建。</p> : null}
              <div className={styles.classOptions}>
                {classes.map((item) => (
                  <label key={item.id}>
                    <input
                      type="checkbox"
                      checked={selectedClassIds.includes(item.id)}
                      onChange={(event) =>
                        setSelectedClassIds((current) =>
                          event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id)
                        )
                      }
                    />
                    <span>
                      {item.name} · {item.studentCount} 人
                    </span>
                  </label>
                ))}
              </div>
              <p>本次将指派给 {assignmentStudentIds.length} 名学生。</p>
            </div>
          </>
        ) : null}

        {taskType === "task1" ? (
          <div className={styles.imageUploadBox}>
            <label>
              <span>Task 1 图片</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => handleImageChange(event.target.files?.[0] ?? null)}
                disabled={uploadingImage}
              />
            </label>
            <p>{uploadingImage ? "上传中..." : assignmentImage ? `已上传：${assignmentImage.name}` : "可上传 JPG / PNG / WebP，最大 8MB。"}</p>
          </div>
        ) : null}
      </form>

      <form className={styles.form} onSubmit={handleCreateClass}>
        <div className={styles.formHeader}>
          <h2>班级/学生分组</h2>
          <ActionButton type="submit" variant="primary" disabled={savingClass}>
            {savingClass ? "创建中..." : "创建分组"}
          </ActionButton>
        </div>
        <label>
          <span>分组名称</span>
          <input value={className} onChange={(event) => setClassName(event.target.value)} placeholder="例如：强化班 A 组" />
        </label>
        <div className={styles.studentPicker}>
          <label>
            <span>添加学生</span>
            <input
              value={classStudentQuery}
              onChange={(event) => setClassStudentQuery(event.target.value)}
              placeholder="输入学生邮箱搜索"
            />
          </label>
          {classStudentQuery.trim().length >= 2 ? (
            <div className={styles.searchResults}>
              {classStudentResults.length === 0 ? <p>没有匹配学生</p> : null}
              {classStudentResults.map((student) => (
                <button key={student.id} type="button" onClick={() => addClassStudent(student)}>
                  {studentLabel(student)}
                </button>
              ))}
            </div>
          ) : null}
          <div className={styles.selectedStudents}>
            {classStudents.map((student) => (
              <span key={student.id}>
                {studentLabel(student)}
                <button type="button" onClick={() => removeClassStudent(student.id)} aria-label={`移除 ${studentLabel(student)}`}>
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
        <div className={styles.classList}>
          {classes.map((item) => (
            <article key={item.id}>
              <strong>{item.name}</strong>
              <span>{item.studentCount} 人</span>
            </article>
          ))}
        </div>
      </form>

      <section className={styles.assignmentList}>
        <div className={styles.listHeader}>
          <h2>已发布作业</h2>
          <div className={styles.filterGroup}>
            {([
              ["all", "全部"],
              ["pending_feedback", "待反馈"],
              ["unsubmitted", "未提交"],
              ["reviewed", "已完成反馈"],
              ["closed", "已关闭"]
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={assignmentFilter === value ? styles.filterButtonActive : styles.filterButton}
                onClick={() => setAssignmentFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {loading ? <p className={styles.empty}>加载中...</p> : null}
        {!loading && items.length === 0 ? <p className={styles.empty}>暂无作业。</p> : null}
        {!loading && items.length > 0 && filteredAssignments.length === 0 ? <p className={styles.empty}>当前筛选下暂无作业。</p> : null}
        {filteredAssignments.map((assignment) => {
          const submittedStudentIds = new Set(assignment.submissions.map((submission) => submission.studentId));
          const unsubmittedStudents = assignment.recipients.filter((student) => !submittedStudentIds.has(student.id));

          return (
          <article key={assignment.id} className={styles.assignmentCard}>
            <div className={styles.assignmentTop}>
              <div>
                <p className={styles.meta}>
                  {assignment.taskType.toUpperCase()} · {formatDate(assignment.dueAt)} ·{" "}
                  {assignment.allowLateSubmission ? `允许补交${assignment.lateDueAt ? `至 ${formatDate(assignment.lateDueAt)}` : ""}` : "截止后锁定"} ·{" "}
                  {assignment.allowResubmission ? "可重复提交" : "不可重复提交"} ·{" "}
                  {assignment.status === "closed" ? "已关闭" : "进行中"}
                </p>
                <h3>{assignment.title}</h3>
              </div>
              <div className={styles.stats}>
                <span>{assignment.recipientCount} 人</span>
                <span>{assignment.submittedCount} 已交</span>
                <span>{assignment.reviewedCount} 已反馈</span>
              </div>
            </div>
            <div className={styles.assignmentActions}>
              <ActionButton onClick={() => beginEditAssignment(assignment)} disabled={assignmentActionId === assignment.id}>
                编辑
              </ActionButton>
              <ActionButton
                onClick={() => handleAssignmentAction(assignment, assignment.status === "closed" ? "reopen" : "close")}
                disabled={assignmentActionId === assignment.id}
              >
                {assignment.status === "closed" ? "重新开放" : "关闭作业"}
              </ActionButton>
              <ActionButton
                onClick={() => handleAssignmentAction(assignment, "duplicate")}
                disabled={assignmentActionId === assignment.id}
              >
                复制作业
              </ActionButton>
              {assignment.submittedCount === 0 ? (
                <ActionButton
                  onClick={() => handleAssignmentAction(assignment, "delete")}
                  disabled={assignmentActionId === assignment.id}
                >
                  删除
                </ActionButton>
              ) : null}
            </div>
            <p className={styles.prompt}>{assignment.prompt}</p>
            {assignment.image ? (
              <div className={styles.assignmentImagePreview}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={assignment.image.url} alt={assignment.image.name} />
              </div>
            ) : null}
            {assignment.instructions ? <p className={styles.instructions}>{assignment.instructions}</p> : null}
            <div className={styles.recipients}>
              {assignment.recipients.map((student) => (
                <span key={student.id}>{studentLabel(student)}</span>
              ))}
            </div>
            {unsubmittedStudents.length > 0 ? (
              <div className={styles.unsubmittedBox}>
                <strong>未提交学生</strong>
                <div>
                  {unsubmittedStudents.map((student) => (
                    <span key={student.id}>{studentLabel(student)}</span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className={styles.submissions}>
              {assignment.submissions.length === 0 ? <p className={styles.empty}>还没有学生提交。</p> : null}
              {assignment.submissions.map((submission) => {
                const draft = feedbackDrafts[submission.id] ?? createFeedbackDraft(submission);

                return (
                  <section key={submission.id} className={styles.submissionCard}>
                    <div className={styles.submissionHeader}>
                      <strong>{submission.studentEmail || submission.studentName || submission.studentId}</strong>
                      <span>{statusLabel(submission)}</span>
                      {submission.isLate ? <span className={styles.lateBadge}>补交</span> : null}
                    </div>
                    <p className={styles.submittedAt}>提交时间：{formatDate(submission.submittedAt)}</p>
                    <pre className={styles.essay}>{submission.essay}</pre>

                    <div className={styles.gradingPanel}>
                      <div className={styles.gradingHeader}>
                        <div>
                          <strong>批改工作台</strong>
                          <p>按 IELTS 四项维度给分，并对具体句子/段落写入批注。</p>
                        </div>
                        <label className={styles.rewriteToggle}>
                          <input
                            type="checkbox"
                            checked={draft.rewriteRequired}
                            onChange={(event) => updateFeedbackDraft(submission, { rewriteRequired: event.target.checked })}
                          />
                          <span>要求学生重写/二次提交</span>
                        </label>
                      </div>

                      <div className={styles.bandGrid}>
                        {FEEDBACK_DIMENSIONS.map((dimension) => (
                          <section key={dimension.key} className={styles.bandCard}>
                            <label>
                              <span>{dimension.label} 分数</span>
                              <input
                                value={draft.scoreBreakdown[dimension.key].score}
                                onChange={(event) => updateScoreDimension(submission, dimension.key, { score: event.target.value })}
                                placeholder="0-9"
                              />
                            </label>
                            <label>
                              <span>{dimension.label} 说明</span>
                              <textarea
                                value={draft.scoreBreakdown[dimension.key].comment}
                                onChange={(event) => updateScoreDimension(submission, dimension.key, { comment: event.target.value })}
                                rows={2}
                                placeholder="说明该维度的主要问题或优点"
                              />
                            </label>
                          </section>
                        ))}
                      </div>

                      <div className={styles.annotationBlock}>
                        <div className={styles.annotationHeader}>
                          <strong>句子/段落批注</strong>
                          <ActionButton onClick={() => addFeedbackItem(submission)}>添加批注</ActionButton>
                        </div>
                        {draft.feedbackItems.length === 0 ? <p className={styles.empty}>暂无逐条批注。</p> : null}
                        {draft.feedbackItems.map((item) => (
                          <div key={item.id} className={styles.annotationItem}>
                            <label>
                              <span>原文片段</span>
                              <textarea
                                value={item.quote}
                                onChange={(event) => updateFeedbackItem(submission, item.id, { quote: event.target.value })}
                                rows={2}
                                placeholder="粘贴需要点评的句子或段落"
                              />
                            </label>
                            <label>
                              <span>问题类型</span>
                              <select
                                value={item.category}
                                onChange={(event) =>
                                  updateFeedbackItem(submission, item.id, {
                                    category: event.target.value as AssignmentFeedbackItem["category"]
                                  })
                                }
                              >
                                <option value="task_response">审题/回应</option>
                                <option value="coherence">逻辑/衔接</option>
                                <option value="lexical">词汇</option>
                                <option value="grammar">语法</option>
                                <option value="other">其他</option>
                              </select>
                            </label>
                            <label>
                              <span>批注</span>
                              <textarea
                                value={item.comment}
                                onChange={(event) => updateFeedbackItem(submission, item.id, { comment: event.target.value })}
                                rows={2}
                                placeholder="指出问题或亮点"
                              />
                            </label>
                            <label>
                              <span>修改建议</span>
                              <textarea
                                value={item.suggestion}
                                onChange={(event) => updateFeedbackItem(submission, item.id, { suggestion: event.target.value })}
                                rows={2}
                                placeholder="给出可执行的修改建议"
                              />
                            </label>
                            <ActionButton onClick={() => removeFeedbackItem(submission, item.id)}>删除批注</ActionButton>
                          </div>
                        ))}
                      </div>

                      <div className={styles.quickFeedback}>
                        <span>快捷评语</span>
                        <div>
                          {QUICK_FEEDBACK.map((text) => (
                            <button key={text} type="button" onClick={() => appendQuickFeedback(submission, text)}>
                              {text}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className={styles.feedbackGrid}>
                      <label>
                        <span>总分（可选）</span>
                        <input
                          value={draft.score}
                          onChange={(event) => updateFeedbackDraft(submission, { score: event.target.value })}
                          placeholder="例如 6.5"
                        />
                      </label>
                      <label>
                        <span>老师反馈</span>
                        <textarea
                          value={draft.feedback}
                          onChange={(event) => updateFeedbackDraft(submission, { feedback: event.target.value })}
                          rows={4}
                          placeholder="写给学生的反馈"
                        />
                      </label>
                      </div>
                    </div>

                    <ActionButton
                      variant="primary"
                      onClick={() => handleSaveFeedback(submission.id)}
                      disabled={feedbackSavingId === submission.id}
                    >
                      {feedbackSavingId === submission.id ? "保存中..." : "保存反馈"}
                    </ActionButton>
                  </section>
                );
              })}
            </div>
          </article>
          );
        })}
      </section>
    </main>
  );
}
