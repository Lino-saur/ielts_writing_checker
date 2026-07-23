"use client";

import Link from "next/link";
import { useState } from "react";
import { ActionLink, Pill, Surface } from "@/components/ui-kit";
import { parseAnnotatedEssay } from "@/app/checker/checker-revision";
import { getRevisionCategoryLabel } from "@/lib/ielts/revision-categories";
import { getMessages } from "@/lib/i18n/messages";
import type { SharedWritingReview } from "@/lib/review-sharing";
import type { Locale, RevisionStage } from "@/lib/types";

function StaticHighlightedText({
  text,
  highlightedSentences,
  highlightLabel,
  keyPrefix
}: {
  text: string;
  highlightedSentences: string[];
  highlightLabel: string;
  keyPrefix: string;
}) {
  const candidates = highlightedSentences.filter(Boolean);
  if (!candidates.length) return <span>{text}</span>;

  const subparts: React.ReactNode[] = [];
  let remaining = text;
  let cursor = 0;

  while (remaining.length > 0) {
    let matchedSentence = "";
    let matchedIndex = -1;

    for (const candidate of candidates) {
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
        className="essayHighlight"
        key={`${keyPrefix}-highlight-${cursor}`}
        title={highlightLabel}
      >
        <span className="essayHighlightIcon" aria-hidden="true">★</span>
        {matchedSentence}
      </mark>
    );

    remaining = remaining.slice(matchedIndex + matchedSentence.length);
    cursor += 1;
  }

  return <span>{subparts}</span>;
}

function StaticAnnotatedEssay({
  stage,
  tone,
  highlightedSentences,
  highlightLabel
}: {
  stage: RevisionStage;
  tone: "correction" | "optimization";
  highlightedSentences: string[];
  highlightLabel: string;
}) {
  const { parts } = parseAnnotatedEssay(stage.annotatedEssay, stage.correctionNotes);

  return parts.map((part, index) => {
    if (part.type === "edit") {
      if (tone === "optimization") {
        return (
          <span className="sharedReadOnlyEdit is-optimization" key={`${part.id}-${index}`}>
            <span className="essayEnhancement">
              {part.original}<span className="essayEnhancementIcon" aria-hidden="true">✦</span>
            </span>
            <ins className="essayAdd essayAccepted essayEnhancementAccepted">{part.corrected}</ins>
          </span>
        );
      }
      return (
        <span className="sharedReadOnlyEdit is-correction" key={`${part.id}-${index}`}>
          <del className="essayDel">{part.original}</del>
          <ins className="essayAdd">{part.corrected}</ins>
        </span>
      );
    }
    if (part.type === "del") return <del className="essayDel" key={`del-${index}`}>{part.text}</del>;
    if (part.type === "add") {
      return (
        <ins className={`essayAdd${tone === "optimization" ? " essayAccepted essayEnhancementAccepted" : ""}`} key={`add-${index}`}>
          {part.text}
        </ins>
      );
    }
    return (
      <StaticHighlightedText
        key={`plain-${index}`}
        keyPrefix={`plain-${index}`}
        text={part.text}
        highlightedSentences={highlightedSentences}
        highlightLabel={highlightLabel}
      />
    );
  });
}

