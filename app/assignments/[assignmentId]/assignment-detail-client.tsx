"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppNavbar } from "@/components/app-navbar";
import { LoadingLottie } from "@/components/loading-lottie";
import { ActionButton, Pill, Surface } from "@/components/ui-kit";
import { useAuthSession } from "@/lib/auth-client-session";
import { getMessages } from "@/lib/i18n/messages";
import { useRouteLocale } from "@/lib/i18n/use-route-locale";
import type { StudentWritingAssignment } from "@/lib/types";
import {
  assignmentStatusClass,
  countAssignmentWords,
  formatAssignmentDate,
  getAssignmentCopy
} from "../assignment-copy";

type AssignmentPayload = {
  assignment: StudentWritingAssignment;
};

export default function AssignmentDetailClient({ assignmentId }: { assignmentId: string }) {
  const { sessionContext, sessionResolved } = useAuthSession();
  const [locale, setLocale] = useRouteLocale();
  const { navbar } = getMessages(locale);
  const t = getAssignmentCopy(locale);
  const [assignment, setAssignment] = useState<StudentWritingAssignment | null>(null);
  const [draft, setDraft] = useState("");
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authRequest, setAuthRequest] = useState<{ mode: "signIn" | "signUp"; id: number } | null>(null);

  const isAuthenticated = Boolean(sessionContext.user);
  const draftStorageKey = sessionContext.user?.id
    ? `ielts-assignment-draft:${sessionContext.user.id}:${assignmentId}`
    : null;

  function getSubmitBlockText() {
    if (!assignment?.submitBlockReason) {
      return null;
    }
    if (assignment.submitBlockReason === "closed") {
      return t.assignmentClosed;
    }
    if (assignment.submitBlockReason === "deadline_passed") {
      return t.deadlinePassed;
    }
    if (assignment.submitBlockReason === "resubmission_not_allowed") {
      return t.resubmissionLocked;
    }
    return t.submitBlocked;
  }

  function getDimensionLabel(key: string) {
    if (key === "taskAchievement") {
      return assignment?.taskType === "task1" ? "TA" : "TR";
    }
    if (key === "coherenceAndCohesion") {
      return "CC";
    }
    if (key === "lexicalResource") {
      return "LR";
    }
    if (key === "grammaticalRangeAndAccuracy") {
      return "GRA";
    }
    return key;
  }

  const loadAssignment = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/assignments/${encodeURIComponent(assignmentId)}`, { cache: "no-store" });
      const data = (await response.json()) as AssignmentPayload | { error?: string };
      if (!response.ok || !("assignment" in data)) {
        throw new Error(response.status === 404 ? "NOT_FOUND" : "LOAD_FAILED");
      }
      setAssignment(data.assignment);
      const serverDraft = data.assignment.essay ?? "";
      let nextDraft = serverDraft;
      let restoredLocalDraft = false;

      if (draftStorageKey) {
        try {
          const rawDraft = window.localStorage.getItem(draftStorageKey);
          const localDraft = rawDraft ? (JSON.parse(rawDraft) as { text?: unknown; updatedAt?: unknown }) : null;
          const localText = typeof localDraft?.text === "string" ? localDraft.text : "";
          const localUpdatedAt = typeof localDraft?.updatedAt === "number" ? localDraft.updatedAt : 0;
          const submittedAt = data.assignment.submittedAt ? new Date(data.assignment.submittedAt).getTime() : 0;
          if (localText && localText !== serverDraft && localUpdatedAt > submittedAt) {
            nextDraft = localText;
            restoredLocalDraft = true;
          }
        } catch {
          // Ignore malformed local drafts.
        }
      }

      setDraft(nextDraft);
      setDraftNotice(restoredLocalDraft ? t.draftRestored : null);
    } catch (loadError) {
      setError(loadError instanceof Error && loadError.message === "NOT_FOUND" ? t.notFound : t.detailLoadError);
    } finally {
      setLoading(false);
    }
  }, [assignmentId, draftStorageKey, t.detailLoadError, t.draftRestored, t.notFound]);

  useEffect(() => {
    if (!sessionResolved) {
      return;
    }
    if (!isAuthenticated) {
      setLoading(false);
      setAssignment(null);
      return;
    }
    void loadAssignment();
  }, [isAuthenticated, loadAssignment, sessionResolved]);

  useEffect(() => {
    if (!assignment || !draftStorageKey || loading) {
      return;
    }

    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          draftStorageKey,
          JSON.stringify({
            text: draft,
            updatedAt: Date.now()
          })
        );
        setDraftNotice(t.draftSaved);
      } catch {
        // Local storage can be unavailable in private browsing; ignore silently.
      }
    }, 600);

    return () => window.clearTimeout(timer);
  }, [assignment, draft, draftStorageKey, loading, t.draftSaved]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assignment) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/assignments/${encodeURIComponent(assignment.id)}/submission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ essay: draft })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "SUBMIT_FAILED");
      }
      if (draftStorageKey) {
        window.localStorage.removeItem(draftStorageKey);
      }
      setDraftNotice(null);
      await loadAssignment();
    } catch {
      setError(t.submitError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="pageShell assignmentsPage">
      <div className="pageBackdrop" aria-hidden="true">
        <span className="backdropOrb orbOne" />
        <span className="backdropOrb orbTwo" />
        <span className="backdropGrid" />
      </div>

      <AppNavbar
        locale={locale}
        onLocaleChange={setLocale}
        copy={navbar}
        taskMenuMode="all"
        energyBalance={sessionContext.energy?.balance ?? null}
        energyLabel={locale === "zh-CN" ? "能量" : "Energy"}
        authRequest={authRequest}
      />

      {!sessionResolved || loading ? (
        <Surface className="assignmentsState">
          <LoadingLottie label={t.loading} showLabel={false} />
        </Surface>
      ) : !isAuthenticated ? (
        <Surface className="assignmentsState">
          <h1>{t.authTitle}</h1>
          <p>{t.authBody}</p>
          <div className="assignmentsActions">
            <ActionButton onClick={() => setAuthRequest({ mode: "signIn", id: Date.now() })}>{t.login}</ActionButton>
            <ActionButton variant="primary" onClick={() => setAuthRequest({ mode: "signUp", id: Date.now() })}>
              {t.signUp}
            </ActionButton>
          </div>
        </Surface>
      ) : !assignment ? (
        <section className="assignmentsWrap">
          <Surface className="assignmentsState">
            <p>{error ?? t.notFound}</p>
            <Link href={`/${locale}/assignments`} className="assignmentBackLink">
              ← {t.backToList}
            </Link>
          </Surface>
        </section>
      ) : (
        <section className="assignmentsWrap assignmentDetailWrap">
          <div className="assignmentDetailNav">
            <Link href={`/${locale}/assignments`} className="assignmentBackLink">
              ← {t.backToList}
            </Link>
          </div>

          {error ? <p className="assignmentsError">{error}</p> : null}

          <Surface className="assignmentTaskCard">
            <div className="assignmentTaskHeader">
              <div>
                <div className="checkerTaskContext assignmentTaskContext">
                  <Pill>{assignment.taskType === "task1" ? navbar.task1 : navbar.task2}</Pill>
                  <div>
                    <strong>{assignment.title}</strong>
                    <span>
                      {t.dueAt}: {formatAssignmentDate(assignment.dueAt, locale, t.noDueAt)}
                    </span>
                    {assignment.allowLateSubmission ? (
                      <span>
                        {t.lateDueAt}: {formatAssignmentDate(assignment.lateDueAt, locale, t.noDueAt)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <span className={`assignmentStatus ${assignmentStatusClass(assignment.submissionStatus)}`}>
                {assignment.rewriteRequired
                  ? t.rewriteRequired
                  : assignment.submissionStatus === "reviewed"
                  ? t.reviewed
                  : assignment.submissionStatus === "submitted"
                    ? t.submitted
                    : t.notSubmitted}
              </span>
            </div>

            <div className="assignmentTaskWorkspace">
              <div className="assignmentReadonlyColumn">
                {assignment.instructions ? (
                  <section className="checkerField checkerPromptBlock assignmentInstructionsBlock">
                    <div className="checkerPromptHeader">
                      <span>{t.instructions}</span>
                      <span className="assignmentReadonlyBadge">{t.readonly}</span>
                    </div>
                    <div className="checkerPromptBody">
                      <p className="checkerPromptText">{assignment.instructions}</p>
                    </div>
                  </section>
                ) : null}

                <section className="checkerField checkerPromptBlock">
                  <div className="checkerPromptHeader">
                    <span>{t.prompt}</span>
                    <span className="assignmentReadonlyBadge">{t.readonly}</span>
                  </div>
                  <div className="checkerPromptBody">
                    <p className="checkerPromptText">{assignment.prompt}</p>
                  </div>
                </section>

                {assignment.taskType === "task1" ? (
                  <section className="checkerField checkerUploadBlock">
                    <div className="checkerPromptHeader">
                      <span>Task 1 Image</span>
                      <span className="assignmentReadonlyBadge">{t.readonly}</span>
                    </div>
                    <div className="checkerPromptBody checkerUploadBody">
                      <div className={`checkerUploadDropzone is-readonly${assignment.image ? " has-preview" : ""}`}>
                        {assignment.image ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={assignment.image.url} alt={assignment.image.name} className="checkerUploadPreviewImage" />
                          </>
                        ) : (
                          <span className="checkerUploadReadonlyEmpty">No image</span>
                        )}
                      </div>
                    </div>
                  </section>
                ) : null}
              </div>

              <form className="checkerDraftPanel assignmentDraftPanel" onSubmit={handleSubmit}>
                <div className="checkerDraftHeader assignmentDraftHeader">
                  <div>
                    <h2>{t.essay}</h2>
                    {assignment.submittedAt ? (
                      <span className="checkerDraftStatus">
                        {t.submittedAt}: {formatAssignmentDate(assignment.submittedAt, locale, "")}
                        {assignment.isLate ? ` · ${t.lateSubmission}` : ""}
                      </span>
                    ) : null}
                    {draftNotice ? <span className="checkerDraftStatus is-saving">{draftNotice}</span> : null}
                    {getSubmitBlockText() ? <span className="checkerDraftStatus">{getSubmitBlockText()}</span> : null}
                  </div>
                </div>

                <label className="checkerEssayField">
                  <span className="srOnly">{t.essay}</span>
                  <textarea
                    className="checkerEssayInput assignmentEssayInput"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={t.essayPlaceholder}
                    rows={18}
                    disabled={!assignment.canSubmit}
                  />
                </label>

                <div className="checkerDraftFooter assignmentDraftFooter">
                  <div className="checkerDraftMeta">
                    <span className="assignmentWordCount">
                      {t.wordCount}: <strong>{countAssignmentWords(draft)}</strong> {t.wordsUnit}
                    </span>
                  </div>
                  <ActionButton variant="primary" type="submit" disabled={submitting || !assignment.canSubmit}>
                    {submitting
                      ? t.submitting
                      : assignment.submissionStatus === "not_submitted"
                        ? t.submit
                        : t.resubmit}
                  </ActionButton>
                </div>
              </form>
            </div>

            {assignment.teacherFeedback ||
            assignment.teacherFeedbackItems.length > 0 ||
            Object.values(assignment.teacherScoreBreakdown).some((item) => item.score !== null || item.comment) ? (
              <section className="assignmentFeedback">
                <div className="assignmentFeedbackTitle">
                  <h3>{t.feedback}</h3>
                  {assignment.teacherScore !== null ? (
                    <span>
                      {t.score}: {assignment.teacherScore}
                    </span>
                  ) : null}
                </div>

                {Object.values(assignment.teacherScoreBreakdown).some((item) => item.score !== null || item.comment) ? (
                  <div className="assignmentScoreBreakdown">
                    <h4>{t.scoreBreakdown}</h4>
                    <div>
                      {Object.entries(assignment.teacherScoreBreakdown).map(([key, item]) => (
                        item.score !== null || item.comment ? (
                          <article key={key}>
                            <strong>
                              {getDimensionLabel(key)}
                              {item.score !== null ? ` · ${item.score}` : ""}
                            </strong>
                            {item.comment ? <p>{item.comment}</p> : null}
                          </article>
                        ) : null
                      ))}
                    </div>
                  </div>
                ) : null}

                {assignment.teacherFeedbackItems.length > 0 ? (
                  <div className="assignmentAnnotations">
                    <h4>{t.annotations}</h4>
                    {assignment.teacherFeedbackItems.map((item) => (
                      <article key={item.id}>
                        {item.quote ? <blockquote>{item.quote}</blockquote> : null}
                        {item.comment ? <p>{item.comment}</p> : null}
                        {item.suggestion ? (
                          <p>
                            <strong>{t.suggestion}：</strong>
                            {item.suggestion}
                          </p>
                        ) : null}
                      </article>
                    ))}
                  </div>
                ) : null}

                {assignment.teacherFeedback ? <p>{assignment.teacherFeedback}</p> : null}
              </section>
            ) : null}
          </Surface>
        </section>
      )}
    </main>
  );
}
