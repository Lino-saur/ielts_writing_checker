import { getRevisionCategoryLabel } from "@/lib/ielts/revision-categories";
import type { CheckerMessages } from "@/lib/i18n/messages";
import type { CorrectionNote, Locale } from "@/lib/types";

export type RevisionDecision = "accepted" | "ignored";

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
        <mark key={`${keyPrefix}-highlight-${cursor}`} className="essayHighlight">
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
        <span
          key={`edit-${part.index}-${index}`}
          className={`editChip${isActive ? " active" : ""}${decision ? ` is-${decision}` : ""}`}
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
          {decision === "accepted" ? (
            <ins className="essayAdd essayAccepted">{part.corrected}</ins>
          ) : decision === "ignored" ? (
            <span className="essayIgnored">{part.original}</span>
          ) : (
            <>
              <del className="essayDel">{part.original}</del>
              <ins className="essayAdd">{part.corrected}</ins>
            </>
          )}
          {part.note ? (
            <span className={`editTooltip${isActive ? " visible" : ""}`}>
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
