"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import {
  AiProvider,
  CorrectionNote,
  Locale,
  TargetBand,
  TaskType,
  WritingCheckResult
} from "@/lib/types";

const TASK_PLACEHOLDERS: Record<TaskType, { prompt: string; essay: string }> = {
  task1: {
    prompt:
      "The chart below shows the percentage of households using three different renewable energy sources in a European country from 2000 to 2020. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    essay:
      "The chart compares the proportion of households that used solar, wind and hydro energy in one European country between 2000 and 2020.\n\nOverall, all three sources became more common over the period, although solar power showed the most dramatic growth. By contrast, hydro remained the least widely used source despite a gradual increase.\n\nIn 2000, hydro was used by around 5% of households, while solar and wind accounted for approximately 2% and 3% respectively. Over the next ten years, the figures for solar and wind rose steadily to about 8% and 9%. Hydro also increased, but only to roughly 7%.\n\nAfter 2010, solar use climbed sharply and reached about 18% in 2020, making it the leading source by the end of the period. Wind energy followed a similar but less pronounced pattern, finishing at around 14%. Meanwhile, hydro rose more modestly to approximately 9%."
  },
  task2: {
    prompt:
      "Some people believe that unpaid community service should be a compulsory part of high school programmes. To what extent do you agree or disagree?",
    essay:
      "Some people thinks unpaid community service should be compulsory in high school programmes, I am agree with this opinion because it can helps students become more responsibility and know the society better.\n\nFirstly, students nowadays is always study in classroom and they dont have many chance to touch real life, so community service are a good ways for them to learning how other people live. For example help old peoples in a care home or cleaning the streets can let student understand the value of hard working. This kind of activity also make them more kindness, and they will not only thinking about themself.\n\nSecondly, unpaid work can improving many useful skills, such as communicate with others, teamwork and solve problems. When students join in a charity event, they need talk with different people and maybe organize some small things, these experience is very helpful for their future job. Also, if they only focus on exam, they may becomes selfish and lack of social ability.\n\nHowever some people may said compulsory community service is not good because students already have many homework and exams. This is true in some ways, but I think school can just ask them do few hours every month, it will not be too much pressure. If the activity is designed good, student will feel interesting and meaningful, not just a boring task.\n\nIn conclusion, I strongly agree unpaid community service should be a compulsory part of high school, because it teach students responsibility, kindness and useful skills. But school should not make it too heavy, otherwise students will hate it and the purpose will lost."
  }
};

