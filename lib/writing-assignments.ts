import { randomUUID } from "node:crypto";
import { db, ensureDatabase } from "./db";
import { getReviewImageObject } from "./object-storage";
import type {
  AssignmentFeedbackItem,
  AssignmentScoreBreakdown,
  AdminWritingAssignment,
  AdminWritingAssignmentSubmission,
  StudentWritingAssignment,
  TaskType,
  WritingAssignmentStudent,
  WritingClass
} from "./types";

const MAX_TITLE_LENGTH = 160;
const MAX_PROMPT_LENGTH = 10_000;
const MAX_INSTRUCTIONS_LENGTH = 4_000;
const MAX_ESSAY_LENGTH = 20_000;
const MAX_FEEDBACK_LENGTH = 8_000;
const MAX_FEEDBACK_ITEM_LENGTH = 1_500;
const MAX_FEEDBACK_ITEMS = 20;

type UserColumnRow = {
  column_name: string;
};

type UserRow = {
  id: string;
  email: string | null;
  name?: string | null;
  display_name?: string | null;
};

type AssignmentRow = {
  id: string;
  teacher_admin_user_id: string;
  title: string;
  task_type: TaskType;
  prompt_text: string;
  instructions: string;
  image_object_key: string | null;
  image_name: string | null;
  image_mime_type: string | null;
  image_size_bytes: number | string | null;
  due_at: Date | string | null;
  late_due_at: Date | string | null;
  allow_late_submission: boolean;
  allow_resubmission: boolean;
  status: "assigned" | "closed";
  created_at: Date | string;
  updated_at: Date | string;
};

type ClassRow = {
  id: string;
  teacher_admin_user_id: string;
  name: string;
  created_at: Date | string;
  updated_at: Date | string;
};

type SubmissionRow = {
  id: string;
  assignment_id: string;
  student_user_id: string;
  essay_text: string;
  status: "submitted" | "reviewed";
  teacher_feedback: string | null;
  teacher_score: number | string | null;
  teacher_feedback_items: unknown;
  teacher_score_breakdown: unknown;
  rewrite_required: boolean;
  is_late: boolean;
  submitted_at: Date | string;
  late_submitted_at: Date | string | null;
  reviewed_at: Date | string | null;
  updated_at: Date | string;
};

type StudentAssignmentRow = AssignmentRow & {
  submission_id: string | null;
  essay_text: string | null;
  submission_status: "submitted" | "reviewed" | null;
  teacher_feedback: string | null;
  teacher_score: number | string | null;
  teacher_feedback_items: unknown;
  teacher_score_breakdown: unknown;
  rewrite_required: boolean | null;
  is_late: boolean | null;
  submitted_at: Date | string | null;
  late_submitted_at: Date | string | null;
  reviewed_at: Date | string | null;
};

function quoteIdentifier(value: string) {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function normalizeText(value: unknown, field: string, options: { maxLength: number; required?: boolean }) {
  if (typeof value !== "string") {
    throw new Error(`INVALID_${field}`);
  }

  const trimmed = value.trim();
  if (options.required !== false && !trimmed) {
    throw new Error(`INVALID_${field}`);
  }
  if (trimmed.length > options.maxLength) {
    throw new Error(`INVALID_${field}`);
  }

  return trimmed;
}

function normalizeTaskType(value: unknown): TaskType {
  if (value !== "task1" && value !== "task2") {
    throw new Error("INVALID_TASK_TYPE");
  }
  return value;
}

function normalizeDueAt(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error("INVALID_DUE_AT");
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("INVALID_DUE_AT");
  }
  return parsed.toISOString();
}

function normalizeScore(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const score = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(score) || score < 0 || score > 9) {
    throw new Error("INVALID_TEACHER_SCORE");
  }
  return Math.round(score * 10) / 10;
}

const SCORE_DIMENSIONS = [
  "taskAchievement",
  "coherenceAndCohesion",
  "lexicalResource",
  "grammaticalRangeAndAccuracy"
] as const;

const DEFAULT_SCORE_BREAKDOWN: AssignmentScoreBreakdown = {
  taskAchievement: { score: null, comment: "" },
  coherenceAndCohesion: { score: null, comment: "" },
  lexicalResource: { score: null, comment: "" },
  grammaticalRangeAndAccuracy: { score: null, comment: "" }
};

function normalizeBoolean(value: unknown, defaultValue: boolean) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  if (typeof value !== "boolean") {
    throw new Error("INVALID_BOOLEAN");
  }
  return value;
}

