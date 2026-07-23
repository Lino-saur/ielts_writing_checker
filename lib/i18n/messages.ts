import { Locale } from "@/lib/types";
import { DEFAULT_LOCALE } from "./config";
import checkerEn from "./locales/en/checker.json";
import checkerZhCN from "./locales/zh-CN/checker.json";
import landingEn from "./locales/en/landing.json";
import landingZhCN from "./locales/zh-CN/landing.json";
import navbarEn from "./locales/en/navbar.json";
import navbarZhCN from "./locales/zh-CN/navbar.json";
import practiceEn from "./locales/en/practice.json";
import practiceZhCN from "./locales/zh-CN/practice.json";

export type NavbarMessages = Record<string, string> & {
  brand: string;
  task1: string;
  task2: string;
  languageLabel: string;
  userLabel: string;
  energyLabel: string;
  login: string;
  signInTab: string;
  signUpTab: string;
  authName: string;
  authEmail: string;
  authPassword: string;
  authSubmitSignIn: string;
  authSubmitSignUp: string;
  authHintSignIn: string;
  authHintSignUp: string;
  authVerificationPending: string;
  authVerificationRequired: string;
  authVerificationSent: string;
  authVerificationSuccess: string;
  authVerificationAutoSigningIn: string;
  authResendVerification: string;
  authResendVerificationSending: string;
  authClose: string;
  authSignOut: string;
  authDeleteAccount: string;
  authDeleteDialogTitle: string;
  authDeleteDialogHint: string;
  authDeleteDialogWarning: string;
  authDeleteConfirmLabel: string;
  authDeleteCancel: string;
  authDeleteSubmit: string;
  authDeleting: string;
  authDeleteSuccess: string;
  genericError: string;
  writingTasks: string;
  actionGroup: string;
  openActionMenu: string;
  closeActionMenu: string;
  openSettingsMenu: string;
  closeSettingsMenu: string;
  noAccount: string;
  createOne: string;
  alreadyHaveAccount: string;
  backToSignIn: string;
  themeLabel: string;
  appearanceLabel: string;
  switchToDarkMode: string;
  switchToLightMode: string;
  hidePassword: string;
  showPassword: string;
  submitting: string;
  feedbackEntry: string;
  feedbackTitle: string;
  feedbackHint: string;
  feedbackTypeLabel: string;
  feedbackTypeProduct: string;
  feedbackTypeBug: string;
  feedbackTypeFeatureRequest: string;
  feedbackCommentLabel: string;
  feedbackCommentPlaceholder: string;
  feedbackSubmit: string;
  feedbackSubmitted: string;
  rechargeEntry: string;
  historyEntry: string;
  practiceEntry: string;
  assignmentsEntry: string;
  rechargeTitle: string;
  rechargeHint: string;
  rechargeMessage: string;
  rechargeContactLabel: string;
  rechargeContactPlaceholder: string;
  rechargeSubmit: string;
  rechargeSubmitted: string;
  rechargeLoading: string;
  rechargePlanLabel: string;
  rechargeMonthly: string;
  rechargeQuarterly: string;
  rechargeAnnual: string;
  rechargeReviews: string;
  rechargeDays: string;
  rechargeSimulationNote: string;
  rechargeSuccess: string;
  rechargePassSuccess: string;
  rechargeUnlimited: string;
  rechargeNeverExpires: string;
  rechargeCurrentBenefits: string;
  rechargeCurrentBalance: string;
  rechargeUnlimitedStatus: string;
  rechargeUnlimitedUntil: string;
  rechargeNoActivePass: string;
  ordersEntry: string;
  ordersMenuHint: string;
  ordersTitle: string;
  ordersSubtitle: string;
  ordersLoading: string;
  ordersLoadError: string;
  ordersRetry: string;
  ordersRefresh: string;
  ordersBack: string;
  ordersAuthTitle: string;
  ordersAuthBody: string;
  ordersEmptyTitle: string;
  ordersEmptyBody: string;
  ordersEmptyAction: string;
  ordersStatusPaid: string;
  ordersStatusPending: string;
  ordersStatusFailed: string;
  ordersStatusCancelled: string;
  ordersStatusRefunded: string;
  ordersNumber: string;
  ordersPurchasedAt: string;
  ordersPaymentMethod: string;
  ordersWechat: string;
  ordersPaidAmount: string;
  ordersUnlimitedPlan: string;
  ordersInkPlan: string;
  ordersQuestion: string;
  ordersRefundRequest: string;
  ordersQuestionTitle: string;
  ordersQuestionHint: string;
  ordersRefundTitle: string;
  ordersRefundHint: string;
  ordersRefundDefaultReason: string;
  ordersSupportReason: string;
  ordersSupportDetails: string;
  ordersSupportDetailsPlaceholder: string;
  ordersRefundPolicy: string;
  ordersSupportSubmit: string;
  ordersSupportSubmitError: string;
  ordersRefundUnavailable: string;
  ordersSupportStatus_open: string;
  ordersSupportStatus_reviewing: string;
  ordersSupportStatus_approved: string;
  ordersSupportStatus_rejected: string;
  ordersSupportStatus_refunded: string;
  rechargeRewardAlert: string;
  rechargeRewardToastGranted: string;
  rechargeRewardToastAlreadyClaimed: string;
};

export type LandingMessages = Record<string, string>;
export type CheckerMessages = Record<string, string>;
export type PracticeMessages = Record<string, string> & {
  title: string;
  eyebrow: string;
  body: string;
  allBooks: string;
  taskLabel: string;
  allTasks: string;
  allTags: string;
  task1: string;
  task2: string;
  bookLabel: string;
  testLabel: string;
  questionCount: string;
  startPractice: string;
  loading: string;
  loadFailed: string;
  emptyTitle: string;
  emptyBody: string;
  authTitle: string;
  authBody: string;
  authDialogHint: string;
  authLogin: string;
  authSignUp: string;
  imageReady: string;
  tags: string;
  sourceLabel: string;
  sourceCambridge: string;
  sourceHistorical: string;
  yearLabel: string;
  allYears: string;
  categoryLabel: string;
  allCategories: string;
  questionTypeLabel: string;
  allQuestionTypes: string;
  importanceLabel: string;
  allImportance: string;
  paginationLabel: string;
  previousPage: string;
  nextPage: string;
};

const navbarMessages: Record<Locale, NavbarMessages> = {
  en: navbarEn,
  "zh-CN": navbarZhCN
};

const landingMessages: Record<Locale, LandingMessages> = {
  en: landingEn,
  "zh-CN": landingZhCN
};

const checkerMessages: Record<Locale, CheckerMessages> = {
  en: checkerEn,
  "zh-CN": checkerZhCN
};

const practiceMessages: Record<Locale, PracticeMessages> = {
  en: practiceEn,
  "zh-CN": practiceZhCN
};

export function getMessages(locale: Locale) {
  const resolvedLocale = locale in navbarMessages ? locale : DEFAULT_LOCALE;
  return {
    navbar: navbarMessages[resolvedLocale],
    landing: landingMessages[resolvedLocale],
    checker: checkerMessages[resolvedLocale],
    practice: practiceMessages[resolvedLocale]
  };
}
