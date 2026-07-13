"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppNavbar } from "@/components/app-navbar";
import { ActionButton, ActionLink, Pill, Surface } from "@/components/ui-kit";
import { useAuthSession } from "@/lib/auth-client-session";
import { getMessages } from "@/lib/i18n/messages";
import { useRouteLocale } from "@/lib/i18n/use-route-locale";
import type { StudentWritingAssignment, TaskType } from "@/lib/types";
import { assignmentStatusClass, formatAssignmentDate, getAssignmentCopy } from "./assignment-copy";

type AssignmentsPayload = {
  items: StudentWritingAssignment[];
};

type AssignmentStatusFilter = "all" | StudentWritingAssignment["submissionStatus"];
type AssignmentTaskFilter = "all" | TaskType;

export default function AssignmentsPageClient() {
  const { sessionContext, sessionResolved } = useAuthSession();
  const [locale, setLocale] = useRouteLocale();
  const { navbar } = getMessages(locale);
  const t = getAssignmentCopy(locale);
  const [items, setItems] = useState<StudentWritingAssignment[]>([]);
  const [statusFilter, setStatusFilter] = useState<AssignmentStatusFilter>("all");
  const [taskFilter, setTaskFilter] = useState<AssignmentTaskFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequest, setAuthRequest] = useState<{ mode: "signIn" | "signUp"; id: number } | null>(null);

  const isAuthenticated = Boolean(sessionContext.user);
  const checkerHref = useMemo(() => `/${locale}/checker`, [locale]);
  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const statusMatches = statusFilter === "all" || item.submissionStatus === statusFilter;
        const taskMatches = taskFilter === "all" || item.taskType === taskFilter;
        return statusMatches && taskMatches;
      }),
    [items, statusFilter, taskFilter]
  );

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/assignments", { cache: "no-store" });
      const data = (await response.json()) as AssignmentsPayload | { error?: string };
      if (!response.ok || !("items" in data)) {
        throw new Error("LOAD_FAILED");
      }
      setItems(data.items);
    } catch {
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [t.loadError]);

  useEffect(() => {
    if (!sessionResolved) {
      return;
    }
    if (!isAuthenticated) {
      setLoading(false);
      setItems([]);
      return;
    }
    void loadAssignments();
  }, [isAuthenticated, loadAssignments, sessionResolved]);

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
          <p>{t.loading}</p>
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
      ) : (
        <section className="assignmentsWrap">
          <Surface className="assignmentsHero">
            <div>
              <Pill>{locale === "zh-CN" ? "Teacher Assignments" : "Assignments"}</Pill>
              <h1>{t.title}</h1>
              <p>{t.body}</p>
            </div>
            <ActionLink href={checkerHref}>{t.checker}</ActionLink>
          </Surface>

          {error ? <p className="assignmentsError">{error}</p> : null}
          {items.length === 0 ? (
            <Surface className="assignmentsState">
              <p>{t.empty}</p>
            </Surface>
          ) : null}

          {items.length > 0 ? (
            <div className="assignmentFilterBar" aria-label="Assignment filters">
              <div className="assignmentFilterGroup">
                {(["all", "not_submitted", "submitted", "reviewed"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`assignmentFilterButton${statusFilter === value ? " is-active" : ""}`}
                    onClick={() => setStatusFilter(value)}
                  >
                    {value === "all"
                      ? t.filterAll
                      : value === "not_submitted"
                        ? t.filterNotSubmitted
                        : value === "submitted"
                          ? t.filterSubmitted
                          : t.filterReviewed}
                  </button>
                ))}
              </div>
              <div className="assignmentFilterGroup">
                {(["all", "task1", "task2"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`assignmentFilterButton${taskFilter === value ? " is-active" : ""}`}
                    onClick={() => setTaskFilter(value)}
                  >
                    {value === "all" ? t.taskAll : value === "task1" ? navbar.task1 : navbar.task2}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="assignmentsList">
            {filteredItems.map((assignment) => (
              <Link key={assignment.id} href={`/${locale}/assignments/${assignment.id}`} className="assignmentListCard">
                <Surface className="assignmentListCardSurface">
                  <div className="assignmentListCardMain">
                    <div className="assignmentListCardTop">
                      <Pill>{assignment.taskType === "task1" ? navbar.task1 : navbar.task2}</Pill>
                      <span className={`assignmentStatus ${assignmentStatusClass(assignment.submissionStatus)}`}>
                        {assignment.submissionStatus === "reviewed"
                          ? t.reviewed
                          : assignment.submissionStatus === "submitted"
                            ? t.submitted
                            : t.notSubmitted}
                      </span>
                    </div>
                    <h2>{assignment.title}</h2>
                    <p>{assignment.prompt}</p>
                    <div className="assignmentListMeta">
                      <span>
                        {t.dueAt}: {formatAssignmentDate(assignment.dueAt, locale, t.noDueAt)}
                      </span>
                      <span>
                        {t.createdAt}: {formatAssignmentDate(assignment.createdAt, locale, "")}
                      </span>
                      {assignment.image ? <span>{t.hasImage}</span> : null}
                    </div>
                  </div>
                  <span className="assignmentListCardAction">{t.viewDetail} →</span>
                </Surface>
              </Link>
            ))}
          </div>
          {items.length > 0 && filteredItems.length === 0 ? (
            <Surface className="assignmentsState">
              <p>{t.empty}</p>
            </Surface>
          ) : null}
        </section>
      )}
    </main>
  );
}