function normalizeScoreBreakdown(value: unknown): AssignmentScoreBreakdown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_SCORE_BREAKDOWN;
  }

  const source = value as Record<string, unknown>;
  return SCORE_DIMENSIONS.reduce((breakdown, dimension) => {
    const entry = source[dimension];
    const objectEntry = entry && typeof entry === "object" && !Array.isArray(entry) ? (entry as Record<string, unknown>) : {};
    const commentValue = objectEntry.comment;
    const comment =
      typeof commentValue === "string"
        ? normalizeText(commentValue, "SCORE_COMMENT", { maxLength: MAX_FEEDBACK_ITEM_LENGTH, required: false })
        : "";

    return {
      ...breakdown,
      [dimension]: {
        score: normalizeScore(objectEntry.score),
        comment
      }
    };
  }, DEFAULT_SCORE_BREAKDOWN);
}

function normalizeFeedbackItems(value: unknown): AssignmentFeedbackItem[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value) || value.length > MAX_FEEDBACK_ITEMS) {
    throw new Error("INVALID_FEEDBACK_ITEMS");
  }

  return value
    .map((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new Error("INVALID_FEEDBACK_ITEMS");
      }
      const source = item as Record<string, unknown>;
      const category =
        source.category === "task_response" ||
        source.category === "coherence" ||
        source.category === "lexical" ||
        source.category === "grammar" ||
        source.category === "other"
          ? source.category
          : "other";
      const quote =
        typeof source.quote === "string"
          ? normalizeText(source.quote, "FEEDBACK_QUOTE", { maxLength: MAX_FEEDBACK_ITEM_LENGTH, required: false })
          : "";
      const comment =
        typeof source.comment === "string"
          ? normalizeText(source.comment, "FEEDBACK_ITEM_COMMENT", {
              maxLength: MAX_FEEDBACK_ITEM_LENGTH,
              required: false
            })
          : "";
      const suggestion =
        typeof source.suggestion === "string"
          ? normalizeText(source.suggestion, "FEEDBACK_SUGGESTION", {
              maxLength: MAX_FEEDBACK_ITEM_LENGTH,
              required: false
            })
          : "";

      return {
        id: typeof source.id === "string" && source.id.trim() ? source.id.trim().slice(0, 80) : `feedback-${index + 1}`,
        quote,
        category,
        comment,
        suggestion,
        ruleReference: null
      } satisfies AssignmentFeedbackItem;
    })
    .filter((item) => item.quote || item.comment || item.suggestion);
}

function normalizeOptionalImage(input: {
  objectKey?: unknown;
  name?: unknown;
  mimeType?: unknown;
  sizeBytes?: unknown;
}) {
  if (!input.objectKey && !input.name && !input.mimeType && !input.sizeBytes) {
    return {
      objectKey: null,
      name: null,
      mimeType: null,
      sizeBytes: null
    };
  }

  if (typeof input.objectKey !== "string" || input.objectKey.length < 1 || input.objectKey.length > 512) {
    throw new Error("INVALID_ASSIGNMENT_IMAGE");
  }
  if (typeof input.name !== "string" || input.name.length < 1 || input.name.length > 180) {
    throw new Error("INVALID_ASSIGNMENT_IMAGE");
  }
  if (typeof input.mimeType !== "string" || input.mimeType.length < 1 || input.mimeType.length > 80) {
    throw new Error("INVALID_ASSIGNMENT_IMAGE");
  }
  const sizeBytes = input.sizeBytes === undefined || input.sizeBytes === null ? null : Number(input.sizeBytes);
  if (sizeBytes !== null && (!Number.isInteger(sizeBytes) || sizeBytes <= 0)) {
    throw new Error("INVALID_ASSIGNMENT_IMAGE");
  }

  return {
    objectKey: input.objectKey,
    name: input.name,
    mimeType: input.mimeType,
    sizeBytes
  };
}

