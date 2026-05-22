export type TaskType = "task1" | "task2";

export type AiProvider = "deepseek";

export type ActiveProvider = "deepseek" | "heuristic";

export type Locale = "en" | "zh-CN";

export type TargetBand = 5 | 5.5 | 6 | 6.5 | 7 | 7.5 | 8;

export type BandBreakdown = {
  score: number;
  rationale: string;
};

export type ImprovementItem = {
  title: string;
  detail: string;
};

export type CorrectionNote = {
  id: string;
  original: string;
  corrected: string;
  reason: string;
};

export type HighlightedSentence = {
  sentence: string;
  reason: string;
};

export type WritingScoreResult = {
  taskType: TaskType;
  wordCount: number;
  estimatedBand: number;
  targetBand: TargetBand;
  bandBreakdown: {
    taskAchievement: BandBreakdown;
    coherenceAndCohesion: BandBreakdown;
    lexicalResource: BandBreakdown;
    grammaticalRangeAndAccuracy: BandBreakdown;
  };
  strengths: string[];
  highlightedSentences: HighlightedSentence[];
  priorityFixes: ImprovementItem[];
  feedbackMode: "ai" | "heuristic";
  providerUsed: ActiveProvider;
};

export type WritingRevisionResult = {
  taskType: TaskType;
  wordCount: number;
  targetBand: TargetBand;
  annotatedEssay: string;
  correctionNotes: CorrectionNote[];
  feedbackMode: "ai" | "heuristic";
  providerUsed: ActiveProvider;
};

export type WritingCheckResult = {
  taskType: TaskType;
  wordCount: number;
  estimatedBand: number;
  targetBand: TargetBand;
  bandBreakdown: {
    taskAchievement: BandBreakdown;
    coherenceAndCohesion: BandBreakdown;
    lexicalResource: BandBreakdown;
    grammaticalRangeAndAccuracy: BandBreakdown;
  };
  strengths: string[];
  highlightedSentences: HighlightedSentence[];
  priorityFixes: ImprovementItem[];
  annotatedEssay: string;
  correctionNotes: CorrectionNote[];
  feedbackMode: "ai" | "heuristic";
  providerUsed: ActiveProvider;
};
