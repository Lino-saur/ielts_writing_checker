import {
  AiProvider,
  CorrectionNote,
  HighlightedSentence,
  RevisionStage,
  Locale,
  TargetBand,
  TaskImageInput,
  TaskType,
  WritingCheckResult,
  WritingRevisionResult,
  WritingScoreResult
} from "../types";

export type PriorReviewContext = {
  parentReviewId: string;
  previousEssay: string;
  previousResult: WritingCheckResult;
  acceptedRevisionIds: string[];
};

export type CheckInput = {
  taskType: TaskType;
  prompt: string;
  essay: string;
  taskImage?: TaskImageInput | null;
  provider?: AiProvider;
  locale?: Locale;
  targetBand?: TargetBand;
  priorReview?: PriorReviewContext;
};

export type ChatCompletionsPayload = {
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    prompt_tokens_details?: {
      cached_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };
};

export type ProviderConfig = {
  name: "deepseek" | "gemini" | "qianwen";
  apiKey?: string;
  endpoint: string;
  model: string;
  extraBody?: Record<string, unknown>;
};

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export const BAND_LABELS = [
  "taskAchievement",
  "coherenceAndCohesion",
  "lexicalResource",
  "grammaticalRangeAndAccuracy"
] as const;

export function getLocale(requestedLocale?: Locale): Locale {
  return requestedLocale === "zh-CN" ? "zh-CN" : "en";
}

export function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function countSentences(text: string) {
  return text
    .split(/[.!?]+/)
    .map((segment) => segment.trim())
    .filter(Boolean).length;
}

export function clampBand(value: number) {
  const roundedToHalf = Math.round(value * 2) / 2;
  return Math.max(3, Math.min(9, Number(roundedToHalf.toFixed(1))));
}

export function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function getTargetBand(value?: TargetBand): TargetBand {
  const allowed: TargetBand[] = [5, 5.5, 6, 6.5, 7, 7.5, 8];
  return value && allowed.includes(value) ? value : 6.5;
}

export type {
  CorrectionNote,
  HighlightedSentence,
  RevisionStage,
  WritingCheckResult,
  WritingRevisionResult,
  WritingScoreResult
};
