import { TaskType, WritingCheckResult } from "./types";

type CheckInput = {
  taskType: TaskType;
  prompt: string;
  essay: string;
};

const BAND_LABELS = [
  "taskAchievement",
  "coherenceAndCohesion",
  "lexicalResource",
  "grammaticalRangeAndAccuracy"
] as const;

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
  return Math.max(3, Math.min(9, Number(value.toFixed(1))));
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildHeuristicFeedback({ taskType, prompt, essay }: CheckInput): WritingCheckResult {
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

  const strengths = [
    wordCount >= minimumWords
      ? `The response meets the expected length for IELTS ${taskType === "task1" ? "Task 1" : "Task 2"}.`
      : `The response shows a clear attempt to answer the prompt, but it is under the usual word target.`,
    paragraphs.length >= 3
      ? "The structure is divided into visible sections, which helps readability."
      : "The ideas are understandable and can be developed into a clearer paragraph structure.",
    uniqueWords >= (taskType === "task1" ? 80 : 120)
      ? "Vocabulary range is reasonably broad for an MVP-level automated check."
      : "There is a usable base of topic vocabulary to build on."
  ];

  const priorityFixes = [
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
          taskType === "task1"
            ? "Measures whether the response covers key features, presents an overview, and supports comparisons."
            : "Measures whether the response answers the question directly and develops a clear position."
      },
      coherenceAndCohesion: {
        score: coherenceAndCohesion,
        rationale: "Estimates structure, paragraphing, and linking between ideas."
      },
      lexicalResource: {
        score: lexicalResource,
        rationale: "Estimates vocabulary range and precision."
      },
      grammaticalRangeAndAccuracy: {
        score: grammaticalRangeAndAccuracy,
        rationale: "Estimates sentence variety and control."
      }
    },
    strengths,
    priorityFixes,
    sampleRewrite,
    feedbackMode: "heuristic"
  };
}

function extractJsonObject(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("Model response did not include a JSON object.");
  }

  return JSON.parse(match[0]) as WritingCheckResult;
}

async function buildAiFeedback(input: CheckInput): Promise<WritingCheckResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return buildHeuristicFeedback(input);
  }

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const wordCount = countWords(input.essay);
  const minimumWords = input.taskType === "task1" ? 150 : 250;

  const prompt = `
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
  "feedbackMode": "ai"
}

Constraints:
- Use band scores from 0 to 9 in 0.5 increments.
- Keep rationales concise and specific to the essay.
- Include exactly 3 strengths.
- Include exactly 3 priority fixes.
- Keep sampleRewrite between 60 and 110 words.
- Consider the minimum word expectation of ${minimumWords}.

Prompt:
${input.prompt}

Essay:
${input.essay}

Detected word count: ${wordCount}
`.trim();

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: {
        type: "json_object"
      },
      messages: [
        {
          role: "system",
          content: "You are a precise IELTS writing evaluator."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const text = payload.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error("OpenAI response was empty.");
  }

  const parsed = extractJsonObject(text);
  parsed.feedbackMode = "ai";
  parsed.wordCount = wordCount;
  parsed.taskType = input.taskType;

  for (const label of BAND_LABELS) {
    parsed.bandBreakdown[label].score = clampBand(parsed.bandBreakdown[label].score);
  }

  parsed.estimatedBand = clampBand(parsed.estimatedBand);

  return parsed;
}

export async function evaluateWriting(input: CheckInput): Promise<WritingCheckResult> {
  const cleanInput = {
    taskType: input.taskType,
    prompt: input.prompt.trim(),
    essay: input.essay.trim()
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