const UI_COPY = {
  en: {
    languageLabel: "Language",
    heroEyebrow: "AI Writing Review",
    heroTitle: "IELTS Writing Checker",
    heroDescription: "Rubric-based feedback with inline revision reasons.",
    userLabel: "User",
    guestUser: "Guest",
    login: "Log In",
    signInTab: "Sign In",
    signUpTab: "Sign Up",
    authName: "Name",
    authEmail: "Email",
    authPassword: "Password",
    authSubmitSignIn: "Continue",
    authSubmitSignUp: "Create Account",
    authHintSignIn: "Sign in to upgrade from a guest session.",
    authHintSignUp: "Create a formal account for your reviews and energy.",
    authClose: "Close",
    authSignOut: "Sign Out",
    resetGuest: "Reset Guest",
    resettingGuest: "Resetting...",
    energy: "Energy",
    energyCost: "Cost",
    insufficientEnergy: "Not enough energy for a review.",
    modesLabel: "Modes",
    aiReview: "AI Review",
    heuristicReady: "Fallback Review",
    coverage: "Task 1 + Task 2",
    taskSwitcherAria: "Task type",
    task1: "Task 1",
    task2: "Task 2",
    providerDeepSeek: "DeepSeek",
    targetBand: "Target Band",
    prompt: "Prompt",
    essay: "Essay",
    wordCount: "Word count",
    checking: "Checking...",
    checkWriting: "Check Writing",
    estimatedBand: "Estimated Band",
    aiMode: "AI mode",
    heuristicMode: "Heuristic mode",
    providerUsed: "Provider",
    taskAchievement: "Task Achievement",
    coherence: "Coherence & Cohesion",
    lexical: "Lexical Resource",
    grammar: "Grammar Range & Accuracy",
    strengths: "Strengths",
    highlightedSentences: "Highlighted Sentences",
    highlightedSentence: "Sentence",
    highlightedReason: "Why It Works",
    priorityFixes: "Priority Fixes",
    annotatedEssay: "Revision",
    correctionOriginal: "Original",
    correctionCorrected: "Corrected",
    correctionReason: "Reason",
    revisionBundle: "Inline Revision",
    tapForReason: "Click a revision to see why it was changed.",
    ready: "Ready",
    emptyTitle: "Run the first review",
    emptyDescription:
      "Choose Task 1 or Task 2, paste the prompt and essay, then run the checker to get rubric-based feedback.",
    genericError: "Something went wrong."
  },
  "zh-CN": {
    languageLabel: "语言",
    heroEyebrow: "AI 写作评估",
    heroTitle: "IELTS 写作批改器",
    heroDescription: "按评分标准返回反馈，并在文中直接说明修改原因。",
    userLabel: "用户",
    guestUser: "访客",
    login: "登录",
    signInTab: "登录",
    signUpTab: "注册",
    authName: "昵称",
    authEmail: "邮箱",
    authPassword: "密码",
    authSubmitSignIn: "继续登录",
    authSubmitSignUp: "创建账号",
    authHintSignIn: "登录后即可从访客会话升级为正式账号。",
    authHintSignUp: "创建正式账号，用于绑定批改记录和能量。",
    authClose: "关闭",
    authSignOut: "退出登录",
    resetGuest: "重置访客",
    resettingGuest: "重置中...",
    energy: "能量",
    energyCost: "消耗",
    insufficientEnergy: "当前能量不足，无法继续批阅。",
    modesLabel: "模式",
    aiReview: "AI 评分",
    heuristicReady: "本地评分",
    coverage: "覆盖 Task 1 + Task 2",
    taskSwitcherAria: "题型选择",
    task1: "Task 1",
    task2: "Task 2",
    providerDeepSeek: "DeepSeek",
    targetBand: "目标分数",
    prompt: "题目",
    essay: "作文",
    wordCount: "词数",
    checking: "评分中...",
    checkWriting: "开始批改",
    estimatedBand: "预估分数",
    aiMode: "AI 模式",
    heuristicMode: "本地启发式模式",
    providerUsed: "当前平台",
    taskAchievement: "任务回应",
    coherence: "连贯与衔接",
    lexical: "词汇资源",
    grammar: "语法范围与准确性",
    strengths: "优点",
    highlightedSentences: "精彩句子",
    highlightedSentence: "原句",
    highlightedReason: "精彩原因",
    priorityFixes: "优先修改点",
    annotatedEssay: "批改痕迹",
    correctionOriginal: "原句",
    correctionCorrected: "修改后",
    correctionReason: "修改原因",
    revisionBundle: "文中批改",
    tapForReason: "点击文中的修改处，可查看原因。",
    ready: "已就绪",
    emptyTitle: "开始第一次批改",
    emptyDescription: "选择 Task 1 或 Task 2，粘贴题目和作文，然后运行批改以获取按评分标准生成的反馈。",
    genericError: "发生了一些问题。"
  }
} as const;

function isErrorPayload(value: unknown): value is { error?: string } {
  return typeof value === "object" && value !== null && "error" in value;
}

type EnergyState = {
  balance: number;
  totalConsumed: number;
  totalRecharged: number;
  updatedAt: string;
};

type EnergyPayload = {
  energy: EnergyState;
  cost: number;
};

type SessionPayload = {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    isAnonymous: boolean;
  };
};

function formatUserPill(
  user: SessionPayload["user"] | null,
  t: (typeof UI_COPY)["en"] | (typeof UI_COPY)["zh-CN"]
) {
  if (!user) {
    return `${t.userLabel}: --`;
  }

  const identity = user.isAnonymous
    ? t.guestUser
    : user.name?.trim() || user.email?.trim() || t.userLabel;

  return `${t.userLabel}: ${identity} · ${user.id.slice(0, 8)}`;
}

