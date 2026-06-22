import {
  BAND_LABELS,
  CheckInput,
  CorrectionNote,
  HighlightedSentence,
  ProviderConfig,
  RevisionStage,
  WritingCheckResult,
  WritingRevisionResult,
  WritingScoreResult,
  clampBand,
  countWords,
  getLocale,
  getTargetBand
} from "./shared";
import { getRevisionCategoryLabel, normalizeRevisionCategory } from "./revision-categories";

export function cleanModelText(text: string) {
  return text
    .replace(/```json/gi, "```")
    .replace(/```text/gi, "```")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```/g, "")
    .trim();
}

export function previewText(text: string, maxLength = 400) {
  return text.slice(0, maxLength).replace(/\s+/g, " ");
}

function repairJsonString(text: string) {
  let repaired = cleanModelText(text);

  repaired = repaired
    .replace(/\u201c|\u201d/g, "\"")
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u00a0/g, " ");

  repaired = repaired.replace(/,\s*([}\]])/g, "$1");

  repaired = repaired
    .replace(/(\}|\])\s*(\{|\[)/g, "$1,$2")
    .replace(/"\s*\n\s*"/g, "\",\n\"");

  return repaired;
}

function extractJsonObject(text: string) {
  const cleanedText = cleanModelText(text);
  const match = cleanedText.match(/\{[\s\S]*\}/);
  if (!match) {
    const preview = previewText(cleanedText);
    throw new Error(`Model response did not include a JSON object. Raw preview: ${preview}`);
  }

  const candidate = match[0];

  try {
    return JSON.parse(candidate) as WritingCheckResult;
  } catch (error) {
    const repaired = repairJsonString(candidate);

    try {
      return JSON.parse(repaired) as WritingCheckResult;
    } catch {
      throw error;
    }
  }
}

function extractTaggedSections(text: string) {
  const cleanedText = cleanModelText(text);
  const sections = new Map<string, string>();
  const pattern = /===([A-Z_]+)===/g;
  const matches = [...cleanedText.matchAll(pattern)];

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const name = current[1];

    if (name === "END") {
      continue;
    }

    const contentStart = current.index! + current[0].length;
    const nextIndex = matches[index + 1]?.index ?? cleanedText.length;
    const content = cleanedText.slice(contentStart, nextIndex).trim();
    sections.set(name, content);
  }

  return sections;
}

function parseScoreAndRationaleBlock(block: string) {
  const scoreMatch = block.match(/score:\s*([0-9]+(?:\.[0-9])?)/i);
  const rationaleMatch = block.match(/rationale:\s*([\s\S]*)/i);

  if (!scoreMatch || !rationaleMatch) {
    throw new Error(`Invalid score block: ${previewText(block)}`);
  }

  return {
    score: Number(scoreMatch[1]),
    rationale: rationaleMatch[1].trim()
  };
}

function parseBulletList(block: string) {
  return block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*]\s*/, "").replace(/^\d+\.\s*/, "").trim())
    .filter(Boolean);
}

