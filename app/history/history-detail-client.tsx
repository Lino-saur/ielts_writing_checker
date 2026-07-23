"use client";

import { useCallback, useEffect, useState } from "react";
import { AppNavbar } from "@/components/app-navbar";
import { LoadingLottie } from "@/components/loading-lottie";
import { LingMascot } from "@/components/ling-mascot";
import { ActionButton, Surface } from "@/components/ui-kit";
import { useAuthSession } from "@/lib/auth-client-session";
import { getMessages } from "@/lib/i18n/messages";
import { useRouteLocale } from "@/lib/i18n/use-route-locale";
import type { WritingReviewDetail, WritingReviewThread } from "@/lib/types";
import { describeReviewProgressStage, formatReviewTime, ReviewDetailContent } from "./history-shared";

type EnergyState = {
  balance: number;
  totalConsumed: number;
  totalRecharged: number;
  updatedAt: string;
};

type HistoryDetailPageClientProps = {
  reviewId: string;
};

type ShareState = {
  active: boolean;
  token: string | null;
  createdAt: string | null;
};

function countImprovedCriteria(
  current: NonNullable<WritingReviewDetail["result"]>,
  previous: NonNullable<WritingReviewDetail["result"]>
) {
  const currentScores = [
    current.bandBreakdown.taskAchievement.score,
    current.bandBreakdown.coherenceAndCohesion.score,
    current.bandBreakdown.lexicalResource.score,
    current.bandBreakdown.grammaticalRangeAndAccuracy.score
  ];
  const previousScores = [
    previous.bandBreakdown.taskAchievement.score,
    previous.bandBreakdown.coherenceAndCohesion.score,
    previous.bandBreakdown.lexicalResource.score,
    previous.bandBreakdown.grammaticalRangeAndAccuracy.score
  ];

  return currentScores.filter((score, index) => score > previousScores[index]).length;
}

