"use client";

import { useState } from "react";
import type {
  GuidedSuggestionTarget,
  GuidedWritingDraft,
  GuidedWritingField,
  GuidedWritingStance
} from "@/lib/ielts/guided-writing";
import {
  composeGuidedEssay,
  getGuidedWritingCompletion,
  getGuidedWritingSectionStatus
} from "@/lib/ielts/guided-writing";

type GuidedWritingProps = {
  copy: Record<string, string>;
  locale: "en" | "zh-CN";
  taskPrompt: string;
  draft: GuidedWritingDraft;
  step: number;
  onDraftChange: (draft: GuidedWritingDraft) => void;
  onStepChange: (step: number) => void;
  onUseDraft: (essay: string) => void;
};

const STEP_COUNT = 5;

function GuidedField({
  label,
  hint,
  placeholder,
  value,
  onChange,
  onSuggest,
  suggestion,
  suggesting,
  onAcceptSuggestion,
  suggestLabel,
  acceptLabel,
  tabHint,
  rows = 3
}: {
  label: string;
  hint: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSuggest: () => void;
  suggestion?: string;
  suggesting: boolean;
  onAcceptSuggestion: () => void;
  suggestLabel: string;
  acceptLabel: string;
  tabHint: string;
  rows?: number;
}) {
  return (
    <div className="guidedWritingField">
      <span className="guidedWritingFieldTitle">
        <span>{label}</span>
        <button type="button" onClick={onSuggest} disabled={suggesting}>
          {suggesting ? "…" : `✦ ${suggestLabel}`}
        </button>
      </span>
      <small>{hint}</small>
      <textarea
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Tab" && suggestion) {
            event.preventDefault();
            onAcceptSuggestion();
          }
        }}
        placeholder={placeholder}
        rows={rows}
      />
      {suggestion ? (
        <span className="guidedInlineSuggestion" role="status">
          <span>{suggestion}</span>
          <button type="button" onClick={onAcceptSuggestion}>{acceptLabel}</button>
          <small>{tabHint}</small>
        </span>
      ) : null}
    </div>
  );
}

