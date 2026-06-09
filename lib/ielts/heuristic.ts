import {
  CheckInput,
  CorrectionNote,
  HighlightedSentence,
  WritingCheckResult,
  WritingRevisionResult,
  WritingScoreResult,
  average,
  clampBand,
  countSentences,
  countWords,
  getLocale,
  getTargetBand
} from "./shared";

function getEssaySentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function buildHeuristicCorrectionNotes(essay: string, locale: "en" | "zh-CN"): CorrectionNote[] {
  const sentences = getEssaySentences(essay);
  const firstSentence =
    sentences[0] ||
    "This essay discusses the issue and attempts to present a clear position on the topic.";
  const secondSentence =
    sentences[1] ||
    "The main argument can be improved by making the explanation more precise and more logically connected.";

  return [
    {
      id: "1",
      original: firstSentence,
      corrected:
        "This essay addresses the issue directly and presents a clearer position on the topic.",
      reason:
        locale === "zh-CN"
          ? "把开头改得更直接，减少空泛表达，让立场更清楚。"
          : "Makes the opening more direct and clarifies the writer's position."
    },
    {
      id: "2",
      original: secondSentence,
      corrected:
        "The main argument would be stronger if each point were explained more precisely and linked more logically.",
      reason:
        locale === "zh-CN"
          ? "把比较笼统的句子改得更准确，同时强调逻辑衔接。"
          : "Improves precision and makes the logical connection more explicit."
    }
  ];
}

function buildAnnotatedEssayFromNotes(essay: string, notes: CorrectionNote[]) {
  let annotatedEssay = essay;

  for (const note of notes) {
    if (!annotatedEssay.includes(note.original)) {
      continue;
    }

    const replacement = `[del#${note.id}]${note.original}[/del#${note.id}][add#${note.id}]${note.corrected}[/add#${note.id}]`;
    annotatedEssay = annotatedEssay.replace(note.original, replacement);
  }

  return annotatedEssay;
}

function buildHeuristicHighlightedSentences(
  essay: string,
  locale: "en" | "zh-CN",
  taskType: CheckInput["taskType"]
): HighlightedSentence[] {
  const sentences = getEssaySentences(essay);
  const selected = sentences.filter((sentence) => sentence.split(/\s+/).length >= 10).slice(0, 2);

  if (selected.length === 0) {
    return [
      {
        sentence:
          taskType === "task1"
            ? "Overall, all three sources became more common over the period."
            : "I largely agree that unpaid community service should be included in high school education.",
        reason:
          locale === "zh-CN"
            ? "这句话能够直接概括核心观点，表达清楚，适合作为文章中的亮点句。"
            : "This sentence works well because it expresses a central idea clearly and directly."
      }
    ];
  }

  return selected.map((sentence, index) => ({
    sentence,
    reason:
      locale === "zh-CN"
        ? index === 0
          ? "这句话较精彩，因为信息明确，表达自然，而且能有效支撑文章主旨。"
          : "这句话值得肯定，因为它兼顾了内容展开和语言控制。"
        : index === 0
          ? "This sentence stands out because it is clear, informative, and supports the main point effectively."
          : "This sentence is effective because it combines idea development with reasonably controlled language."
  }));
}

