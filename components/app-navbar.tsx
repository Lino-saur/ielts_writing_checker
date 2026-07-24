"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  invalidateClientSessionContext,
  type ClientSessionContext,
  useAuthSession
} from "@/lib/auth-client-session";
import type { NavbarMessages } from "@/lib/i18n/messages";
import { ActionButton, Pill, Surface } from "@/components/ui-kit";
import type { FeedbackKind, Locale, RechargeOrder, RechargeProduct } from "@/lib/types";

type AppNavbarProps = {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  copy: NavbarMessages;
  onSessionUpdated?: () => Promise<void> | void;
  taskMenuMode?: "all" | "task2Only";
  energyBalance?: number | null;
  authRequest?: {
    mode: AuthMode;
    id: number;
  } | null;
  authHint?: string;
  onTaskNavigate?: (task: "task1" | "task2", href: string) => void;
};

type AuthMode = "signIn" | "signUp";
type ThemeMode = "light" | "dark";
type ProductFeedbackKind = Exclude<FeedbackKind, "review">;
type AuthErrorLike = {
  message?: string;
  code?: string;
};

async function getAuthClient() {
  const { authClient } = await import("@/lib/auth-client");
  return authClient;
}

function formatUser(user: ClientSessionContext["user"]) {
  if (!user) {
    return "--";
  }

  return user.name?.trim() || user.email?.trim() || "--";
}

function normalizeAuthError(error: AuthErrorLike | null | undefined, fallback: string) {
  const normalized = new Error(error?.message || fallback) as Error & { code?: string };
  normalized.code = error?.code;
  return normalized;
}

function isEmailVerificationError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalizedMessage = error.message.toLowerCase();
  const errorCode = "code" in error ? String((error as { code?: unknown }).code || "") : "";

  return errorCode === "EMAIL_NOT_VERIFIED" || normalizedMessage.includes("not verified");
}

function normalizeEmailIdentity(email: string) {
  return email.trim().toLowerCase();
}