export function GuidedWriting({
  copy,
  locale,
  taskPrompt,
  draft,
  step,
  onDraftChange,
  onStepChange,
  onUseDraft
}: GuidedWritingProps) {
  const [suggestion, setSuggestion] = useState<{ target: GuidedSuggestionTarget; text: string } | null>(null);
  const [suggestingTarget, setSuggestingTarget] = useState<GuidedSuggestionTarget | null>(null);
  const [suggestionError, setSuggestionError] = useState(false);
  const essay = composeGuidedEssay(draft);
  const completion = getGuidedWritingCompletion(draft);
  const completedSteps = getGuidedWritingSectionStatus(draft);
  const update = <Key extends keyof GuidedWritingDraft>(key: Key, value: GuidedWritingDraft[Key]) => {
    onDraftChange({ ...draft, [key]: value });
    if (suggestion?.target === key) setSuggestion(null);
  };
  const requestSuggestion = async (target: GuidedSuggestionTarget) => {
    setSuggestingTarget(target);
    setSuggestionError(false);
    try {
      const response = await fetch("/api/guided-writing/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskPrompt, field: target, draft, locale })
      });
      const data = await response.json() as { suggestion?: string };
      if (!response.ok || !data.suggestion) throw new Error("GUIDED_SUGGESTION_FAILED");
      setSuggestion({ target, text: data.suggestion });
    } catch {
      setSuggestionError(true);
    } finally {
      setSuggestingTarget(null);
    }
  };
  const acceptSuggestion = (field: GuidedWritingField) => {
    if (suggestion?.target !== field) return;
    update(field, suggestion.text);
    setSuggestion(null);
  };
  const fieldSuggestionProps = (field: GuidedWritingField) => ({
    onSuggest: () => void requestSuggestion(field),
    suggestion: suggestion?.target === field ? suggestion.text : undefined,
    suggesting: suggestingTarget === field,
    onAcceptSuggestion: () => acceptSuggestion(field),
    suggestLabel: copy.guidedAiHint,
    acceptLabel: copy.guidedAcceptHint,
    tabHint: copy.guidedAcceptTab
  });
  const stepTitles = [
    copy.guidedStepPosition,
    copy.guidedStepIntroduction,
    copy.guidedStepBodyOne,
    copy.guidedStepBodyTwo,
    copy.guidedStepConclusion
  ];

  return (
    <section className="guidedWriting" aria-label={copy.guidedMode}>
      <header className="guidedWritingHeader">
        <div>
          <span className="guidedWritingEyebrow">{copy.guidedEyebrow}</span>
          <h3>{copy.guidedTitle}</h3>
          <p>{copy.guidedDescription}</p>
        </div>
        <strong>{copy.guidedProgress.replace("{completed}", String(completion.completed)).replace("{total}", String(completion.total))}</strong>
      </header>

      <div className="guidedWritingLayout">
        <nav className="guidedWritingSteps" aria-label={copy.guidedStepsLabel}>
          {stepTitles.map((title, index) => (
            <button
              key={title}
              type="button"
              className={step === index ? "is-active" : completedSteps[index] ? "is-complete" : ""}
              aria-current={step === index ? "step" : undefined}
              onClick={() => onStepChange(index)}
            >
              <span>{index + 1}</span>
              {title}
            </button>
          ))}
        </nav>

        <div className="guidedWritingStage">
          <div className="guidedWritingStageIntro">
            <span>{copy.guidedStepCounter.replace("{current}", String(step + 1)).replace("{total}", String(STEP_COUNT))}</span>
            <h4>{stepTitles[step]}</h4>
            <p>{copy[`guidedStep${step + 1}Help`]}</p>
          </div>

          {step === 0 ? (
            <div className="guidedStanceOptions" role="group" aria-label={copy.guidedStanceLabel}>
              {([
                ["agree", copy.guidedStanceAgree, copy.guidedStanceAgreeHint],
                ["partial", copy.guidedStancePartial, copy.guidedStancePartialHint],
                ["disagree", copy.guidedStanceDisagree, copy.guidedStanceDisagreeHint]
              ] as Array<[GuidedWritingStance, string, string]>).map(([value, label, hint]) => (
                <button
                  key={value}
                  type="button"
                  className={draft.stance === value ? "is-selected" : ""}
                  onClick={() => update("stance", value)}
                >
                  <strong>{label}</strong>
                  <span>{hint}</span>
                </button>
              ))}
              <div className="guidedThinkingPrompt">
                <strong>{copy.guidedThinkTitle}</strong>
                <p>{copy.guidedThinkPosition}</p>
                <button type="button" onClick={() => void requestSuggestion("positionIdea")} disabled={suggestingTarget === "positionIdea"}>
                  {suggestingTarget === "positionIdea" ? copy.guidedAiThinking : `✦ ${copy.guidedAskIdea}`}
                </button>
                {suggestion?.target === "positionIdea" ? <em>{suggestion.text}</em> : null}
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="guidedWritingFields">
              <GuidedField
                label={copy.guidedIntroductionContext}
                hint={copy.guidedIntroductionContextHint}
                placeholder={copy.guidedIntroductionContextPlaceholder}
                value={draft.introductionContext}
                onChange={(value) => update("introductionContext", value)}
                {...fieldSuggestionProps("introductionContext")}
              />
              <GuidedField
                label={copy.guidedIntroductionThesis}
                hint={copy.guidedIntroductionThesisHint}
                placeholder={copy.guidedIntroductionThesisPlaceholder}
                value={draft.introductionThesis}
                onChange={(value) => update("introductionThesis", value)}
                {...fieldSuggestionProps("introductionThesis")}
              />
            </div>
          ) : null}

          {step === 2 || step === 3 ? (
            <div className="guidedWritingFields">
              <div className="guidedIdeaBank">
                <strong>{copy.guidedIdeaBank}</strong>
                <span>{copy.guidedIdeaResponsibility}</span>
                <span>{copy.guidedIdeaSkills}</span>
                <span>{copy.guidedIdeaCommunity}</span>
                <span>{copy.guidedIdeaPressure}</span>
                <button
                  type="button"
                  onClick={() => void requestSuggestion(step === 2 ? "bodyOneIdea" : "bodyTwoIdea")}
                  disabled={suggestingTarget === (step === 2 ? "bodyOneIdea" : "bodyTwoIdea")}
                >
                  ✦ {suggestingTarget === (step === 2 ? "bodyOneIdea" : "bodyTwoIdea") ? copy.guidedAiThinking : copy.guidedAskParagraphIdea}
                </button>
              </div>
              {suggestion?.target === (step === 2 ? "bodyOneIdea" : "bodyTwoIdea") ? (
                <div className="guidedPlanningSuggestion" role="status">{suggestion.text}</div>
              ) : null}
              <GuidedField
                label={copy.guidedBodyTopic}
                hint={copy.guidedBodyTopicHint}
                placeholder={copy.guidedBodyTopicPlaceholder}
                value={step === 2 ? draft.bodyOneTopic : draft.bodyTwoTopic}
                onChange={(value) => update(step === 2 ? "bodyOneTopic" : "bodyTwoTopic", value)}
                {...fieldSuggestionProps(step === 2 ? "bodyOneTopic" : "bodyTwoTopic")}
              />
              <GuidedField
                label={copy.guidedBodyExplanation}
                hint={copy.guidedBodyExplanationHint}
                placeholder={copy.guidedBodyExplanationPlaceholder}
                value={step === 2 ? draft.bodyOneExplanation : draft.bodyTwoExplanation}
                onChange={(value) => update(step === 2 ? "bodyOneExplanation" : "bodyTwoExplanation", value)}
                {...fieldSuggestionProps(step === 2 ? "bodyOneExplanation" : "bodyTwoExplanation")}
              />
              <GuidedField
                label={copy.guidedBodyExample}
                hint={copy.guidedBodyExampleHint}
                placeholder={copy.guidedBodyExamplePlaceholder}
                value={step === 2 ? draft.bodyOneExample : draft.bodyTwoExample}
                onChange={(value) => update(step === 2 ? "bodyOneExample" : "bodyTwoExample", value)}
                {...fieldSuggestionProps(step === 2 ? "bodyOneExample" : "bodyTwoExample")}
              />
            </div>
          ) : null}

          {step === 4 ? (
            <div className="guidedWritingFields">
              <GuidedField
                label={copy.guidedConclusionRestatement}
                hint={copy.guidedConclusionRestatementHint}
                placeholder={copy.guidedConclusionRestatementPlaceholder}
                value={draft.conclusionRestatement}
                onChange={(value) => update("conclusionRestatement", value)}
                {...fieldSuggestionProps("conclusionRestatement")}
              />
              <div className="guidedReviewChecklist">
                <strong>{copy.guidedChecklistTitle}</strong>
                <span>{copy.guidedChecklistPosition}</span>
                <span>{copy.guidedChecklistParagraphs}</span>
                <span>{copy.guidedChecklistExamples}</span>
              </div>
            </div>
          ) : null}

          <footer className="guidedWritingActions">
            {suggestionError ? <span className="guidedSuggestionError">{copy.guidedAiError}</span> : null}
            <button type="button" onClick={() => onStepChange(Math.max(0, step - 1))} disabled={step === 0}>
              {copy.guidedPrevious}
            </button>
            {step < STEP_COUNT - 1 ? (
              <button type="button" className="is-primary" onClick={() => onStepChange(step + 1)}>
                {copy.guidedNext}
              </button>
            ) : (
              <button type="button" className="is-primary" disabled={!essay} onClick={() => onUseDraft(essay)}>
                {copy.guidedUseDraft}
              </button>
            )}
          </footer>
        </div>

        <aside className="guidedWritingPreview">
          <div>
            <span>{copy.guidedPreviewLabel}</span>
            <strong>{essay.trim() ? essay.trim().split(/\s+/).length : 0} {copy.wordsUnit}</strong>
          </div>
          {essay ? <p>{essay}</p> : <p className="is-empty">{copy.guidedPreviewEmpty}</p>}
        </aside>
      </div>
    </section>
  );
}