type AuthMode = "signIn" | "signUp";

function ScoreCard({
  label,
  score,
  rationale
}: {
  label: string;
  score: number;
  rationale: string;
}) {
  return (
    <article className="scoreCard">
      <div className="scoreHeader">
        <div>
          <p className="sectionLabel">{label}</p>
          <h3>{score.toFixed(1)}</h3>
        </div>
      </div>
      <p>{rationale}</p>
    </article>
  );
}

function renderAnnotatedEssay(
  text: string,
  highlightedSentences: string[],
  correctionNotes: CorrectionNote[],
  activeEditIndex: number | null,
  onToggleEdit: (index: number) => void,
  t: (typeof UI_COPY)["en"] | (typeof UI_COPY)["zh-CN"]
) {
  const notesById = new Map(correctionNotes.map((note) => [note.id, note]));
  const parts: Array<
    | { type: "plain"; text: string }
    | { type: "edit"; id: string; original: string; corrected: string; note?: CorrectionNote; index: number }
    | { type: "del" | "add"; text: string }
  > = [];
  const pairPattern = /\[del#([A-Za-z0-9_-]+)\]([\s\S]*?)\[\/del#\1\]\[add#\1\]([\s\S]*?)\[\/add#\1\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let editIndex = 0;

  while ((match = pairPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "plain", text: text.slice(lastIndex, match.index) });
    }

    parts.push({
      type: "edit",
      id: match[1],
      original: match[2],
      corrected: match[3],
      note: notesById.get(match[1]),
      index: editIndex
    });
    editIndex += 1;

    lastIndex = pairPattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "plain", text: text.slice(lastIndex) });
  }

  function renderPlainTextSegment(segment: string, keyPrefix: string) {
    if (!highlightedSentences.length) {
      return <span key={keyPrefix}>{segment}</span>;
    }

    const normalizedCandidates = highlightedSentences.filter(Boolean);
    if (!normalizedCandidates.length) {
      return <span key={keyPrefix}>{segment}</span>;
    }

    const subparts: React.ReactNode[] = [];
    let remaining = segment;
    let cursor = 0;

    while (remaining.length > 0) {
      let matchedSentence = "";
      let matchedIndex = -1;

      for (const candidate of normalizedCandidates) {
        const index = remaining.indexOf(candidate);
        if (index !== -1 && (matchedIndex === -1 || index < matchedIndex)) {
          matchedSentence = candidate;
          matchedIndex = index;
        }
      }

      if (matchedIndex === -1) {
        subparts.push(<span key={`${keyPrefix}-tail-${cursor}`}>{remaining}</span>);
        break;
      }

      if (matchedIndex > 0) {
        subparts.push(
          <span key={`${keyPrefix}-plain-${cursor}`}>{remaining.slice(0, matchedIndex)}</span>
        );
      }

      subparts.push(
        <mark key={`${keyPrefix}-highlight-${cursor}`} className="essayHighlight">
          {matchedSentence}
        </mark>
      );

      remaining = remaining.slice(matchedIndex + matchedSentence.length);
      cursor += 1;
    }

    return <span key={keyPrefix}>{subparts}</span>;
  }

  return parts.map((part, index) => {
    if (part.type === "edit") {
      const isActive = activeEditIndex === part.index;

      return (
        <span
          key={`edit-${part.index}-${index}`}
          className={`editChip${isActive ? " active" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => onToggleEdit(part.index)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onToggleEdit(part.index);
            }
          }}
        >
          <del className="essayDel">{part.original}</del>
          <ins className="essayAdd">{part.corrected}</ins>
          {part.note ? (
            <span className={`editTooltip${isActive ? " visible" : ""}`}>
              <strong>{t.correctionReason}:</strong> {part.note.reason}
            </span>
          ) : null}
        </span>
      );
    }

    if (part.type === "del") {
      return (
        <del key={index} className="essayDel">
          {part.text}
        </del>
      );
    }

    if (part.type === "add") {
      return (
        <ins key={index} className="essayAdd">
          {part.text}
        </ins>
      );
    }

    return renderPlainTextSegment(part.text, `plain-${index}`);
  });
}

export default function HomePage() {
  const activeEditRef = useRef<HTMLDivElement | null>(null);
  const [locale, setLocale] = useState<Locale>("zh-CN");
  const [taskType, setTaskType] = useState<TaskType>("task2");
  const provider: AiProvider = "deepseek";
  const [targetBand, setTargetBand] = useState<TargetBand>(6.5);
  const [prompt, setPrompt] = useState(TASK_PLACEHOLDERS.task2.prompt);
  const [essay, setEssay] = useState(TASK_PLACEHOLDERS.task2.essay);
  const [result, setResult] = useState<WritingCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeEditIndex, setActiveEditIndex] = useState<number | null>(null);
  const [energy, setEnergy] = useState<EnergyState | null>(null);
  const [reviewCost, setReviewCost] = useState(1);
  const [sessionReady, setSessionReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<SessionPayload["user"] | null>(null);
  const [resettingGuest, setResettingGuest] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signIn");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const t = UI_COPY[locale];

  useEffect(() => {
    if (activeEditIndex === null) {
      return;
    }

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (!activeEditRef.current) {
        return;
      }

      const target = event.target;
      if (target instanceof Node && !activeEditRef.current.contains(target)) {
        setActiveEditIndex(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [activeEditIndex]);

  useEffect(() => {
    let mounted = true;

    async function ensureAnonymousSession() {
      const sessionResult = await authClient.getSession();

      if (sessionResult.data) {
        return;
      }

      const anonymousResult = await authClient.signIn.anonymous();
      if (anonymousResult.error) {
        throw new Error(anonymousResult.error.message || "AUTH_INIT_FAILED");
      }
    }

    async function loadSessionContext() {
      try {
        await ensureAnonymousSession();
        const [sessionResponse, energyResponse] = await Promise.all([
          fetch("/api/session"),
          fetch("/api/energy")
        ]);

        const sessionData = (await sessionResponse.json()) as SessionPayload | { error?: string };
        const energyData = (await energyResponse.json()) as EnergyPayload | { error?: string };

        if (!sessionResponse.ok || isErrorPayload(sessionData)) {
          return;
        }

        if (!energyResponse.ok || isErrorPayload(energyData)) {
          return;
        }

        if (mounted) {
          setCurrentUser(sessionData.user);
          setEnergy(energyData.energy);
          setReviewCost(energyData.cost);
        }
      } catch {
        // Ignore preload failures.
      } finally {
        if (mounted) {
          setSessionReady(true);
        }
      }
    }

    loadSessionContext();

    return () => {
      mounted = false;
    };
  }, []);

  async function refreshSessionContext() {
    const [sessionResponse, energyResponse] = await Promise.all([fetch("/api/session"), fetch("/api/energy")]);
    const sessionData = (await sessionResponse.json()) as SessionPayload | { error?: string };
    const energyData = (await energyResponse.json()) as EnergyPayload | { error?: string };

    if (!sessionResponse.ok || isErrorPayload(sessionData)) {
      throw new Error(t.genericError);
    }

    if (!energyResponse.ok || isErrorPayload(energyData)) {
      throw new Error(t.genericError);
    }

    setCurrentUser(sessionData.user);
    setEnergy(energyData.energy);
    setReviewCost(energyData.cost);
  }

  async function handleResetGuest() {
    if (!currentUser?.isAnonymous || resettingGuest) {
      return;
    }

    setResettingGuest(true);
    setError(null);

    try {
      const signOutResult = await authClient.signOut();
      if (signOutResult.error) {
        throw new Error(signOutResult.error.message || t.genericError);
      }

      const anonymousResult = await authClient.signIn.anonymous();
      if (anonymousResult.error) {
        throw new Error(anonymousResult.error.message || t.genericError);
      }

      await refreshSessionContext();
      setResult(null);
      setActiveEditIndex(null);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : t.genericError);
    } finally {
      setResettingGuest(false);
    }
  }

  function handleLoginPlaceholder() {
    setError(null);
    setAuthDialogOpen(true);
    setAuthMode("signIn");
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthSubmitting(true);
    setError(null);

    try {
      if (authMode === "signIn") {
        const result = await authClient.signIn.email({
          email: authEmail.trim(),
          password: authPassword
        });

        if (result.error) {
          throw new Error(result.error.message || t.genericError);
        }
      } else {
        const result = await authClient.signUp.email({
          name: authName.trim(),
          email: authEmail.trim(),
          password: authPassword
        });

        if (result.error) {
          throw new Error(result.error.message || t.genericError);
        }
      }

      await refreshSessionContext();
      setAuthDialogOpen(false);
      setAuthPassword("");
      setResult(null);
      setActiveEditIndex(null);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : t.genericError);
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleSignOut() {
    setError(null);

    try {
      const signOutResult = await authClient.signOut();
      if (signOutResult.error) {
        throw new Error(signOutResult.error.message || t.genericError);
      }

      const anonymousResult = await authClient.signIn.anonymous();
      if (anonymousResult.error) {
        throw new Error(anonymousResult.error.message || t.genericError);
      }

      await refreshSessionContext();
      setResult(null);
      setActiveEditIndex(null);
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : t.genericError);
    }
  }

  function onTaskTypeChange(nextType: TaskType) {
    setTaskType(nextType);
    setPrompt(TASK_PLACEHOLDERS[nextType].prompt);
    setEssay(TASK_PLACEHOLDERS[nextType].essay);
    setResult(null);
    setError(null);
    setActiveEditIndex(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionReady) {
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          taskType,
          provider,
          locale,
          targetBand,
          prompt,
          essay
        })
      });

      const data = (await response.json()) as
        | {
            result: WritingCheckResult;
            energy: EnergyState;
            cost: number;
          }
        | { error?: string; energy?: EnergyState; cost?: number };

      if (!response.ok) {
        if (response.status === 401) {
          setError(t.genericError);
          return;
        }

        if (isErrorPayload(data) && data.error === "INSUFFICIENT_ENERGY") {
          if ("energy" in data && data.energy) {
            setEnergy(data.energy);
          }
          setError(t.insufficientEnergy);
          return;
        }

        throw new Error(isErrorPayload(data) ? data.error || "Request failed." : "Request failed.");
      }

      if (!("result" in data)) {
        throw new Error(t.genericError);
      }

      setResult(data.result);
      setEnergy(data.energy);
      setReviewCost(data.cost);
      setActiveEditIndex(null);
    } catch (submissionError) {
      setResult(null);
      setError(submissionError instanceof Error ? submissionError.message : t.genericError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="pageShell">
      <header className="pageHeader">
        <div className="titleBlock">
          <p className="eyebrow">{t.heroEyebrow}</p>
          <h1>{t.heroTitle}</h1>
          <p className="lede">{t.heroDescription}</p>
        </div>
        <div className="headerControls">
          <div className="metaPills">
            <span>{result?.feedbackMode === "ai" ? t.aiReview : t.heuristicReady}</span>
            <span>{formatUserPill(currentUser, t)}</span>
            <span>
              {t.energy}: {energy?.balance ?? "--"}
            </span>
            <span>
              {t.energyCost}: {reviewCost}
            </span>
          </div>
          {currentUser?.isAnonymous ? (
            <div className="authActionGroup">
              <button
                type="button"
                className="ghostAction primary"
                onClick={handleLoginPlaceholder}
                disabled={loading || !sessionReady}
              >
                {t.login}
              </button>
              <button
                type="button"
                className="ghostAction"
                onClick={handleResetGuest}
                disabled={resettingGuest || loading || !sessionReady}
              >
                {resettingGuest ? t.resettingGuest : t.resetGuest}
              </button>
            </div>
          ) : currentUser ? (
            <div className="authActionGroup">
              <button
                type="button"
                className="ghostAction"
                onClick={handleSignOut}
                disabled={loading || !sessionReady}
              >
                {t.authSignOut}
              </button>
            </div>
          ) : null}
          <label className="localeControl">
            <span>{t.languageLabel}</span>
            <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
              <option value="zh-CN">简体中文</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>
      </header>

      <section className="workspace">
        <form className="editorPanel" onSubmit={handleSubmit}>
          <div className="panelHeading">
            <div>
              <p className="sectionLabel">{t.modesLabel}</p>
              <h2>{taskType === "task1" ? t.task1 : t.task2}</h2>
            </div>
            <div className="inlineMeta">
              <span>{t.providerDeepSeek}</span>
              <span>
                {t.wordCount}: {essay.trim() ? essay.trim().split(/\s+/).length : 0}
              </span>
            </div>
          </div>

          <div className="segmentedControl" role="tablist" aria-label={t.taskSwitcherAria}>
            <button
              type="button"
              className={taskType === "task1" ? "active" : ""}
              onClick={() => onTaskTypeChange("task1")}
            >
              {t.task1}
            </button>
            <button
              type="button"
              className={taskType === "task2" ? "active" : ""}
              onClick={() => onTaskTypeChange("task2")}
            >
              {t.task2}
            </button>
          </div>

          <label>
            <span>{t.targetBand}</span>
            <select value={targetBand} onChange={(event) => setTargetBand(Number(event.target.value) as TargetBand)}>
              <option value={5}>5.0</option>
              <option value={5.5}>5.5</option>
              <option value={6}>6.0</option>
              <option value={6.5}>6.5</option>
              <option value={7}>7.0</option>
              <option value={7.5}>7.5</option>
              <option value={8}>8.0</option>
            </select>
          </label>

          <label>
            <span>{t.prompt}</span>
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={5} />
          </label>

          <label>
            <span>{t.essay}</span>
            <textarea value={essay} onChange={(event) => setEssay(event.target.value)} rows={16} />
          </label>

          <div className="editorFooter">
            <p>
              {t.wordCount}: <strong>{essay.trim() ? essay.trim().split(/\s+/).length : 0}</strong>
            </p>
            <button type="submit" disabled={loading || !sessionReady}>
              {loading ? t.checking : t.checkWriting}
            </button>
          </div>

          {error ? <p className="errorBox">{error}</p> : null}
        </form>

        <section className="resultsPanel">
          {result ? (
            <div className="reportPaper">
              <div className="resultHero">
                <div className="resultScore">
                  <p className="sectionLabel">{t.estimatedBand}</p>
                  <h2>{result.estimatedBand.toFixed(1)}</h2>
                </div>
                <div className="resultMeta">
                  <span>{result.taskType === "task1" ? t.task1 : t.task2}</span>
                  <span>
                    {locale === "zh-CN" ? "目标" : "Target"} {result.targetBand.toFixed(1)}
                  </span>
                  <span>
                    {result.wordCount} {locale === "zh-CN" ? "词" : "words"}
                  </span>
                  <span>{result.feedbackMode === "ai" ? t.aiMode : t.heuristicMode}</span>
                  <span>
                    {t.providerUsed}: {result.providerUsed}
                  </span>
                </div>
              </div>

              <div className="scoreGrid">
                <ScoreCard
                  label={t.taskAchievement}
                  score={result.bandBreakdown.taskAchievement.score}
                  rationale={result.bandBreakdown.taskAchievement.rationale}
                />
                <ScoreCard
                  label={t.coherence}
                  score={result.bandBreakdown.coherenceAndCohesion.score}
                  rationale={result.bandBreakdown.coherenceAndCohesion.rationale}
                />
                <ScoreCard
                  label={t.lexical}
                  score={result.bandBreakdown.lexicalResource.score}
                  rationale={result.bandBreakdown.lexicalResource.rationale}
                />
                <ScoreCard
                  label={t.grammar}
                  score={result.bandBreakdown.grammaticalRangeAndAccuracy.score}
                  rationale={result.bandBreakdown.grammaticalRangeAndAccuracy.rationale}
                />
              </div>

              <article className="feedbackSection">
                <p className="sectionLabel">{t.strengths}</p>
                <ul>
                  {result.strengths.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>

              <article className="feedbackSection">
                <p className="sectionLabel">{t.highlightedSentences}</p>
                <div className="correctionList">
                  {result.highlightedSentences.map((item, index) => (
                    <article key={`${item.sentence}-${index}`} className="correctionCard">
                      <p>
                        <strong>{t.highlightedSentence}:</strong> {item.sentence}
                      </p>
                      <p>
                        <strong>{t.highlightedReason}:</strong> {item.reason}
                      </p>
                    </article>
                  ))}
                </div>
              </article>

              <article className="feedbackSection">
                <p className="sectionLabel">{t.priorityFixes}</p>
                <ul>
                  {result.priorityFixes.map((item) => (
                    <li key={item.title}>
                      <strong>{item.title}:</strong> {item.detail}
                    </li>
                  ))}
                </ul>
              </article>

              <article className="feedbackSection revisionSection">
                <p className="sectionLabel">{t.revisionBundle}</p>
                <p className="revisionHint">{t.tapForReason}</p>

                <div className="revisionBlock">
                  <p className="subsectionTitle">{t.annotatedEssay}</p>
                  <div className="annotatedEssay" ref={activeEditRef}>
                    {renderAnnotatedEssay(
                      result.annotatedEssay,
                      result.highlightedSentences.map((item) => item.sentence),
                      result.correctionNotes,
                      activeEditIndex,
                      (index) => setActiveEditIndex((current) => (current === index ? null : index)),
                      t
                    )}
                  </div>
                </div>
              </article>
            </div>
          ) : (
            <div className="emptyState">
              <p className="eyebrow">{t.ready}</p>
              <h2>{t.emptyTitle}</h2>
              <p>{t.emptyDescription}</p>
            </div>
          )}
        </section>
      </section>

      {authDialogOpen ? (
        <div className="authDialogBackdrop" onClick={() => !authSubmitting && setAuthDialogOpen(false)}>
          <div
            className="authDialog"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="authDialogHeader">
              <div className="authTabs" role="tablist" aria-label="Authentication mode">
                <button
                  type="button"
                  className={authMode === "signIn" ? "active" : ""}
                  onClick={() => setAuthMode("signIn")}
                  disabled={authSubmitting}
                >
                  {t.signInTab}
                </button>
                <button
                  type="button"
                  className={authMode === "signUp" ? "active" : ""}
                  onClick={() => setAuthMode("signUp")}
                  disabled={authSubmitting}
                >
                  {t.signUpTab}
                </button>
              </div>
              <button
                type="button"
                className="ghostAction"
                onClick={() => setAuthDialogOpen(false)}
                disabled={authSubmitting}
              >
                {t.authClose}
              </button>
            </div>

            <p className="authHint">{authMode === "signIn" ? t.authHintSignIn : t.authHintSignUp}</p>

            <form className="authForm" onSubmit={handleAuthSubmit}>
              {authMode === "signUp" ? (
                <label>
                  <span>{t.authName}</span>
                  <input
                    type="text"
                    value={authName}
                    onChange={(event) => setAuthName(event.target.value)}
                    required
                    minLength={2}
                  />
                </label>
              ) : null}

              <label>
                <span>{t.authEmail}</span>
                <input
                  type="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  required
                  autoComplete="email"
                />
              </label>

              <label>
                <span>{t.authPassword}</span>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  required
                  minLength={8}
                  autoComplete={authMode === "signIn" ? "current-password" : "new-password"}
                />
              </label>
              <div className="editorFooter">
                <button type="submit" disabled={authSubmitting}>
                  {authSubmitting
                    ? "Submitting..."
                    : authMode === "signIn"
                      ? t.authSubmitSignIn
                      : t.authSubmitSignUp}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