function StaticRevisionSection({
  id,
  index,
  title,
  description,
  revisedLabel,
  detailLabel,
  originalLabel,
  suggestedLabel,
  reasonLabel,
  emptyLabel,
  highlightLabel,
  highlightedSentences,
  stage,
  locale,
  tone
}: {
  id: string;
  index: string;
  title: string;
  description: string;
  revisedLabel: string;
  detailLabel: string;
  originalLabel: string;
  suggestedLabel: string;
  reasonLabel: string;
  emptyLabel: string;
  highlightLabel: string;
  highlightedSentences: string[];
  stage: RevisionStage;
  locale: Locale;
  tone: "correction" | "optimization";
}) {
  return (
    <Surface as="section" className={`sharedReportSection sharedRevisionSection is-${tone}`} id={id}>
      <header className="sharedSectionHeader">
        <span className="sharedSectionIndex">{index}</span>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <Pill>{stage.correctionNotes.length}</Pill>
      </header>

      <div className="sharedRevisedEssayBlock">
        <div className="sharedRevisedEssayHeader">
          <p className="sectionLabel">{revisedLabel}</p>
          <div className="revisionLegend sharedRevisionLegend" aria-label={revisedLabel}>
            <span className="revisionLegendItem">
              <span className={tone === "correction" ? "revisionLegendOriginal" : "revisionLegendOptimization"}>Aa</span>
              {originalLabel}
            </span>
            <span className="revisionLegendItem">
              <span className={tone === "correction" ? "revisionLegendSuggested" : "revisionLegendOptimization"}>Aa</span>
              {suggestedLabel}
            </span>
            <span className="revisionLegendItem">
              <span className="revisionLegendHighlight" aria-hidden="true">★</span>
              {highlightLabel}
            </span>
          </div>
        </div>
        <p className="annotatedEssay reviseAnnotatedEssay sharedAnnotatedEssay">
          <StaticAnnotatedEssay
            stage={stage}
            tone={tone}
            highlightedSentences={highlightedSentences}
            highlightLabel={highlightLabel}
          />
        </p>
      </div>

      <div className="sharedRevisionDetails">
        <p className="sectionLabel">{detailLabel}</p>
        {stage.correctionNotes.length ? (
          <div className="sharedRevisionGrid">
            {stage.correctionNotes.map((note, noteIndex) => (
              <article className="sharedRevisionCard" key={`${id}-${note.id}-${noteIndex}`}>
                <div className="sharedRevisionCardHeader">
                  <span>{String(noteIndex + 1).padStart(2, "0")}</span>
                  <strong>{getRevisionCategoryLabel(note.category?.trim() || "other", locale)}</strong>
                </div>
                <div className="sharedRevisionPair">
                  <div>
                    <small>{originalLabel}</small>
                    <p>{note.original}</p>
                  </div>
                  <span aria-hidden="true">→</span>
                  <div>
                    <small>{suggestedLabel}</small>
                    <p>{note.corrected}</p>
                  </div>
                </div>
                <p className="sharedRevisionReason"><strong>{reasonLabel}</strong>{note.reason}</p>
              </article>
            ))}
          </div>
        ) : <p className="sharedRevisionEmpty">{emptyLabel}</p>}
      </div>
    </Surface>
  );
}

