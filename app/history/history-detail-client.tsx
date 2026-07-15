"use client";

import { useEffect, useMemo, useState } from "react";
import { AppNavbar } from "@/components/app-navbar";
import { LoadingLottie } from "@/components/loading-lottie";
import { ActionButton, ActionLink, Surface } from "@/components/ui-kit";
import { useAuthSession } from "@/lib/auth-client-session";
import { getMessages } from "@/lib/i18n/messages";
import { useRouteLocale } from "@/lib/i18n/use-route-locale";
import type { WritingReviewDetail } from "@/lib/types";
import { ReviewDetailContent } from "./history-shared";

type EnergyState = {
  balance: number;
  totalConsumed: number;
  totalRecharged: number;
  updatedAt: string;
};

type HistoryDetailPageClientProps = {
  reviewId: string;
};

export default function HistoryDetailPageClient({ reviewId }: HistoryDetailPageClientProps) {
  const { sessionContext, sessionResolved } = useAuthSession();
  const [locale, setLocale] = useRouteLocale();
  const [energy, setEnergy] = useState<EnergyState | null>(sessionContext.energy as EnergyState | null);
  const [authRequest, setAuthRequest] = useState<{ mode: "signIn" | "signUp"; id: number } | null>(null);
  const [detail, setDetail] = useState<WritingReviewDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { checker: t, navbar } = getMessages(locale);
  const historyHref = useMemo(() => `/${locale}/history`, [locale]);
  const sessionReady = sessionResolved;
  const isAuthenticated = Boolean(sessionContext.user);

  useEffect(() => {
    setEnergy(sessionContext.energy as EnergyState | null);
  }, [sessionContext.energy]);

  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    if (!isAuthenticated) {
      setDetail(null);
      setError(null);
      return;
    }

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
  }, [isAuthenticated, reviewId, sessionReady, t.historyLoadError, t.historyNotFound]);

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
            <h1>{t.historyResultTitle}</h1>
            <p className="uiSectionBody">{t.historyBody}</p>
          </div>
          <ActionLink href={historyHref} variant="secondary">
            {t.historyTitle}
          </ActionLink>
        </Surface>
      </section>

      {!sessionReady ? (
        <Surface className="historyEmptyState">
          <LoadingLottie label={t.historyLoadingDetail} showLabel={false} />
        </Surface>
      ) : !isAuthenticated ? (
        <Surface className="historyEmptyState">
          <h2>{t.historyAuthTitle}</h2>
          <p>{t.historyAuthBody}</p>
          <div className="historyAuthActions">
            <ActionButton onClick={() => setAuthRequest({ mode: "signIn", id: Date.now() })}>{t.authRequiredLogin}</ActionButton>
            <ActionButton variant="primary" onClick={() => setAuthRequest({ mode: "signUp", id: Date.now() })}>
              {t.authRequiredSignUp}
            </ActionButton>
          </div>
        </Surface>
      ) : (
        <section className="historyDetailPage">
          <Surface as="section" className="checkerReportShell is-revealed">
            <Surface className="reportPaper checkerReportPaper historyDetailStandalone">
              {loadingDetail ? <LoadingLottie label={t.historyLoadingDetail} showLabel={false} /> : null}
              {error && !loadingDetail ? <p className="errorBox">{error}</p> : null}
              {!loadingDetail && detail ? <ReviewDetailContent detail={detail} locale={locale} navbar={navbar} t={t} /> : null}
            </Surface>
          </Surface>
        </section>
      )}
    </main>
  );
}