function splitNumberedEntries(block: string, entryLeadPattern: string) {
  const pattern = new RegExp(
    `(?:^|\\s)(\\d+\\.\\s*(?:${entryLeadPattern})[\\s\\S]*?)(?=(?:\\s+\\d+\\.\\s*(?:${entryLeadPattern}))|$)`,
    "g"
  );
  const matches = [...block.matchAll(pattern)].map((match) => match[1].trim());

  if (matches.length > 0) {
    return matches;
  }

  return block
    .split(/\n(?=\d+\.\s)/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseHighlightedSentencesBlock(block: string): HighlightedSentence[] {
  return splitNumberedEntries(block, "sentence:")
    .map((entry) => {
      const sentenceMatch = entry.match(/sentence:\s*([\s\S]*?)(?=\s+reason:|$)/i);
      const reasonMatch = entry.match(/reason:\s*([\s\S]*)/i);

      if (!sentenceMatch || !reasonMatch) {
        return null;
      }

      return {
        sentence: sentenceMatch[1].trim(),
        reason: reasonMatch[1].trim()
      };
    })
    .filter((item): item is HighlightedSentence => Boolean(item));
}

function parsePriorityFixesBlock(block: string) {
  return splitNumberedEntries(block, "title:")
    .map((entry) => {
      const titleMatch = entry.match(/title:\s*([\s\S]*?)(?=\s+detail:|$)/i);
      const detailMatch = entry.match(/detail:\s*([\s\S]*)/i);

      if (!titleMatch || !detailMatch) {
        return null;
      }

      return {
        title: titleMatch[1].trim(),
        detail: detailMatch[1].trim()
      };
    })
    .filter((item): item is WritingCheckResult["priorityFixes"][number] => Boolean(item));
}

function parseCorrectionNotesBlock(block: string): CorrectionNote[] {
  return splitNumberedEntries(block, "id:")
    .map<CorrectionNote | null>((entry) => {
      const idMatch = entry.match(/id:\s*([A-Za-z0-9_-]+)/i);
      const categoryMatch = entry.match(/category:\s*([\s\S]*?)(?=\s+original:|$)/i);
      const originalMatch = entry.match(/original:\s*([\s\S]*?)(?=\s+corrected:|$)/i);
      const correctedMatch = entry.match(/corrected:\s*([\s\S]*?)(?=\s+reason:|$)/i);
      const reasonMatch = entry.match(/reason:\s*([\s\S]*)/i);

      if (!idMatch || !originalMatch || !correctedMatch || !reasonMatch) {
        return null;
      }

      return {
        id: idMatch[1].trim(),
        category: normalizeRevisionCategory(categoryMatch?.[1]?.trim()),
        original: originalMatch[1].trim(),
        corrected: correctedMatch[1].trim(),
        reason: reasonMatch[1].trim()
      };
    })
    .filter((item): item is CorrectionNote => item !== null);
}

export function parseScoreStructuredResponse(text: string): WritingScoreResult {
  try {
    const sections = extractTaggedSections(text);

    if (sections.size === 0) {
      throw new Error(`Model response did not include tagged sections. Raw preview: ${previewText(text)}`);
    }

    const taskType = (sections.get("TASK_TYPE") || "").trim();
    const estimatedBand = Number((sections.get("ESTIMATED_BAND") || "").trim());
    const taskAchievement = parseScoreAndRationaleBlock(sections.get("TASK_ACHIEVEMENT") || "");
    const coherenceAndCohesion = parseScoreAndRationaleBlock(sections.get("COHERENCE_AND_COHESION") || "");
    const lexicalResource = parseScoreAndRationaleBlock(sections.get("LEXICAL_RESOURCE") || "");
    const grammaticalRangeAndAccuracy = parseScoreAndRationaleBlock(
      sections.get("GRAMMATICAL_RANGE_AND_ACCURACY") || ""
    );

    if (taskType !== "task1" && taskType !== "task2") {
      throw new Error(`Invalid task type section: ${taskType}`);
    }

    return {
      taskType,
      wordCount: 0,
      estimatedBand,
      targetBand: 6.5,
      bandBreakdown: {
        taskAchievement,
        coherenceAndCohesion,
        lexicalResource,
        grammaticalRangeAndAccuracy
      },
      strengths: parseBulletList(sections.get("STRENGTHS") || ""),
      highlightedSentences: parseHighlightedSentencesBlock(sections.get("HIGHLIGHTED_SENTENCES") || ""),
      priorityFixes: parsePriorityFixesBlock(sections.get("PRIORITY_FIXES") || ""),
      feedbackMode: "ai",
      providerUsed: "deepseek"
    };
  } catch (structuredError) {
    try {
      const parsed = extractJsonObject(text);
      return {
        taskType: parsed.taskType,
        wordCount: parsed.wordCount,
        estimatedBand: parsed.estimatedBand,
        targetBand: parsed.targetBand,
        bandBreakdown: parsed.bandBreakdown,
        strengths: parsed.strengths,
        highlightedSentences: parsed.highlightedSentences,
        priorityFixes: parsed.priorityFixes,
        feedbackMode: parsed.feedbackMode,
        providerUsed: parsed.providerUsed
      };
    } catch {
      throw structuredError;
    }
  }
}

export function parseRevisionStructuredResponse(text: string): WritingRevisionResult {
  try {
    const sections = extractTaggedSections(text);

    if (sections.size === 0) {
      throw new Error(`Model response did not include tagged sections. Raw preview: ${previewText(text)}`);
    }

    const taskType = (sections.get("TASK_TYPE") || "").trim();
    const annotatedEssay = (sections.get("ANNOTATED_ESSAY") || "").trim();
    const correctionNotes = parseCorrectionNotesBlock(sections.get("CORRECTION_NOTES") || "");
    const grammarAnnotatedEssay = (sections.get("GRAMMAR_ANNOTATED_ESSAY") || "").trim();
    const optimizationAnnotatedEssay = (sections.get("OPTIMIZATION_ANNOTATED_ESSAY") || "").trim();

    if (taskType !== "task1" && taskType !== "task2") {
      throw new Error(`Invalid task type section: ${taskType}`);
    }

    if (annotatedEssay) {
      return {
        taskType,
        wordCount: 0,
        targetBand: 6.5,
        annotatedEssay,
        correctionNotes,
        feedbackMode: "ai",
        providerUsed: "deepseek"
      };
    }

    if (!grammarAnnotatedEssay) {
      throw new Error("Missing ANNOTATED_ESSAY section.");
    }

    return {
      taskType,
      wordCount: 0,
      targetBand: 6.5,
      annotatedEssay: optimizationAnnotatedEssay || grammarAnnotatedEssay,
      correctionNotes: parseCorrectionNotesBlock(sections.get("OPTIMIZATION_CORRECTION_NOTES") || "") || correctionNotes,
      grammarRevision: {
        annotatedEssay: grammarAnnotatedEssay,
        correctionNotes: parseCorrectionNotesBlock(sections.get("GRAMMAR_CORRECTION_NOTES") || "")
      },
      optimizationRevision: optimizationAnnotatedEssay
        ? {
            annotatedEssay: optimizationAnnotatedEssay,
            correctionNotes: parseCorrectionNotesBlock(sections.get("OPTIMIZATION_CORRECTION_NOTES") || "")
          }
        : undefined,
      feedbackMode: "ai",
      providerUsed: "deepseek"
    };
  } catch (structuredError) {
    try {
      const parsed = extractJsonObject(text);
      return {
        taskType: parsed.taskType,
        wordCount: parsed.wordCount,
        targetBand: parsed.targetBand,
        annotatedEssay: parsed.annotatedEssay,
        correctionNotes: parsed.correctionNotes,
        grammarRevision: parsed.grammarRevision,
        optimizationRevision: parsed.optimizationRevision,
        feedbackMode: parsed.feedbackMode,
        providerUsed: parsed.providerUsed
      };
    } catch {
      throw structuredError;
    }
  }
}

function attachIdsToAnnotatedEssay(annotatedEssay: string, correctionNotes: CorrectionNote[]) {
  if (!annotatedEssay.includes("[del]")) {
    return annotatedEssay;
  }

  let noteIndex = 0;
  return annotatedEssay.replace(/\[del\]([\s\S]*?)\[\/del\]\[add\]([\s\S]*?)\[\/add\]/g, (_match, original, corrected) => {
    const id = correctionNotes[noteIndex]?.id || String(noteIndex + 1);
    noteIndex += 1;
    return `[del#${id}]${original}[/del#${id}][add#${id}]${corrected}[/add#${id}]`;
  });
}

function extractRevisionEdits(annotatedEssay: string) {
  return [...annotatedEssay.matchAll(/\[del#([A-Za-z0-9_-]+)\]([\s\S]*?)\[\/del#\1\]\[add#\1\]([\s\S]*?)\[\/add#\1\]/g)].map(
    (match) => ({
      id: match[1],
      original: match[2].trim(),
      corrected: match[3].trim()
    })
  );
}

function buildFallbackRevisionReason(
  locale: ReturnType<typeof getLocale>,
  category: string,
  original: string,
  corrected: string
) {
  const normalizedCategory = normalizeRevisionCategory(category);
  const categoryLabel = getRevisionCategoryLabel(normalizedCategory, locale);

  if (locale === "zh-CN") {
    return `这处修改属于“${categoryLabel}”。原句写成“${original}”不够准确或不够合适，改为“${corrected}”后，语法关系或表达逻辑会更清楚，也更符合 IELTS 写作中的自然英文用法。`;
  }

  return `This edit is classified as ${categoryLabel}. The original wording "${original}" is inaccurate or less suitable in context, and changing it to "${corrected}" makes the grammar or expression clearer and more natural for IELTS writing.`;
}

function isWeakRevisionReason(reason: string) {
  const compact = reason.trim();
  if (!compact) {
    return true;
  }

  if (compact.length < 24) {
    return true;
  }

  const normalized = compact.toLowerCase();
  return [
    "model did not provide a reason",
    "grammar mistake",
    "better wording",
    "more natural",
    "improves clarity",
    "fixed error"
  ].some((pattern) => normalized.includes(pattern));
}

function repairRevisionNotes(
  annotatedEssay: string,
  correctionNotes: CorrectionNote[],
  locale: ReturnType<typeof getLocale>
) {
  function inferCategory(original: string, corrected: string) {
    const before = original.trim();
    const after = corrected.trim();
    const lowerBefore = before.toLowerCase();
    const lowerAfter = after.toLowerCase();
    const beforeWord = lowerBefore.replace(/^[^a-z]+|[^a-z]+$/g, "");
    const afterWord = lowerAfter.replace(/^[^a-z]+|[^a-z]+$/g, "");
    const isSingleWordSwap = beforeWord.length > 0 && afterWord.length > 0 && !/\s/.test(beforeWord) && !/\s/.test(afterWord);

    if (/^[\s,.;:!?'"()\-]+$/.test(before) || /^[\s,.;:!?'"()\-]+$/.test(after)) {
      return "punctuation";
    }

    if (lowerBefore === lowerAfter && before !== after) {
      return /[a-z]/i.test(before) || /[a-z]/i.test(after) ? "capitalization" : "punctuation";
    }

    if (/\b(a|an|the)\b/i.test(before) !== /\b(a|an|the)\b/i.test(after)) {
      return "articles";
    }

    if (/\b(am|is|are|was|were|has|have|do|does)\b/i.test(before) || /\b(am|is|are|was|were|has|have|do|does)\b/i.test(after)) {
      return "subject_verb_agreement";
    }

    if (/\b(was|were|had|did)\b/i.test(before) !== /\b(was|were|had|did)\b/i.test(after) || /\b(ed)\b/i.test(after)) {
      return "tense";
    }

    if (/\b(in|on|at|for|to|with|from|of)\b/i.test(before) !== /\b(in|on|at|for|to|with|from|of)\b/i.test(after)) {
      return "preposition";
    }

    if (
      /\b(to\s+\w+|\w+\s+to\s+\w+|\w+\s+\w+ing)\b/i.test(`${before} ${after}`) &&
      beforeWord !== afterWord
    ) {
      return "verb_pattern";
    }

    if (isSingleWordSwap) {
      return "word_form";
    }

    if (before.split(/\s+/).length === after.split(/\s+/).length && before.length !== after.length) {
      return "naturalness";
    }

    return "other";
  }

  const edits = extractRevisionEdits(annotatedEssay);
  const notesById = new Map(
    correctionNotes.map((note) => [
      note.id,
      {
        ...note,
        category: normalizeRevisionCategory(note.category?.trim()),
        original: note.original.trim(),
        corrected: note.corrected.trim(),
        reason: note.reason.trim()
      }
    ])
  );

  return edits.map((edit) => {
    const existing = notesById.get(edit.id);
    if (existing) {
      const category = normalizeRevisionCategory(existing.category) || inferCategory(edit.original, edit.corrected);
      const reason =
        !isWeakRevisionReason(existing.reason)
          ? existing.reason
          : buildFallbackRevisionReason(locale, category, existing.original || edit.original, existing.corrected || edit.corrected);

      return {
        id: edit.id,
        category,
        original: existing.original || edit.original,
        corrected: existing.corrected || edit.corrected,
        reason
      };
    }

    const category = inferCategory(edit.original, edit.corrected);
    return {
      id: edit.id,
      category,
      original: edit.original,
      corrected: edit.corrected,
      reason: buildFallbackRevisionReason(locale, category, edit.original, edit.corrected)
    };
  });
}

function validateRevisionAlignment(annotatedEssay: string, correctionNotes: CorrectionNote[]) {
  const editIds = extractRevisionEdits(annotatedEssay).map((edit) => edit.id);
  const noteIds = correctionNotes.map((note) => note.id);

  const uniqueEditIds = new Set(editIds);
  const uniqueNoteIds = new Set(noteIds);

  if (editIds.length === 0) {
    throw new Error("annotatedEssay did not include any revision ids.");
  }

  if (uniqueEditIds.size !== editIds.length) {
    throw new Error(`annotatedEssay contains duplicate revision ids: ${editIds.join(", ")}`);
  }

  if (uniqueNoteIds.size !== noteIds.length) {
    throw new Error(`correctionNotes contains duplicate ids: ${noteIds.join(", ")}`);
  }

  if (uniqueEditIds.size !== uniqueNoteIds.size) {
    throw new Error(`Revision count mismatch: ${uniqueEditIds.size} edits vs ${uniqueNoteIds.size} notes.`);
  }

  for (const id of uniqueEditIds) {
    if (!uniqueNoteIds.has(id)) {
      throw new Error(`Missing correction note for revision id ${id}.`);
    }
  }

  for (const id of uniqueNoteIds) {
    if (!uniqueEditIds.has(id)) {
      throw new Error(`Unused correction note id ${id}.`);
    }
  }
}

export function normalizeScoreResult(parsed: WritingScoreResult, input: CheckInput, providerName: ProviderConfig["name"]) {
  parsed.feedbackMode = "ai";
  parsed.providerUsed = providerName;
  parsed.wordCount = countWords(input.essay);
  parsed.taskType = input.taskType;
  parsed.targetBand = getTargetBand(input.targetBand);
  parsed.highlightedSentences = parsed.highlightedSentences || [];

  for (const label of BAND_LABELS) {
    parsed.bandBreakdown[label].score = clampBand(parsed.bandBreakdown[label].score);
  }

  parsed.estimatedBand = clampBand(parsed.estimatedBand);
  return parsed;
}

export function normalizeRevisionResult(
  parsed: WritingRevisionResult,
  input: CheckInput,
  providerName: ProviderConfig["name"]
) {
  function normalizeRevisionStage(stage: RevisionStage | undefined, fallbackAnnotatedEssay?: string, fallbackNotes?: CorrectionNote[]) {
    const resolvedAnnotatedEssay = stage?.annotatedEssay ?? fallbackAnnotatedEssay ?? "";
    const resolvedNotes =
      stage?.correctionNotes?.map((note, index) => ({
        ...note,
        category: normalizeRevisionCategory(note.category?.trim()),
        id: note.id || String(index + 1)
      })) ??
      fallbackNotes?.map((note, index) => ({
        ...note,
        category: normalizeRevisionCategory(note.category?.trim()),
        id: note.id || String(index + 1)
      })) ??
      [];

    const annotatedEssayWithIds = attachIdsToAnnotatedEssay(resolvedAnnotatedEssay, resolvedNotes);
    const repairedNotes = repairRevisionNotes(annotatedEssayWithIds, resolvedNotes, getLocale(input.locale));
    validateRevisionAlignment(annotatedEssayWithIds, repairedNotes);

    return {
      annotatedEssay: annotatedEssayWithIds,
      correctionNotes: repairedNotes
    };
  }

  parsed.feedbackMode = "ai";
  parsed.providerUsed = providerName;
  parsed.wordCount = countWords(input.essay);
  parsed.taskType = input.taskType;
  parsed.targetBand = getTargetBand(input.targetBand);

  const singleStageRevision = normalizeRevisionStage(undefined, parsed.annotatedEssay, parsed.correctionNotes);
  const grammarRevision = parsed.grammarRevision
    ? normalizeRevisionStage(parsed.grammarRevision)
    : singleStageRevision;
  const optimizationRevision = parsed.optimizationRevision
    ? normalizeRevisionStage(parsed.optimizationRevision)
    : singleStageRevision;

  parsed.grammarRevision = grammarRevision;
  parsed.optimizationRevision = optimizationRevision;
  parsed.annotatedEssay = optimizationRevision.annotatedEssay;
  parsed.correctionNotes = optimizationRevision.correctionNotes;
  return parsed;
}
