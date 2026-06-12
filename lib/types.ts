export type TaskType = "task1" | "task2";

export type TaskImageInput = {
  name: string;
  mimeType: string;
  dataUrl: string;
};

export type AiProvider = "deepseek" | "gemini";

export type ActiveProvider = "deepseek" | "gemini";

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
  feedbackMode: "ai";
  providerUsed: ActiveProvider;
};

export type WritingRevisionResult = {
  taskType: TaskType;
  wordCount: number;
  targetBand: TargetBand;
  annotatedEssay: string;
  correctionNotes: CorrectionNote[];
  feedbackMode: "ai";
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
  feedbackMode: "ai";
  providerUsed: ActiveProvider;
};

export type WritingReviewImage = {
  name: string;
  mimeType: string;
  url: string;
};

export type WritingReviewListItem = {
  id: string;
  taskType: TaskType;
  targetBand: number;
  estimatedBand: number;
  wordCount: number;
  providerUsed: ActiveProvider;
  hasImage: boolean;
  createdAt: string;
};

export type WritingReviewDetail = {
  id: string;
  userId: string;
  taskType: TaskType;
  prompt: string;
  essay: string;
  targetBand: number;
  estimatedBand: number;
  wordCount: number;
  providerUsed: ActiveProvider;
  result: WritingCheckResult;
  image: WritingReviewImage | null;
  createdAt: string;
  updatedAt: string;
};

export type FeedbackKind = "review" | "product" | "bug" | "feature_request";
export type FeedbackStatus = "new" | "reviewing" | "closed";
export type SupportInboxStatus = "new" | "reviewing" | "closed";
export type AdminUserStatus = "active" | "disabled";
export type RechargeProvider = "manual" | "wechat" | "alipay";
export type RechargeOrderStatus = "pending" | "paid" | "failed" | "cancelled";
export type RechargePaymentMode = "redirect" | "qr_code" | "sdk" | "pending";

export type FeedbackPayload = {
  kind: FeedbackKind;
  helpful: boolean | null;
  category?: string | null;
  comment?: string;
  page: string;
  taskType?: TaskType;
  targetBand?: TargetBand;
  providerUsed?: ActiveProvider;
  feedbackMode?: "ai";
  estimatedBand?: number;
  wordCount?: number;
  context?: Record<string, unknown>;
};

export type FeedbackEntry = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  kind: FeedbackKind;
  status: FeedbackStatus;
  helpful: boolean | null;
  category: string | null;
  comment: string;
  page: string;
  taskType: TaskType | null;
  targetBand: number | null;
  providerUsed: ActiveProvider | null;
  feedbackMode: "ai" | null;
  estimatedBand: number | null;
  wordCount: number | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type SupportInboxEntry = {
  id: string;
  resendEmailId: string | null;
  fromEmail: string;
  fromName: string | null;
  toEmail: string | null;
  subject: string;
  textContent: string;
  htmlContent: string | null;
  status: SupportInboxStatus;
  replyCount: number;
  lastRepliedAt: string | null;
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
  rawPayload: Record<string, unknown>;
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

export type RechargeProduct = {
  id: string;
  code: string;
  name: string;
  energyAmount: number;
  bonusEnergyAmount: number;
  priceCents: number;
  currency: string;
  status: "active" | "inactive";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type RechargeOrder = {
  id: string;
  userId: string;
  productId: string;
  productCode: string;
  productName: string;
  provider: RechargeProvider;
  status: RechargeOrderStatus;
  amountCents: number;
  currency: string;
  energyAmount: number;
  bonusEnergyAmount: number;
  totalEnergyAmount: number;
  providerOrderId: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RechargePaymentSession = {
  provider: RechargeProvider;
  mode: RechargePaymentMode;
  redirectUrl: string | null;
  qrCodeUrl: string | null;
  clientPayload: Record<string, string | number | boolean | null> | null;
  message?: string;
};