export function buildHeuristicFeedback(input: CheckInput): WritingCheckResult {
  const { taskType, prompt, essay, locale, targetBand: requestedTargetBand } = input;
  const resolvedLocale = getLocale(locale);
  const targetBand = getTargetBand(requestedTargetBand);
  const wordCount = countWords(essay);
  const sentences = countSentences(essay);
  const paragraphs = essay
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
  const uniqueWords = new Set(
    essay
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
  ).size;
  const longSentences = essay.split(/[.!?]+/).filter((sentence) => sentence.trim().split(/\s+/).length >= 24).length;
  const linkers = (essay.match(/\b(however|therefore|moreover|overall|in contrast|for example|as a result)\b/gi) || [])
    .length;
  const minimumWords = taskType === "task1" ? 150 : 250;
  const mentionsPromptVocabulary = prompt
    .toLowerCase()
    .split(/\W+/)
    .filter((token) => token.length >= 5)
    .some((token) => essay.toLowerCase().includes(token));

  let taskAchievement = 5.5;
  let coherenceAndCohesion = 5.5;
  let lexicalResource = 5.5;
  let grammaticalRangeAndAccuracy = 5.5;

  if (wordCount >= minimumWords) taskAchievement += 0.7;
  if (wordCount >= minimumWords + 40) taskAchievement += 0.3;
  if (mentionsPromptVocabulary) taskAchievement += 0.4;
  if (paragraphs.length >= (taskType === "task1" ? 3 : 4)) coherenceAndCohesion += 0.6;
  if (sentences >= (taskType === "task1" ? 6 : 10)) coherenceAndCohesion += 0.3;
  if (linkers >= 3) coherenceAndCohesion += 0.4;
  if (uniqueWords >= (taskType === "task1" ? 80 : 120)) lexicalResource += 0.6;
  if (longSentences >= 2) grammaticalRangeAndAccuracy += 0.4;
  if (sentences > 0 && wordCount / sentences <= 28) grammaticalRangeAndAccuracy += 0.4;

  if (wordCount < minimumWords) taskAchievement -= 1.2;
  if (paragraphs.length < 2) coherenceAndCohesion -= 0.9;
  if (uniqueWords < (taskType === "task1" ? 60 : 90)) lexicalResource -= 0.8;
  if (sentences <= 3) grammaticalRangeAndAccuracy -= 0.8;

  taskAchievement = clampBand(taskAchievement);
  coherenceAndCohesion = clampBand(coherenceAndCohesion);
  lexicalResource = clampBand(lexicalResource);
  grammaticalRangeAndAccuracy = clampBand(grammaticalRangeAndAccuracy);

  const estimatedBand = clampBand(
    average([taskAchievement, coherenceAndCohesion, lexicalResource, grammaticalRangeAndAccuracy])
  );

  const strengths =
    resolvedLocale === "zh-CN"
      ? [
          wordCount >= minimumWords
            ? `这篇回答达到了 IELTS ${taskType === "task1" ? "Task 1" : "Task 2"} 的基本字数要求。`
            : "这篇回答已经在回应题目，但字数仍低于理想范围。",
          paragraphs.length >= 3
            ? "文章有比较清晰的分段，整体阅读体验较顺。"
            : "文章中的核心想法是清楚的，但段落结构还可以更明确。",
          uniqueWords >= (taskType === "task1" ? 80 : 120)
            ? "词汇范围相对较丰富，足以支撑较自然的学术表达。"
            : "已经具备一定的主题词汇基础，但还可以进一步减少重复。"
        ]
      : [
          wordCount >= minimumWords
            ? `The response meets the expected length for IELTS ${taskType === "task1" ? "Task 1" : "Task 2"}.`
            : "The response shows a clear attempt to answer the prompt, but it is under the usual word target.",
          paragraphs.length >= 3
            ? "The structure is divided into visible sections, which helps readability."
            : "The ideas are understandable and can be developed into a clearer paragraph structure.",
          uniqueWords >= (taskType === "task1" ? 80 : 120)
            ? "Vocabulary range is reasonably broad for an MVP-level automated check."
            : "There is a usable base of topic vocabulary to build on."
        ];

  const priorityFixes =
    resolvedLocale === "zh-CN"
      ? [
          wordCount < minimumWords
            ? {
                title: "补足内容展开",
                detail: `增加解释、例子或比较，至少写到 ${minimumWords} 词以上。`
              }
            : {
                title: "提升任务回应力度",
                detail:
                  taskType === "task1"
                    ? "把 overview 和关键对比写得更明确，不要只罗列数据。"
                    : "更早表明立场，并让每个主体段都围绕一个明确论点展开。"
              },
          paragraphs.length < (taskType === "task1" ? 3 : 4)
            ? {
                title: "优化分段",
                detail: "把文章拆分成更清楚的引言、主体段和结尾。"
              }
            : {
                title: "提升衔接精度",
                detail: "连接词要体现真实逻辑关系，而不是机械重复使用。"
              },
          {
            title: "减少重复表达",
            detail: "用更准确的学术词汇和更紧凑的表达替换泛泛而谈的重复用词。"
          }
        ]
      : [
          wordCount < minimumWords
            ? {
                title: "Increase development",
                detail: `Add enough explanation and support to reach at least ${minimumWords} words.`
              }
            : {
                title: "Sharpen task response",
                detail:
                  taskType === "task1"
                    ? "Make the overview and key comparisons more explicit."
                    : "State your position earlier and support each main point with a specific example."
              },
          paragraphs.length < (taskType === "task1" ? 3 : 4)
            ? {
                title: "Improve paragraphing",
                detail: "Split the essay into a clearer introduction, body sections, and ending."
              }
            : {
                title: "Link ideas more precisely",
                detail: "Use transitions only where they show contrast, cause, or emphasis clearly."
              },
          {
            title: "Reduce repetitive wording",
            detail: "Replace repeated general words with more specific academic vocabulary and tighter phrasing."
          }
        ];

  const correctionNotes = buildHeuristicCorrectionNotes(essay, resolvedLocale);
  const annotatedEssay = buildAnnotatedEssayFromNotes(essay, correctionNotes);
  const highlightedSentences = buildHeuristicHighlightedSentences(essay, resolvedLocale, taskType);

  return {
    taskType,
    wordCount,
    estimatedBand,
    targetBand,
    bandBreakdown: {
      taskAchievement: {
        score: taskAchievement,
        rationale:
          resolvedLocale === "zh-CN"
            ? taskType === "task1"
              ? "评估是否抓住了关键信息、是否写出了 overview，以及比较是否充分。"
              : "评估是否正面回应题目、立场是否清晰，以及论证是否有展开。"
            : taskType === "task1"
              ? "Measures whether the response covers key features, presents an overview, and supports comparisons."
              : "Measures whether the response answers the question directly and develops a clear position."
      },
      coherenceAndCohesion: {
        score: coherenceAndCohesion,
        rationale:
          resolvedLocale === "zh-CN"
            ? "评估结构、分段以及观点之间的衔接是否自然。"
            : "Estimates structure, paragraphing, and linking between ideas."
      },
      lexicalResource: {
        score: lexicalResource,
        rationale:
          resolvedLocale === "zh-CN"
            ? "评估词汇范围、准确性以及表达是否避免重复。"
            : "Estimates vocabulary range and precision."
      },
      grammaticalRangeAndAccuracy: {
        score: grammaticalRangeAndAccuracy,
        rationale:
          resolvedLocale === "zh-CN"
            ? "评估句型变化、语法控制和整体准确性。"
            : "Estimates sentence variety and control."
      }
    },
    strengths,
    highlightedSentences,
    priorityFixes,
    annotatedEssay,
    correctionNotes,
    feedbackMode: "heuristic",
    providerUsed: "heuristic"
  };
}

export function toScoreResult(result: WritingCheckResult): WritingScoreResult {
  return {
    taskType: result.taskType,
    wordCount: result.wordCount,
    estimatedBand: result.estimatedBand,
    targetBand: result.targetBand,
    bandBreakdown: result.bandBreakdown,
    strengths: result.strengths,
    highlightedSentences: result.highlightedSentences,
    priorityFixes: result.priorityFixes,
    feedbackMode: result.feedbackMode,
    providerUsed: result.providerUsed
  };
}

export function toRevisionResult(result: WritingCheckResult): WritingRevisionResult {
  return {
    taskType: result.taskType,
    wordCount: result.wordCount,
    targetBand: result.targetBand,
    annotatedEssay: result.annotatedEssay,
    correctionNotes: result.correctionNotes,
    feedbackMode: result.feedbackMode,
    providerUsed: result.providerUsed
  };
}
