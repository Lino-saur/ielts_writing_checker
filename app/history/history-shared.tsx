"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pill } from "@/components/ui-kit";
import { TeachingRuleReferences } from "@/components/teaching-rule-references";
import { getRevisionCategoryLabel } from "@/lib/ielts/revision-categories";
import { getMessages } from "@/lib/i18n/messages";
import type { CorrectionNote, Locale, WritingReviewDetail } from "@/lib/types";

type CheckerMessages = ReturnType<typeof getMessages>["checker"];
type NavbarMessages = ReturnType<typeof getMessages>["navbar"];

export function formatReviewTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function describeTaskFilter(taskType: "all" | "task1" | "task2", navbar: NavbarMessages, allTasksLabel: string) {
  if (taskType === "task1") {
    return navbar.task1;
  }

  if (taskType === "task2") {
    return navbar.task2;
  }

  return allTasksLabel;
}

export function ScoreCard({
  label,
  score,
  rationale,
  defaultExpanded = false,
  showDetailsLabel,
  hideDetailsLabel
}: {
  label: string;
  score: number;
  rationale: string;
  defaultExpanded?: boolean;
  showDetailsLabel: string;
  hideDetailsLabel: string;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <article className="scoreCard">
      <button
        type="button"
        className="scoreCardToggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        <div>
          <p className="sectionLabel">{label}</p>
          <h3>{score.toFixed(1)}</h3>
        </div>
        <span className="scoreCardToggleMeta">
          {expanded ? hideDetailsLabel : showDetailsLabel}
          <i className={`ai-chevron-${expanded ? "up" : "down"}`} aria-hidden="true" />
        </span>
      </button>
      {expanded ? <p className="scoreCardRationale">{rationale}</p> : null}
    </article>
  );
}

function FeedbackDisclosure({
  label,
  count,
  itemsLabel,
  defaultExpanded = false,
  children
}: {
  label: string;
  count: number;
  itemsLabel: string;
  defaultExpanded?: boolean;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <article className="feedbackSection feedbackDisclosure">
      <button
        type="button"
        className="feedbackDisclosureToggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        <span className="sectionLabel">{label}</span>
        <span className="feedbackDisclosureMeta">
          {count} {itemsLabel}
          <i className={`ai-chevron-${expanded ? "up" : "down"}`} aria-hidden="true" />
        </span>
      </button>
      {expanded ? <div className="feedbackDisclosureBody">{children}</div> : null}
    </article>
  );
}

function parseAnnotatedEssay(text: string, correctionNotes: CorrectionNote[]) {
  const notesById = new Map(correctionNotes.map((note) => [note.id, note]));
  const parts: Array<
    | { type: "plain"; text: string }
    | { type: "edit"; id: string; original: string; corrected: string; note?: CorrectionNote; index: number }
    | { type: "del" | "add"; text: string }
  > = [];
  const edits: Array<{
    id: string;
    original: string;
    corrected: string;
    note?: CorrectionNote;
    index: number;
  }> = [];
  const pairPattern = /\[del#([A-Za-z0-9_-]+)\]([\s\S]*?)\[\/del#\1\]\[add#\1\]([\s\S]*?)\[\/add#\1\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let editIndex = 0;

  while ((match = pairPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "plain", text: text.slice(lastIndex, match.index) });
    }

    const edit = {
      id: match[1],
      original: match[2],
      corrected: match[3],
      note: notesById.get(match[1]),
      index: editIndex
    };

    parts.push({ type: "edit", ...edit });
    edits.push(edit);
    editIndex += 1;
    lastIndex = pairPattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "plain", text: text.slice(lastIndex) });
  }

  return { parts, edits };
}

function groupRevisionEditsByCategory(
  edits: ReturnType<typeof parseAnnotatedEssay>["edits"],
  locale: Locale
) {
  const groups = new Map<
    string,
    {
      key: string;
      label: string;
      edits: typeof edits;
    }
  >();

  edits.forEach((edit) => {
    const key = edit.note?.category?.trim() || "other";
    const existing = groups.get(key);

    if (existing) {
      existing.edits.push(edit);
      return;
    }

    groups.set(key, {
      key,
      label: getRevisionCategoryLabel(key, locale === "zh-CN" ? "zh-CN" : "en"),
      edits: [edit]
    });
  });

  return Array.from(groups.values());
}

