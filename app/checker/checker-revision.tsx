import { getRevisionCategoryLabel } from "@/lib/ielts/revision-categories";
import type { CheckerMessages } from "@/lib/i18n/messages";
import type { CorrectionNote, Locale, RevisionStage } from "@/lib/types";
import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

export type RevisionDecision = "accepted" | "ignored";

type EditTooltipPosition = {
  left: number;
  top: number;
  width: number;
  arrowLeft: number;
  placement: "above" | "below";
};

function RevisionEditChip({
  edit,
  decision,
  isActive,
  onToggle,
  t
}: {
  edit: ReturnType<typeof parseAnnotatedEssay>["edits"][number];
  decision?: RevisionDecision;
  isActive: boolean;
  onToggle: () => void;
  t: CheckerMessages;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<EditTooltipPosition | null>(null);

  const updateTooltipPosition = useCallback(() => {
    const anchor = anchorRef.current;
    const tooltip = tooltipRef.current;
    if (!anchor || !tooltip) {
      return;
    }

    const viewportPadding = 16;
    const gap = 10;
    const anchorRect = anchor.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - viewportPadding * 2);
    const height = tooltip.offsetHeight;
    const anchorCenter = anchorRect.left + anchorRect.width / 2;
    const left = Math.min(
      Math.max(viewportPadding, anchorCenter - width / 2),
      window.innerWidth - width - viewportPadding
    );
    const roomBelow = window.innerHeight - anchorRect.bottom - viewportPadding;
    const roomAbove = anchorRect.top - viewportPadding;
    const placement = roomBelow >= height + gap || roomBelow >= roomAbove ? "below" : "above";
    const preferredTop = placement === "below"
      ? anchorRect.bottom + gap
      : anchorRect.top - height - gap;
    const top = Math.min(
      Math.max(viewportPadding, preferredTop),
      window.innerHeight - height - viewportPadding
    );
    const arrowLeft = Math.min(Math.max(18, anchorCenter - left), width - 18);

    setPosition({ left, top, width, arrowLeft, placement });
  }, []);

  useLayoutEffect(() => {
    if (!isActive || !edit.note) {
      setPosition(null);
      return;
    }

    updateTooltipPosition();
    window.addEventListener("resize", updateTooltipPosition);
    window.addEventListener("scroll", updateTooltipPosition, true);

    return () => {
      window.removeEventListener("resize", updateTooltipPosition);
      window.removeEventListener("scroll", updateTooltipPosition, true);
    };
  }, [edit.note, isActive, updateTooltipPosition]);

  const tooltipStyle = position
    ? ({
        left: position.left,
        top: position.top,
        width: position.width,
        "--edit-tooltip-arrow-left": `${position.arrowLeft}px`
      } as CSSProperties)
    : undefined;

  return (
    <span
      ref={anchorRef}
      className={`editChip${isActive ? " active" : ""}${decision ? ` is-${decision}` : ""}`}
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle();
        }
      }}
    >
      {decision === "accepted" ? (
        <ins className="essayAdd essayAccepted">{edit.corrected}</ins>
      ) : decision === "ignored" ? (
        <span className="essayIgnored">{edit.original}</span>
      ) : (
        <>
          <del className="essayDel">{edit.original}</del>
          <ins className="essayAdd">{edit.corrected}</ins>
        </>
      )}
      {isActive && edit.note && typeof document !== "undefined"
        ? createPortal(
            <span
              ref={tooltipRef}
              className="editTooltip editTooltipPortal visible"
              data-placement={position?.placement ?? "below"}
              style={tooltipStyle}
              role="tooltip"
              onClick={(event) => event.stopPropagation()}
            >
              <strong>{t.correctionReason}:</strong> {edit.note.reason}
            </span>,
            document.body
          )
        : null}
    </span>
  );
}

export function ScoreCard({
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

export function parseAnnotatedEssay(text: string, correctionNotes: CorrectionNote[]) {
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

export function groupRevisionEditsByCategory(
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
      label: getRevisionCategoryLabel(key, locale),
      edits: [edit]
    });
  });

  return Array.from(groups.values());
}

export function materializeRevisionEssay(
  text: string,
  correctionNotes: CorrectionNote[],
  decisions: Record<string, RevisionDecision>
) {
  const { parts } = parseAnnotatedEssay(text, correctionNotes);

  return parts
    .map((part) => {
      if (part.type === "edit") {
        return decisions[part.id] === "accepted" ? part.corrected : part.original;
      }

      return part.text;
    })
    .join("");
}

export function materializeVerifiedOptimizationEssay(
  optimizationStage: RevisionStage,
  decisions: Record<string, RevisionDecision>,
  finalGrammarStage?: RevisionStage
) {
  const optimization = parseAnnotatedEssay(
    optimizationStage.annotatedEssay,
    optimizationStage.correctionNotes
  );
  const optimizationEssay = materializeRevisionEssay(
    optimizationStage.annotatedEssay,
    optimizationStage.correctionNotes,
    decisions
  );
  const acceptedOptimizationIds = optimization.edits
    .filter((edit) => decisions[edit.id] === "accepted")
    .map((edit) => edit.id);

  if (!finalGrammarStage || acceptedOptimizationIds.length === 0) {
    return { essay: optimizationEssay, appliedFinalGrammarIds: [] as string[] };
  }

  const finalGrammar = parseAnnotatedEssay(
    finalGrammarStage.annotatedEssay,
    finalGrammarStage.correctionNotes
  );
  const allOptimizationAccepted = optimization.edits.every(
    (edit) => decisions[edit.id] === "accepted"
  );

  if (allOptimizationAccepted) {
    const acceptedFinalGrammar = Object.fromEntries(
      finalGrammar.edits.map((edit) => [edit.id, "accepted" as const])
    );
    return {
      essay: materializeRevisionEssay(
        finalGrammarStage.annotatedEssay,
        finalGrammarStage.correctionNotes,
        acceptedFinalGrammar
      ),
      appliedFinalGrammarIds: finalGrammar.edits.map((edit) => edit.id)
    };
  }

  let essay = optimizationEssay;
  const appliedFinalGrammarIds: string[] = [];

  finalGrammar.edits.forEach((edit) => {
    const firstIndex = essay.indexOf(edit.original);
    if (firstIndex === -1 || firstIndex !== essay.lastIndexOf(edit.original)) {
      return;
    }

    essay = `${essay.slice(0, firstIndex)}${edit.corrected}${essay.slice(firstIndex + edit.original.length)}`;
    appliedFinalGrammarIds.push(edit.id);
  });

  return { essay, appliedFinalGrammarIds };
}

export function renderAnnotatedEssay(
  text: string,
  highlightedSentences: string[],
  correctionNotes: CorrectionNote[],
  decisions: Record<string, RevisionDecision>,
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
        subparts.push(
          <span key={`${keyPrefix}-plain-${cursor}`}>{remaining.slice(0, matchedIndex)}</span>
        );
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
      const decision = decisions[part.id];

      return (
        <RevisionEditChip
          key={`edit-${part.index}-${index}`}
          edit={part}
          decision={decision}
          isActive={isActive}
          onToggle={() => onToggleEdit(part.index)}
          t={t}
        />
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