export default function HistoryDetailPageClient({ reviewId }: HistoryDetailPageClientProps) {
  const { sessionContext, sessionResolved } = useAuthSession();
  const [locale, setLocale] = useRouteLocale();
  const [energy, setEnergy] = useState<EnergyState | null>(sessionContext.energy as EnergyState | null);
  const [authRequest, setAuthRequest] = useState<{ mode: "signIn" | "signUp"; id: number } | null>(null);
  const [thread, setThread] = useState<WritingReviewThread | null>(null);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [editingBaseReviewId, setEditingBaseReviewId] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftEssay, setDraftEssay] = useState("");
  const [editingAcceptedRevisionIds, setEditingAcceptedRevisionIds] = useState<string[]>([]);
  const [submittingRevision, setSubmittingRevision] = useState(false);
  const [revisionError, setRevisionError] = useState<string | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareState, setShareState] = useState<ShareState | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareCopyState, setShareCopyState] = useState<"idle" | "copied">("idle");

  const { checker: t, navbar } = getMessages(locale);
  const sessionReady = sessionResolved;
  const isAuthenticated = Boolean(sessionContext.user);
  const firstReview = thread?.items[0] ?? null;
  const latestReview = thread?.items[thread.items.length - 1] ?? null;
  const selectedReview = thread?.items.find((item) => item.id === selectedReviewId) ?? latestReview;
  const selectedReviewIndex = selectedReview
    ? thread?.items.findIndex((item) => item.id === selectedReview.id) ?? -1
    : -1;
  const previousReview = selectedReviewIndex > 0 ? thread?.items[selectedReviewIndex - 1] ?? null : null;
  const progressSummary =
    selectedReview?.status === "completed" &&
    selectedReview.result &&
    previousReview?.status === "completed" &&
    previousReview.result
      ? {
          bandDelta: selectedReview.result.estimatedBand - previousReview.result.estimatedBand,
          improvedCriteria: countImprovedCriteria(selectedReview.result, previousReview.result)
        }
      : null;
  const editingBaseReview = thread?.items.find((item) => item.id === editingBaseReviewId) ?? null;
  const draftWordCount = draftEssay.trim() ? draftEssay.trim().split(/\s+/).length : 0;
  const draftMinimumWords = editingBaseReview?.taskType === "task1" ? 150 : 250;

  const loadThread = useCallback(async (silent = false) => {
    if (!silent) setLoadingDetail(true);
    setError(null);
    try {
      const response = await fetch(`/api/reviews/${encodeURIComponent(reviewId)}?thread=1`, { cache: "no-store" });
      const data = (await response.json()) as WritingReviewThread | { error?: string };
      if (response.status === 404) throw new Error("NOT_FOUND");
      if (!response.ok || !("items" in data)) throw new Error("REQUEST_FAILED");
      setThread(data);
      const newest = data.items[data.items.length - 1];
      if (newest) setSelectedReviewId((current) => current && data.items.some((item) => item.id === current) ? current : newest.id);
    } catch (loadError) {
      if (!silent) {
        setThread(null);
        setError(loadError instanceof Error && loadError.message === "NOT_FOUND" ? t.historyNotFound : t.historyLoadError);
      }
    } finally {
      if (!silent) setLoadingDetail(false);
    }
  }, [reviewId, t.historyLoadError, t.historyNotFound]);

  useEffect(() => {
    setEnergy(sessionContext.energy as EnergyState | null);
  }, [sessionContext.energy]);

  useEffect(() => {
    if (!sessionReady) return;
    if (!isAuthenticated) {
      setThread(null);
      setError(null);
      return;
    }
    void loadThread();
  }, [isAuthenticated, loadThread, sessionReady]);

  useEffect(() => {
    if (latestReview?.status !== "processing") return;
    const timer = window.setInterval(() => void loadThread(true), 3_000);
    return () => window.clearInterval(timer);
  }, [latestReview?.status, loadThread]);

  useEffect(() => {
    if (!selectedReview || editingBaseReviewId === selectedReview.id) return;
    setEditingBaseReviewId(selectedReview.id);
    setDraftEssay(selectedReview.essay);
    setEditingAcceptedRevisionIds([]);
    setRevisionError(null);
  }, [editingBaseReviewId, selectedReview]);

  useEffect(() => {
    setShareDialogOpen(false);
    setShareState(null);
    setShareError(null);
    setShareCopyState("idle");
  }, [selectedReviewId]);

  useEffect(() => {
    if (!shareDialogOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setShareDialogOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [shareDialogOpen]);

  async function openShareDialog() {
    if (!selectedReview || selectedReview.status !== "completed") return;
    setShareDialogOpen(true);
    setShareLoading(true);
    setShareError(null);
    setShareCopyState("idle");
    try {
      const response = await fetch(`/api/reviews/${encodeURIComponent(selectedReview.id)}/share`, { cache: "no-store" });
      const data = (await response.json()) as ShareState | { error?: string };
      if (!response.ok || !("active" in data)) throw new Error("SHARE_LOAD_FAILED");
      setShareState(data);
    } catch {
      setShareError(t.shareReviewFailed);
    } finally {
      setShareLoading(false);
    }
  }

  async function ensureShareLink() {
    if (!selectedReview) return null;
    if (shareState?.active && shareState.token) {
      return `${window.location.origin}/share/${shareState.token}`;
    }
    const response = await fetch(`/api/reviews/${encodeURIComponent(selectedReview.id)}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale })
    });
    const data = (await response.json()) as ShareState | { error?: string };
    if (!response.ok || !("active" in data) || !data.token) throw new Error("SHARE_CREATE_FAILED");
    setShareState(data);
    return `${window.location.origin}/share/${data.token}`;
  }

  async function copyShareLink() {
    setShareLoading(true);
    setShareError(null);
    try {
      const link = await ensureShareLink();
      if (!link) throw new Error("SHARE_CREATE_FAILED");
      await navigator.clipboard.writeText(link);
      setShareCopyState("copied");
    } catch {
      setShareError(t.shareReviewFailed);
    } finally {
      setShareLoading(false);
    }
  }

  async function shareWithSystem() {
    setShareLoading(true);
    setShareError(null);
    try {
      const link = await ensureShareLink();
      if (!link) throw new Error("SHARE_CREATE_FAILED");
      if (navigator.share) {
        await navigator.share({ title: t.shareReviewTitle, text: t.shareReviewMessage, url: link });
      } else {
        await navigator.clipboard.writeText(link);
        setShareCopyState("copied");
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setShareError(t.shareReviewFailed);
    } finally {
      setShareLoading(false);
    }
  }

  async function revokeShareLink() {
    if (!selectedReview) return;
    setShareLoading(true);
    setShareError(null);
    try {
      const response = await fetch(`/api/reviews/${encodeURIComponent(selectedReview.id)}/share`, { method: "DELETE" });
      if (!response.ok) throw new Error("SHARE_REVOKE_FAILED");
      setShareState({ active: false, token: null, createdAt: null });
      setShareCopyState("idle");
    } catch {
      setShareError(t.shareReviewFailed);
    } finally {
      setShareLoading(false);
    }
  }

  function startRevisionFromRound(review: WritingReviewDetail, essay: string, acceptedRevisionIds: string[]) {
    setSelectedReviewId(review.id);
    setEditingBaseReviewId(review.id);
    setDraftEssay(essay);
    setEditingAcceptedRevisionIds(acceptedRevisionIds);
    setRevisionError(null);
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLTextAreaElement>(".historyEssayEditor")?.scrollIntoView({ behavior: "smooth", block: "center" });
      document.querySelector<HTMLTextAreaElement>(".historyEssayEditor")?.focus();
    });
  }

  async function submitNextRevision() {
    if (!editingBaseReview || editingBaseReview.status !== "completed" || submittingRevision || !draftEssay.trim()) return;
    setSubmittingRevision(true);
    setRevisionError(null);
    try {
      const response = await fetch("/api/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": window.crypto.randomUUID()
        },
        body: JSON.stringify({
          taskType: editingBaseReview.taskType,
          prompt: editingBaseReview.prompt,
          essay: draftEssay,
          locale,
          targetBand: editingBaseReview.targetBand,
          parentReviewId: editingBaseReview.id,
          acceptedRevisionIds: editingAcceptedRevisionIds
        })
      });
      const data = (await response.json()) as {
        reviewId?: string;
        energy?: EnergyState;
        error?: string;
      };
      if (data.energy) setEnergy(data.energy);
      if (!response.ok) {
        if (data.error === "INSUFFICIENT_ENERGY") throw new Error(t.insufficientEnergy);
        throw new Error(t.genericError);
      }
      if (data.reviewId) setSelectedReviewId(data.reviewId);
      setEditingBaseReviewId(null);
      setEditingAcceptedRevisionIds([]);
      await loadThread(true);
    } catch (submitError) {
      setRevisionError(submitError instanceof Error ? submitError.message : t.genericError);
    } finally {
      setSubmittingRevision(false);
    }
  }

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
        authRequest={authRequest}
      />

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
          {loadingDetail ? (
            <Surface className="historyEmptyState">
              <LoadingLottie label={t.historyLoadingDetail} showLabel={false} />
            </Surface>
          ) : null}
          {error && !loadingDetail ? <p className="errorBox">{error}</p> : null}

          {!loadingDetail && firstReview && selectedReview ? (
            <Surface as="section" className="checkerWorkbench historySourceWorkbench">
              <div className="checkerInputWorkspace">
                <div className="checkerQuestionColumn">
                  <div className="checkerField checkerPromptBlock">
                    <div className="checkerPromptHeader">
                      <span>{firstReview.taskType === "task1" ? navbar.task1 : navbar.task2}</span>
                      <span className="historyReadOnlyBadge">{t.historyReadOnly}</span>
                    </div>
                    <div className="checkerPromptBody"><p className="checkerPromptText">{firstReview.prompt}</p></div>
                  </div>
                  {firstReview.taskType === "task1" ? (
                    <div className="checkerField checkerUploadBlock">
                      <div className="checkerPromptBody checkerUploadBody">
                        <div className={`checkerUploadDropzone is-readonly${firstReview.image ? " has-preview" : ""}`}>
                          {firstReview.image ? (
                            // Authenticated review images must bypass Next's unauthenticated image optimizer.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={firstReview.image.url} alt={firstReview.image.name} className="checkerUploadPreviewImage" />
                          ) : (
                            <span className="checkerUploadReadonlyEmpty">{t.practiceImageUnavailable}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="checkerDraftPanel historyEssayDraftPanel">
                  <div className="checkerDraftHeader">
                    <div>
                      <h2>{t.essay}</h2>
                      <span className="checkerDraftStatus">
                        {t.reviewRoundLabel.replace(
                          "{round}",
                          String((thread?.items.findIndex((item) => item.id === selectedReview.id) ?? 0) + 1)
                        )}
                      </span>
                    </div>
                    <div className="checkerTargetBandControl historyTargetBandControl">
                      <label className="checkerInlineSelect">
                        <span>{t.targetBand}</span>
                        <select value={selectedReview.targetBand} disabled aria-label={t.targetBand}>
                          <option value={5}>5.0</option>
                          <option value={5.5}>5.5</option>
                          <option value={6}>6.0</option>
                          <option value={6.5}>6.5</option>
                          <option value={7}>7.0</option>
                          <option value={7.5}>7.5</option>
                          <option value={8}>8.0</option>
                        </select>
                      </label>
                      <span className="checkerTargetBandHint">
                        {selectedReview.status === "processing"
                          ? `${t.reviewStatusProcessing} ${selectedReview.progressPercent}%`
                          : t.targetBandHint}
                      </span>
                    </div>
                  </div>
                  <label className="checkerEssayField">
                    <span className="srOnly">{t.essay}</span>
                    <textarea
                      className="checkerEssayInput historyEssayEditor"
                      value={draftEssay}
                      onChange={(event) => setDraftEssay(event.target.value)}
                      rows={20}
                      readOnly={selectedReview.status !== "completed"}
                      aria-label={t.essay}
                    />
                  </label>
                  {revisionError ? <p className="errorBox">{revisionError}</p> : null}
                  <div className="checkerDraftFooter">
                    <div className="checkerDraftMeta">
                      <div className={`checkerWordProgress is-${draftWordCount >= draftMinimumWords ? "ready" : "low"}`}>
                        <div className="checkerWordProgressHeader">
                          <span className="checkerWordHint">
                            <strong>{draftWordCount}</strong>
                            <span> / {draftMinimumWords} {t.wordsUnit}</span>
                          </span>
                        </div>
                        <span className="checkerWordProgressTrack" aria-hidden="true">
                          <span
                            className="checkerWordProgressFill"
                            style={{ width: `${Math.min(100, Math.round((draftWordCount / draftMinimumWords) * 100))}%` }}
                          />
                        </span>
                      </div>
                    </div>
                    <ActionButton
                      variant="primary"
                      disabled={
                        selectedReview.status !== "completed" ||
                        submittingRevision ||
                        !draftEssay.trim() ||
                        draftEssay.trim() === selectedReview.essay.trim()
                      }
                      onClick={() => void submitNextRevision()}
                    >
                      {submittingRevision || selectedReview.status === "processing"
                        ? t.checking
                        : t.reviewContinueSubmit.replace("{cost}", String(sessionContext.reviewCost ?? 1))}
                    </ActionButton>
                  </div>
                  {selectedReview.status === "processing" ? (
                    <div className="reviewProgressPanel" role="status" aria-live="polite">
                      <div className="reviewProgressHeader">
                        <div>
                          <strong>{t.reviewProgressTitle}</strong>
                          <span>{describeReviewProgressStage(selectedReview.progressStage, t)}</span>
                        </div>
                        <b>{selectedReview.progressPercent}%</b>
                      </div>
                      <progress
                        className="reviewProgressBar"
                        max={100}
                        value={selectedReview.progressPercent}
                        aria-label={t.reviewProgressTitle}
                      />
                      <p>{t.reviewProgressBackgroundHint}</p>
                    </div>
                  ) : null}
                  {selectedReview.status === "failed" ? <p className="errorBox">{t.aiReviewFailedAlert}</p> : null}
                </div>
              </div>
            </Surface>
          ) : null}

          {!loadingDetail && thread && selectedReview ? (
            <>
              <Surface as="section" className="reviewRoundNavigator" role="navigation" aria-label={t.reviewThreadTitle}>
                <div className="reviewRoundNavHeader">
                  <p className="sectionLabel">{t.reviewThreadTitle}</p>
                  <strong>{t.reviewThreadCount.replace("{count}", String(thread.items.length))}</strong>
                </div>
                <div className="reviewRoundNav" role="tablist">
                  {thread.items.map((item, index) => {
                    const isSelected = item.id === selectedReview.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={isSelected}
                        className={`reviewRoundNavButton${isSelected ? " is-active" : ""}`}
                        onClick={() => setSelectedReviewId(item.id)}
                      >
                        <span className="reviewRoundNavIndex">{index + 1}</span>
                        <span className="reviewRoundNavCopy">
                          <strong>{t.reviewRoundLabel.replace("{round}", String(index + 1))}</strong>
                          <small>{formatReviewTime(item.createdAt, locale)}</small>
                        </span>
                        <span className={`reviewRoundNavStatus is-${item.status}`}>
                          {item.status === "completed"
                            ? `Band ${item.estimatedBand.toFixed(1)}`
                            : item.status === "processing"
                              ? `${t.reviewStatusProcessing} ${item.progressPercent}%`
                              : t.reviewStatusFailed}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Surface>

              {selectedReview.status === "completed" && selectedReview.result ? (
                <Surface as="section" className="checkerReportShell is-revealed historySelectedReport">
                  {progressSummary ? (
                    <div className="historyProgressSummary">
                      <LingMascot
                        key={`progress-${selectedReview.id}`}
                        state="progress"
                        size="medium"
                        motion
                        className="historyProgressMascot"
                      />
                      <div className="historyProgressCopy">
                        <p className="sectionLabel">{t.progressSummaryEyebrow}</p>
                        <h2>{t.progressSummaryTitle}</h2>
                        <div className="historyProgressMetrics">
                          <span>
                            {progressSummary.bandDelta === 0
                              ? t.progressSummaryBandSteady
                              : t.progressSummaryBandDelta.replace(
                                  "{delta}",
                                  `${progressSummary.bandDelta > 0 ? "+" : ""}${progressSummary.bandDelta.toFixed(1)}`
                                )}
                          </span>
                          <span>
                            {progressSummary.improvedCriteria > 0
                              ? t.progressSummaryCriteriaGain.replace(
                                  "{count}",
                                  String(progressSummary.improvedCriteria)
                                )
                              : t.progressSummaryNextStep}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div className="historyReportToolbar">
                    <div>
                      <p className="sectionLabel">{t.historyResultTitle}</p>
                      <span>{t.shareReviewPrivateHint}</span>
                    </div>
                    <ActionButton onClick={() => void openShareDialog()}>{t.shareReviewAction}</ActionButton>
                  </div>
                  <Surface className="reportPaper checkerReportPaper">
                    <ReviewDetailContent
                      key={selectedReview.id}
                      detail={selectedReview as WritingReviewDetail & { result: NonNullable<WritingReviewDetail["result"]> }}
                      locale={locale}
                      navbar={navbar}
                      t={t}
                      onContinueRevision={(essay, acceptedRevisionIds) =>
                        startRevisionFromRound(selectedReview, essay, acceptedRevisionIds)
                      }
                    />
                  </Surface>
                </Surface>
              ) : null}
            </>
          ) : null}
        </section>
      )}

      {shareDialogOpen ? (
        <div className="shareDialogBackdrop" role="presentation" onMouseDown={() => setShareDialogOpen(false)}>
          <Surface
            as="section"
            className="shareDialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-review-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="shareDialogHeader">
              <div>
                <p className="sectionLabel">{t.shareReviewEyebrow}</p>
                <h2 id="share-review-title">{t.shareReviewTitle}</h2>
              </div>
              <button type="button" className="shareDialogClose" aria-label={t.shareReviewClose} onClick={() => setShareDialogOpen(false)}>×</button>
            </div>
            <p className="shareDialogBody">{t.shareReviewBody}</p>
            <div className="sharePrivacyList">
              <span>✓ {t.shareReviewIncludes}</span>
              <span>✓ {t.shareReviewExcludes}</span>
              <span>✓ {t.shareReviewRevocable}</span>
            </div>
            {shareState?.active && shareState.token ? (
              <div className="shareLinkField">
                <span>{`/share/${shareState.token}`}</span>
              </div>
            ) : null}
            {shareError ? <p className="errorBox">{shareError}</p> : null}
            <div className="shareDialogActions">
              {shareState?.active ? (
                <ActionButton disabled={shareLoading} onClick={() => void revokeShareLink()}>{t.shareReviewDisable}</ActionButton>
              ) : null}
              <ActionButton disabled={shareLoading} onClick={() => void copyShareLink()}>
                {shareCopyState === "copied" ? t.shareReviewCopied : shareState?.active ? t.shareReviewCopy : t.shareReviewCreate}
              </ActionButton>
              <ActionButton variant="primary" disabled={shareLoading} onClick={() => void shareWithSystem()}>
                {shareLoading ? t.shareReviewWorking : t.shareReviewSystem}
              </ActionButton>
            </div>
          </Surface>
        </div>
      ) : null}
    </main>
  );
}
