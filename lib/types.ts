export type TaskType = "task1" | "task2";

export type AiProvider = "deepseek";

export type ActiveProvider = "deepseek" | "heuristic";

export type Locale = "en" | "zh-CN";

export type BandBreakdown = {
  score: number;
  rationale: string;
};

export type ImprovementItem = {
  title: string;
  detail: string;
};

export type WritingCheckResult = {
  taskType: TaskType;
  wordCount: number;
  estimatedBand: number;
  bandBreakdown: {
    taskAchievement: BandBreakdown;
    coherenceAndCohesion: BandBreakdown;
    lexicalResource: BandBreakdown;
    grammaticalRangeAndAccuracy: BandBreakdown;
  };
  strengths: string[];
  priorityFixes: ImprovementItem[];
  sampleRewrite: string;
  feedbackMode: "ai" | "heuristic";
  providerUsed: ActiveProvider;
};
