"use client";

import Link from "next/link";
import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  getClientSessionContext,
  invalidateClientSessionContext,
  type ClientSessionContext
} from "@/lib/auth-client-session";
import type { NavbarMessages } from "@/lib/i18n/messages";
import { ActionButton, Pill, Surface } from "@/components/ui-kit";
import type { FeedbackKind, Locale } from "@/lib/types";

type AppNavbarProps = {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  copy: NavbarMessages;
  onSessionUpdated?: () => Promise<void> | void;
  taskMenuMode?: "all" | "task2Only";
  energyBalance?: number | null;
  energyLabel?: string;
  authRequest?: {
    mode: AuthMode;
    id: number;
  } | null;
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

function formatUser(user: ClientSessionContext["user"], copy: NavbarMessages) {
  if (!user) {
    return `${copy.userLabel}: --`;
  }

  const identity = user.name?.trim() || user.email?.trim() || copy.userLabel;
  return `${copy.userLabel}: ${identity}`;
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

export function AppNavbar({
  locale,
  onLocaleChange,
  copy,
  onSessionUpdated,
  taskMenuMode = "all",
  energyBalance = null,
  energyLabel,
  authRequest = null
}: AppNavbarProps) {
  const themeSwitchId = useId();
  const taskMenuRef = useRef<HTMLDivElement | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const [currentUser, setCurrentUser] = useState<ClientSessionContext["user"]>(null);
  const [currentEnergyBalance, setCurrentEnergyBalance] = useState<number | null>(energyBalance);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signIn");
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
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
  const [rechargeContact, setRechargeContact] = useState("");
  const [rechargeSubmitting, setRechargeSubmitting] = useState(false);
  const [rechargeSubmitted, setRechargeSubmitted] = useState(false);
  const [rechargeError, setRechargeError] = useState<string | null>(null);
  const [rechargeToast, setRechargeToast] = useState<string | null>(null);

  const homeHref = useMemo(() => `/${locale}`, [locale]);
  const checkerTask1Href = useMemo(() => `/${locale}/checker?task=task1`, [locale]);
  const checkerTask2Href = useMemo(() => `/${locale}/checker?task=task2`, [locale]);
  const taskMenuLabel = activeTask === "task1" ? copy.task1 : activeTask === "task2" ? copy.task2 : copy.writingTasks;
  const moreMenuOpenLabel = copy.openSettingsMenu;
  const moreMenuCloseLabel = copy.closeSettingsMenu;
  const authSwitchPrefix = authMode === "signIn" ? copy.noAccount : copy.alreadyHaveAccount;
  const authSwitchAction = authMode === "signIn" ? copy.createOne : copy.backToSignIn;
  const effectiveEnergyBalance = energyBalance ?? currentEnergyBalance;
  const themeLabel = copy.themeLabel;
  const appearanceLabel = copy.appearanceLabel;
  const resendVerificationEmail = (signInEmail.trim() || verificationEmail).trim();
  const canResendVerification =
    authMode === "signIn" &&
    Boolean(
      verificationEmail ||
        (authError === copy.authVerificationRequired && signInEmail.trim()) ||
        authNotice === copy.authVerificationPending ||
        authNotice === copy.authVerificationSent
    );

  useEffect(() => {
    setCurrentEnergyBalance(energyBalance);
  }, [energyBalance]);

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
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const sessionContext = await getClientSessionContext();

        if (mounted) {
          setCurrentUser(sessionContext.user);
          setCurrentEnergyBalance(sessionContext.energy?.balance ?? null);
        }
      } catch {
        if (mounted) {
          setCurrentUser(null);
          setCurrentEnergyBalance(null);
        }
      }
    }

    loadSession();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (authDialogOpen || feedbackDialogOpen || rechargeDialogOpen || deleteDialogOpen) {
      setTaskMenuOpen(false);
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

  async function refreshSession() {
    const sessionContext = await getClientSessionContext({ forceRefresh: true });
    setCurrentUser(sessionContext.user);
    setCurrentEnergyBalance(sessionContext.energy?.balance ?? null);
    await onSessionUpdated?.();
  }

  function openAuth(mode: AuthMode) {
    setAuthMode(mode);
    setAuthError(null);
    setAuthNotice(null);
    setAuthDialogOpen(true);
  }

  function openFeedbackDialog() {
    setFeedbackKind("product");
    setFeedbackComment("");
    setFeedbackError(null);
    setFeedbackSubmitted(false);
    setFeedbackDialogOpen(true);
  }

  function openRechargeDialog() {
    setRechargeContact("");
    setRechargeError(null);
    setRechargeSubmitted(false);
    setRechargeDialogOpen(true);
  }

  function openDeleteDialog() {
    setDeletePassword("");
    setDeleteError(null);
    setDeleteDialogOpen(true);
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

    try {
      const authClient = await getAuthClient();
      if (mode === "signIn") {
        const result = await authClient.signIn.email({
          email: signInEmail.trim(),
          password: signInPassword,
          callbackURL: getVerificationCallbackUrl()
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

    if (!rechargeContact.trim() || rechargeSubmitting || rechargeSubmitted) {
      return;
    }

    setRechargeSubmitting(true);
    setRechargeError(null);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          kind: "feature_request",
          category: "recharge_waitlist",
          helpful: null,
          comment: rechargeContact.trim(),
          context: {
            source: "recharge_waitlist"
          },
          page: typeof window !== "undefined" ? window.location.pathname : "/"
        })
      });

      const data = (await response.json()) as { error?: string; rewardGranted?: boolean };

      if (!response.ok) {
        throw new Error(data.error || copy.genericError);
      }

      setRechargeSubmitted(true);
      setRechargeContact("");
      setRechargeToast(data.rewardGranted ? copy.rechargeRewardToastGranted : copy.rechargeRewardToastAlreadyClaimed);
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
            <svg width="35" height="32" viewBox="0 0 36 33" xmlns="http://www.w3.org/2000/svg">
              <path
                fill="currentColor"
                d="M35.6,29c-1.1,3.4-5.4,4.4-7.9,1.9c-2.3-2.2-6.1-3.7-9.4-3.7c-3.1,0-7.5,1.8-10,4.1c-2.2,2-5.8,1.5-7.3-1.1c-1-1.8-1.2-4.1,0-6.2l0.6-1.1l0,0c0.6-0.7,4.4-5.2,12.5-5.7c0.5,1.8,2,3.1,3.9,3.1c2.2,0,4.1-1.9,4.1-4.2s-1.8-4.2-4.1-4.2c-2,0-3.6,1.4-4,3.3H7.7c-0.8,0-1.3-0.9-0.9-1.6l5.6-9.8c2.5-4.5,8.8-4.5,11.3,0L35.1,24C36,25.7,36.1,27.5,35.6,29z"
              />
            </svg>
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
                onClick={() => setTaskMenuOpen((value) => !value)}
              >
                <span>{taskMenuLabel}</span>
                <i className={`ai-chevron-${taskMenuOpen ? "up" : "down"}`} aria-hidden="true" />
              </button>

              <div className={`aroundTaskDropdown${taskMenuOpen ? " is-open" : ""}`} role="menu">
                <Link
                  href={checkerTask1Href}
                  className={activeTask === "task1" ? "active" : undefined}
                  role="menuitem"
                  onClick={() => setTaskMenuOpen(false)}
                >
                  {copy.task1}
                </Link>
                <Link
                  href={checkerTask2Href}
                  className={activeTask === "task2" ? "active" : undefined}
                  role="menuitem"
                  onClick={() => setTaskMenuOpen(false)}
                >
                  {copy.task2}
                </Link>
              </div>
            </>
          )}
        </div>

        <div className="aroundNavControls">
          <div className="aroundAuthArea">
            <div className="aroundAccountCluster">
              {currentUser ? <Pill className="aroundUserChip aroundUserBadge">{formatUser(currentUser, copy)}</Pill> : null}
              {currentUser && energyLabel ? (
                <Pill className="aroundUserChip aroundEnergyBadge">
                  <span className="aroundEnergyIcon" aria-hidden="true" />
                  <span className="srOnly">{energyLabel}</span>
                  <span>{effectiveEnergyBalance ?? "--"}</span>
                </Pill>
              ) : null}
            </div>

            {!currentUser ? (
              <ActionButton
                className="aroundPrimaryAction"
                onClick={() => {
                  setMoreMenuOpen(false);
                  openAuth("signIn");
                }}
              >
                {copy.login}
              </ActionButton>
            ) : (
              <ActionButton
                className="ghostAction"
                onClick={async () => {
                  setMoreMenuOpen(false);
                  await handleSignOut();
                }}
              >
                {copy.authSignOut}
              </ActionButton>
            )}
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
              setMoreMenuOpen((value) => !value);
            }}
          >
            <i className="ai-settings-filled" aria-hidden="true" />
          </button>

          <div id="app-navbar-menu" className={`aroundUtilityDropdown aroundMoreDropdown${moreMenuOpen ? " is-open" : ""}`} role="menu">
            <div className="aroundMenuSection">
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

            <div className="aroundMenuSection">
              <button
                type="button"
                className="aroundMenuActionButton"
                onClick={() => {
                  setMoreMenuOpen(false);
                  openFeedbackDialog();
                }}
              >
                {copy.feedbackEntry}
              </button>
            </div>

            {currentUser ? (
              <div className="aroundMenuSection">
                <button
                  type="button"
                  className="aroundMenuActionButton aroundMenuActionDanger"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    openDeleteDialog();
                  }}
                >
                  {copy.authDeleteAccount}
                </button>
              </div>
            ) : null}

            <div className="aroundMenuSection">
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
        <div className="authDialogBackdrop" onClick={() => !authSubmitting && setAuthDialogOpen(false)}>
          <Surface
            className={`authDialog ${locale === "zh-CN" ? "authDialogCn" : "authDialogEn"}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="authDialogHeader">
              <div className="authCardIntro">
                <h2>{authMode === "signIn" ? copy.signInTab : copy.signUpTab}</h2>
                <p className="authHint">{authMode === "signIn" ? copy.authHintSignIn : copy.authHintSignUp}</p>
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
                        onChange={(event) => setSignInEmail(event.target.value)}
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
                <div className="rechargeRewardAlert" role="note">
                  <strong>+10</strong>
                  <span>{copy.rechargeRewardAlert}</span>
                </div>

                <p className="authHint">{copy.rechargeMessage}</p>

                <label className="authField">
                  <span>{copy.rechargeContactLabel}</span>
                  <textarea
                    className="feedbackDialogTextarea"
                    value={rechargeContact}
                    onChange={(event) => setRechargeContact(event.target.value)}
                    rows={4}
                    maxLength={500}
                    placeholder={copy.rechargeContactPlaceholder}
                    disabled={rechargeSubmitting || rechargeSubmitted}
                    required
                  />
                </label>

                {rechargeError ? <p className="errorBox">{rechargeError}</p> : null}
                {rechargeSubmitted ? <Pill>{copy.rechargeSubmitted}</Pill> : null}

                <ActionButton
                  type="submit"
                  variant="primary"
                  fullWidth
                  disabled={!rechargeContact.trim() || rechargeSubmitting || rechargeSubmitted}
                >
                  {rechargeSubmitting ? copy.submitting : rechargeSubmitted ? copy.rechargeSubmitted : copy.rechargeSubmit}
                </ActionButton>
              </form>
            </section>
          </Surface>
        </div>
      ) : null}

      {rechargeToast ? (
        <div className="rewardToast" role="status" aria-live="polite">
          <span>{rechargeToast}</span>
          <button type="button" className="rewardToastClose" onClick={() => setRechargeToast(null)} aria-label={copy.authClose}>
            <i className="ai-cross" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </>
  );
}