function renderAnnotatedEssay(
  text: string,
  highlightedSentences: string[],
  correctionNotes: CorrectionNote[],
  isEnhancement: boolean,
  activeEditIndex: number | null,
  onToggleEdit: (index: number) => void,
  t: CheckerMessages
) {
  const { parts } = parseAnnotatedEssay(text, correctionNotes);

  function renderPlainTextSegment(segment: string, keyPrefix: string) {
    if (!highlightedSentences.length) {
      return <span key={keyPrefix}>{segment}</span>;
    }

    const normalizedCandidates = highlightedSentences.filter(Boolean);
    if (!normalizedCandidates.length) {
      return <span key={keyPrefix}>{segment}</span>;
    }

    const subparts: React.ReactNode[] = [];
    let remaining = segment;
    let cursor = 0;

    while (remaining.length > 0) {
      let matchedSentence = "";
      let matchedIndex = -1;

      for (const candidate of normalizedCandidates) {
        const index = remaining.indexOf(candidate);
        if (index !== -1 && (matchedIndex === -1 || index < matchedIndex)) {
          matchedSentence = candidate;
          matchedIndex = index;
        }
      }

      if (matchedIndex === -1) {
        subparts.push(<span key={`${keyPrefix}-tail-${cursor}`}>{remaining}</span>);
        break;
      }

      if (matchedIndex > 0) {
        subparts.push(<span key={`${keyPrefix}-plain-${cursor}`}>{remaining.slice(0, matchedIndex)}</span>);
      }

      subparts.push(
        <mark
          key={`${keyPrefix}-highlight-${cursor}`}
          className="essayHighlight"
          title={t.revisionLegendHighlight}
        >
          <span className="essayHighlightIcon" aria-hidden="true">★</span>
          {matchedSentence}
        </mark>
      );

      remaining = remaining.slice(matchedIndex + matchedSentence.length);
      cursor += 1;
    }

    return <span key={keyPrefix}>{subparts}</span>;
  }

  return parts.map((part, index) => {
    if (part.type === "edit") {
      const isActive = activeEditIndex === part.index;

      return (
        <span
          key={`edit-${part.index}-${index}`}
          className={`editChip${isEnhancement ? " is-enhancement" : ""}${isActive ? " active" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => onToggleEdit(part.index)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onToggleEdit(part.index);
            }
          }}
        >
          {isEnhancement ? (
            <span className="essayEnhancement">
              {part.original}
              <span className="essayEnhancementIcon" aria-hidden="true">✦</span>
            </span>
          ) : (
            <>
              <del className="essayDel">{part.original}</del>
              <ins className="essayAdd">{part.corrected}</ins>
            </>
          )}
          {part.note ? (
            <span className={`editTooltip${isActive ? " visible" : ""}`}>
              {isEnhancement ? (
                <>
                  <span className="editTooltipEnhancementHeader">
                    <span aria-hidden="true">✦</span>
                    {t.revisionOptimizationOptional}
                  </span>
                  <span className="editTooltipEnhancementPair">
                    <span>{part.original}</span>
                    <i className="ai-arrow-right" aria-hidden="true" />
                    <strong>{part.corrected}</strong>
                  </span>
                </>
              ) : null}
              <strong>{t.correctionReason}:</strong> {part.note.reason}
            </span>
          ) : null}
        </span>
      );
    }

    if (part.type === "del") {
      return (
        <del key={index} className="essayDel">
          {part.text}
        </del>
      );
    }

    if (part.type === "add") {
      return (
        <ins key={index} className="essayAdd">
          {part.text}
        </ins>
      );
    }

    return renderPlainTextSegment(part.text, `plain-${index}`);
  });
}

export function ReviewDetailContent({
  detail,
  locale,
  navbar,
  t
}: {
  detail: WritingReviewDetail;
  locale: Locale;
  navbar: NavbarMessages;
  t: CheckerMessages;
}) {
  const [reportView, setReportView] = useState<"overview" | "revise">("overview");
  const [activeEditIndex, setActiveEditIndex] = useState<number | null>(null);
  const [activeRevisionStage, setActiveRevisionStage] = useState<"grammar" | "optimization">("optimization");
  const [expandedRevisionCategories, setExpandedRevisionCategories] = useState<Record<string, boolean>>({});
  const activeEditRef = useRef<HTMLDivElement | null>(null);
  const currentRevisionStage = useMemo(
    () => activeRevisionStage === "grammar"
      ? (detail.result.grammarRevision ?? {
          annotatedEssay: detail.result.annotatedEssay,
          correctionNotes: detail.result.correctionNotes
        })
      : (detail.result.optimizationRevision ?? {
          annotatedEssay: detail.result.annotatedEssay,
          correctionNotes: detail.result.correctionNotes
        }),
    [activeRevisionStage, detail.result]
  );
  const parsedRevision = useMemo(
    () => parseAnnotatedEssay(currentRevisionStage.annotatedEssay, currentRevisionStage.correctionNotes),
    [currentRevisionStage]
  );
  const groupedRevisionEdits = useMemo(
    () => groupRevisionEditsByCategory(parsedRevision.edits, locale),
    [locale, parsedRevision.edits]
  );
  const weakestCriterionKey = [
    { key: "taskAchievement", score: detail.result.bandBreakdown.taskAchievement.score },
    { key: "coherence", score: detail.result.bandBreakdown.coherenceAndCohesion.score },
    { key: "lexical", score: detail.result.bandBreakdown.lexicalResource.score },
    { key: "grammar", score: detail.result.bandBreakdown.grammaticalRangeAndAccuracy.score }
  ].reduce((weakest, criterion) => criterion.score < weakest.score ? criterion : weakest).key;

  function openRevisionFromFeedback() {
    setReportView("revise");
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        activeEditRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  useEffect(() => {
    setActiveEditIndex(null);
  }, [activeRevisionStage, detail.id]);

  useEffect(() => {
    if (activeEditIndex === null) {
      return;
    }

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (!activeEditRef.current) {
        return;
      }

      const target = event.target;
      if (target instanceof Node && !activeEditRef.current.contains(target)) {
        setActiveEditIndex(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [activeEditIndex]);

  useEffect(() => {
    if (!groupedRevisionEdits.length) {
      setExpandedRevisionCategories((current) =>
        Object.keys(current).length ? {} : current
      );
      return;
    }

    setExpandedRevisionCategories((current) => {
      const next: Record<string, boolean> = {};

      groupedRevisionEdits.forEach((group, index) => {
        next[group.key] = current[group.key] ?? index === 0;
      });

      const currentKeys = Object.keys(current);
      const nextKeys = Object.keys(next);
      if (currentKeys.length === nextKeys.length && nextKeys.every((key) => current[key] === next[key])) {
        return current;
      }

      return next;
    });
  }, [groupedRevisionEdits]);

  useEffect(() => {
    if (activeEditIndex === null) {
      return;
    }

    const activeEdit = parsedRevision.edits.find((edit) => edit.index === activeEditIndex);
    const activeCategory = activeEdit?.note?.category?.trim() || "other";

    setExpandedRevisionCategories((current) =>
      current[activeCategory]
        ? current
        : {
            ...current,
            [activeCategory]: true
          }
    );

    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-revise-card-index="${activeEditIndex}"]`)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, [activeEditIndex, parsedRevision]);

  return (
    <>
      <div className="resultHero">
        <div className="resultScore">
          <p className="sectionLabel">{t.estimatedBand}</p>
          <div className="resultScoreValue">
            <h2>{detail.estimatedBand.toFixed(1)}</h2>
            <span>/ 9</span>
          </div>
        </div>
        <div className="resultHeroActions">
          <div className="resultMeta">
            <Pill>{detail.taskType === "task1" ? navbar.task1 : navbar.task2}</Pill>
            <Pill>
              {t.targetChipLabel} {detail.targetBand.toFixed(1)}
            </Pill>
            <Pill>
              {detail.wordCount} {t.wordsUnit}
            </Pill>
            <Pill>
              {t.historyCreatedAt}: {formatReviewTime(detail.createdAt, locale)}
            </Pill>
          </div>
        </div>
      </div>

      <div className="reportModeSwitch" role="tablist" aria-label="Review modes">
        <button
          type="button"
          className={`reportModeButton${reportView === "overview" ? " is-active" : ""}`}
          onClick={() => setReportView("overview")}
        >
          {t.overviewTab}
        </button>
        <button
          type="button"
          className={`reportModeButton${reportView === "revise" ? " is-active" : ""}`}
          onClick={() => setReportView("revise")}
        >
          {t.reviseTab}
        </button>
      </div>

      {reportView === "overview" ? (
        <>
          <div className="scoreGrid">
            <ScoreCard
              label={t.taskAchievement}
              score={detail.result.bandBreakdown.taskAchievement.score}
              rationale={detail.result.bandBreakdown.taskAchievement.rationale}
              defaultExpanded={weakestCriterionKey === "taskAchievement"}
              showDetailsLabel={t.scoreDetailsShow}
              hideDetailsLabel={t.scoreDetailsHide}
            />
            <ScoreCard
              label={t.coherence}
              score={detail.result.bandBreakdown.coherenceAndCohesion.score}
              rationale={detail.result.bandBreakdown.coherenceAndCohesion.rationale}
              defaultExpanded={weakestCriterionKey === "coherence"}
              showDetailsLabel={t.scoreDetailsShow}
              hideDetailsLabel={t.scoreDetailsHide}
            />
            <ScoreCard
              label={t.lexical}
              score={detail.result.bandBreakdown.lexicalResource.score}
              rationale={detail.result.bandBreakdown.lexicalResource.rationale}
              defaultExpanded={weakestCriterionKey === "lexical"}
              showDetailsLabel={t.scoreDetailsShow}
              hideDetailsLabel={t.scoreDetailsHide}
            />
            <ScoreCard
              label={t.grammar}
              score={detail.result.bandBreakdown.grammaticalRangeAndAccuracy.score}
              rationale={detail.result.bandBreakdown.grammaticalRangeAndAccuracy.rationale}
              defaultExpanded={weakestCriterionKey === "grammar"}
              showDetailsLabel={t.scoreDetailsShow}
              hideDetailsLabel={t.scoreDetailsHide}
            />
          </div>

          <FeedbackDisclosure
            label={t.priorityFixes}
            count={detail.result.priorityFixes.length}
            itemsLabel={t.feedbackItemsUnit}
            defaultExpanded
          >
            <ul>
              {detail.result.priorityFixes.map((item) => (
                <li key={item.title}>
                  <strong>{item.title}:</strong> {item.detail}
                  <TeachingRuleReferences
                    references={item.ruleReferences}
                    label={t.ruleBasis}
                  />
                </li>
              ))}
            </ul>
            <button type="button" className="feedbackNextAction" onClick={openRevisionFromFeedback}>
              {t.startRevisionFromFeedback}
              <span aria-hidden="true">→</span>
            </button>
          </FeedbackDisclosure>

          <FeedbackDisclosure
            label={t.strengths}
            count={detail.result.strengths.length}
            itemsLabel={t.feedbackItemsUnit}
          >
            <ul>
              {detail.result.strengths.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </FeedbackDisclosure>

          <FeedbackDisclosure
            label={t.highlightedSentences}
            count={detail.result.highlightedSentences.length}
            itemsLabel={t.feedbackItemsUnit}
          >
            <div className="correctionList">
              {detail.result.highlightedSentences.map((item, index) => (
                <article key={`${item.sentence}-${index}`} className="correctionCard">
                  <p>
                    <strong>{t.highlightedSentence}:</strong> {item.sentence}
                  </p>
                  <p>
                    <strong>{t.highlightedReason}:</strong> {item.reason}
                  </p>
                  <TeachingRuleReferences
                    references={item.ruleReferences}
                    label={t.ruleBasis}
                  />
                </article>
              ))}
            </div>
          </FeedbackDisclosure>
        </>
      ) : (
        <section className="reviseWorkspace">
          <article className="feedbackSection reviseEssayPanel">
            <div className="revisePanelHeader">
              <p className="sectionLabel">{t.reviseTitle}</p>
            </div>
            <div className="reviseLayoutSwitch" role="group" aria-label="Revision stage">
              <button
                type="button"
                className={`reviseLayoutButton${activeRevisionStage === "grammar" ? " is-active" : ""}`}
                onClick={() => setActiveRevisionStage("grammar")}
              >
                <span>{t.revisionStageGrammar}</span>
              </button>
              <button
                type="button"
                className={`reviseLayoutButton${activeRevisionStage === "optimization" ? " is-active" : ""}`}
                onClick={() => setActiveRevisionStage("optimization")}
              >
                <span>{t.revisionStageOptimization}</span>
              </button>
            </div>
            <div className="revisionLegend" aria-label={t.revisionLegendLabel}>
              <span className="revisionLegendItem">
                <span className="revisionLegendHighlight" aria-hidden="true">★</span>
                {t.revisionLegendHighlight}
              </span>
              {activeRevisionStage === "grammar" ? (
                <>
                  <span className="revisionLegendItem">
                    <span className="revisionLegendOriginal" aria-hidden="true">Aa</span>
                    {t.revisionLegendOriginal}
                  </span>
                  <span className="revisionLegendItem">
                    <span className="revisionLegendSuggested" aria-hidden="true">Aa</span>
                    {t.revisionLegendSuggested}
                  </span>
                </>
              ) : (
                <span className="revisionLegendItem">
                  <span className="revisionLegendOptimization" aria-hidden="true">✦</span>
                  {t.revisionLegendOptimization}
                </span>
              )}
            </div>
            <div className="annotatedEssay reviseAnnotatedEssay" ref={activeEditRef}>
              {renderAnnotatedEssay(
                currentRevisionStage.annotatedEssay,
                detail.result.highlightedSentences.map((item) => item.sentence),
                currentRevisionStage.correctionNotes,
                activeRevisionStage === "optimization",
                activeEditIndex,
                (index) => setActiveEditIndex((current) => (current === index ? null : index)),
                t
              )}
            </div>
          </article>

          <aside className="feedbackSection reviseSidebar">
            <p className="sectionLabel">
              {activeRevisionStage === "grammar" ? t.revisionStageGrammar : t.revisionStageOptimization}
            </p>
            {groupedRevisionEdits.length ? (
              <div className="reviseDetailList">
                {groupedRevisionEdits.map((group) => {
                  const isOpen = expandedRevisionCategories[group.key] ?? false;

                  return (
                    <section key={`revise-group-${group.key}`} className="reviseCategoryGroup">
                      <button
                        type="button"
                        className={`reviseCategoryButton${isOpen ? " is-open" : ""}`}
                        onClick={() =>
                          setExpandedRevisionCategories((current) => ({
                            ...current,
                            [group.key]: !isOpen
                          }))
                        }
                      >
                        <span className="reviseCategoryTitle">{group.label}</span>
                        <span className="reviseCategoryMeta">
                          {group.edits.length}
                          <i className={`ai-chevron-${isOpen ? "up" : "down"}`} aria-hidden="true" />
                        </span>
                      </button>
                      {isOpen ? (
                        <div className="reviseCategoryItems">
                          {group.edits.map((edit) => {
                            const isActive = activeEditIndex === edit.index;

                            return (
                              <button
                                key={`revise-detail-${edit.id}-${edit.index}`}
                                type="button"
                                data-revise-card-index={edit.index}
                                className={`reviseDetailCard${isActive ? " is-active" : ""}`}
                                onClick={() => setActiveEditIndex((current) => (current === edit.index ? null : edit.index))}
                              >
                                <div className="reviseDetailHeader">
                                  <span className="reviseDetailIndex">{String(edit.index + 1).padStart(2, "0")}</span>
                                </div>
                                <div className="reviseDetailSummary">
                                  <p className="reviseDetailOriginal">{edit.original}</p>
                                  <i className="ai-arrow-right" aria-hidden="true" />
                                  <p className="reviseDetailSuggested">{edit.corrected}</p>
                                </div>
                                {isActive ? (
                                  <div className="reviseDetailBody">
                                    <div className="reviseReason">
                                      <span>{t.correctionReason}</span>
                                      <p>{edit.note?.reason ?? ""}</p>
                                      <TeachingRuleReferences
                                        references={edit.note?.ruleReferences}
                                        label={t.ruleBasis}
                                      />
                                    </div>
                                  </div>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </section>
                  );
                })}
              </div>
            ) : (
              <p>{t.historyChartEmpty}</p>
            )}
          </aside>
        </section>
      )}

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
            {/* Authenticated review images cannot be fetched by Next's unauthenticated server image optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={detail.image.url} alt={detail.image.name} className="historyImage" />
          </div>
        ) : (
          <p>{t.historyNoImage}</p>
        )}
      </article>
    </>
  );
}
