"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppNavbar } from "@/components/app-navbar";
import { LoadingLottie } from "@/components/loading-lottie";
import { ActionButton, ActionLink, Pill, Surface } from "@/components/ui-kit";
import { useAuthSession } from "@/lib/auth-client-session";
import { getMessages } from "@/lib/i18n/messages";
import { useRouteLocale } from "@/lib/i18n/use-route-locale";
import type { WritingReviewListItem, WritingReviewStats, WritingReviewTaskFilter } from "@/lib/types";
import { describeTaskFilter, formatReviewTime } from "./history-shared";

const PieChart = dynamic(
  () => import("./history-charts").then((module) => module.PieChart),
  { ssr: false, loading: () => <div className="historyChartEmpty" aria-hidden="true" /> }
);
const ScoreTrendChart = dynamic(
  () => import("./history-charts").then((module) => module.ScoreTrendChart),
  { ssr: false, loading: () => <div className="historyChartEmpty" aria-hidden="true" /> }
);

type EnergyState = {
  balance: number;
  totalConsumed: number;
  totalRecharged: number;
  updatedAt: string;
};

type ReviewListPayload = {
  items: WritingReviewListItem[];
  total: number;
};

const RECENT_COUNT_OPTIONS = [10, 20, 30, 50] as const;

