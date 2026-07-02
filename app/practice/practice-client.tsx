"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
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
  page: number;
  pageSize: number;
  totalPages: number;
  books: number[];
  tags: string[];
};

type HistoricalPayload = {
  items: HistoricalPracticeQuestion[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  years: number[];
  categories: string[];
  types: HistoricalQuestionType[];
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
  if (locale === "zh-CN") {
    return `${year}/${month}/${day}`;
  }
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function parsePage(value: string | null) {
  const page = Number.parseInt(value ?? "", 10);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function getPaginationPages(page: number, totalPages: number) {
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export default function PracticePageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [locale, setLocale] = useRouteLocale();
  const { practice: t, navbar } = getMessages(locale);
  const [source, setSource] = useState<PracticeSource>(
    searchParams.get("source") === "historical" ? "historical" : "cambridge"
  );
  const [items, setItems] = useState<PracticeQuestion[]>([]);
  const [practiceTotal, setPracticeTotal] = useState(0);
  const [practiceTotalPages, setPracticeTotalPages] = useState(1);
  const [books, setBooks] = useState<number[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [historicalItems, setHistoricalItems] = useState<HistoricalPracticeQuestion[]>([]);
  const [historicalTotal, setHistoricalTotal] = useState(0);
  const [historicalTotalPages, setHistoricalTotalPages] = useState(1);
  const [historicalYears, setHistoricalYears] = useState<number[]>([]);
  const [historicalCategories, setHistoricalCategories] = useState<string[]>([]);
  const [historicalTypes, setHistoricalTypes] = useState<HistoricalQuestionType[]>([]);
  const [historicalLoading, setHistoricalLoading] = useState(false);
  const [historicalError, setHistoricalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(source === "cambridge");
  const [error, setError] = useState<string | null>(null);
  const [bookFilter, setBookFilter] = useState(searchParams.get("book") ?? "all");
  const [taskFilter, setTaskFilter] = useState<"all" | TaskType>(
    searchParams.get("task") === "task1" || searchParams.get("task") === "task2"
      ? searchParams.get("task") as TaskType
      : "all"
  );
  const [tagFilter, setTagFilter] = useState(searchParams.get("tag") ?? "all");
  const [practicePage, setPracticePage] = useState(parsePage(searchParams.get("page")));
  const [yearFilter, setYearFilter] = useState(searchParams.get("year") ?? "all");
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get("category") ?? "all");
  const [questionTypeFilter, setQuestionTypeFilter] = useState(searchParams.get("type") ?? "all");
  const [historicalTaskFilter, setHistoricalTaskFilter] = useState<"all" | TaskType>(
    searchParams.get("task") === "task1" || searchParams.get("task") === "task2"
      ? searchParams.get("task") as TaskType
      : "all"
  );
  const [historicalPage, setHistoricalPage] = useState(parsePage(searchParams.get("page")));

  useEffect(() => {
    if (source !== "cambridge") {
      return;
    }

    const controller = new AbortController();

    async function loadPracticeQuestions() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          page: String(practicePage)
        });
        if (bookFilter !== "all") params.set("book", bookFilter);
        if (taskFilter !== "all") params.set("task", taskFilter);
        if (tagFilter !== "all") params.set("tag", tagFilter);
        const response = await fetch(`/api/practice/questions?${params.toString()}`, {
          signal: controller.signal
        });
        const payload = (await response.json()) as PracticePayload | { error?: string };

        if (!response.ok || !("items" in payload)) {
          throw new Error("LOAD_FAILED");
        }

        if (practicePage > payload.totalPages) {
          setPracticePage(payload.totalPages);
          return;
        }

        setItems(payload.items);
        setPracticeTotal(payload.total);
        setPracticeTotalPages(payload.totalPages);
        setBooks(payload.books);
        setTags(payload.tags);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(t.loadFailed);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadPracticeQuestions();

    return () => {
      controller.abort();
    };
  }, [bookFilter, practicePage, source, t.loadFailed, tagFilter, taskFilter]);

  useEffect(() => {
    if (source !== "historical") {
      return;
    }

    const controller = new AbortController();

    async function loadHistoricalQuestions() {
      setHistoricalLoading(true);
      setHistoricalError(null);

      try {
        const params = new URLSearchParams({
          page: String(historicalPage)
        });
        if (historicalTaskFilter !== "all") params.set("task", historicalTaskFilter);
        if (yearFilter !== "all") params.set("year", yearFilter);
        if (categoryFilter !== "all") params.set("category", categoryFilter);
        if (questionTypeFilter !== "all" && historicalTaskFilter !== "task1") {
          params.set("type", questionTypeFilter);
        }
        const response = await fetch(`/api/practice/historical?${params.toString()}`, {
          signal: controller.signal
        });
        const payload = (await response.json()) as HistoricalPayload | { error?: string };

        if (!response.ok || !("items" in payload)) {
          throw new Error("LOAD_FAILED");
        }

        if (historicalPage > payload.totalPages) {
          setHistoricalPage(payload.totalPages);
          return;
        }

        setHistoricalItems(payload.items);
        setHistoricalTotal(payload.total);
        setHistoricalTotalPages(payload.totalPages);
        setHistoricalYears(payload.years);
        setHistoricalCategories(payload.categories);
        setHistoricalTypes(payload.types);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setHistoricalError(t.loadFailed);
      } finally {
        if (!controller.signal.aborted) {
          setHistoricalLoading(false);
        }
      }
    }

    void loadHistoricalQuestions();

    return () => {
      controller.abort();
    };
  }, [
    categoryFilter,
    historicalPage,
    historicalTaskFilter,
    questionTypeFilter,
    source,
    t.loadFailed,
    yearFilter
  ]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (source === "historical") {
      params.set("source", "historical");
      params.delete("book");
      params.delete("tag");
      if (historicalTaskFilter === "all") params.delete("task");
      else params.set("task", historicalTaskFilter);
      if (yearFilter === "all") params.delete("year");
      else params.set("year", yearFilter);
      if (categoryFilter === "all") params.delete("category");
      else params.set("category", categoryFilter);
      if (questionTypeFilter === "all" || historicalTaskFilter === "task1") {
        params.delete("type");
      } else {
        params.set("type", questionTypeFilter);
      }
      if (historicalPage === 1) params.delete("page");
      else params.set("page", String(historicalPage));
    } else {
      params.delete("source");
      params.delete("year");
      params.delete("category");
      params.delete("type");
      if (bookFilter === "all") params.delete("book");
      else params.set("book", bookFilter);
      if (taskFilter === "all") params.delete("task");
      else params.set("task", taskFilter);
      if (tagFilter === "all") params.delete("tag");
      else params.set("tag", tagFilter);
      if (practicePage === 1) params.delete("page");
      else params.set("page", String(practicePage));
    }

    const nextQuery = params.toString();
    if (nextQuery !== searchParams.toString()) {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    }
  }, [
    categoryFilter,
    bookFilter,
    historicalPage,
    historicalTaskFilter,
    pathname,
    practicePage,
    questionTypeFilter,
    router,
    searchParams,
    source,
    tagFilter,
    taskFilter,
    yearFilter
  ]);

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

      <section className="practiceWorkspace">
          <div className="practiceSourceSwitch" role="tablist" aria-label={t.sourceLabel}>
            <button
              type="button"
              role="tab"
              aria-selected={source === "cambridge"}
              className={source === "cambridge" ? "is-active" : ""}
              onClick={() => {
                setSource("cambridge");
                setHistoricalPage(1);
                setPracticePage(1);
              }}
            >
              {t.sourceCambridge}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={source === "historical"}
              className={source === "historical" ? "is-active" : ""}
              onClick={() => {
                setSource("historical");
                setHistoricalPage(1);
                setPracticePage(1);
              }}
            >
              {t.sourceHistorical}
            </button>
          </div>

          {source === "cambridge" ? (
            <>
              <Surface className="practiceFilters">
                <label>
                  <span>{t.bookLabel}</span>
                  <select
                    value={bookFilter}
                    onChange={(event) => {
                      setBookFilter(event.target.value);
                      setPracticePage(1);
                    }}
                  >
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
                    onChange={(event) => {
                      setTaskFilter(event.target.value as "all" | TaskType);
                      setPracticePage(1);
                    }}
                  >
                    <option value="all">{t.allTasks}</option>
                    <option value="task1">{t.task1}</option>
                    <option value="task2">{t.task2}</option>
                  </select>
                </label>
                <label>
                  <span>{t.tags}</span>
                  <select
                    value={tagFilter}
                    onChange={(event) => {
                      setTagFilter(event.target.value);
                      setPracticePage(1);
                    }}
                  >
                    <option value="all">{t.allTags}</option>
                    {tags.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                </label>
              </Surface>

              {loading ? (
                <Surface className="practiceStatePanel">
                  <p>{t.loading}</p>
                </Surface>
              ) : error ? (
                <Surface className="practiceStatePanel">
                  <p>{error}</p>
                </Surface>
              ) : items.length === 0 ? (
                <Surface className="practiceStatePanel">
                  <h2>{t.emptyTitle}</h2>
                  <p>{t.emptyBody}</p>
                </Surface>
              ) : (
                <div className="practiceGrid">
                  {items.map((item) => {
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

              {practiceTotal > 0 ? (
                <nav className="practicePagination" aria-label={t.paginationLabel}>
                  <p>
                    {locale === "zh-CN"
                      ? `共 ${practiceTotal} 道题 · 第 ${practicePage} / ${practiceTotalPages} 页`
                      : `${practiceTotal} questions · Page ${practicePage} of ${practiceTotalPages}`}
                  </p>
                  <div className="practicePaginationActions">
                    <button
                      type="button"
                      disabled={practicePage <= 1 || loading}
                      onClick={() => setPracticePage((page) => Math.max(1, page - 1))}
                    >
                      {t.previousPage}
                    </button>
                    {getPaginationPages(practicePage, practiceTotalPages).map((page) => (
                      <button
                        key={page}
                        type="button"
                        aria-current={page === practicePage ? "page" : undefined}
                        className={`practicePageNumber ${
                          page === practicePage ? "is-active" : ""
                        }`}
                        disabled={loading}
                        onClick={() => setPracticePage(page)}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={practicePage >= practiceTotalPages || loading}
                      onClick={() =>
                        setPracticePage((page) => Math.min(practiceTotalPages, page + 1))
                      }
                    >
                      {t.nextPage}
                    </button>
                  </div>
                </nav>
              ) : null}
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
                  <span>{t.taskLabel}</span>
                  <select
                    value={historicalTaskFilter}
                    onChange={(event) => {
                      setHistoricalTaskFilter(event.target.value as "all" | TaskType);
                      setCategoryFilter("all");
                      setQuestionTypeFilter("all");
                      setHistoricalPage(1);
                    }}
                  >
                    <option value="all">{t.allTasks}</option>
                    <option value="task1">{t.task1}</option>
                    <option value="task2">{t.task2}</option>
                  </select>
                </label>
                <label>
                  <span>{t.yearLabel}</span>
                  <select
                    value={yearFilter}
                    onChange={(event) => {
                      setYearFilter(event.target.value);
                      setHistoricalPage(1);
                    }}
                  >
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
                  <select
                    value={categoryFilter}
                    onChange={(event) => {
                      setCategoryFilter(event.target.value);
                      setHistoricalPage(1);
                    }}
                  >
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
                    onChange={(event) => {
                      setQuestionTypeFilter(event.target.value);
                      setHistoricalPage(1);
                    }}
                    disabled={historicalTaskFilter === "task1"}
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

              {historicalItems.length === 0 ? (
                <Surface className="practiceStatePanel">
                  <h2>{t.emptyTitle}</h2>
                  <p>{t.emptyBody}</p>
                </Surface>
              ) : (
                <div className="practiceGrid">
                  {historicalItems.map((item) => {
                    const checkerHref = `/${locale}/checker?task=${item.taskType}&historicalId=${encodeURIComponent(item.id)}`;
                    return (
                      <Surface as="article" key={item.id} className="practiceCard">
                        <div className="practiceCardTop">
                          <h2>{formatHistoricalDate(item.date, locale)}</h2>
                          <Pill>{normalizeTaskLabel(item.taskType, t)}</Pill>
                        </div>

                        <div className="practiceTagRow">
                          <span className="practiceTag">
                            {formatHistoricalCategory(item.category, locale)}
                          </span>
                          {item.type ? (
                            <span className="practiceTag">
                              {formatHistoricalType(item.type, locale)}
                            </span>
                          ) : null}
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

              {historicalTotal > 0 ? (
                <nav className="practicePagination" aria-label={t.paginationLabel}>
                  <p>
                    {locale === "zh-CN"
                      ? `共 ${historicalTotal} 道题 · 第 ${historicalPage} / ${historicalTotalPages} 页`
                      : `${historicalTotal} questions · Page ${historicalPage} of ${historicalTotalPages}`}
                  </p>
                  <div className="practicePaginationActions">
                    <button
                      type="button"
                      disabled={historicalPage <= 1 || historicalLoading}
                      onClick={() => setHistoricalPage((page) => Math.max(1, page - 1))}
                    >
                      {t.previousPage}
                    </button>
                    {getPaginationPages(historicalPage, historicalTotalPages).map((page) => (
                      <button
                        key={page}
                        type="button"
                        aria-current={page === historicalPage ? "page" : undefined}
                        className={`practicePageNumber ${
                          page === historicalPage ? "is-active" : ""
                        }`}
                        disabled={historicalLoading}
                        onClick={() => setHistoricalPage(page)}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={historicalPage >= historicalTotalPages || historicalLoading}
                      onClick={() =>
                        setHistoricalPage((page) => Math.min(historicalTotalPages, page + 1))
                      }
                    >
                      {t.nextPage}
                    </button>
                  </div>
                </nav>
              ) : null}
            </>
          )}
      </section>
    </main>
  );
}
