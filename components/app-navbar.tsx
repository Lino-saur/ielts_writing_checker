"use client";

import Link from "next/link";
import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  getClientSessionContext,
  invalidateClientSessionContext,
  type ClientSessionContext
} from "@/lib/auth-client-session";
import { ActionButton, Pill, Surface } from "@/components/ui-kit";

type Locale = "en" | "zh-CN";

type NavbarCopy = {
  brand: string;
  task1: string;
  task2: string;
  languageLabel: string;
  userLabel: string;
  guestUser: string;
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
  authClose: string;
  authSignOut: string;
  genericError: string;
};

type AppNavbarProps = {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  copy: NavbarCopy;
  onSessionUpdated?: () => Promise<void> | void;
  taskMenuMode?: "all" | "task2Only";
  energyBalance?: number | null;
  energyLabel?: string;
};

type AuthMode = "signIn" | "signUp";
type ThemeMode = "light" | "dark";

async function getAuthClient() {
  const { authClient } = await import("@/lib/auth-client");
  return authClient;
}

function formatUser(user: ClientSessionContext["user"], copy: NavbarCopy) {
  if (!user) {
    return `${copy.userLabel}: --`;
  }

  const identity = user.isAnonymous ? copy.guestUser : user.name?.trim() || user.email?.trim() || copy.userLabel;
  return `${copy.userLabel}: ${identity}`;
}

export function AppNavbar({
  locale,
  onLocaleChange,
  copy,
  onSessionUpdated,
  taskMenuMode = "all",
  energyBalance = null,
  energyLabel
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
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [taskMenuOpen, setTaskMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [signInPasswordVisible, setSignInPasswordVisible] = useState(false);
  const [signUpPasswordVisible, setSignUpPasswordVisible] = useState(false);

  const homeHref = useMemo(() => `/?lang=${locale}`, [locale]);
  const checkerTask1Href = useMemo(() => `/checker?task=task1&lang=${locale}`, [locale]);
  const checkerTask2Href = useMemo(() => `/checker?task=task2&lang=${locale}`, [locale]);
  const taskMenuLabel = activeTask === "task1" ? copy.task1 : activeTask === "task2" ? copy.task2 : locale === "zh-CN" ? "写作任务" : "Writing tasks";
  const moreMenuOpenLabel = locale === "zh-CN" ? "打开设置菜单" : "Open settings menu";
  const moreMenuCloseLabel = locale === "zh-CN" ? "收起设置菜单" : "Close settings menu";
  const authSwitchPrefix = authMode === "signIn" ? (locale === "zh-CN" ? "没有账号？" : "No account?") : locale === "zh-CN" ? "已有账号？" : "Already have an account?";
  const authSwitchAction = authMode === "signIn" ? (locale === "zh-CN" ? "创建账号" : "Create one") : locale === "zh-CN" ? "返回登录" : "Back to sign in";
  const guestBadge = locale === "zh-CN" ? "访客模式" : "Guest";
  const effectiveEnergyBalance = energyBalance ?? currentEnergyBalance;
  const themeLabel = locale === "zh-CN" ? "主题" : "Theme";
  const appearanceLabel = locale === "zh-CN" ? "外观" : "Appearance";

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
    if (authDialogOpen) {
      setTaskMenuOpen(false);
      setMoreMenuOpen(false);
    }
  }, [authDialogOpen]);

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
    setAuthDialogOpen(true);
  }

  async function submitAuth(mode: AuthMode) {
    setAuthSubmitting(true);
    setAuthError(null);

    try {
      const authClient = await getAuthClient();
      if (mode === "signIn") {
        const result = await authClient.signIn.email({
          email: signInEmail.trim(),
          password: signInPassword
        });

        if (result.error) {
          throw new Error(result.error.message || copy.genericError);
        }
      } else {
        const result = await authClient.signUp.email({
          name: signUpName.trim(),
          email: signUpEmail.trim(),
          password: signUpPassword
        });

        if (result.error) {
          throw new Error(result.error.message || copy.genericError);
        }
      }

      invalidateClientSessionContext();
      await refreshSession();
      setAuthDialogOpen(false);
      setSignInPassword("");
      setSignUpPassword("");
      setSignInPasswordVisible(false);
      setSignUpPasswordVisible(false);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : copy.genericError);
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

    try {
      const authClient = await getAuthClient();
      const signOutResult = await authClient.signOut();
      if (signOutResult.error) {
        throw new Error(signOutResult.error.message || copy.genericError);
      }

      invalidateClientSessionContext();
      const anonymousResult = await authClient.signIn.anonymous();
      if (anonymousResult.error) {
        throw new Error(anonymousResult.error.message || copy.genericError);
      }

      await refreshSession();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : copy.genericError);
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
              <Pill className="aroundUserChip aroundUserBadge">
                {currentUser?.isAnonymous !== false ? guestBadge : formatUser(currentUser, copy)}
              </Pill>
              {energyLabel ? (
                <Pill className="aroundUserChip aroundEnergyBadge">
                  <span className="aroundEnergyIcon" aria-hidden="true" />
                  <span className="srOnly">{energyLabel}</span>
                  <span>{effectiveEnergyBalance ?? "--"}</span>
                </Pill>
              ) : null}
            </div>

            {currentUser?.isAnonymous !== false ? (
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
                    aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
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
                        aria-label={signInPasswordVisible ? "Hide password" : "Show password"}
                      >
                        <i className={signInPasswordVisible ? "ai-hide" : "ai-show"} aria-hidden="true" />
                      </button>
                    </div>
                  </label>

                  {authError ? <p className="errorBox">{authError}</p> : null}

                  <ActionButton type="submit" variant="primary" fullWidth disabled={authSubmitting}>
                    {authSubmitting ? "Submitting..." : copy.authSubmitSignIn}
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
                        aria-label={signUpPasswordVisible ? "Hide password" : "Show password"}
                      >
                        <i className={signUpPasswordVisible ? "ai-hide" : "ai-show"} aria-hidden="true" />
                      </button>
                    </div>
                  </label>

                  {authError ? <p className="errorBox">{authError}</p> : null}

                  <ActionButton type="submit" variant="primary" fullWidth disabled={authSubmitting}>
                    {authSubmitting ? "Submitting..." : copy.authSubmitSignUp}
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
    </>
  );
}
