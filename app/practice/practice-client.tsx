"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppNavbar } from "@/components/app-navbar";
import { Pill, Surface } from "@/components/ui-kit";
import { getMessages } from "@/lib/i18n/messages";
import { useRouteLocale } from "@/lib/i18n/use-route-locale";
import type {
  HistoricalPracticeQuestion,
  HistoricalQuestionType,
  Locale,
  PracticeQuestion,
  TaskType
} from "@/lib/types";

type PracticePayload = {
  items: PracticeQuestion[];
  total: number;
};

type HistoricalPayload = {
  items: HistoricalPracticeQuestion[];
};

type PracticeSource = "cambridge" | "historical";

const HISTORICAL_CATEGORY_EN: Record<string, string> = {
  交通类: "Transport",
  人文类: "Culture",
  价值观类: "Values",
  国际化: "Globalisation",
  媒体类: "Media",
  工作类: "Work",
  建筑类: "Architecture",
  成功类: "Success",
  政府类: "Government",
  教育类: "Education",
  旅游类: "Travel",
  犯罪类: "Crime",
  环境类: "Environment",
  生活类: "Lifestyle",
  社会类: "Society",
  科技类: "Technology",
  艺术类: "Arts"
};

const HISTORICAL_TYPE_EN: Record<HistoricalQuestionType, string> = {
  观点类: "Opinion",
  讨论类: "Discussion",
  问题解决类: "Problem & solution",
  混合类: "Mixed"
};

function normalizeTaskLabel(taskType: TaskType, labels: { task1: string; task2: string }) {
  return taskType === "task1" ? labels.task1 : labels.task2;
}

function formatHistoricalCategory(category: string, locale: Locale) {
  return locale === "zh-CN" ? category : (HISTORICAL_CATEGORY_EN[category] ?? category);
}

function formatHistoricalType(type: HistoricalQuestionType, locale: Locale) {
  return locale === "zh-CN" ? type : HISTORICAL_TYPE_EN[type];
}

function formatHistoricalDate(date: string, locale: Locale) {
  const [year, month, day] = date.split("-").map((part) => Number.parseInt(part, 10));
  return new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: locale === "zh-CN" ? "numeric" : "short",
    day: "numeric"
  }).format(new Date(year, month - 1, day));
}

