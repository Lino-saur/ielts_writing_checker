"use client";

import { useEffect, useMemo, useState } from "react";
import { AppNavbar } from "@/components/app-navbar";
import { ActionButton, ActionLink, Pill, Surface } from "@/components/ui-kit";
import { useAuthSession } from "@/lib/auth-client-session";
import { getMessages } from "@/lib/i18n/messages";
import { useRouteLocale } from "@/lib/i18n/use-route-locale";
import type { WritingReviewDetail, WritingReviewListItem } from "@/lib/types";

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

function formatReviewTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function ScoreCard({
  label,
  score,
  rationale
}: {
  label: string;
  score: number;
  rationale: string;
}) {
  return (
    <article className="scoreCard">
      <div className="scoreHeader">
        <div>
          <p className="sectionLabel">{label}</p>
          <h3>{score.toFixed(1)}</h3>
        </div>
      </div>
      <p>{rationale}</p>
    </article>
  );
}

export default function HistoryPageClient() {
  const { sessionContext, sessionResolved } = useAuthSession();
  const [locale, setLocale] = useRouteLocale();
  const [energy, setEnergy] = useState<EnergyState | null>(sessionContext.energy as EnergyState | null);
  const [authRequest, setAuthRequest] = useState<{ mode: "signIn" | "signUp"; id: number } | null>(null);
  const [items, setItems] = useState<WritingReviewListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WritingReviewDetail | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { checker: t, navbar } = getMessages(locale);
  const checkerHref = useMemo(() => `/${locale}/checker`, [locale]);
  const sessionReady = sessionResolved;
  const isAuthenticated = Boolean(sessionContext.user);

  async function loadReviews() {
    setLoadingList(true);
    setError(null);

    try {
      const response = await fetch("/api/reviews?limit=30", {
        cache: "no-store"
      });
      const data = (await response.json()) as ReviewListPayload | { error?: string };

      if (!response.ok || !("items" in data)) {
        throw new Error("REQUEST_FAILED");
      }

      setItems(data.items);
      setSelectedId((current) => current ?? data.items[0]?.id ?? null);
      if (!data.items.length) {
        setDetail(null);
      }
    } catch {
      setError(t.historyLoadError);
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    setEnergy(sessionContext.energy as EnergyState | null);
  }, [sessionContext.energy]);

  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    if (!isAuthenticated) {
      setItems([]);
      setSelectedId(null);
      setDetail(null);
      setError(null);
      return;
    }

    void loadReviews();
  }, [isAuthenticated, sessionReady]);

  useEffect(() => {
    if (!selectedId || !isAuthenticated) {
      return;
    }

    const reviewId = selectedId;
    let cancelled = false;

    async function loadDetail() {
      setLoadingDetail(true);
      setError(null);

      try {
        const response = await fetch(`/api/reviews/${encodeURIComponent(reviewId)}`, {
          cache: "no-store"
        });
        const data = (await response.json()) as WritingReviewDetail | { error?: string };

        if (response.status === 404) {
          throw new Error("NOT_FOUND");
        }

        if (!response.ok || !("id" in data)) {
          throw new Error("REQUEST_FAILED");
        }

        if (!cancelled) {
          setDetail(data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setDetail(null);
          setError(loadError instanceof Error && loadError.message === "NOT_FOUND" ? t.historyNotFound : t.historyLoadError);
        }
      } finally {
        if (!cancelled) {
          setLoadingDetail(false);
        }
      }
    }

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, selectedId, t.historyLoadError, t.historyNotFound]);

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

      <section className="historyHero">
        <Surface className="historyHeroCard">
          <div>
            <p className="eyebrow">{t.historyTitle}</p>
            <h1>{t.historyTitle}</h1>
            <p className="uiSectionBody">{t.historyBody}</p>
          </div>
          <ActionLink href={checkerHref} variant="secondary">
            {t.historyBackToChecker}
          </ActionLink>
        </Surface>
      </section>

      {!sessionReady ? (
        <Surface className="historyEmptyState">
          <p>{t.historyLoading}</p>
        </Surface>
      ) : !isAuthenticated ? (
        <Surface className="historyEmptyState">
          <h2>{t.historyAuthTitle}</h2>
          <p>{t.historyAuthBody}</p>
          <div className="historyAuthActions">
            <ActionButton onClick={() => setAuthRequest({ mode: "signIn", id: Date.now() })}>
              {t.authRequiredLogin}
            </ActionButton>
            <ActionButton variant="primary" onClick={() => setAuthRequest({ mode: "signUp", id: Date.now() })}>
              {t.authRequiredSignUp}
            </ActionButton>
          </div>
        </Surface>
      ) : (
        <section className="historyLayout">
          <Surface className="historySidebar">
            <div className="historySidebarHeader">
              <div>
                <p className="sectionLabel">{t.historyListTitle}</p>
                <p className="uiSectionBody">{items.length}</p>
              </div>
            </div>

            {loadingList ? <p>{t.historyLoading}</p> : null}
            {error && !loadingList ? <p className="errorBox">{error}</p> : null}
            {!loadingList && !items.length ? (
              <div className="historyEmptyPanel">
                <h3>{t.historyEmptyTitle}</h3>
                <p>{t.historyEmptyBody}</p>
              </div>
            ) : null}

            <div className="historyList">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`historyListItem${selectedId === item.id ? " is-active" : ""}`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className="historyListItemTop">
                    <strong>{item.taskType === "task1" ? navbar.task1 : navbar.task2}</strong>
                    <Pill>{item.estimatedBand.toFixed(1)}</Pill>
                  </div>
                  <div className="historyListMeta">
                    <span>
                      {t.historyCreatedAt}: {formatReviewTime(item.createdAt, locale)}
                    </span>
                    <span>
                      {item.wordCount} {t.wordsUnit}
                    </span>
                    <span>{item.hasImage ? t.task1ImageLabel : t.historyNoImage}</span>
                  </div>
                </button>
              ))}
            </div>
          </Surface>

          <Surface className="historyDetail">
            {loadingDetail ? <p>{t.historyLoadingDetail}</p> : null}

            {!loadingDetail && detail ? (
              <>
                <div className="resultHero">
                  <div className="resultScore">
                    <p className="sectionLabel">{t.estimatedBand}</p>
                    <h2>{detail.estimatedBand.toFixed(1)}</h2>
                  </div>
                  <div className="resultHeroActions">
                    <div className="resultMeta">
                      <Pill>
                        {t.targetChipLabel} {detail.targetBand.toFixed(1)}
                      </Pill>
                      <Pill>
                        {detail.wordCount} {t.wordsUnit}
                      </Pill>
                      <Pill>{detail.providerUsed}</Pill>
                    </div>
                  </div>
                </div>

                <article className="feedbackSection">
                  <p className="sectionLabel">{t.historyOriginalPrompt}</p>
                  <p className="historyTextBlock">{detail.prompt}</p>
                </article>

                <article className="feedbackSection">
                  <p className="sectionLabel">{t.historyOriginalEssay}</p>
                  <pre className="historyEssayBlock">{detail.essay}</pre>
                </article>

                <article className="feedbackSection">
                  <p className="sectionLabel">{t.historyOriginalImage}</p>
                  {detail.image ? (
                    <div className="historyImagePanel">
                      <img src={detail.image.url} alt={detail.image.name} className="historyImage" />
                    </div>
                  ) : (
                    <p>{t.historyNoImage}</p>
                  )}
                </article>

                <article className="feedbackSection">
                  <p className="sectionLabel">{t.historyResultTitle}</p>
                  <div className="scoreGrid">
                    <ScoreCard
                      label={t.taskAchievement}
                      score={detail.result.bandBreakdown.taskAchievement.score}
                      rationale={detail.result.bandBreakdown.taskAchievement.rationale}
                    />
                    <ScoreCard
                      label={t.coherence}
                      score={detail.result.bandBreakdown.coherenceAndCohesion.score}
                      rationale={detail.result.bandBreakdown.coherenceAndCohesion.rationale}
                    />
                    <ScoreCard
                      label={t.lexical}
                      score={detail.result.bandBreakdown.lexicalResource.score}
                      rationale={detail.result.bandBreakdown.lexicalResource.rationale}
                    />
                    <ScoreCard
                      label={t.grammar}
                      score={detail.result.bandBreakdown.grammaticalRangeAndAccuracy.score}
                      rationale={detail.result.bandBreakdown.grammaticalRangeAndAccuracy.rationale}
                    />
                  </div>
                </article>

                <article className="feedbackSection">
                  <p className="sectionLabel">{t.strengths}</p>
                  <ul>
                    {detail.result.strengths.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>

                <article className="feedbackSection">
                  <p className="sectionLabel">{t.highlightedSentences}</p>
                  <div className="correctionList">
                    {detail.result.highlightedSentences.map((item, index) => (
                      <article key={`${item.sentence}-${index}`} className="correctionCard">
                        <p>
                          <strong>{t.highlightedSentence}:</strong> {item.sentence}
                        </p>
                        <p>
                          <strong>{t.highlightedReason}:</strong> {item.reason}
                        </p>
                      </article>
                    ))}
                  </div>
                </article>

                <article className="feedbackSection">
                  <p className="sectionLabel">{t.priorityFixes}</p>
                  <ul>
                    {detail.result.priorityFixes.map((item) => (
                      <li key={item.title}>
                        <strong>{item.title}:</strong> {item.detail}
                      </li>
                    ))}
                  </ul>
                </article>

                <article className="feedbackSection">
                  <p className="sectionLabel">{t.revisionStageGrammar}</p>
                  <div className="correctionList">
                    {(detail.result.grammarRevision?.correctionNotes ?? detail.result.correctionNotes).map((item) => (
                      <article key={`grammar-${item.id}`} className="correctionCard">
                        <p>
                          <strong>{t.correctionOriginal}:</strong> {item.original}
                        </p>
                        <p>
                          <strong>{t.correctionCorrected}:</strong> {item.corrected}
                        </p>
                        <p>
                          <strong>{t.correctionReason}:</strong> {item.reason}
                        </p>
                      </article>
                    ))}
                  </div>
                </article>

                <article className="feedbackSection">
                  <p className="sectionLabel">{t.revisionStageOptimization}</p>
                  <div className="correctionList">
                    {(detail.result.optimizationRevision?.correctionNotes ?? detail.result.correctionNotes).map((item) => (
                      <article key={`optimization-${item.id}`} className="correctionCard">
                        <p>
                          <strong>{t.correctionOriginal}:</strong> {item.original}
                        </p>
                        <p>
                          <strong>{t.correctionCorrected}:</strong> {item.corrected}
                        </p>
                        <p>
                          <strong>{t.correctionReason}:</strong> {item.reason}
                        </p>
                      </article>
                    ))}
                  </div>
                </article>
              </>
            ) : null}
          </Surface>
        </section>
      )}
    </main>
  );
}
