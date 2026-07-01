"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppNavbar } from "@/components/app-navbar";
import { Pill, Surface } from "@/components/ui-kit";
import { getMessages } from "@/lib/i18n/messages";
import { useRouteLocale } from "@/lib/i18n/use-route-locale";
import { useAuthSession } from "@/lib/auth-client-session";
import type { PracticeQuestion, TaskType } from "@/lib/types";

type PracticePayload = {
  items: PracticeQuestion[];
  total: number;
};

function normalizeTaskLabel(taskType: TaskType, labels: { task1: string; task2: string }) {
  return taskType === "task1" ? labels.task1 : labels.task2;
}

export default function PracticePageClient() {
  const [locale, setLocale] = useRouteLocale();
  const { practice: t, navbar } = getMessages(locale);
  const { sessionContext, sessionResolved } = useAuthSession();
  const [items, setItems] = useState<PracticeQuestion[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookFilter, setBookFilter] = useState("all");
  const [taskFilter, setTaskFilter] = useState<"all" | TaskType>("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [authRequest, setAuthRequest] = useState<{ mode: "signIn" | "signUp"; id: number } | null>(null);
  const [pendingPracticeHref, setPendingPracticeHref] = useState<string | null>(null);

  const isAuthenticated = Boolean(sessionContext.user);

  useEffect(() => {
    let cancelled = false;

    async function loadPracticeQuestions() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/practice/questions?limit=200&status=published", {
          cache: "no-store"
        });
        const payload = (await response.json()) as PracticePayload | { error?: string };

        if (!response.ok || !("items" in payload)) {
          throw new Error("LOAD_FAILED");
        }

        if (!cancelled) {
          setItems(payload.items);
          setTotal(payload.total);
        }
      } catch {
        if (!cancelled) {
          setError(t.loadFailed);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPracticeQuestions();

    return () => {
      cancelled = true;
    };
  }, [t.loadFailed, isAuthenticated]);

  const books = useMemo(() => {
    return [...new Set(items.map((item) => item.bookNumber))].sort((left, right) => right - left);
  }, [items]);

  const tags = useMemo(() => {
    return [...new Set(items.flatMap((item) => item.tags))].sort((left, right) => left.localeCompare(right));
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (bookFilter !== "all" && item.bookNumber !== Number(bookFilter)) {
        return false;
      }
      if (taskFilter !== "all" && item.taskType !== taskFilter) {
        return false;
      }
      if (tagFilter !== "all" && !item.tags.includes(tagFilter)) {
        return false;
      }
      return true;
    });
  }, [bookFilter, items, tagFilter, taskFilter]);

  function openAuth(mode: "signIn" | "signUp") {
    setAuthRequest({
      mode,
      id: Date.now()
    });
  }

  function requestPractice(checkerHref: string) {
    setPendingPracticeHref(checkerHref);
    openAuth("signIn");
  }

  function handleSessionUpdated() {
    if (pendingPracticeHref) {
      window.location.assign(pendingPracticeHref);
    }
  }

  return (
    <main className="pageShell practicePage">
      <AppNavbar
        locale={locale}
        onLocaleChange={setLocale}
        copy={navbar}
        taskMenuMode="all"
        authRequest={authRequest}
        authHint={t.authDialogHint}
        onSessionUpdated={handleSessionUpdated}
      />

      <section className="practiceHero">
        <Surface className="practiceHeroPanel">
          <div>
            <p className="sectionLabel">{t.eyebrow}</p>
            <h1>{t.title}</h1>
            <p>{t.body}</p>
          </div>
          <div className="practiceHeroStats">
            <Pill>
              {total ?? "—"} {t.questionCount}
            </Pill>
            <Pill>{t.task1}</Pill>
            <Pill>{t.task2}</Pill>
          </div>
        </Surface>
      </section>

      {!sessionResolved || loading ? (
        <Surface className="practiceStatePanel">
          <p>{t.loading}</p>
        </Surface>
      ) : (
        <section className="practiceWorkspace">
          <Surface className="practiceFilters">
            <label>
              <span>{t.bookLabel}</span>
              <select value={bookFilter} onChange={(event) => setBookFilter(event.target.value)}>
                <option value="all">{t.allBooks}</option>
                {books.map((book) => (
                  <option key={book} value={book}>
                    Cambridge {book}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Task</span>
              <select value={taskFilter} onChange={(event) => setTaskFilter(event.target.value as "all" | TaskType)}>
                <option value="all">{t.allTasks}</option>
                <option value="task1">{t.task1}</option>
                <option value="task2">{t.task2}</option>
              </select>
            </label>
            <label>
              <span>{t.tags}</span>
              <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
                <option value="all">{t.allTags}</option>
                {tags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </label>
          </Surface>

          {error ? (
            <Surface className="practiceStatePanel">
              <p>{error}</p>
            </Surface>
          ) : filteredItems.length === 0 ? (
            <Surface className="practiceStatePanel">
              <h2>{t.emptyTitle}</h2>
              <p>{t.emptyBody}</p>
            </Surface>
          ) : (
            <div className="practiceGrid">
              {filteredItems.map((item) => {
                const checkerHref = `/${locale}/checker?task=${item.taskType}&practiceId=${encodeURIComponent(item.id)}`;
                return (
                  <Surface as="article" key={item.id} className="practiceCard">
                    <div className="practiceCardTop">
                      <div>
                        <p className="sectionLabel">
                          {t.bookLabel} {item.bookNumber} / {t.testLabel} {item.testNumber}
                        </p>
                        <h2>{item.title}</h2>
                      </div>
                      <Pill>{normalizeTaskLabel(item.taskType, t)}</Pill>
                    </div>

                    <div className="practiceTagRow">
                      {item.tags.map((tag) => (
                        <span key={tag} className="practiceTag">
                          {tag}
                        </span>
                      ))}
                      {item.imageObjectKey ? <span className="practiceTag is-image">{t.imageReady}</span> : null}
                    </div>

                    <p className="practicePromptPreview">{item.prompt}</p>

                    <div className="practiceCardActions">
                      {isAuthenticated ? (
                        <Link href={checkerHref} className="uiButton practiceStartButton">
                          {t.startPractice}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="uiButton practiceStartButton"
                          onClick={() => requestPractice(checkerHref)}
                        >
                          {t.startPractice}
                        </button>
                      )}
                    </div>
                  </Surface>
                );
              })}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
