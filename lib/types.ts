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

export type FeedbackKind = "review" | "product" | "bug" | "feature_request";
export type FeedbackStatus = "new" | "reviewing" | "closed";
export type AdminUserStatus = "active" | "disabled";

export type FeedbackPayload = {
  kind: FeedbackKind;
  helpful: boolean | null;
  category?: string | null;
  comment?: string;
  page: string;
  taskType?: TaskType;
  targetBand?: TargetBand;
  providerUsed?: ActiveProvider;
  feedbackMode?: "ai" | "heuristic";
  estimatedBand?: number;
  wordCount?: number;
  context?: Record<string, unknown>;
};

export type FeedbackEntry = {
  id: string;
  userId: string;
  kind: FeedbackKind;
  status: FeedbackStatus;
  helpful: boolean | null;
  category: string | null;
  comment: string;
  page: string;
  taskType: TaskType | null;
  targetBand: number | null;
  providerUsed: ActiveProvider | null;
  feedbackMode: "ai" | "heuristic" | null;
  estimatedBand: number | null;
  wordCount: number | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type AdminUserEntry = {
  id: string;
  authUserId: string;
  email: string | null;
  displayName: string | null;
  status: AdminUserStatus;
  createdAt: string;
  updatedAt: string;
};