export default function PracticePageClient() {
  const [locale, setLocale] = useRouteLocale();
  const { practice: t, navbar } = getMessages(locale);
  const [source, setSource] = useState<PracticeSource>("cambridge");
  const [items, setItems] = useState<PracticeQuestion[]>([]);
  const [historicalItems, setHistoricalItems] = useState<HistoricalPracticeQuestion[]>([]);
  const [historicalLoaded, setHistoricalLoaded] = useState(false);
  const [historicalLoading, setHistoricalLoading] = useState(false);
  const [historicalError, setHistoricalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookFilter, setBookFilter] = useState("all");
  const [taskFilter, setTaskFilter] = useState<"all" | TaskType>("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [questionTypeFilter, setQuestionTypeFilter] = useState("all");

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
  }, [t.loadFailed]);

  useEffect(() => {
    if (source !== "historical" || historicalLoaded) {
      return;
    }

    let cancelled = false;

    async function loadHistoricalQuestions() {
      setHistoricalLoading(true);
      setHistoricalError(null);

      try {
        const response = await fetch("/api/practice/historical", {
          cache: "no-store"
        });
        const payload = (await response.json()) as HistoricalPayload | { error?: string };

        if (!response.ok || !("items" in payload)) {
          throw new Error("LOAD_FAILED");
        }

        if (!cancelled) {
          setHistoricalItems(payload.items);
          setHistoricalLoaded(true);
          const latestYear = Math.max(...payload.items.map((item) => item.year));
          setYearFilter(String(latestYear));
        }
      } catch {
        if (!cancelled) {
          setHistoricalError(t.loadFailed);
        }
      } finally {
        if (!cancelled) {
          setHistoricalLoading(false);
        }
      }
    }

    void loadHistoricalQuestions();

    return () => {
      cancelled = true;
    };
  }, [historicalLoaded, source, t.loadFailed]);

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

  const historicalYears = useMemo(
    () => [...new Set(historicalItems.map((item) => item.year))].sort((left, right) => right - left),
    [historicalItems]
  );

  const historicalCategories = useMemo(
    () => [...new Set(historicalItems.map((item) => item.category))].sort((left, right) =>
      left.localeCompare(right)
    ),
    [historicalItems]
  );

  const historicalTypes = useMemo(
    () => [...new Set(historicalItems.map((item) => item.type))],
    [historicalItems]
  );

  const filteredHistoricalItems = useMemo(
    () =>
      historicalItems.filter((item) => {
        if (yearFilter !== "all" && item.year !== Number(yearFilter)) {
          return false;
        }
        if (categoryFilter !== "all" && item.category !== categoryFilter) {
          return false;
        }
        if (questionTypeFilter !== "all" && item.type !== questionTypeFilter) {
          return false;
        }
        return true;
      }),
    [categoryFilter, historicalItems, questionTypeFilter, yearFilter]
  );

  return (
    <main className="pageShell practicePage">
      <AppNavbar
        locale={locale}
        onLocaleChange={setLocale}
        copy={navbar}
        taskMenuMode="all"
        authHint={t.authDialogHint}
      />

      <h1 className="srOnly">{t.title}</h1>

      {loading ? (
        <Surface className="practiceStatePanel">
          <p>{t.loading}</p>
        </Surface>
      ) : (
        <section className="practiceWorkspace">
          <div className="practiceSourceSwitch" role="tablist" aria-label={t.sourceLabel}>
            <button
              type="button"
              role="tab"
              aria-selected={source === "cambridge"}
              className={source === "cambridge" ? "is-active" : ""}
              onClick={() => setSource("cambridge")}
            >
              {t.sourceCambridge}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={source === "historical"}
              className={source === "historical" ? "is-active" : ""}
              onClick={() => setSource("historical")}
            >
              {t.sourceHistorical}
            </button>
          </div>

          {source === "cambridge" ? (
            <>
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
                  <select
                    value={taskFilter}
                    onChange={(event) => setTaskFilter(event.target.value as "all" | TaskType)}
                  >
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
                          <h2>
                            {t.bookLabel} {item.bookNumber} · {t.testLabel} {item.testNumber}
                          </h2>
                          <Pill>{normalizeTaskLabel(item.taskType, t)}</Pill>
                        </div>

                        <div className="practiceTagRow">
                          {item.tags.map((tag) => (
                            <span key={tag} className="practiceTag">
                              {tag}
                            </span>
                          ))}
                        </div>

                        <p className="practicePromptPreview">{item.prompt}</p>

                        <div className="practiceCardActions">
                          <Link href={checkerHref} className="uiButton practiceStartButton">
                            {t.startPractice}
                          </Link>
                        </div>
                      </Surface>
                    );
                  })}
                </div>
              )}
            </>
          ) : historicalLoading ? (
            <Surface className="practiceStatePanel">
              <p>{t.loading}</p>
            </Surface>
          ) : historicalError ? (
            <Surface className="practiceStatePanel">
              <p>{historicalError}</p>
            </Surface>
          ) : (
            <>
              <Surface className="practiceFilters">
                <label>
                  <span>{t.yearLabel}</span>
                  <select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
                    <option value="all">{t.allYears}</option>
                    {historicalYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{t.categoryLabel}</span>
                  <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                    <option value="all">{t.allCategories}</option>
                    {historicalCategories.map((category) => (
                      <option key={category} value={category}>
                        {formatHistoricalCategory(category, locale)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{t.questionTypeLabel}</span>
                  <select
                    value={questionTypeFilter}
                    onChange={(event) => setQuestionTypeFilter(event.target.value)}
                  >
                    <option value="all">{t.allQuestionTypes}</option>
                    {historicalTypes.map((type) => (
                      <option key={type} value={type}>
                        {formatHistoricalType(type, locale)}
                      </option>
                    ))}
                  </select>
                </label>
              </Surface>

              {filteredHistoricalItems.length === 0 ? (
                <Surface className="practiceStatePanel">
                  <h2>{t.emptyTitle}</h2>
                  <p>{t.emptyBody}</p>
                </Surface>
              ) : (
                <div className="practiceGrid">
                  {filteredHistoricalItems.map((item) => {
                    const checkerHref = `/${locale}/checker?task=task2&historicalId=${encodeURIComponent(item.id)}`;
                    return (
                      <Surface as="article" key={item.id} className="practiceCard">
                        <div className="practiceCardTop">
                          <h2>{formatHistoricalDate(item.date, locale)}</h2>
                          <Pill>{t.task2}</Pill>
                        </div>

                        <div className="practiceTagRow">
                          <span className="practiceTag">
                            {formatHistoricalCategory(item.category, locale)}
                          </span>
                          <span className="practiceTag">
                            {formatHistoricalType(item.type, locale)}
                          </span>
                        </div>

                        <p className="practicePromptPreview">{item.prompt}</p>

                        <div className="practiceCardActions">
                          <Link href={checkerHref} className="uiButton practiceStartButton">
                            {t.startPractice}
                          </Link>
                        </div>
                      </Surface>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>
      )}
    </main>
  );
}