async function getUserTableColumns() {
  await ensureDatabase();

  const result = await db.query<UserColumnRow>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'user'`
  );

  return new Set(result.rows.map((row) => row.column_name));
}

async function loadUsersByIds(userIds: string[]) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (!uniqueIds.length) {
    return new Map<string, WritingAssignmentStudent>();
  }

  const columns = await getUserTableColumns();
  if (!columns.has("id") || !columns.has("email")) {
    return new Map<string, WritingAssignmentStudent>();
  }

  const nameColumn = columns.has("name") ? "name" : columns.has("display_name") ? "display_name" : null;
  const selectColumns = [
    `${quoteIdentifier("id")} AS id`,
    `${quoteIdentifier("email")} AS email`,
    nameColumn ? `${quoteIdentifier(nameColumn)} AS ${quoteIdentifier(nameColumn)}` : `NULL::TEXT AS name`
  ];

  const result = await db.query<UserRow>(
    `SELECT ${selectColumns.join(", ")}
     FROM ${quoteIdentifier("user")}
     WHERE ${quoteIdentifier("id")} = ANY($1)
     LIMIT $2`,
    [uniqueIds, uniqueIds.length]
  );

  return new Map(
    result.rows.map((row) => [
      row.id,
      {
        id: row.id,
        email: row.email,
        name: row.name ?? row.display_name ?? null
      } satisfies WritingAssignmentStudent
    ])
  );
}

function mapIso(value: Date | string | null) {
  return value ? new Date(value).toISOString() : null;
}

function parseFeedbackItems(value: unknown): AssignmentFeedbackItem[] {
  try {
    return normalizeFeedbackItems(value);
  } catch {
    return [];
  }
}

function parseScoreBreakdown(value: unknown): AssignmentScoreBreakdown {
  try {
    return normalizeScoreBreakdown(value);
  } catch {
    return DEFAULT_SCORE_BREAKDOWN;
  }
}

function mapSubmission(row: SubmissionRow, users: Map<string, WritingAssignmentStudent>): AdminWritingAssignmentSubmission {
  const student = users.get(row.student_user_id);

  return {
    id: row.id,
    assignmentId: row.assignment_id,
    studentId: row.student_user_id,
    studentEmail: student?.email ?? null,
    studentName: student?.name ?? null,
    essay: row.essay_text,
    status: row.status,
    teacherFeedback: row.teacher_feedback,
    teacherScore: row.teacher_score === null ? null : Number(row.teacher_score),
    teacherFeedbackItems: parseFeedbackItems(row.teacher_feedback_items),
    teacherScoreBreakdown: parseScoreBreakdown(row.teacher_score_breakdown),
    rewriteRequired: row.rewrite_required,
    isLate: row.is_late,
    submittedAt: new Date(row.submitted_at).toISOString(),
    lateSubmittedAt: mapIso(row.late_submitted_at),
    reviewedAt: mapIso(row.reviewed_at),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

function mapAssignmentImage(row: Pick<AssignmentRow, "id" | "image_object_key" | "image_name" | "image_mime_type">) {
  return row.image_object_key && row.image_name && row.image_mime_type
    ? {
        name: row.image_name,
        mimeType: row.image_mime_type,
        url: `/api/assignments/${encodeURIComponent(row.id)}/image`
      }
    : null;
}

function getSubmissionBlockReason(row: Pick<StudentAssignmentRow, "status" | "due_at" | "late_due_at" | "allow_late_submission" | "allow_resubmission" | "submission_id" | "rewrite_required">) {
  if (row.status === "closed") {
    return "closed" as const;
  }

  const now = Date.now();
  const dueAt = row.due_at ? new Date(row.due_at).getTime() : null;
  const lateDueAt = row.late_due_at ? new Date(row.late_due_at).getTime() : null;
  const deadlinePassed =
    dueAt !== null &&
    now > dueAt &&
    (!row.allow_late_submission || (lateDueAt !== null && now > lateDueAt));
  if (deadlinePassed) {
    return "deadline_passed" as const;
  }

  if (row.submission_id && !row.allow_resubmission && !row.rewrite_required) {
    return "resubmission_not_allowed" as const;
  }

  return null;
}

function mapStudentAssignment(row: StudentAssignmentRow): StudentWritingAssignment {
  const blockReason = getSubmissionBlockReason(row);

  return {
    id: row.id,
    title: row.title,
    taskType: row.task_type,
    prompt: row.prompt_text,
    instructions: row.instructions,
    image: mapAssignmentImage(row),
    dueAt: mapIso(row.due_at),
    lateDueAt: mapIso(row.late_due_at),
    allowLateSubmission: row.allow_late_submission,
    allowResubmission: row.allow_resubmission,
    status: row.status,
    submissionStatus: row.submission_status ?? "not_submitted",
    essay: row.essay_text,
    teacherFeedback: row.teacher_feedback,
    teacherScore: row.teacher_score === null ? null : Number(row.teacher_score),
    teacherFeedbackItems: parseFeedbackItems(row.teacher_feedback_items),
    teacherScoreBreakdown: parseScoreBreakdown(row.teacher_score_breakdown),
    rewriteRequired: Boolean(row.rewrite_required),
    isLate: Boolean(row.is_late),
    canSubmit: blockReason === null,
    submitBlockReason: blockReason,
    submittedAt: mapIso(row.submitted_at),
    lateSubmittedAt: mapIso(row.late_submitted_at),
    reviewedAt: mapIso(row.reviewed_at),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

export async function createAdminWritingAssignment(input: {
  teacherAdminUserId: string;
  title: unknown;
  taskType: unknown;
  prompt: unknown;
  instructions?: unknown;
  dueAt?: unknown;
  lateDueAt?: unknown;
  allowLateSubmission?: unknown;
  allowResubmission?: unknown;
  studentIds: unknown;
  taskImageObjectKey?: unknown;
  taskImageName?: unknown;
  taskImageMimeType?: unknown;
  taskImageSizeBytes?: unknown;
}) {
  await ensureDatabase();

  const title = normalizeText(input.title, "TITLE", { maxLength: MAX_TITLE_LENGTH });
  const taskType = normalizeTaskType(input.taskType);
  const prompt = normalizeText(input.prompt, "PROMPT", { maxLength: MAX_PROMPT_LENGTH });
  const instructions =
    input.instructions === undefined
      ? ""
      : normalizeText(input.instructions, "INSTRUCTIONS", { maxLength: MAX_INSTRUCTIONS_LENGTH, required: false });
  const dueAt = normalizeDueAt(input.dueAt);
  const lateDueAt = normalizeDueAt(input.lateDueAt);
  const allowLateSubmission = normalizeBoolean(input.allowLateSubmission, false);
  const allowResubmission = normalizeBoolean(input.allowResubmission, true);
  const image = normalizeOptionalImage({
    objectKey: input.taskImageObjectKey,
    name: input.taskImageName,
    mimeType: input.taskImageMimeType,
    sizeBytes: input.taskImageSizeBytes
  });

  if (!Array.isArray(input.studentIds)) {
    throw new Error("INVALID_STUDENTS");
  }
  const studentIds = [
    ...new Set(input.studentIds.filter((item): item is string => typeof item === "string" && item.trim().length > 0))
  ].map((item) => item.trim());
  if (!studentIds.length || studentIds.length > 200) {
    throw new Error("INVALID_STUDENTS");
  }

  const users = await loadUsersByIds(studentIds);
  if (users.size !== studentIds.length) {
    throw new Error("INVALID_STUDENTS");
  }

  const assignmentId = randomUUID();
  const now = new Date().toISOString();
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO writing_assignments (
        id, teacher_admin_user_id, title, task_type, prompt_text, instructions,
        image_object_key, image_name, image_mime_type, image_size_bytes,
        due_at, late_due_at, allow_late_submission, allow_resubmission,
        status, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'assigned', $15, $16)`,
      [
        assignmentId,
        input.teacherAdminUserId,
        title,
        taskType,
        prompt,
        instructions,
        image.objectKey,
        image.name,
        image.mimeType,
        image.sizeBytes,
        dueAt,
        lateDueAt,
        allowLateSubmission,
        allowResubmission,
        now,
        now
      ]
    );
    for (const studentId of studentIds) {
      await client.query(
        `INSERT INTO assignment_recipients (assignment_id, student_user_id, assigned_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (assignment_id, student_user_id) DO NOTHING`,
        [assignmentId, studentId, now]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return { assignmentId };
}

export async function listAdminWritingAssignments(teacherAdminUserId: string) {
  await ensureDatabase();

  const assignmentsResult = await db.query<AssignmentRow>(
    `SELECT id, teacher_admin_user_id, title, task_type, prompt_text, instructions,
            image_object_key, image_name, image_mime_type, image_size_bytes,
            due_at, late_due_at, allow_late_submission, allow_resubmission,
            status, created_at, updated_at
     FROM writing_assignments
     WHERE teacher_admin_user_id = $1
     ORDER BY created_at DESC
     LIMIT 80`,
    [teacherAdminUserId]
  );
  const assignmentIds = assignmentsResult.rows.map((row) => row.id);
  if (!assignmentIds.length) {
    return [] as AdminWritingAssignment[];
  }

  const recipientsResult = await db.query<{ assignment_id: string; student_user_id: string }>(
    `SELECT assignment_id, student_user_id
     FROM assignment_recipients
     WHERE assignment_id = ANY($1)
     ORDER BY assigned_at ASC`,
    [assignmentIds]
  );
  const submissionsResult = await db.query<SubmissionRow>(
    `SELECT id, assignment_id, student_user_id, essay_text, status, teacher_feedback,
            teacher_score, teacher_feedback_items, teacher_score_breakdown,
            rewrite_required, is_late, submitted_at, late_submitted_at,
            reviewed_at, updated_at
     FROM assignment_submissions
     WHERE assignment_id = ANY($1)
     ORDER BY submitted_at DESC`,
    [assignmentIds]
  );
  const users = await loadUsersByIds([
    ...recipientsResult.rows.map((row) => row.student_user_id),
    ...submissionsResult.rows.map((row) => row.student_user_id)
  ]);
  const recipientsByAssignment = new Map<string, WritingAssignmentStudent[]>();
  const submissionsByAssignment = new Map<string, AdminWritingAssignmentSubmission[]>();

  for (const row of recipientsResult.rows) {
    const student = users.get(row.student_user_id) ?? { id: row.student_user_id, email: null, name: null };
    const list = recipientsByAssignment.get(row.assignment_id) ?? [];
    list.push(student);
    recipientsByAssignment.set(row.assignment_id, list);
  }

  for (const row of submissionsResult.rows) {
    const list = submissionsByAssignment.get(row.assignment_id) ?? [];
    list.push(mapSubmission(row, users));
    submissionsByAssignment.set(row.assignment_id, list);
  }

  return assignmentsResult.rows.map((row) => {
    const recipients = recipientsByAssignment.get(row.id) ?? [];
    const submissions = submissionsByAssignment.get(row.id) ?? [];

    return {
      id: row.id,
      teacherAdminUserId: row.teacher_admin_user_id,
      title: row.title,
      taskType: row.task_type,
      prompt: row.prompt_text,
      instructions: row.instructions,
      image: mapAssignmentImage(row),
      dueAt: mapIso(row.due_at),
      lateDueAt: mapIso(row.late_due_at),
      allowLateSubmission: row.allow_late_submission,
      allowResubmission: row.allow_resubmission,
      status: row.status,
      recipients,
      submissions,
      recipientCount: recipients.length,
      submittedCount: submissions.length,
      reviewedCount: submissions.filter((submission) => submission.status === "reviewed").length,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString()
    } satisfies AdminWritingAssignment;
  });
}

export async function updateAdminWritingAssignmentStatus(input: {
  adminUserId: string;
  assignmentId: unknown;
  status: unknown;
}) {
  await ensureDatabase();

  const assignmentId = normalizeText(input.assignmentId, "ASSIGNMENT_ID", { maxLength: 180 });
  if (input.status !== "assigned" && input.status !== "closed") {
    throw new Error("INVALID_ASSIGNMENT_STATUS");
  }

  const result = await db.query<{ id: string }>(
    `UPDATE writing_assignments
     SET status = $3, updated_at = NOW()
     WHERE id = $1 AND teacher_admin_user_id = $2
     RETURNING id`,
    [assignmentId, input.adminUserId, input.status]
  );

  if (!result.rows[0]) {
    throw new Error("ASSIGNMENT_NOT_FOUND");
  }

  return { assignmentId: result.rows[0].id };
}

export async function updateAdminWritingAssignment(input: {
  adminUserId: string;
  assignmentId: unknown;
  title: unknown;
  taskType: unknown;
  prompt: unknown;
  instructions?: unknown;
  dueAt?: unknown;
  lateDueAt?: unknown;
  allowLateSubmission?: unknown;
  allowResubmission?: unknown;
  taskImageObjectKey?: unknown;
  taskImageName?: unknown;
  taskImageMimeType?: unknown;
  taskImageSizeBytes?: unknown;
}) {
  await ensureDatabase();

  const assignmentId = normalizeText(input.assignmentId, "ASSIGNMENT_ID", { maxLength: 180 });
  const title = normalizeText(input.title, "TITLE", { maxLength: MAX_TITLE_LENGTH });
  const taskType = normalizeTaskType(input.taskType);
  const prompt = normalizeText(input.prompt, "PROMPT", { maxLength: MAX_PROMPT_LENGTH });
  const instructions =
    input.instructions === undefined
      ? ""
      : normalizeText(input.instructions, "INSTRUCTIONS", { maxLength: MAX_INSTRUCTIONS_LENGTH, required: false });
  const dueAt = normalizeDueAt(input.dueAt);
  const lateDueAt = normalizeDueAt(input.lateDueAt);
  const allowLateSubmission = normalizeBoolean(input.allowLateSubmission, false);
  const allowResubmission = normalizeBoolean(input.allowResubmission, true);
  const shouldUpdateImage = Boolean(
    input.taskImageObjectKey || input.taskImageName || input.taskImageMimeType || input.taskImageSizeBytes
  );
  const image = shouldUpdateImage
    ? normalizeOptionalImage({
        objectKey: input.taskImageObjectKey,
        name: input.taskImageName,
        mimeType: input.taskImageMimeType,
        sizeBytes: input.taskImageSizeBytes
      })
    : null;

  const result = await db.query<{ id: string }>(
    `UPDATE writing_assignments
     SET title = $3,
         task_type = $4,
         prompt_text = $5,
         instructions = $6,
         due_at = $7,
         late_due_at = $8,
         allow_late_submission = $9,
         allow_resubmission = $10,
         image_object_key = CASE WHEN $11::boolean THEN $12::text ELSE image_object_key END,
         image_name = CASE WHEN $11::boolean THEN $13::text ELSE image_name END,
         image_mime_type = CASE WHEN $11::boolean THEN $14::text ELSE image_mime_type END,
         image_size_bytes = CASE WHEN $11::boolean THEN $15::bigint ELSE image_size_bytes END,
         updated_at = NOW()
     WHERE id = $1 AND teacher_admin_user_id = $2
     RETURNING id`,
    [
      assignmentId,
      input.adminUserId,
      title,
      taskType,
      prompt,
      instructions,
      dueAt,
      lateDueAt,
      allowLateSubmission,
      allowResubmission,
      shouldUpdateImage,
      image?.objectKey ?? null,
      image?.name ?? null,
      image?.mimeType ?? null,
      image?.sizeBytes ?? null
    ]
  );

  if (!result.rows[0]) {
    throw new Error("ASSIGNMENT_NOT_FOUND");
  }

  return { assignmentId: result.rows[0].id };
}

export async function deleteAdminWritingAssignment(input: {
  adminUserId: string;
  assignmentId: unknown;
}) {
  await ensureDatabase();

  const assignmentId = normalizeText(input.assignmentId, "ASSIGNMENT_ID", { maxLength: 180 });
  const result = await db.query<{ id: string }>(
    `DELETE FROM writing_assignments a
     WHERE a.id = $1
       AND a.teacher_admin_user_id = $2
       AND NOT EXISTS (
         SELECT 1
         FROM assignment_submissions s
         WHERE s.assignment_id = a.id
       )
     RETURNING id`,
    [assignmentId, input.adminUserId]
  );

  if (!result.rows[0]) {
    throw new Error("ASSIGNMENT_NOT_DELETABLE");
  }

  return { assignmentId: result.rows[0].id };
}

export async function duplicateAdminWritingAssignment(input: {
  adminUserId: string;
  assignmentId: unknown;
}) {
  await ensureDatabase();

  const sourceAssignmentId = normalizeText(input.assignmentId, "ASSIGNMENT_ID", { maxLength: 180 });
  const newAssignmentId = randomUUID();
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const assignmentResult = await client.query<Pick<AssignmentRow, "id">>(
      `INSERT INTO writing_assignments (
        id, teacher_admin_user_id, title, task_type, prompt_text, instructions,
        image_object_key, image_name, image_mime_type, image_size_bytes,
        due_at, late_due_at, allow_late_submission, allow_resubmission,
        status, created_at, updated_at
      )
      SELECT
        $3,
        teacher_admin_user_id,
        title || ' Copy',
        task_type,
        prompt_text,
        instructions,
        image_object_key,
        image_name,
        image_mime_type,
        image_size_bytes,
        due_at,
        late_due_at,
        allow_late_submission,
        allow_resubmission,
        'assigned',
        NOW(),
        NOW()
      FROM writing_assignments
      WHERE id = $1 AND teacher_admin_user_id = $2
      RETURNING id`,
      [sourceAssignmentId, input.adminUserId, newAssignmentId]
    );

    if (!assignmentResult.rows[0]) {
      throw new Error("ASSIGNMENT_NOT_FOUND");
    }

    await client.query(
      `INSERT INTO assignment_recipients (assignment_id, student_user_id, assigned_at)
       SELECT $2, student_user_id, NOW()
       FROM assignment_recipients
       WHERE assignment_id = $1
       ON CONFLICT (assignment_id, student_user_id) DO NOTHING`,
      [sourceAssignmentId, newAssignmentId]
    );

    await client.query("COMMIT");
    return { assignmentId: newAssignmentId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function saveAssignmentFeedback(input: {
  adminUserId: string;
  submissionId: string;
  feedback: unknown;
  score?: unknown;
  feedbackItems?: unknown;
  scoreBreakdown?: unknown;
  rewriteRequired?: unknown;
}) {
  await ensureDatabase();

  const feedback = normalizeText(input.feedback, "FEEDBACK", { maxLength: MAX_FEEDBACK_LENGTH });
  const score = normalizeScore(input.score);
  const feedbackItems = normalizeFeedbackItems(input.feedbackItems);
  const scoreBreakdown = normalizeScoreBreakdown(input.scoreBreakdown);
  const rewriteRequired = normalizeBoolean(input.rewriteRequired, false);
  const result = await db.query<{ id: string }>(
    `UPDATE assignment_submissions
     SET status = 'reviewed',
         teacher_feedback = $2,
         teacher_score = $3,
         reviewed_by_admin_user_id = $4,
         teacher_feedback_items = $5::jsonb,
         teacher_score_breakdown = $6::jsonb,
         rewrite_required = $7,
         reviewed_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
       AND EXISTS (
         SELECT 1
         FROM writing_assignments a
         WHERE a.id = assignment_submissions.assignment_id
           AND a.teacher_admin_user_id = $4
       )
     RETURNING id`,
    [
      input.submissionId,
      feedback,
      score,
      input.adminUserId,
      JSON.stringify(feedbackItems),
      JSON.stringify(scoreBreakdown),
      rewriteRequired
    ]
  );

  if (!result.rows[0]) {
    throw new Error("SUBMISSION_NOT_FOUND");
  }

  return { submissionId: result.rows[0].id };
}

export async function listStudentWritingAssignments(userId: string) {
  await ensureDatabase();

  const result = await db.query<StudentAssignmentRow>(
    `SELECT a.id, a.teacher_admin_user_id, a.title, a.task_type, a.prompt_text, a.instructions,
            a.image_object_key, a.image_name, a.image_mime_type, a.image_size_bytes,
            a.due_at, a.late_due_at, a.allow_late_submission, a.allow_resubmission,
            a.status, a.created_at, a.updated_at,
            s.id AS submission_id,
            s.essay_text,
            s.status AS submission_status,
            s.teacher_feedback,
            s.teacher_score,
            s.teacher_feedback_items,
            s.teacher_score_breakdown,
            s.rewrite_required,
            s.is_late,
            s.submitted_at,
            s.late_submitted_at,
            s.reviewed_at
     FROM assignment_recipients r
     JOIN writing_assignments a ON a.id = r.assignment_id
     LEFT JOIN assignment_submissions s
       ON s.assignment_id = a.id AND s.student_user_id = r.student_user_id
     WHERE r.student_user_id = $1
     ORDER BY COALESCE(a.due_at, a.created_at) DESC, a.created_at DESC
     LIMIT 100`,
    [userId]
  );

  return result.rows.map(mapStudentAssignment) satisfies StudentWritingAssignment[];
}

export async function getStudentWritingAssignment(userId: string, assignmentId: string) {
  await ensureDatabase();

  const result = await db.query<StudentAssignmentRow>(
    `SELECT a.id, a.teacher_admin_user_id, a.title, a.task_type, a.prompt_text, a.instructions,
            a.image_object_key, a.image_name, a.image_mime_type, a.image_size_bytes,
            a.due_at, a.late_due_at, a.allow_late_submission, a.allow_resubmission,
            a.status, a.created_at, a.updated_at,
            s.id AS submission_id,
            s.essay_text,
            s.status AS submission_status,
            s.teacher_feedback,
            s.teacher_score,
            s.teacher_feedback_items,
            s.teacher_score_breakdown,
            s.rewrite_required,
            s.is_late,
            s.submitted_at,
            s.late_submitted_at,
            s.reviewed_at
     FROM assignment_recipients r
     JOIN writing_assignments a ON a.id = r.assignment_id
     LEFT JOIN assignment_submissions s
       ON s.assignment_id = a.id AND s.student_user_id = r.student_user_id
     WHERE r.student_user_id = $1 AND r.assignment_id = $2
     LIMIT 1`,
    [userId, assignmentId]
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return mapStudentAssignment(row) satisfies StudentWritingAssignment;
}

export async function submitStudentAssignment(input: { userId: string; assignmentId: string; essay: unknown }) {
  await ensureDatabase();

  const essay = normalizeText(input.essay, "ESSAY", { maxLength: MAX_ESSAY_LENGTH });
  const recipient = await db.query<{
    assignment_id: string;
    status: "assigned" | "closed";
    due_at: Date | string | null;
    late_due_at: Date | string | null;
    allow_late_submission: boolean;
    allow_resubmission: boolean;
    submission_id: string | null;
    rewrite_required: boolean | null;
  }>(
    `SELECT r.assignment_id, a.status, a.due_at, a.late_due_at,
            a.allow_late_submission, a.allow_resubmission,
            s.id AS submission_id, s.rewrite_required
     FROM assignment_recipients r
     JOIN writing_assignments a ON a.id = r.assignment_id
     LEFT JOIN assignment_submissions s
       ON s.assignment_id = r.assignment_id AND s.student_user_id = r.student_user_id
     WHERE r.assignment_id = $1 AND r.student_user_id = $2`,
    [input.assignmentId, input.userId]
  );

  const assignment = recipient.rows[0];
  if (!assignment) {
    throw new Error("ASSIGNMENT_NOT_FOUND");
  }
  if (assignment.status === "closed") {
    throw new Error("ASSIGNMENT_CLOSED");
  }
  if (assignment.submission_id && !assignment.allow_resubmission && !assignment.rewrite_required) {
    throw new Error("RESUBMISSION_NOT_ALLOWED");
  }

  const nowMs = Date.now();
  const dueAtMs = assignment.due_at ? new Date(assignment.due_at).getTime() : null;
  const lateDueAtMs = assignment.late_due_at ? new Date(assignment.late_due_at).getTime() : null;
  const isPastDue = dueAtMs !== null && nowMs > dueAtMs;
  const deadlinePassed =
    isPastDue && (!assignment.allow_late_submission || (lateDueAtMs !== null && nowMs > lateDueAtMs));
  if (deadlinePassed) {
    throw new Error("ASSIGNMENT_DEADLINE_PASSED");
  }

  const submissionId = randomUUID();
  const now = new Date().toISOString();
  const result = await db.query<{ id: string }>(
    `INSERT INTO assignment_submissions (
      id, assignment_id, student_user_id, essay_text, status, teacher_feedback,
      teacher_score, reviewed_by_admin_user_id, teacher_feedback_items, teacher_score_breakdown,
      rewrite_required, is_late, late_submitted_at, submitted_at, reviewed_at, updated_at
    )
    VALUES ($1, $2, $3, $4, 'submitted', NULL, NULL, NULL, '[]'::jsonb, '{}'::jsonb, FALSE, $5, $6, $7, NULL, $8)
    ON CONFLICT (assignment_id, student_user_id)
    DO UPDATE SET
      essay_text = EXCLUDED.essay_text,
      status = 'submitted',
      teacher_feedback = NULL,
      teacher_score = NULL,
      reviewed_by_admin_user_id = NULL,
      teacher_feedback_items = '[]'::jsonb,
      teacher_score_breakdown = '{}'::jsonb,
      rewrite_required = FALSE,
      is_late = EXCLUDED.is_late,
      late_submitted_at = EXCLUDED.late_submitted_at,
      submitted_at = EXCLUDED.submitted_at,
      reviewed_at = NULL,
      updated_at = EXCLUDED.updated_at
    RETURNING id`,
    [submissionId, input.assignmentId, input.userId, essay, isPastDue, isPastDue ? now : null, now, now]
  );

  return { submissionId: result.rows[0].id };
}

export async function getAssignmentImageForUser(input: { userId: string; assignmentId: string; allowAdmin?: boolean }) {
  await ensureDatabase();

  const result = input.allowAdmin
    ? await db.query<Pick<AssignmentRow, "image_object_key" | "image_mime_type">>(
        `SELECT image_object_key, image_mime_type
         FROM writing_assignments
         WHERE id = $1`,
        [input.assignmentId]
      )
    : await db.query<Pick<AssignmentRow, "image_object_key" | "image_mime_type">>(
        `SELECT a.image_object_key, a.image_mime_type
         FROM assignment_recipients r
         JOIN writing_assignments a ON a.id = r.assignment_id
         WHERE r.assignment_id = $1 AND r.student_user_id = $2`,
        [input.assignmentId, input.userId]
      );
  const row = result.rows[0];
  if (!row?.image_object_key || !row.image_mime_type) {
    return null;
  }

  const response = await getReviewImageObject(row.image_object_key);
  return {
    response,
    mimeType: row.image_mime_type
  };
}

export async function createWritingClass(input: {
  teacherAdminUserId: string;
  name: unknown;
  studentIds: unknown;
}) {
  await ensureDatabase();

  const name = normalizeText(input.name, "CLASS_NAME", { maxLength: 120 });
  if (!Array.isArray(input.studentIds)) {
    throw new Error("INVALID_STUDENTS");
  }
  const studentIds = [
    ...new Set(input.studentIds.filter((item): item is string => typeof item === "string" && item.trim().length > 0))
  ].map((item) => item.trim());
  if (!studentIds.length || studentIds.length > 300) {
    throw new Error("INVALID_STUDENTS");
  }

  const users = await loadUsersByIds(studentIds);
  if (users.size !== studentIds.length) {
    throw new Error("INVALID_STUDENTS");
  }

  const classId = randomUUID();
  const now = new Date().toISOString();
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO writing_classes (id, teacher_admin_user_id, name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [classId, input.teacherAdminUserId, name, now, now]
    );
    for (const studentId of studentIds) {
      await client.query(
        `INSERT INTO writing_class_students (class_id, student_user_id, added_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (class_id, student_user_id) DO NOTHING`,
        [classId, studentId, now]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return { classId };
}

export async function listWritingClasses(teacherAdminUserId: string) {
  await ensureDatabase();

  const classesResult = await db.query<ClassRow>(
    `SELECT id, teacher_admin_user_id, name, created_at, updated_at
     FROM writing_classes
     WHERE teacher_admin_user_id = $1
     ORDER BY updated_at DESC
     LIMIT 100`,
    [teacherAdminUserId]
  );
  const classIds = classesResult.rows.map((row) => row.id);
  if (!classIds.length) {
    return [] as WritingClass[];
  }

  const studentsResult = await db.query<{ class_id: string; student_user_id: string }>(
    `SELECT class_id, student_user_id
     FROM writing_class_students
     WHERE class_id = ANY($1)
     ORDER BY added_at ASC`,
    [classIds]
  );
  const users = await loadUsersByIds(studentsResult.rows.map((row) => row.student_user_id));
  const studentsByClass = new Map<string, WritingAssignmentStudent[]>();

  for (const row of studentsResult.rows) {
    const student = users.get(row.student_user_id) ?? { id: row.student_user_id, email: null, name: null };
    const list = studentsByClass.get(row.class_id) ?? [];
    list.push(student);
    studentsByClass.set(row.class_id, list);
  }

  return classesResult.rows.map((row) => {
    const students = studentsByClass.get(row.id) ?? [];
    return {
      id: row.id,
      name: row.name,
      students,
      studentCount: students.length,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString()
    } satisfies WritingClass;
  });
}
