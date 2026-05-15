import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  AiProvider,
  CorrectionNote,
  HighlightedSentence,
  Locale,
  TargetBand,
  TaskType,
  WritingCheckResult
} from "./types";

type CheckInput = {
  taskType: TaskType;
  prompt: string;
  essay: string;
  provider?: AiProvider;
  locale?: Locale;
  targetBand?: TargetBand;
};

type ChatCompletionsPayload = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type ProviderConfig = {
  name: "deepseek";
  apiKey?: string;
  endpoint: string;
  model: string;
  extraBody?: Record<string, unknown>;
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const BAND_LABELS = [
  "taskAchievement",
  "coherenceAndCohesion",
  "lexicalResource",
  "grammaticalRangeAndAccuracy"
] as const;

function getLocale(requestedLocale?: Locale): Locale {
  return requestedLocale === "zh-CN" ? "zh-CN" : "en";
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function countSentences(text: string) {
  return text
    .split(/[.!?]+/)
    .map((segment) => segment.trim())
    .filter(Boolean).length;
}

function clampBand(value: number) {
  const roundedToHalf = Math.round(value * 2) / 2;
  return Math.max(3, Math.min(9, Number(roundedToHalf.toFixed(1))));
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getTargetBand(value?: TargetBand): TargetBand {
  const allowed: TargetBand[] = [5, 5.5, 6, 6.5, 7, 7.5, 8];
  return value && allowed.includes(value) ? value : 6.5;
}

function getDeepSeekConfig(): ProviderConfig {
  return {
    name: "deepseek",
    apiKey: process.env.DEEPSEEK_API_KEY,
    endpoint: "https://api.deepseek.com/chat/completions",
    model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
    extraBody: {
      thinking: {
        type: "disabled"
      },
      temperature: 0.3,
      max_tokens: 1600,
      response_format: {
        type: "json_object"
      }
    }
  };
}

const PROMPTS_DIR = path.join(process.cwd(), "prompts");

async function readPromptFile(filename: string) {
  return readFile(path.join(PROMPTS_DIR, filename), "utf8");
}

function applyTemplate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((output, [key, value]) => {
    return output.replaceAll(`{{${key}}}`, String(value));
  }, template);
}

function getEssaySentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function buildHeuristicCorrectionNotes(essay: string, locale: Locale): CorrectionNote[] {
  const sentences = getEssaySentences(essay);
  const firstSentence =
    sentences[0] ||
    "This essay discusses the issue and attempts to present a clear position on the topic.";
  const secondSentence =
    sentences[1] ||
    "The main argument can be improved by making the explanation more precise and more logically connected.";

  return [
    {
      original: firstSentence,
      corrected:
        "This essay addresses the issue directly and presents a clearer position on the topic.",
      reason:
        locale === "zh-CN"
          ? "把开头改得更直接，减少空泛表达，让立场更清楚。"
          : "Makes the opening more direct and clarifies the writer's position."
    },
    {
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

    const replacement = `[del]${note.original}[/del][add]${note.corrected}[/add]`;
    annotatedEssay = annotatedEssay.replace(note.original, replacement);
  }

  return annotatedEssay;
}

function buildHeuristicHighlightedSentences(
  essay: string,
  locale: Locale,
  taskType: TaskType
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

function buildHeuristicFeedback({ taskType, prompt, essay, locale }: CheckInput): WritingCheckResult {
  const resolvedLocale = getLocale(locale);
  const targetBand = getTargetBand(arguments[0].targetBand);
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

  const sampleRewrite =
    taskType === "task1"
      ? targetBand >= 7
        ? "Overall, all three energy sources became more widely used over the period, but solar recorded by far the most dramatic growth. While hydro increased only modestly and remained the least common source throughout, solar rose sharply after 2010 and finished as the dominant form of renewable household energy. Wind also followed an upward trend, although its increase was steadier and less pronounced than that of solar."
        : "Overall, the chart shows a clear upward trend in the later period, while the earlier figures remain comparatively stable. The most notable change is the sharp rise in the final category, which overtakes the others by the end of the timeline."
      : targetBand >= 7
        ? "I strongly agree that unpaid community service should be a compulsory element of high school education because it develops both civic awareness and practical capability. By working with charities, environmental projects, or community programmes, students learn to cooperate with others, understand real social needs, and apply classroom knowledge in meaningful situations. However, schools should ensure that such programmes are well supervised and flexible enough to avoid placing excessive pressure on students with heavy academic responsibilities."
        : "I largely agree with the statement because long-term progress usually depends on disciplined habits rather than short bursts of motivation. In particular, consistent effort helps people build skill, while repeated practice makes good decisions easier to maintain.";
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
    sampleRewrite,
    feedbackMode: "heuristic",
    providerUsed: "heuristic"
  };
}

function cleanModelText(text: string) {
  return text
    .replace(/```json/gi, "```")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
}

function previewText(text: string, maxLength = 400) {
  return text.slice(0, maxLength).replace(/\s+/g, " ");
}

function extractJsonObject(text: string) {
  const cleanedText = cleanModelText(text);
  const match = cleanedText.match(/\{[\s\S]*\}/);
  if (!match) {
    const preview = previewText(cleanedText);
    throw new Error(`Model response did not include a JSON object. Raw preview: ${preview}`);
  }

  return JSON.parse(match[0]) as WritingCheckResult;
}

function normalizeParsedResult(parsed: WritingCheckResult, input: CheckInput, providerName: ProviderConfig["name"]) {
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

async function buildScoringPrompt(input: CheckInput, minimumWords: number, providerName: ProviderConfig["name"]) {
  const locale = getLocale(input.locale);
  const targetBand = getTargetBand(input.targetBand);
  const outputLanguageInstruction =
    locale === "zh-CN"
      ? "Write rationale, strengths, and priorityFixes in Simplified Chinese. sampleRewrite must remain in natural English."
      : "Write rationale, strengths, priorityFixes, and sampleRewrite in English.";
  const [basePrompt, taskPrompt] = await Promise.all([
    readPromptFile("base.md"),
    readPromptFile(input.taskType === "task1" ? "task1.md" : "task2.md")
  ]);

  const rules = applyTemplate(basePrompt, {
    providerName,
    minimumWords,
    outputLanguageInstruction
  });

  return `
${rules}

${taskPrompt}

Target band:
${targetBand}

The sampleRewrite must be written to match the quality, sophistication, and control expected around IELTS band ${targetBand}. It should not be generic. It should reflect the target score level the user wants to reach.

Prompt:
${input.prompt}

Essay:
${input.essay}

Detected word count: ${countWords(input.essay)}
`.trim();
}

async function runChatCompletion(input: CheckInput, config: ProviderConfig): Promise<WritingCheckResult> {
  if (!config.apiKey) {
    throw new Error(`${config.name.toUpperCase()}_API_KEY is not configured.`);
  }

  const minimumWords = input.taskType === "task1" ? 150 : 250;
  const prompt = await buildScoringPrompt(input, minimumWords, config.name);
  const wordCount = countWords(input.essay);
  const baseMessages: ChatMessage[] = [
    {
      role: "system",
      content: "You are a precise IELTS writing evaluator. Always respond with valid json."
    },
    {
      role: "user",
      content: prompt
    }
  ];

  console.log("[IELTS_CHECK][REQUEST]", {
    provider: config.name,
    model: config.model,
    taskType: input.taskType,
    locale: input.locale,
    wordCount,
    promptLength: prompt.length,
    essayLength: input.essay.length
  });

  async function requestCompletion(messages: ChatMessage[], phase: "first" | "retry") {
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        ...config.extraBody
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[IELTS_CHECK][HTTP_ERROR]", {
        provider: config.name,
        phase,
        status: response.status,
        bodyPreview: previewText(errorText)
      });
      throw new Error(`${config.name} request failed: ${response.status} ${errorText}`);
    }

    const payload = (await response.json()) as ChatCompletionsPayload;
    const text = payload.choices?.[0]?.message?.content;

    if (!text) {
      console.error("[IELTS_CHECK][EMPTY_RESPONSE]", {
        provider: config.name,
        phase,
        payloadPreview: previewText(JSON.stringify(payload))
      });
      throw new Error(`${config.name} response was empty.`);
    }

    console.log("[IELTS_CHECK][RAW_RESPONSE]", {
      provider: config.name,
      phase,
      rawLength: text.length,
      rawPreview: previewText(text),
      cleanedPreview: previewText(cleanModelText(text))
    });

    return text;
  }

  const firstText = await requestCompletion(baseMessages, "first");

  try {
    const parsed = extractJsonObject(firstText);
    console.log("[IELTS_CHECK][PARSE_SUCCESS]", {
      provider: config.name,
      phase: "first",
      estimatedBand: parsed.estimatedBand,
      correctionNoteCount: parsed.correctionNotes?.length
    });
    return normalizeParsedResult(parsed, input, config.name);
  } catch (firstError) {
    console.error("[IELTS_CHECK][PARSE_FAIL]", {
      provider: config.name,
      phase: "first",
      error: firstError instanceof Error ? firstError.message : String(firstError),
      rawPreview: previewText(firstText),
      cleanedPreview: previewText(cleanModelText(firstText))
    });

    const retryText = await requestCompletion([
      ...baseMessages,
      {
        role: "assistant",
        content: firstText
      },
      {
        role: "user",
        content:
          "Your previous reply was invalid. Return ONLY one valid JSON object matching the required schema. No markdown, no explanation, no prose, no code fences."
      }
    ], "retry");

    try {
      const parsed = extractJsonObject(retryText);
      console.log("[IELTS_CHECK][PARSE_SUCCESS]", {
        provider: config.name,
        phase: "retry",
        estimatedBand: parsed.estimatedBand,
        correctionNoteCount: parsed.correctionNotes?.length
      });
      return normalizeParsedResult(parsed, input, config.name);
    } catch (retryError) {
      console.error("[IELTS_CHECK][PARSE_FAIL]", {
        provider: config.name,
        phase: "retry",
        error: retryError instanceof Error ? retryError.message : String(retryError),
        rawPreview: previewText(retryText),
        cleanedPreview: previewText(cleanModelText(retryText))
      });
      throw retryError instanceof Error ? retryError : firstError;
    }
  }
}

async function buildAiFeedback(input: CheckInput): Promise<WritingCheckResult> {
  return runChatCompletion(input, getDeepSeekConfig());
}

export async function evaluateWriting(input: CheckInput): Promise<WritingCheckResult> {
  const cleanInput = {
    taskType: input.taskType,
    prompt: input.prompt.trim(),
    essay: input.essay.trim(),
    provider: input.provider,
    locale: getLocale(input.locale),
    targetBand: getTargetBand(input.targetBand)
  };

  if (!cleanInput.prompt) {
    throw new Error("Prompt is required.");
  }

  if (!cleanInput.essay) {
    throw new Error("Essay is required.");
  }

  try {
    return await buildAiFeedback(cleanInput);
  } catch (error) {
    console.error("[IELTS_CHECK][FALLBACK_TO_HEURISTIC]", {
      taskType: cleanInput.taskType,
      locale: cleanInput.locale,
      wordCount: countWords(cleanInput.essay),
      error: error instanceof Error ? error.message : String(error)
    });
    return buildHeuristicFeedback(cleanInput);
  }
}