export function AppNavbar({
  locale,
  onLocaleChange,
  copy,
  onSessionUpdated,
  taskMenuMode = "all",
  energyBalance = null,
  authRequest = null,
  authHint,
  onTaskNavigate
}: AppNavbarProps) {
  const { sessionContext, sessionResolved, refreshSessionContext, setSessionContext } = useAuthSession();
  const themeSwitchId = useId();
  const signUpConsentId = useId();
  const taskMenuRef = useRef<HTMLDivElement | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signIn");
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpLegalAccepted, setSignUpLegalAccepted] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [authVerifyingAutoLogin, setAuthVerifyingAutoLogin] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationSending, setVerificationSending] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [taskMenuOpen, setTaskMenuOpen] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [signInPasswordVisible, setSignInPasswordVisible] = useState(false);
  const [signUpPasswordVisible, setSignUpPasswordVisible] = useState(false);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackKind, setFeedbackKind] = useState<ProductFeedbackKind>("product");
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [rechargeDialogOpen, setRechargeDialogOpen] = useState(false);
  const [rechargeProducts, setRechargeProducts] = useState<RechargeProduct[]>([]);
  const [selectedRechargeCode, setSelectedRechargeCode] = useState("");
  const [rechargeLoading, setRechargeLoading] = useState(false);
  const [rechargeSubmitting, setRechargeSubmitting] = useState(false);
  const [rechargeSubmitted, setRechargeSubmitted] = useState(false);
  const [rechargeError, setRechargeError] = useState<string | null>(null);
  const [rechargeToast, setRechargeToast] = useState<string | null>(null);

  const homeHref = useMemo(() => `/${locale}`, [locale]);
  const checkerTask1Href = useMemo(() => `/${locale}/checker?task=task1`, [locale]);
  const checkerTask2Href = useMemo(() => `/${locale}/checker?task=task2`, [locale]);
  const historyHref = useMemo(() => `/${locale}/history`, [locale]);
  const practiceHref = useMemo(() => `/${locale}/practice`, [locale]);
  const assignmentsHref = useMemo(() => `/${locale}/assignments`, [locale]);
  const ordersHref = useMemo(() => `/${locale}/orders`, [locale]);
  const taskMenuLabel = activeTask === "task1" ? copy.task1 : activeTask === "task2" ? copy.task2 : copy.writingTasks;
  const actionMenuLabel = copy.actionGroup;
  const actionMenuOpenLabel = copy.openActionMenu;
  const actionMenuCloseLabel = copy.closeActionMenu;
  const moreMenuOpenLabel = copy.openSettingsMenu;
  const moreMenuCloseLabel = copy.closeSettingsMenu;
  const authSwitchPrefix = authMode === "signIn" ? copy.noAccount : copy.alreadyHaveAccount;
  const authSwitchAction = authMode === "signIn" ? copy.createOne : copy.backToSignIn;
  const currentUser = sessionContext.user;
  const effectiveEnergyBalance = energyBalance ?? sessionContext.energy?.balance ?? null;
  const hasUnlimitedReviews = Boolean(
    sessionContext.energy?.unlimitedUntil && new Date(sessionContext.energy.unlimitedUntil).getTime() > Date.now()
  );
  const unlimitedReviewsExpiry = hasUnlimitedReviews && sessionContext.energy?.unlimitedUntil
    ? new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : "en", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date(sessionContext.energy.unlimitedUntil))
    : null;
  const energyLabel = copy.energyLabel;
  const themeLabel = copy.themeLabel;
  const appearanceLabel = copy.appearanceLabel;
  const normalizedSignInEmail = normalizeEmailIdentity(signInEmail);
  const normalizedVerificationEmail = normalizeEmailIdentity(verificationEmail);
  const verificationMatchesCurrentEmail =
    Boolean(normalizedSignInEmail) && normalizedSignInEmail === normalizedVerificationEmail;
  const resendVerificationEmail = verificationMatchesCurrentEmail ? verificationEmail.trim() : "";
  const canResendVerification =
    authMode === "signIn" &&
    verificationMatchesCurrentEmail &&
    Boolean(
      authError === copy.authVerificationRequired ||
        authNotice === copy.authVerificationPending ||
        authNotice === copy.authVerificationSent
    );
  const refreshSession = useCallback(async () => {
    await refreshSessionContext();
    await onSessionUpdated?.();
  }, [onSessionUpdated, refreshSessionContext]);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("theme-mode");
    const nextTheme = storedTheme === "dark" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    const currentUrl = new URL(window.location.href);
    setActiveTask(currentUrl.pathname === "/checker" ? currentUrl.searchParams.get("task") : null);

    if (currentUrl.searchParams.get("auth_verified") === "1") {
      currentUrl.searchParams.delete("auth_verified");
      window.history.replaceState({}, "", currentUrl.toString());
      setAuthVerifyingAutoLogin(true);
      invalidateClientSessionContext();
      void refreshSession()
        .then(() => {
          setAuthVerifyingAutoLogin(false);
          setAuthDialogOpen(false);
          setAuthError(null);
          setAuthNotice(null);
          setVerificationEmail("");
        })
        .catch(() => {
          setAuthVerifyingAutoLogin(false);
          setAuthMode("signIn");
          setAuthNotice(copy.authVerificationSuccess);
          setAuthDialogOpen(true);
        });
    }
  }, [copy.authVerificationSuccess, refreshSession]);

  useEffect(() => {
    if (authDialogOpen || feedbackDialogOpen || rechargeDialogOpen || deleteDialogOpen) {
      setTaskMenuOpen(false);
      setActionMenuOpen(false);
      setAccountMenuOpen(false);
      setMoreMenuOpen(false);
    }
  }, [authDialogOpen, feedbackDialogOpen, rechargeDialogOpen, deleteDialogOpen]);

  useEffect(() => {
    if (!authRequest) {
      return;
    }

    openAuth(authRequest.mode);
  }, [authRequest]);

  useEffect(() => {
    if (!rechargeToast) {
      return;
    }

    const timer = window.setTimeout(() => {
      setRechargeToast(null);
    }, 3200);

    return () => window.clearTimeout(timer);
  }, [rechargeToast]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!taskMenuRef.current?.contains(event.target as Node)) {
        setTaskMenuOpen(false);
      }

      if (!actionMenuRef.current?.contains(event.target as Node)) {
        setActionMenuOpen(false);
      }

      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }

      if (!moreMenuRef.current?.contains(event.target as Node)) {
        setMoreMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("theme-mode", nextTheme);
  }

  function openAuth(mode: AuthMode) {
    setAuthMode(mode);
    setAuthError(null);
    setAuthNotice(null);
    setVerificationEmail("");
    setAuthDialogOpen(true);
  }

  function updateSignInEmail(email: string) {
    setSignInEmail(email);

    if (normalizeEmailIdentity(email) !== normalizeEmailIdentity(verificationEmail)) {
      setVerificationEmail("");

      if (authError === copy.authVerificationRequired) {
        setAuthError(null);
      }

      if (authNotice === copy.authVerificationPending || authNotice === copy.authVerificationSent) {
        setAuthNotice(null);
      }
    }
  }

  function openFeedbackDialog() {
    setFeedbackKind("product");
    setFeedbackComment("");
    setFeedbackError(null);
    setFeedbackSubmitted(false);
    setFeedbackDialogOpen(true);
  }

  function openDeleteDialog() {
    setDeletePassword("");
    setDeleteError(null);
    setDeleteDialogOpen(true);
  }

  function openRechargeDialog() {
    setRechargeError(null);
    setRechargeSubmitted(false);
    setRechargeDialogOpen(true);
    setRechargeLoading(true);
    void fetch("/api/recharge/products", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as { items?: RechargeProduct[]; error?: string };
        if (!response.ok) throw new Error(data.error || copy.genericError);
        const items = data.items ?? [];
        setRechargeProducts(items);
        setSelectedRechargeCode((current) => current || items[0]?.code || "");
      })
      .catch((error) => setRechargeError(error instanceof Error ? error.message : copy.genericError))
      .finally(() => setRechargeLoading(false));
  }

  function getVerificationCallbackUrl() {
    const callbackUrl = new URL(window.location.href);
    callbackUrl.searchParams.set("auth_verified", "1");
    return callbackUrl.toString();
  }

  async function sendVerificationEmail(email: string) {
    const response = await fetch("/api/auth/send-verification-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        callbackURL: getVerificationCallbackUrl()
      })
    });

    const data = (await response.json()) as { error?: { message?: string } | string };

    if (!response.ok) {
      const message =
        typeof data.error === "string"
          ? data.error
          : typeof data.error?.message === "string"
            ? data.error.message
            : copy.genericError;
      throw new Error(message);
    }
  }

  async function handleResendVerificationEmail() {
    if (!resendVerificationEmail || verificationSending) {
      return;
    }

    setVerificationSending(true);
    setAuthError(null);

    try {
      await sendVerificationEmail(resendVerificationEmail);
      setVerificationEmail(resendVerificationEmail);
      setAuthNotice(copy.authVerificationSent);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : copy.genericError);
    } finally {
      setVerificationSending(false);
    }
  }

  async function submitAuth(mode: AuthMode) {
    setAuthSubmitting(true);
    setAuthError(null);
    setAuthNotice(null);

    if (mode === "signIn") {
      setVerificationEmail("");
    }

    try {
      const authClient = await getAuthClient();
      if (mode === "signIn") {
        const result = await authClient.signIn.email({
          email: signInEmail.trim(),
          password: signInPassword,
          rememberMe: true
        });

        if (result.error) {
          throw normalizeAuthError(result.error, copy.genericError);
        }
      } else {
        const normalizedEmail = signUpEmail.trim();
        const result = await authClient.signUp.email({
          name: signUpName.trim(),
          email: normalizedEmail,
          password: signUpPassword,
          callbackURL: getVerificationCallbackUrl()
        });

        if (result.error) {
          throw normalizeAuthError(result.error, copy.genericError);
        }

        setAuthMode("signIn");
        setVerificationEmail(normalizedEmail);
        setSignInEmail(normalizedEmail);
        setSignInPassword("");
        setSignUpPassword("");
        setSignUpLegalAccepted(false);
        setSignInPasswordVisible(false);
        setSignUpPasswordVisible(false);
        setAuthNotice(copy.authVerificationPending);
        return;
      }

      invalidateClientSessionContext();
      await refreshSession();
      setAuthDialogOpen(false);
      setVerificationEmail("");
      setSignInPassword("");
      setSignUpPassword("");
      setSignInPasswordVisible(false);
      setSignUpPasswordVisible(false);
    } catch (error) {
      if (isEmailVerificationError(error)) {
        setVerificationEmail(signInEmail.trim());
        setAuthError(copy.authVerificationRequired);
      } else {
        setAuthError(error instanceof Error ? error.message : copy.genericError);
      }
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleSignInSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthMode("signIn");
    await submitAuth("signIn");
  }

  async function handleSignUpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthMode("signUp");
    if (!signUpLegalAccepted) {
      setAuthNotice(null);
      setAuthError(copy.authAgreementRequired);
      return;
    }
    await submitAuth("signUp");
  }

  async function handleSignOut() {
    setAuthError(null);
    setAuthNotice(null);
    setAuthSubmitting(true);

    try {
      const authClient = await getAuthClient();
      const signOutResult = await authClient.signOut();
      if (signOutResult.error) {
        throw new Error(signOutResult.error.message || copy.genericError);
      }

      invalidateClientSessionContext();
      setSessionContext({
        user: null,
        energy: null,
        reviewCost: null
      });
      await refreshSession();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : copy.genericError);
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleDeleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!deletePassword || deleteSubmitting) {
      return;
    }

    setDeleteSubmitting(true);
    setDeleteError(null);

    try {
      const response = await fetch("/api/auth/delete-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          password: deletePassword
        })
      });

      const data = (await response.json()) as {
        success?: boolean;
        message?: string;
        error?: { message?: string } | string;
      };

      if (!response.ok) {
        const message =
          typeof data.error === "string"
            ? data.error
            : typeof data.error?.message === "string"
              ? data.error.message
              : copy.genericError;
        throw new Error(message);
      }

      invalidateClientSessionContext();
      setSessionContext({
        user: null,
        energy: null,
        reviewCost: null
      });
      await refreshSession();
      setDeleteDialogOpen(false);
      setDeletePassword("");
      if (typeof window !== "undefined") {
        window.alert(copy.authDeleteSuccess);
        window.location.assign(homeHref);
      }
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : copy.genericError);
    } finally {
      setDeleteSubmitting(false);
    }
  }

  async function handleFeedbackSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!feedbackComment.trim() || feedbackSubmitting || feedbackSubmitted) {
      return;
    }

    setFeedbackSubmitting(true);
    setFeedbackError(null);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          kind: feedbackKind,
          helpful: null,
          comment: feedbackComment.trim(),
          context: {
            uid: currentUser?.id ?? null
          },
          page: typeof window !== "undefined" ? window.location.pathname : "/"
        })
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || copy.genericError);
      }

      setFeedbackSubmitted(true);
      setFeedbackComment("");
    } catch (error) {
      setFeedbackError(error instanceof Error ? error.message : copy.genericError);
    } finally {
      setFeedbackSubmitting(false);
    }
  }

  async function handleRechargeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedRechargeCode || rechargeSubmitting || rechargeSubmitted) {
      return;
    }

    setRechargeSubmitting(true);
    setRechargeError(null);

    try {
      const response = await fetch("/api/recharge/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          productCode: selectedRechargeCode,
          provider: "wechat"
        })
      });

      const data = (await response.json()) as { error?: string; order?: RechargeOrder };

      if (!response.ok) {
        throw new Error(data.error || copy.genericError);
      }

      if (!data.order || data.order.status !== "paid") {
        throw new Error(data.error || copy.genericError);
      }

      setRechargeSubmitted(true);
      setRechargeToast(
        data.order.unlimitedDays
          ? copy.rechargePassSuccess.replace("{days}", String(data.order.unlimitedDays))
          : copy.rechargeSuccess.replace("{amount}", String(data.order.totalEnergyAmount))
      );
      await refreshSession();
    } catch (error) {
      setRechargeError(error instanceof Error ? error.message : copy.genericError);
    } finally {
      setRechargeSubmitting(false);
    }
  }

  return (
    <>
      <Surface as="header" className="aroundNavbar">
        <Link className="aroundNavBrand" href={homeHref}>
          <span className="aroundBrandIcon" aria-hidden="true">
            <span className="aroundBrandIconImage" />
          </span>
          <span className="aroundBrandFull">{copy.brand}</span>
          <span className="aroundBrandCompact">IELTS</span>
        </Link>

        <div className="aroundTaskMenu" ref={taskMenuRef}>
          {taskMenuMode === "task2Only" ? (
            <Link href={checkerTask2Href} className="aroundTaskMenuButton aroundTaskMenuStatic">
              <span>{copy.task2}</span>
            </Link>
          ) : (
            <>
              <button
                type="button"
                className={`aroundTaskMenuButton${taskMenuOpen ? " is-open" : ""}`}
                aria-haspopup="menu"
                aria-expanded={taskMenuOpen}
                onClick={() => {
                  setActionMenuOpen(false);
                  setAccountMenuOpen(false);
                  setMoreMenuOpen(false);
                  setTaskMenuOpen((value) => !value);
                }}
              >
                <span>{taskMenuLabel}</span>
                <i className={`ai-chevron-${taskMenuOpen ? "up" : "down"}`} aria-hidden="true" />
              </button>

              <div className={`aroundTaskDropdown${taskMenuOpen ? " is-open" : ""}`} role="menu">
                <Link
                  href={checkerTask1Href}
                  className={activeTask === "task1" ? "active" : undefined}
                  role="menuitem"
                  onClick={(event) => {
                    setTaskMenuOpen(false);
                    if (onTaskNavigate) {
                      event.preventDefault();
                      onTaskNavigate("task1", checkerTask1Href);
                    }
                  }}
                >
                  {copy.task1}
                </Link>
                <Link
                  href={checkerTask2Href}
                  className={activeTask === "task2" ? "active" : undefined}
                  role="menuitem"
                  onClick={(event) => {
                    setTaskMenuOpen(false);
                    if (onTaskNavigate) {
                      event.preventDefault();
                      onTaskNavigate("task2", checkerTask2Href);
                    }
                  }}
                >
                  {copy.task2}
                </Link>
              </div>
            </>
          )}
        </div>

        <div className="aroundTaskMenu aroundActionMenu" ref={actionMenuRef}>
          <button
            type="button"
            className={`aroundTaskMenuButton${actionMenuOpen ? " is-open" : ""}`}
            aria-haspopup="menu"
            aria-expanded={actionMenuOpen}
            aria-label={actionMenuOpen ? actionMenuCloseLabel : actionMenuOpenLabel}
            onClick={() => {
              setTaskMenuOpen(false);
              setAccountMenuOpen(false);
              setMoreMenuOpen(false);
              setActionMenuOpen((value) => !value);
            }}
          >
            <span>{actionMenuLabel}</span>
            <i className={`ai-chevron-${actionMenuOpen ? "up" : "down"}`} aria-hidden="true" />
          </button>

          <div className={`aroundTaskDropdown${actionMenuOpen ? " is-open" : ""}`} role="menu">
            <Link href={practiceHref} role="menuitem" onClick={() => setActionMenuOpen(false)}>
              {copy.practiceEntry}
            </Link>
            <Link href={historyHref} role="menuitem" onClick={() => setActionMenuOpen(false)}>
              {copy.historyEntry}
            </Link>
            <Link href={assignmentsHref} role="menuitem" onClick={() => setActionMenuOpen(false)}>
              {copy.assignmentsEntry}
            </Link>
          </div>
        </div>

        <div className="aroundNavControls">
          <div className="aroundAuthArea">
            {currentUser ? (
              <div className="aroundAccountMenu" ref={accountMenuRef}>
                <button
                  type="button"
                  className={`aroundAccountCluster aroundAccountTrigger${accountMenuOpen ? " is-open" : ""}`}
                  aria-haspopup="menu"
                  aria-expanded={accountMenuOpen}
                  aria-controls="app-navbar-account-menu"
                  aria-label={copy.accountLabel}
                  onClick={() => {
                    setTaskMenuOpen(false);
                    setActionMenuOpen(false);
                    setMoreMenuOpen(false);
                    setAccountMenuOpen((value) => !value);
                  }}
                >
                  <span className="aroundUserBadge" title={formatUser(currentUser)}>
                    {formatUser(currentUser)}
                  </span>
                  {energyLabel ? (
                    <>
                      <span className="aroundAccountDivider" aria-hidden="true" />
                      <span className="aroundEnergyBadge">
                        <span className="aroundEnergyIcon" aria-hidden="true" />
                        <span className="srOnly">{energyLabel}</span>
                        <span>{hasUnlimitedReviews ? "∞" : effectiveEnergyBalance ?? "--"}</span>
                      </span>
                    </>
                  ) : null}
                  <i className={`aroundAccountChevron ai-chevron-${accountMenuOpen ? "up" : "down"}`} aria-hidden="true" />
                </button>

                <div
                  id="app-navbar-account-menu"
                  className={`aroundUtilityDropdown aroundAccountDropdown${accountMenuOpen ? " is-open" : ""}`}
                  role="menu"
                >
                  <div className="aroundAccountDropdownHeader">
                    <span className="aroundAccountAvatar" aria-hidden="true">
                      <i className="ai-user" />
                    </span>
                    <span className="aroundAccountIdentity">
                      <strong>{formatUser(currentUser)}</strong>
                      {currentUser.name?.trim() && currentUser.email?.trim() ? <small>{currentUser.email}</small> : null}
                    </span>
                  </div>
                  <div className="aroundAccountPrimaryActions" role="none">
                    {energyLabel ? (
                      <button
                        type="button"
                        className="aroundAccountEnergyRow"
                        role="menuitem"
                        onClick={() => {
                          setAccountMenuOpen(false);
                          openRechargeDialog();
                        }}
                      >
                        <span className="aroundAccountMenuIcon aroundAccountEnergyIcon" aria-hidden="true">
                          <span className="aroundEnergyIcon" />
                        </span>
                        <span className="aroundAccountMenuCopy">
                          <strong>{energyLabel}</strong>
                          <small>{copy.rechargeEntry}</small>
                        </span>
                        <span className="aroundAccountEnergyValue">
                          {hasUnlimitedReviews ? "∞" : effectiveEnergyBalance ?? "--"}
                        </span>
                        <i className="ai-chevron-right aroundAccountRowChevron" aria-hidden="true" />
                      </button>
                    ) : null}
                    <Link
                      href={ordersHref}
                      className="aroundAccountOrderRow"
                      role="menuitem"
                      onClick={() => setAccountMenuOpen(false)}
                    >
                      <span className="aroundAccountMenuIcon" aria-hidden="true">
                        <i className="ai-file" />
                      </span>
                      <span className="aroundAccountMenuCopy">
                        <strong>{copy.ordersEntry}</strong>
                        <small>{copy.ordersMenuHint}</small>
                      </span>
                      <i className="ai-chevron-right aroundAccountRowChevron" aria-hidden="true" />
                    </Link>
                  </div>
                  <div className="aroundAccountSecondaryActions" role="none">
                    <button
                      type="button"
                      className="aroundAccountSecondaryButton"
                      role="menuitem"
                      onClick={async () => {
                        setAccountMenuOpen(false);
                        await handleSignOut();
                      }}
                    >
                      <i className="ai-logout" aria-hidden="true" />
                      <span>{copy.authSignOut}</span>
                    </button>
                    <button
                      type="button"
                      className="aroundAccountSecondaryButton aroundMenuActionDanger"
                      role="menuitem"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        openDeleteDialog();
                      }}
                    >
                      <i className="ai-trash" aria-hidden="true" />
                      <span>{copy.authDeleteAccount}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {!sessionResolved ? (
              <ActionButton className="aroundPrimaryAction" disabled aria-busy="true">
                ...
              </ActionButton>
            ) : !currentUser ? (
              <ActionButton
                className="aroundPrimaryAction"
                onClick={() => {
                  setMoreMenuOpen(false);
                  openAuth("signIn");
                }}
              >
                {copy.login}
              </ActionButton>
            ) : null}
          </div>

          <div className="aroundUtilityMenu" ref={moreMenuRef}>
          <button
            type="button"
            className={`aroundNavMenuButton${moreMenuOpen ? " is-open" : ""}`}
            aria-expanded={moreMenuOpen}
            aria-controls="app-navbar-menu"
            aria-label={moreMenuOpen ? moreMenuCloseLabel : moreMenuOpenLabel}
            onClick={() => {
              setTaskMenuOpen(false);
              setActionMenuOpen(false);
              setAccountMenuOpen(false);
              setMoreMenuOpen((value) => !value);
            }}
          >
            <i className="ai-settings-filled" aria-hidden="true" />
            <span className="aroundSettingsLabel">{locale === "zh-CN" ? "设置" : "Settings"}</span>
          </button>

          <div id="app-navbar-menu" className={`aroundUtilityDropdown aroundMoreDropdown${moreMenuOpen ? " is-open" : ""}`} role="menu">
            <div className="aroundSettingsHeader">
              <span className="aroundSettingsHeaderIcon" aria-hidden="true"><i className="ai-settings-filled" /></span>
              <div>
                <strong>{copy.settingsTitle}</strong>
                <p>{copy.settingsSubtitle}</p>
              </div>
            </div>
            <div className="aroundMenuSection aroundMobileMenuSection aroundSettingsNavigation">
              <div className="aroundMenuSectionLabel">{copy.navigationLabel}</div>
              <Link href={practiceHref} className="aroundMenuActionLink" role="menuitem" onClick={() => setMoreMenuOpen(false)}>
                <i className="ai-open-book" aria-hidden="true" />
                <span>{copy.practiceEntry}</span>
              </Link>
              <Link href={historyHref} className="aroundMenuActionLink" role="menuitem" onClick={() => setMoreMenuOpen(false)}>
                <i className="ai-time" aria-hidden="true" />
                <span>{copy.historyEntry}</span>
              </Link>
              <Link href={assignmentsHref} className="aroundMenuActionLink" role="menuitem" onClick={() => setMoreMenuOpen(false)}>
                <i className="ai-clipboard" aria-hidden="true" />
                <span>{copy.assignmentsEntry}</span>
              </Link>
            </div>
            <div className="aroundMenuSection aroundLanguageSection">
              <div className="aroundMenuSectionLabel">{copy.languageLabel}</div>
              <div className="aroundSegmentedControl">
                <button
                  type="button"
                  className={`aroundSegmentButton${locale === "zh-CN" ? " is-active" : ""}`}
                  onClick={() => {
                    onLocaleChange("zh-CN");
                    setMoreMenuOpen(false);
                  }}
                >
                  简体中文
                </button>
                <button
                  type="button"
                  className={`aroundSegmentButton${locale === "en" ? " is-active" : ""}`}
                  onClick={() => {
                    onLocaleChange("en");
                    setMoreMenuOpen(false);
                  }}
                >
                  English
                </button>
              </div>
            </div>
            <div className="aroundMenuSection aroundSupportSection">
              <div className="aroundMenuSectionLabel">{copy.supportLabel}</div>
              <button
                type="button"
                className="aroundMenuActionButton"
                onClick={() => {
                  setMoreMenuOpen(false);
                  openFeedbackDialog();
                }}
              >
                <i className="ai-message" aria-hidden="true" />
                <span>{copy.feedbackEntry}</span>
              </button>
            </div>

            <div className="aroundMenuSection aroundAppearanceSection">
              <div className="aroundMenuRow">
                <div>
                  <div className="aroundMenuSectionLabel">{appearanceLabel}</div>
                  <div className="aroundMenuValue">{themeLabel}</div>
                </div>
                <div className="form-switch mode-switch aroundModeSwitch" data-theme-toggle="mode">
                  <input
                    id={themeSwitchId}
                    className="form-check-input"
                    type="checkbox"
                    checked={theme === "dark"}
                    onChange={toggleTheme}
                    aria-label={theme === "light" ? copy.switchToDarkMode : copy.switchToLightMode}
                  />
                  <label className="form-check-label" htmlFor={themeSwitchId}>
                    <i className="ai-sun fs-lg" />
                  </label>
                  <label className="form-check-label" htmlFor={themeSwitchId}>
                    <i className="ai-moon fs-lg" />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </Surface>

      {authVerifyingAutoLogin ? (
        <div className="authDialogBackdrop">
          <Surface className={`authDialog confirmDialog authStatusDialog ${locale === "zh-CN" ? "authDialogCn" : "authDialogEn"}`}>
            <div className="confirmDialogHeader">
              <div className="confirmDialogIntro">
                <h2>{copy.authVerificationSuccess}</h2>
                <p className="authHint">{copy.authVerificationAutoSigningIn}</p>
              </div>
            </div>
          </Surface>
        </div>
      ) : null}

      {authDialogOpen ? (
        <div className="authDialogBackdrop authAccountDialogBackdrop" onClick={() => !authSubmitting && setAuthDialogOpen(false)}>
          <Surface
            className={`authDialog authAccountDialog ${locale === "zh-CN" ? "authDialogCn" : "authDialogEn"}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="authDialogHeader">
              <div className="authCardIntro">
                <h2>{authMode === "signIn" ? copy.signInTab : copy.signUpTab}</h2>
                <p className="authHint">{authMode === "signIn" ? authHint ?? copy.authHintSignIn : copy.authHintSignUp}</p>
              </div>
              <button type="button" className="authDialogClose" onClick={() => setAuthDialogOpen(false)} disabled={authSubmitting}>
                <i className="ai-cross" aria-hidden="true" />
                <span className="srOnly">{copy.authClose}</span>
              </button>
            </div>

            <section className="authCardInner">
              {authMode === "signIn" ? (
                <form className="authForm" onSubmit={handleSignInSubmit}>
                  <label className="authField">
                    <span>{copy.authEmail}</span>
                    <div className="authInputWrap">
                      <i className="ai-mail" aria-hidden="true" />
                      <input
                        type="email"
                        value={signInEmail}
                        onChange={(event) => updateSignInEmail(event.target.value)}
                        required
                        autoComplete="email"
                      />
                    </div>
                  </label>

                  <label className="authField">
                    <span>{copy.authPassword}</span>
                    <div className="authInputWrap authPasswordWrap">
                      <i className="ai-lock-closed" aria-hidden="true" />
                      <input
                        type={signInPasswordVisible ? "text" : "password"}
                        value={signInPassword}
                        onChange={(event) => setSignInPassword(event.target.value)}
                        required
                        minLength={8}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        className="authPasswordToggle"
                        onClick={() => setSignInPasswordVisible((value) => !value)}
                        aria-label={signInPasswordVisible ? copy.hidePassword : copy.showPassword}
                      >
                        <i className={signInPasswordVisible ? "ai-hide" : "ai-show"} aria-hidden="true" />
                      </button>
                    </div>
                  </label>

                  {authNotice ? <p className="authInfoBox">{authNotice}</p> : null}
                  {authError ? <p className="errorBox">{authError}</p> : null}
                  {canResendVerification ? (
                    <button
                      type="button"
                      className="authInlineAction"
                      onClick={handleResendVerificationEmail}
                      disabled={verificationSending || authSubmitting}
                    >
                      {verificationSending ? copy.authResendVerificationSending : copy.authResendVerification}
                    </button>
                  ) : null}

                  <ActionButton type="submit" variant="primary" fullWidth disabled={authSubmitting}>
                    {authSubmitting ? copy.submitting : copy.authSubmitSignIn}
                  </ActionButton>
                </form>
              ) : (
                <form className="authForm" onSubmit={handleSignUpSubmit}>
                  <label className="authField">
                    <span>{copy.authName}</span>
                    <div className="authInputWrap">
                      <i className="ai-user" aria-hidden="true" />
                      <input
                        type="text"
                        value={signUpName}
                        onChange={(event) => setSignUpName(event.target.value)}
                        required
                        minLength={2}
                        autoComplete="name"
                      />
                    </div>
                  </label>

                  <label className="authField">
                    <span>{copy.authEmail}</span>
                    <div className="authInputWrap">
                      <i className="ai-mail" aria-hidden="true" />
                      <input
                        type="email"
                        value={signUpEmail}
                        onChange={(event) => setSignUpEmail(event.target.value)}
                        required
                        autoComplete="email"
                      />
                    </div>
                  </label>

                  <label className="authField">
                    <span>{copy.authPassword}</span>
                    <div className="authInputWrap authPasswordWrap">
                      <i className="ai-lock-closed" aria-hidden="true" />
                      <input
                        type={signUpPasswordVisible ? "text" : "password"}
                        value={signUpPassword}
                        onChange={(event) => setSignUpPassword(event.target.value)}
                        required
                        minLength={8}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="authPasswordToggle"
                        onClick={() => setSignUpPasswordVisible((value) => !value)}
                        aria-label={signUpPasswordVisible ? copy.hidePassword : copy.showPassword}
                      >
                        <i className={signUpPasswordVisible ? "ai-hide" : "ai-show"} aria-hidden="true" />
                      </button>
                    </div>
                  </label>

                  <div className="authLegalConsent">
                    <input
                      id={signUpConsentId}
                      type="checkbox"
                      checked={signUpLegalAccepted}
                      onChange={(event) => {
                        setSignUpLegalAccepted(event.target.checked);
                        if (event.target.checked && authError === copy.authAgreementRequired) {
                          setAuthError(null);
                        }
                      }}
                    />
                    <p>
                      <label htmlFor={signUpConsentId}>{copy.authAgreementPrefix}</label>{" "}
                      <Link href={`/${locale}/terms`} target="_blank" rel="noreferrer">
                        {copy.authTermsLink}
                      </Link>
                      {copy.authAgreementJoiner}
                      <Link href={`/${locale}/privacy`} target="_blank" rel="noreferrer">
                        {copy.authPrivacyLink}
                      </Link>
                    </p>
                  </div>

                  {authNotice ? <p className="authInfoBox">{authNotice}</p> : null}
                  {authError ? <p className="errorBox">{authError}</p> : null}

                  <ActionButton type="submit" variant="primary" fullWidth disabled={authSubmitting}>
                    {authSubmitting ? copy.submitting : copy.authSubmitSignUp}
                  </ActionButton>
                </form>
              )}

              <p className="authSwitchLine">
                {authSwitchPrefix}
                <button
                  type="button"
                  className="authSwitchButton"
                  onClick={() => {
                    setAuthError(null);
                    setAuthNotice(null);
                    setVerificationEmail("");
                    setAuthMode(authMode === "signIn" ? "signUp" : "signIn");
                  }}
                  disabled={authSubmitting}
                >
                  {authSwitchAction}
                </button>
              </p>
            </section>
          </Surface>
        </div>
      ) : null}

      {deleteDialogOpen ? (
        <div className="authDialogBackdrop" onClick={() => !deleteSubmitting && setDeleteDialogOpen(false)}>
          <Surface
            className={`authDialog confirmDialog ${locale === "zh-CN" ? "authDialogCn" : "authDialogEn"}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="confirmDialogHeader">
              <div className="confirmDialogIntro">
                <h2>{copy.authDeleteDialogTitle}</h2>
                <p className="authHint">{copy.authDeleteDialogHint}</p>
              </div>
              <button
                type="button"
                className="authDialogClose"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={deleteSubmitting}
              >
                <i className="ai-cross" aria-hidden="true" />
                <span className="srOnly">{copy.authClose}</span>
              </button>
            </div>

            <form className="confirmDialogBody" onSubmit={handleDeleteAccount}>
              <p className="confirmDangerText">{copy.authDeleteDialogWarning}</p>

              <label className="authField confirmDeleteField">
                <span>{copy.authDeleteConfirmLabel}</span>
                <div className="authInputWrap authPasswordWrap">
                  <i className="ai-lock-closed" aria-hidden="true" />
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(event) => setDeletePassword(event.target.value)}
                    required
                    minLength={8}
                    autoComplete="current-password"
                  />
                </div>
              </label>

              {deleteError ? <p className="errorBox">{deleteError}</p> : null}

              <div className="confirmDialogActions">
                <ActionButton type="button" variant="secondary" onClick={() => setDeleteDialogOpen(false)} disabled={deleteSubmitting}>
                  {copy.authDeleteCancel}
                </ActionButton>
                <ActionButton type="submit" variant="primary" disabled={deleteSubmitting}>
                  {deleteSubmitting ? copy.authDeleting : copy.authDeleteSubmit}
                </ActionButton>
              </div>
            </form>
          </Surface>
        </div>
      ) : null}

      {feedbackDialogOpen ? (
        <div className="authDialogBackdrop" onClick={() => !feedbackSubmitting && setFeedbackDialogOpen(false)}>
          <Surface
            className={`authDialog ${locale === "zh-CN" ? "authDialogCn" : "authDialogEn"}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="authDialogHeader">
              <div className="authCardIntro">
                <h2>{copy.feedbackTitle}</h2>
                <p className="authHint">{copy.feedbackHint}</p>
              </div>
              <button
                type="button"
                className="authDialogClose"
                onClick={() => setFeedbackDialogOpen(false)}
                disabled={feedbackSubmitting}
              >
                <i className="ai-cross" aria-hidden="true" />
                <span className="srOnly">{copy.authClose}</span>
              </button>
            </div>

            <section className="authCardInner">
              <form className="authForm" onSubmit={handleFeedbackSubmit}>
                <label className="authField">
                  <span>{copy.feedbackTypeLabel}</span>
                  <select
                    className="feedbackTypeSelect"
                    value={feedbackKind}
                    onChange={(event) => setFeedbackKind(event.target.value as ProductFeedbackKind)}
                    disabled={feedbackSubmitting || feedbackSubmitted}
                  >
                    <option value="product">{copy.feedbackTypeProduct}</option>
                    <option value="bug">{copy.feedbackTypeBug}</option>
                    <option value="feature_request">{copy.feedbackTypeFeatureRequest}</option>
                  </select>
                </label>

                <label className="authField">
                  <span>{copy.feedbackCommentLabel}</span>
                  <textarea
                    className="feedbackDialogTextarea"
                    value={feedbackComment}
                    onChange={(event) => setFeedbackComment(event.target.value)}
                    rows={6}
                    maxLength={2000}
                    placeholder={copy.feedbackCommentPlaceholder}
                    disabled={feedbackSubmitting || feedbackSubmitted}
                    required
                  />
                </label>

                {feedbackError ? <p className="errorBox">{feedbackError}</p> : null}
                {feedbackSubmitted ? <Pill>{copy.feedbackSubmitted}</Pill> : null}

                <ActionButton
                  type="submit"
                  variant="primary"
                  fullWidth
                  disabled={!feedbackComment.trim() || feedbackSubmitting || feedbackSubmitted}
                >
                  {feedbackSubmitting ? copy.submitting : feedbackSubmitted ? copy.feedbackSubmitted : copy.feedbackSubmit}
                </ActionButton>
              </form>
            </section>
          </Surface>
        </div>
      ) : null}

      {rechargeDialogOpen ? (
        <div className="authDialogBackdrop" onClick={() => !rechargeSubmitting && setRechargeDialogOpen(false)}>
          <Surface
            className={`authDialog ${locale === "zh-CN" ? "authDialogCn" : "authDialogEn"}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="authDialogHeader">
              <div className="authCardIntro">
                <h2>{copy.rechargeTitle}</h2>
                <p className="authHint">{copy.rechargeHint}</p>
              </div>
              <button
                type="button"
                className="authDialogClose"
                onClick={() => setRechargeDialogOpen(false)}
                disabled={rechargeSubmitting}
              >
                <i className="ai-cross" aria-hidden="true" />
                <span className="srOnly">{copy.authClose}</span>
              </button>
            </div>

            <section className="authCardInner">
              <form className="authForm" onSubmit={handleRechargeSubmit}>
                <div className="rechargeEntitlementSummary" aria-label={copy.rechargeCurrentBenefits}>
                  <div className="rechargeEntitlementItem">
                    <span>{copy.rechargeCurrentBalance}</span>
                    <strong>
                      <span className="aroundEnergyIcon" aria-hidden="true" />
                      {effectiveEnergyBalance ?? "--"}
                    </strong>
                  </div>
                  <div className="rechargeEntitlementDivider" aria-hidden="true" />
                  <div className="rechargeEntitlementItem">
                    <span>{copy.rechargeUnlimitedStatus}</span>
                    <strong className={hasUnlimitedReviews ? "is-active" : undefined}>
                      {unlimitedReviewsExpiry
                        ? copy.rechargeUnlimitedUntil.replace("{date}", unlimitedReviewsExpiry)
                        : copy.rechargeNoActivePass}
                    </strong>
                  </div>
                </div>

                <p className="authHint">{copy.rechargeMessage}</p>

                {rechargeLoading ? <p className="authHint">{copy.rechargeLoading}</p> : null}
                <div className="rechargeProductList" role="radiogroup" aria-label={copy.rechargePlanLabel}>
                  {rechargeProducts.map((product) => {
                    const total = product.energyAmount + product.bonusEnergyAmount;
                    const selected = selectedRechargeCode === product.code;
                    const planName = product.unlimitedDays
                      ? product.unlimitedDays >= 365
                        ? copy.rechargeAnnual
                        : product.unlimitedDays >= 90
                          ? copy.rechargeQuarterly
                          : copy.rechargeMonthly
                      : `${total} ${copy.rechargeReviews}`;
                    return (
                      <button
                        key={product.id}
                        type="button"
                        className={`rechargeProductCard${selected ? " is-selected" : ""}`}
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setSelectedRechargeCode(product.code)}
                        disabled={rechargeSubmitting || rechargeSubmitted}
                      >
                        <span className="rechargeProductName">{planName}</span>
                        <span className="rechargeProductPrice">
                          {product.listPriceCents > product.priceCents ? (
                            <del>
                              {new Intl.NumberFormat(locale === "zh-CN" ? "zh-CN" : "en", {
                                style: "currency",
                                currency: product.currency,
                                maximumFractionDigits: 1
                              }).format(product.listPriceCents / 100)}
                            </del>
                          ) : null}
                          <strong>
                          {new Intl.NumberFormat(locale === "zh-CN" ? "zh-CN" : "en", {
                            style: "currency",
                            currency: product.currency,
                            maximumFractionDigits: 1
                          }).format(product.priceCents / 100)}
                          </strong>
                        </span>
                        <span className="rechargeProductMeta">
                          {product.unlimitedDays
                            ? `${copy.rechargeUnlimited} · ${product.unlimitedDays} ${copy.rechargeDays}`
                            : `${total} ${copy.rechargeReviews} · ${copy.rechargeNeverExpires}`}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <p className="rechargeSimulationNote">{copy.rechargeSimulationNote}</p>

                {rechargeError ? <p className="errorBox">{rechargeError}</p> : null}
                {rechargeSubmitted ? <Pill>{copy.rechargeSubmitted}</Pill> : null}

                <ActionButton
                  type="submit"
                  variant="primary"
                  fullWidth
                  disabled={!selectedRechargeCode || rechargeLoading || rechargeSubmitting || rechargeSubmitted}
                >
                  {rechargeSubmitting ? copy.submitting : rechargeSubmitted ? copy.rechargeSubmitted : copy.rechargeSubmit}
                </ActionButton>
              </form>
            </section>
          </Surface>
        </div>
      ) : null}

      {rechargeToast ? (
        <div className="rewardToast uiToast" data-tone="success" role="status" aria-live="polite">
          <span>{rechargeToast}</span>
          <button type="button" className="rewardToastClose" onClick={() => setRechargeToast(null)} aria-label={copy.authClose}>
            <i className="ai-cross" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </>
  );
}