export default function SharedReviewClient({ sharedReview }: { sharedReview: SharedWritingReview }) {
  const [locale, setLocale] = useState<Locale>("zh-CN");
  const { checker: t, navbar } = getMessages(locale);
  const detail = sharedReview.detail;
  const result = detail.result;
  const grammarStage = result.grammarRevision ?? {
    annotatedEssay: result.annotatedEssay,
    correctionNotes: result.correctionNotes
  };
  const optimizationStage = result.optimizationRevision ?? {
    annotatedEssay: result.annotatedEssay,
    correctionNotes: result.correctionNotes
  };
  const copy = locale === "zh-CN"
    ? {
        badge: "公开分享 · 只读",
        reportLabel: "批改报告",
        checkerCta: "去批改",
        checkerCtaTitle: "也想知道自己的作文能得多少分？",
        checkerCtaBody: "提交 IELTS 作文，获得评分、逐句修改与表达优化建议。",
        title: "IELTS 写作批改报告",
        prompt: "写作题目",
        essay: "原始作文",
        taskImage: "Task 1 原始图片",
        language: "EN",
        overview: "总览",
        grammar: "修改",
        optimization: "优化",
        overviewDescription: "评分依据和最值得优先处理的问题。",
        grammarDescription: "语法、用词和句子结构的必要修正。",
        optimizationDescription: "在意思不变的前提下，让表达更自然、准确和有力。",
        priority: "优先修改",
        strengths: "做得好的地方",
        revisedGrammar: "完整修改稿",
        revisedOptimization: "完整优化稿",
        details: "逐项说明",
        original: "原文",
        suggested: "建议",
        reason: "原因：",
        highlight: "亮点句",
        emptyGrammar: "这篇作文没有需要展示的语法修改。",
        emptyOptimization: "这篇作文没有需要展示的优化建议。"
      }
    : {
        badge: "Public share · Read only",
        reportLabel: "Review report",
        checkerCta: "Check my essay",
        checkerCtaTitle: "Want to know how your essay would score?",
        checkerCtaBody: "Submit your IELTS essay for scoring, corrections and expression improvements.",
        title: "IELTS Writing Review",
        prompt: "Writing prompt",
        essay: "Original essay",
        taskImage: "Original Task 1 image",
        language: "中文",
        overview: "Overview",
        grammar: "Corrections",
        optimization: "Optimizations",
        overviewDescription: "Scoring rationale and the issues that matter most.",
        grammarDescription: "Required fixes to grammar, wording and sentence structure.",
        optimizationDescription: "Clearer, more natural and more precise expression without changing the meaning.",
        priority: "Priority fixes",
        strengths: "What works well",
        revisedGrammar: "Complete corrected essay",
        revisedOptimization: "Complete optimized essay",
        details: "Itemized changes",
        original: "Original",
        suggested: "Suggestion",
        reason: "Why: ",
        highlight: "Strong sentence",
        emptyGrammar: "There are no grammar corrections to show for this essay.",
        emptyOptimization: "There are no optimization suggestions to show for this essay."
      };
  const criteria = [
    { label: t.taskAchievement, value: result.bandBreakdown.taskAchievement },
    { label: t.coherence, value: result.bandBreakdown.coherenceAndCohesion },
    { label: t.lexical, value: result.bandBreakdown.lexicalResource },
    { label: t.grammar, value: result.bandBreakdown.grammaticalRangeAndAccuracy }
  ];

  return (
    <main className="pageShell sharedReviewPage">
      <div className="pageBackdrop" aria-hidden="true">
        <span className="backdropOrb orbOne" />
        <span className="backdropOrb orbTwo" />
        <span className="backdropGrid" />
      </div>

      <header className="sharedReviewHeader">
        <div className="sharedReviewIdentity">
          <Link className="sharedReviewBrand" href={`/${locale}`}>
            <span className="sharedReviewBrandMark" aria-hidden="true">W</span>
            <span className="sharedReviewBrandName">{navbar.brand}</span>
            <span className="sharedReviewBrandCompact">IELTS</span>
          </Link>
          <span className="sharedReviewHeaderDivider" aria-hidden="true" />
          <span className="sharedReviewReportLabel">{copy.reportLabel}</span>
        </div>
        <div className="sharedReviewHeaderActions">
          <span className="sharedReviewBadge">{copy.badge}</span>
          <button type="button" className="sharedReviewLanguage" onClick={() => setLocale(locale === "zh-CN" ? "en" : "zh-CN")}>
            {copy.language}
          </button>
          <ActionLink className="sharedReviewCheckerCta" href={`/${locale}/checker`} variant="primary">
            {copy.checkerCta}<span aria-hidden="true">↗</span>
          </ActionLink>
        </div>
      </header>

      <article className="sharedReviewContent">
        <Surface as="header" className="sharedReviewHero">
          <div className="sharedReviewHeroCopy">
            <p className="sectionLabel">{copy.title}</p>
            <div className="sharedReviewScore"><strong>{detail.estimatedBand.toFixed(1)}</strong><span>/ 9</span></div>
            <div className="sharedReviewMeta">
              <Pill>{detail.taskType === "task1" ? navbar.task1 : navbar.task2}</Pill>
              <Pill>{t.targetChipLabel} {detail.targetBand.toFixed(1)}</Pill>
              <Pill>{detail.wordCount} {t.wordsUnit}</Pill>
            </div>
          </div>
          <nav className="sharedReviewNav" aria-label={copy.title}>
            <a href="#overview"><span>01</span>{copy.overview}</a>
            <a href="#corrections"><span>02</span>{copy.grammar}</a>
            <a href="#optimizations"><span>03</span>{copy.optimization}</a>
          </nav>
        </Surface>

        <Surface as="section" className="sharedReviewSource">
          <div className="sharedReviewPromptBlock">
            <p className="sectionLabel">{detail.taskType === "task1" ? navbar.task1 : navbar.task2}</p>
            <p>{detail.prompt}</p>
            {detail.taskType === "task1" && detail.image ? (
              <figure className="sharedReviewTaskImage">
                {/* The source image has unknown dimensions and must bypass Next's persistent image cache after share revocation. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={detail.image.url} alt={detail.image.name} />
              </figure>
            ) : null}
          </div>
          <div className="sharedReviewEssayBlock">
            <p className="sectionLabel">{copy.essay}</p>
            <p>{detail.essay}</p>
          </div>
        </Surface>

        <Surface as="section" className="sharedReportSection sharedOverviewSection" id="overview">
          <header className="sharedSectionHeader">
            <span className="sharedSectionIndex">01</span>
            <div><h2>{copy.overview}</h2><p>{copy.overviewDescription}</p></div>
          </header>
          <div className="sharedCriteriaGrid">
            {criteria.map((criterion) => (
              <article key={criterion.label} className="sharedCriterionCard">
                <div><span>{criterion.label}</span><strong>{criterion.value.score.toFixed(1)}</strong></div>
                <p>{criterion.value.rationale}</p>
              </article>
            ))}
          </div>
          <div className="sharedFeedbackGrid">
            <section>
              <h3>{copy.priority}</h3>
              <ol>{result.priorityFixes.map((item) => <li key={item.title}><strong>{item.title}</strong><p>{item.detail}</p></li>)}</ol>
            </section>
            <section>
              <h3>{copy.strengths}</h3>
              <ul>{result.strengths.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
            </section>
          </div>
        </Surface>

        <StaticRevisionSection
          id="corrections"
          index="02"
          title={copy.grammar}
          description={copy.grammarDescription}
          revisedLabel={copy.revisedGrammar}
          detailLabel={copy.details}
          originalLabel={copy.original}
          suggestedLabel={copy.suggested}
          reasonLabel={copy.reason}
          highlightLabel={copy.highlight}
          highlightedSentences={result.highlightedSentences.map((item) => item.sentence)}
          emptyLabel={copy.emptyGrammar}
          stage={grammarStage}
          locale={locale}
          tone="correction"
        />

        <StaticRevisionSection
          id="optimizations"
          index="03"
          title={copy.optimization}
          description={copy.optimizationDescription}
          revisedLabel={copy.revisedOptimization}
          detailLabel={copy.details}
          originalLabel={copy.original}
          suggestedLabel={copy.suggested}
          reasonLabel={copy.reason}
          highlightLabel={copy.highlight}
          highlightedSentences={result.highlightedSentences.map((item) => item.sentence)}
          emptyLabel={copy.emptyOptimization}
          stage={optimizationStage}
          locale={locale}
          tone="optimization"
        />

        <Surface as="section" className="sharedReviewCta">
          <div>
            <p className="sectionLabel">IELTS Writing Checker</p>
            <h2>{copy.checkerCtaTitle}</h2>
            <p>{copy.checkerCtaBody}</p>
          </div>
          <ActionLink href={`/${locale}/checker`} variant="primary">
            {copy.checkerCta}<span aria-hidden="true">→</span>
          </ActionLink>
        </Surface>
      </article>
    </main>
  );
}
