import { AiProvider, Locale, TaskType, WritingCheckResult } from "./types";

type CheckInput = {
  taskType: TaskType;
  prompt: string;
  essay: string;
  provider?: AiProvider;
  locale?: Locale;
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

function getDeepSeekConfig(): ProviderConfig {
  return {
    name: "deepseek",
    apiKey: process.env.DEEPSEEK_API_KEY,
    endpoint: "https://api.deepseek.com/chat/completions",
    model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
    extraBody: {
      temperature: 0.3,
      max_tokens: 1600,
      response_format: {
        type: "json_object"
      }
    }
  };
}

function buildHeuristicFeedback({ taskType, prompt, essay, locale }: CheckInput): WritingCheckResult {
  const resolvedLocale = getLocale(locale);
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
      ? "Overall, the chart shows a clear upward trend in the later period, while the earlier figures remain comparatively stable. The most notable change is the sharp rise in the final category, which overtakes the others by the end of the timeline."
      : "I largely agree with the statement because long-term progress usually depends on disciplined habits rather than short bursts of motivation. In particular, consistent effort helps people build skill, while repeated practice makes good decisions easier to maintain.";

  return {
    taskType,
    wordCount,
    estimatedBand,
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
    priorityFixes,
    sampleRewrite,
    feedbackMode: "heuristic",
    providerUsed: "heuristic"
  };
}

function extractJsonObject(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("Model response did not include a JSON object.");
  }

  return JSON.parse(match[0]) as WritingCheckResult;
}

function normalizeParsedResult(parsed: WritingCheckResult, input: CheckInput, providerName: ProviderConfig["name"]) {
  parsed.feedbackMode = "ai";
  parsed.providerUsed = providerName;
  parsed.wordCount = countWords(input.essay);
  parsed.taskType = input.taskType;

  for (const label of BAND_LABELS) {
    parsed.bandBreakdown[label].score = clampBand(parsed.bandBreakdown[label].score);
  }

  parsed.estimatedBand = clampBand(parsed.estimatedBand);

  return parsed;
}

function buildScoringPrompt(input: CheckInput, minimumWords: number, providerName: ProviderConfig["name"]) {
  const locale = getLocale(input.locale);
  const outputLanguageInstruction =
    locale === "zh-CN"
      ? "Write rationale, strengths, and priorityFixes in Simplified Chinese. sampleRewrite must remain in natural English."
      : "Write rationale, strengths, priorityFixes, and sampleRewrite in English.";
  const task2LogicInstruction =
    input.taskType === "task2"
      ? `
- When judging idea development for body paragraphs, explicitly evaluate whether the argument can be logically developed as a clear causal chain in the form "A inevitably leads to B, B inevitably leads to C, and C inevitably leads to D".
- Use the IELTS writing criteria to judge whether that causal chain is clear, relevant, sufficiently explained, and well connected to the question.
- If the essay does not follow that logic chain well, reflect the weakness in task achievement/task response and coherence/cohesion comments, and suggest how the chain could be made tighter.`
      : "";

  return `
You are an IELTS writing examiner.
Evaluate the user's response for ${input.taskType === "task1" ? "IELTS Academic Writing Task 1" : "IELTS Writing Task 2"}.
Return JSON only.

Required JSON shape:
{
  "taskType": "task1" | "task2",
  "wordCount": number,
  "estimatedBand": number,
  "bandBreakdown": {
    "taskAchievement": { "score": number, "rationale": string },
    "coherenceAndCohesion": { "score": number, "rationale": string },
    "lexicalResource": { "score": number, "rationale": string },
    "grammaticalRangeAndAccuracy": { "score": number, "rationale": string }
  },
  "strengths": string[],
  "priorityFixes": [{ "title": string, "detail": string }],
  "sampleRewrite": string,
  "feedbackMode": "ai",
  "providerUsed": "${providerName}"
}

Constraints:
- Use band scores from 0 to 9 in 0.5 increments.
- Keep rationales concise and specific to the essay.
- Include exactly 3 strengths.
- Include exactly 3 priority fixes.
- Keep sampleRewrite between 60 and 110 words.
- Consider the minimum word expectation of ${minimumWords}.
- The output must be valid json.
- ${outputLanguageInstruction}
${task2LogicInstruction}

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
  const prompt = buildScoringPrompt(input, minimumWords, config.name);

  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "system",
          content: "You are a precise IELTS writing evaluator. Always respond with valid json."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      ...config.extraBody
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${config.name} request failed: ${response.status} ${errorText}`);
  }

  const payload = (await response.json()) as ChatCompletionsPayload;
  const text = payload.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error(`${config.name} response was empty.`);
  }

  const parsed = extractJsonObject(text);
  return normalizeParsedResult(parsed, input, config.name);
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
    locale: getLocale(input.locale)
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
    console.error("Falling back to heuristic scoring:", error);
    return buildHeuristicFeedback(cleanInput);
  }
}
