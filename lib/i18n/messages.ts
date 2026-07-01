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
  rechargeTitle: string;
  rechargeHint: string;
  rechargeMessage: string;
  rechargeContactLabel: string;
  rechargeContactPlaceholder: string;
  rechargeSubmit: string;
  rechargeSubmitted: string;
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