export default function HistoryPageClient() {
  const { sessionContext, sessionResolved } = useAuthSession();
  const [locale, setLocale] = useRouteLocale();
  const [energy, setEnergy] = useState<EnergyState | null>(sessionContext.energy as EnergyState | null);
  const [authRequest, setAuthRequest] = useState<{ mode: "signIn" | "signUp"; id: number } | null>(null);
  const [items, setItems] = useState<WritingReviewListItem[]>([]);
  const [totalReviews, setTotalReviews] = useState(0);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [stats, setStats] = useState<WritingReviewStats | null>(null);
  const [taskFilter, setTaskFilter] = useState<WritingReviewTaskFilter>("all");
  const [recentCount, setRecentCount] = useState<(typeof RECENT_COUNT_OPTIONS)[number]>(20);

  const { checker: t, navbar } = getMessages(locale);
  const checkerHref = useMemo(() => `/${locale}/checker`, [locale]);
  const sessionReady = sessionResolved;
  const isAuthenticated = Boolean(sessionContext.user);

  const loadReviews = useCallback(async () => {
    setLoadingList(true);
    setItems([]);
    setTotalReviews(0);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: String(recentCount),
        taskType: taskFilter
      });
      const response = await fetch(`/api/reviews?${params.toString()}`, {
        cache: "no-store"
      });
      const data = (await response.json()) as ReviewListPayload | { error?: string };

      if (!response.ok || !("items" in data)) {
        throw new Error("REQUEST_FAILED");
      }

      setItems(data.items);
      setTotalReviews(data.total);
    } catch {
      setError(t.historyLoadError);
    } finally {
      setLoadingList(false);
    }
  }, [recentCount, t.historyLoadError, taskFilter]);

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    setStatsError(null);

    try {
      const params = new URLSearchParams({
        recentCount: String(recentCount),
        taskType: taskFilter
      });
      const response = await fetch(`/api/reviews/stats?${params.toString()}`, {
        cache: "no-store"
      });
      const data = (await response.json()) as WritingReviewStats | { error?: string };

      if (!response.ok || !("scoreTrend" in data)) {
        throw new Error("REQUEST_FAILED");
      }

      setStats(data);
    } catch {
      setStatsError(t.historyStatsLoadError ?? t.historyLoadError);
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  }, [recentCount, t.historyLoadError, t.historyStatsLoadError, taskFilter]);

  useEffect(() => {
    setEnergy(sessionContext.energy as EnergyState | null);
  }, [sessionContext.energy]);

  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    if (!isAuthenticated) {
      setItems([]);
      setTotalReviews(0);
      setError(null);
      setStats(null);
      setStatsError(null);
      return;
    }

    void loadReviews();
    void loadStats();
  }, [isAuthenticated, loadReviews, loadStats, sessionReady]);

  return (
    <main className="pageShell">
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
        energyBalance={energy?.balance ?? null}
        energyLabel={t.energy}
        authRequest={authRequest}
      />

      {!sessionReady ? (
        <Surface className="historyEmptyState">
          <LoadingLottie label={t.historyLoading} showLabel={false} />
        </Surface>
      ) : !isAuthenticated ? (
        <Surface className="historyEmptyState">
          <h1>{t.historyAuthTitle}</h1>
          <p>{t.historyAuthBody}</p>
          <div className="historyAuthActions">
            <ActionButton onClick={() => setAuthRequest({ mode: "signIn", id: Date.now() })}>{t.authRequiredLogin}</ActionButton>
            <ActionButton variant="primary" onClick={() => setAuthRequest({ mode: "signUp", id: Date.now() })}>
              {t.authRequiredSignUp}
            </ActionButton>
          </div>
        </Surface>
      ) : (
        <>
          <section className="historyRecordsSection">
            <Surface className="historyListSurface">
              <div className="historyPageHeader">
                <div>
                  <h1 className="historyPageTitle">{t.historyTitle}</h1>
                  <p className="uiSectionBody">
                    {t.historyListCount.replace("{count}", String(totalReviews))}
                  </p>
                </div>
                <ActionLink href={checkerHref} variant="secondary">
                  {t.historyBackToChecker}
                </ActionLink>
              </div>

              <div className="historyFilters">
                <div className="historyFilterControl">
                  <span className="historyFilterLabel">{t.historyTaskFilterLabel}</span>
                  <div className="historyFilterGroup" role="group" aria-label={t.historyTaskFilterLabel}>
                    {(["all", "task1", "task2"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={`historyFilterButton${taskFilter === value ? " is-active" : ""}`}
                        aria-pressed={taskFilter === value}
                        onClick={() => setTaskFilter(value)}
                      >
                        {value === "all" ? t.historyTaskFilterAll : value === "task1" ? navbar.task1 : navbar.task2}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="historyFilterControl">
                  <span className="historyFilterLabel">{t.historyRecentCountLabel}</span>
                  <div className="historyFilterGroup" role="group" aria-label={t.historyRecentCountLabel}>
                    {RECENT_COUNT_OPTIONS.map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={`historyFilterButton${recentCount === value ? " is-active" : ""}`}
                        aria-pressed={recentCount === value}
                        onClick={() => setRecentCount(value)}
                      >
                        {value} {t.historyRecentCountSuffix}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="historyListHeader">
                <h2>{t.historyListTitle}</h2>
                <span>{describeTaskFilter(taskFilter, navbar, t.historyTaskFilterAll)}</span>
              </div>

              {loadingList ? <LoadingLottie label={t.historyLoading} showLabel={false} /> : null}
              {error && !loadingList ? <p className="errorBox">{error}</p> : null}
              {!loadingList && !items.length ? (
                <div className="historyEmptyPanel">
                  <h3>{t.historyEmptyTitle}</h3>
                  <p>{t.historyEmptyBody}</p>
                  <ActionLink href={checkerHref}>{t.historyBackToChecker}</ActionLink>
                </div>
              ) : null}

              <div className="historyList">
                {items.map((item) => {
                  const detailHref = `/${locale}/history/${item.id}`;
                  return (
                    <Link key={item.id} href={detailHref} className="historyListItem">
                      <div className="historyListItemTop">
                        <div className="historyListHeading">
                          <strong>{item.taskType === "task1" ? navbar.task1 : navbar.task2}</strong>
                          <span className="historyListTimestamp">{formatReviewTime(item.createdAt, locale)}</span>
                        </div>
                        <Pill>Band {item.estimatedBand.toFixed(1)}</Pill>
                      </div>
                      <div className={`historyListContent${item.hasImage ? " has-image" : ""}`}>
                        <div className="historyListCopy">
                          <p className="historyListPreview">{item.promptPreview}</p>
                          <p className="historyListEssayPreview">{item.essayPreview}</p>
                        </div>
                        {item.hasImage ? (
                          <div className="historyListThumbnail">
                            <Image
                              src={`/api/reviews/${encodeURIComponent(item.id)}/image`}
                              alt={t.historyOriginalImage}
                              width={360}
                              height={203}
                              loading="lazy"
                              unoptimized
                            />
                          </div>
                        ) : null}
                      </div>
                      <div className="historyListFooter">
                        <div className="historyListMeta">
                          <span>
                            {item.wordCount} {t.wordsUnit}
                          </span>
                        </div>
                        <span className="historyListAction" aria-hidden="true">
                          {t.historyViewDetail} <span>→</span>
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </Surface>
          </section>

          {!loadingList && items.length > 0 ? (
            <section className="historyAnalytics">
              <Surface className="historyAnalyticsCard">
                <div className="historyAnalyticsHeader">
                  <div>
                    <h2>{t.historyAnalyticsTitle}</h2>
                    <p className="uiSectionBody">
                      {describeTaskFilter(taskFilter, navbar, t.historyTaskFilterAll)} · {recentCount}{" "}
                      {t.historyRecentCountSuffix}
                    </p>
                  </div>
                </div>

                {loadingStats ? <LoadingLottie label={t.historyLoading} showLabel={false} size="small" /> : null}
                {statsError && !loadingStats ? <p className="errorBox">{statsError}</p> : null}

                {!loadingStats && !statsError ? (
                  <>
                    <div className="historyAnalyticsOverview">
                      <div className="historyAnalyticsMetric">
                        <span>{t.historyStatsTotalReviews}</span>
                        <strong>{stats?.totalReviews ?? 0}</strong>
                      </div>
                      <div className="historyAnalyticsMetric">
                        <span>{t.historyStatsTotalGrammarFixes}</span>
                        <strong>{stats?.totalGrammarCorrections ?? 0}</strong>
                      </div>
                    </div>

                    <div className="historyChartGrid">
                      <article className="historyChartCard">
                        <div className="historyChartHeader">
                          <p className="sectionLabel">{t.historyGrammarPieTitle}</p>
                          <p className="uiSectionBody">{t.historyGrammarPieBody}</p>
                        </div>
                        <PieChart stats={stats} locale={locale} emptyLabel={t.historyChartEmpty} />
                      </article>

                      <article className="historyChartCard">
                        <div className="historyChartHeader">
                          <p className="sectionLabel">{t.historyScoreTrendTitle}</p>
                          <p className="uiSectionBody">{t.historyScoreTrendBody}</p>
                        </div>
                        <ScoreTrendChart stats={stats} locale={locale} emptyLabel={t.historyChartEmpty} />
                      </article>
                    </div>
                  </>
                ) : null}
              </Surface>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
