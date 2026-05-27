"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { AppNavbar } from "@/components/app-navbar";
import { ActionButton, Pill, Surface } from "@/components/ui-kit";
import {
  AiProvider,
  CorrectionNote,
  Locale,
  TargetBand,
  TaskType,
  WritingCheckResult
} from "@/lib/types";

const LOCALE_STORAGE_KEY = "app-locale";

async function getAuthClient() {
  const { authClient } = await import("@/lib/auth-client");
  return authClient;
}

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
    brand: "IELTS Writing Checker",
    languageLabel: "Language",
    heroEyebrow: "AI Writing Review",
    heroTitle: "IELTS Writing Checker",
    heroDescription: "Rubric-based feedback with inline revision reasons.",
    heroDescriptionStrong:
      "A cleaner review desk for Task 1 and Task 2, shaped like a polished SaaS workspace.",
    navBadge: "Around-inspired interface",
    navFeatures: "Features",
    navTemplates: "Templates",
    navWorkspace: "Workspace",
    heroPrimaryCta: "Start Reviewing",
    heroSecondaryCta: "Guest Session",
    heroKicker: "Landing page direction inspired by Around Index.",
    statAccuracyLabel: "Feedback model",
    statAccuracyValue: "Band rubric",
    statSessionsLabel: "Session mode",
    statSessionsValue: "Anonymous or account",
    statFocusLabel: "Revision style",
    statFocusValue: "Inline explanations",
    featureOneTitle: "Exam-ready structure",
    featureOneBody: "Separate prompt, target band and essay input so the review flow stays disciplined.",
    featureTwoTitle: "Visible reasoning",
    featureTwoBody: "Corrections stay anchored in the essay, with sentence-level reasons on demand.",
    featureThreeTitle: "Practical scoring",
    featureThreeBody: "Band breakdown, highlights and priority fixes are grouped into a report that is quick to scan.",
    editorEyebrow: "Writing workspace",
    resultEyebrow: "Review output",
    previewLabel: "Live review setup",
    previewBody: "Switch task type, set a target band and keep track of energy before you submit.",
    socialProofTitle: "Used to shape a faster IELTS writing workflow",
    galleryEyebrow: "Landing blocks",
    galleryTitle: "Homepage sections with placeholder visuals",
    galleryDescription:
      "The page is designed as a product landing page first, with the checker embedded as the main conversion section below.",
    galleryCardOneTitle: "Hero showcase",
    galleryCardOneBody: "Bold heading, intro copy and layered UI placeholders.",
    galleryCardTwoTitle: "Feature storytelling",
    galleryCardTwoBody: "Three editorial cards to explain value without crowding the hero.",
    galleryCardThreeTitle: "Template library",
    galleryCardThreeBody: "A grid of product directions presented like Around landing previews.",
    galleryCardFourTitle: "Workflow section",
    galleryCardFourBody: "A process strip that turns product capability into a guided user path.",
    storyEyebrow: "Why this layout",
    storyTitle: "A landing page first, an evaluation tool second",
    storyBody:
      "Around index pages sell a visual system before they explain every detail. This homepage now follows that pattern: strong entry, curated sections, then the functional product desk.",
    storyPointOne: "Large hero with layered mockups and placeholder media blocks.",
    storyPointTwo: "Section rhythm that alternates between grids, story content and a focused CTA.",
    storyPointThree: "The working checker remains available lower on the page for real use.",
    processEyebrow: "Review flow",
    processTitle: "A simpler path from draft to revision",
    processStepOneTitle: "Paste the task",
    processStepOneBody: "Switch between Task 1 and Task 2, then set the band target before review.",
    processStepTwoTitle: "Run the check",
    processStepTwoBody: "Use AI scoring, energy tracking and session-aware access in one place.",
    processStepThreeTitle: "Study the report",
    processStepThreeBody: "Read strengths, fixes, highlighted sentences and inline reasons together.",
    ctaTitle: "Scroll into the live checker when you want to test the flow.",
    ctaBody: "The sections above frame the product like a landing page. The workspace below is still fully interactive.",
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
    brand: "IELTS Writing Checker",
    languageLabel: "语言",
    heroEyebrow: "AI 写作评估",
    heroTitle: "IELTS 写作批改器",
    heroDescription: "按评分标准返回反馈，并在文中直接说明修改原因。",
    heroDescriptionStrong: "把 Task 1 / Task 2 批改工作台整理成更完整、更克制的 Around 风格界面。",
    navBadge: "Around 风格界面",
    navFeatures: "能力",
    navTemplates: "模板区",
    navWorkspace: "工作台",
    heroPrimaryCta: "开始批改",
    heroSecondaryCta: "当前访客会话",
    heroKicker: "首页结构参考 Around Index Page 的节奏来做。",
    statAccuracyLabel: "反馈框架",
    statAccuracyValue: "按 Band 标准",
    statSessionsLabel: "会话模式",
    statSessionsValue: "访客或正式账号",
    statFocusLabel: "批改形式",
    statFocusValue: "文中解释修改原因",
    featureOneTitle: "更像考试场景",
    featureOneBody: "题目、目标分和作文输入被拆开，批改流程更清晰，不容易混乱。",
    featureTwoTitle: "修改理由可见",
    featureTwoBody: "批改痕迹直接留在文中，点开就能看到句子级修改原因。",
    featureThreeTitle: "结果更可执行",
    featureThreeBody: "分项评分、亮点和优先修改点被整理成一份更容易快速扫读的报告。",
    editorEyebrow: "写作工作台",
    resultEyebrow: "批改结果",
    previewLabel: "当前批改配置",
    previewBody: "可随时切换题型、目标分与语言，并在提交前确认能量消耗。",
    socialProofTitle: "用于组织 IELTS 写作产品首页节奏的展示区",
    galleryEyebrow: "首页模块",
    galleryTitle: "带占位视觉的 Landing Page 内容区",
    galleryDescription: "这个首页先作为产品落地页成立，再把批改器工作台作为下方核心转化区接住。",
    galleryCardOneTitle: "Hero 展示区",
    galleryCardOneBody: "大标题、导语和分层 UI 占位视觉，先把第一屏立住。",
    galleryCardTwoTitle: "能力讲述区",
    galleryCardTwoBody: "用三张编辑感更强的卡片解释价值，不把信息全塞进首屏。",
    galleryCardThreeTitle: "模板预览区",
    galleryCardThreeBody: "像 Around 首页一样，用卡片网格展示不同方向的落地页块。",
    galleryCardFourTitle: "流程说明区",
    galleryCardFourBody: "把产品能力整理成一条更清楚的用户路径。",
    storyEyebrow: "布局思路",
    storyTitle: "先让它像一个落地页，再让它像一个工具",
    storyBody:
      "Around 的首页会先建立品牌感和视觉系统，再解释细节。这里也沿用这个顺序：先首屏、再内容区、最后落到真正可用的批改工作台。",
    storyPointOne: "首屏使用更大的标题、分层 mockup 和占位图块。",
    storyPointTwo: "区块节奏在卡片网格、故事段落和 CTA 之间切换，避免单调。",
    storyPointThree: "真正可用的批改器工作台仍然保留在页面下半部分。",
    processEyebrow: "使用路径",
    processTitle: "从草稿到修改的路径更直接",
    processStepOneTitle: "粘贴题目",
    processStepOneBody: "先切换 Task 1 / Task 2，再设置目标分。",
    processStepTwoTitle: "运行批改",
    processStepTwoBody: "AI 评分、能量计费和会话逻辑都在同一个入口里完成。",
    processStepThreeTitle: "查看报告",
    processStepThreeBody: "优点、重点修改项、精彩句子和文中解释放在一起看。",
    ctaTitle: "继续向下滚动，就可以直接进入真实可用的批改器。",
    ctaBody: "上面的区块负责呈现落地页气质，下面的工作台负责真正承接使用。",
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

type ErrorSource = "auth" | "general";

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
  const localeHydratedRef = useRef(false);
  const [locale, setLocale] = useState<Locale>("zh-CN");
  const [taskType, setTaskType] = useState<TaskType>("task2");
  const provider: AiProvider = "deepseek";
  const [targetBand, setTargetBand] = useState<TargetBand>(6.5);
  const [prompt, setPrompt] = useState(TASK_PLACEHOLDERS.task2.prompt);
  const [essay, setEssay] = useState(TASK_PLACEHOLDERS.task2.essay);
  const [result, setResult] = useState<WritingCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorSource, setErrorSource] = useState<ErrorSource>("general");
  const [loading, setLoading] = useState(false);
  const [activeEditIndex, setActiveEditIndex] = useState<number | null>(null);
  const [energy, setEnergy] = useState<EnergyState | null>(null);
  const [reviewCost, setReviewCost] = useState(1);
  const [sessionReady, setSessionReady] = useState(false);

  const t = UI_COPY[locale];
  const wordCount = essay.trim() ? essay.trim().split(/\s+/).length : 0;

  function clearError() {
    setError(null);
    setErrorSource("general");
  }

  function showError(message: string, source: ErrorSource = "general") {
    setError(message);
    setErrorSource(source);
  }

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
    const params = new URLSearchParams(window.location.search);
    const taskParam = params.get("task");
    const langParam = params.get("lang");
    const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    const nextLocale =
      langParam === "en" || langParam === "zh-CN"
        ? langParam
        : storedLocale === "en" || storedLocale === "zh-CN"
          ? storedLocale
          : "zh-CN";

    if (taskParam === "task1" || taskParam === "task2") {
      setTaskType(taskParam);
      setPrompt(TASK_PLACEHOLDERS[taskParam].prompt);
      setEssay(TASK_PLACEHOLDERS[taskParam].essay);
      setResult(null);
      setActiveEditIndex(null);
    }

    setLocale(nextLocale);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    localeHydratedRef.current = true;

    if (params.get("lang") !== nextLocale) {
      params.set("lang", nextLocale);
      const nextQuery = params.toString();
      window.history.replaceState({}, "", nextQuery ? `/checker?${nextQuery}` : "/checker");
    }
  }, []);

  useEffect(() => {
    if (!localeHydratedRef.current) {
      return;
    }

    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    const params = new URLSearchParams(window.location.search);

    if (params.get("lang") !== locale) {
      params.set("lang", locale);
      const nextQuery = params.toString();
      window.history.replaceState({}, "", nextQuery ? `/checker?${nextQuery}` : "/checker");
    }
  }, [locale]);

  useEffect(() => {
    let mounted = true;

    async function loadSessionContext() {
      try {
        const authClient = await getAuthClient();
        const sessionResult = await authClient.getSession();
        if (!sessionResult.data) {
          const anonymousResult = await authClient.signIn.anonymous();
          if (anonymousResult.error) {
            throw new Error(anonymousResult.error.message || "AUTH_INIT_FAILED");
          }
        }

        const energyResponse = await fetch("/api/energy");
        const energyData = (await energyResponse.json()) as EnergyPayload | { error?: string };

        if (!energyResponse.ok || isErrorPayload(energyData)) {
          return;
        }

        if (mounted) {
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
    const energyResponse = await fetch("/api/energy");
    const energyData = (await energyResponse.json()) as EnergyPayload | { error?: string };

    if (!energyResponse.ok || isErrorPayload(energyData)) {
      throw new Error(t.genericError);
    }

    setEnergy(energyData.energy);
    setReviewCost(energyData.cost);
  }

  function onTaskTypeChange(nextType: TaskType) {
    setTaskType(nextType);
    setPrompt(TASK_PLACEHOLDERS[nextType].prompt);
    setEssay(TASK_PLACEHOLDERS[nextType].essay);
    setResult(null);
    clearError();
    setActiveEditIndex(null);
    const params = new URLSearchParams(window.location.search);
    params.set("task", nextType);
    params.set("lang", locale);
    window.history.replaceState({}, "", `/checker?${params.toString()}`);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionReady) {
      return;
    }
    setLoading(true);
    clearError();

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
          showError(t.genericError, "auth");
          return;
        }

        if (isErrorPayload(data) && data.error === "INSUFFICIENT_ENERGY") {
          if ("energy" in data && data.energy) {
            setEnergy(data.energy);
          }
          showError(t.insufficientEnergy);
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
      showError(submissionError instanceof Error ? submissionError.message : t.genericError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="pageShell">
      <div className="pageBackdrop" aria-hidden="true">
        <span className="backdropOrb orbOne" />
        <span className="backdropOrb orbTwo" />
        <span className="backdropGrid" />
      </div>

      {error && errorSource === "auth" ? (
        <div className="topErrorBanner" role="alert" aria-live="polite">
          <span>{error}</span>
          <button type="button" className="topErrorDismiss" onClick={clearError} aria-label={t.authClose}>
            {t.authClose}
          </button>
        </div>
      ) : null}

      <AppNavbar locale={locale} onLocaleChange={setLocale} copy={t} onSessionUpdated={refreshSessionContext} />

      <section className="checkerIntro">
        <Surface className="checkerIntroCard">
          <p className="eyebrow">{t.heroEyebrow}</p>
          <h1>{t.heroTitle}</h1>
          <p className="lede">{t.heroDescription}</p>
          <div className="checkerIntroMeta">
            <Pill>{t.task1}</Pill>
            <Pill>{t.task2}</Pill>
            <Pill>{t.providerDeepSeek}</Pill>
            <Pill>
              {t.energy}: {energy?.balance ?? "--"}
            </Pill>
          </div>
        </Surface>
      </section>

      <section className="workspace" id="workspace">
        <Surface as="form" className="editorPanel" onSubmit={handleSubmit}>
          <div className="panelHeading">
            <div>
              <p className="sectionLabel">{t.editorEyebrow}</p>
              <h2>{taskType === "task1" ? t.task1 : t.task2}</h2>
            </div>
            <div className="inlineMeta">
              <Pill>{t.providerDeepSeek}</Pill>
              <Pill>
                {t.wordCount}: {wordCount}
              </Pill>
            </div>
          </div>

          <div className="segmentedControl" role="tablist" aria-label={t.taskSwitcherAria}>
            <ActionButton
              variant="plain"
              className={taskType === "task1" ? "active" : ""}
              onClick={() => onTaskTypeChange("task1")}
            >
              {t.task1}
            </ActionButton>
            <ActionButton
              variant="plain"
              className={taskType === "task2" ? "active" : ""}
              onClick={() => onTaskTypeChange("task2")}
            >
              {t.task2}
            </ActionButton>
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
              {t.wordCount}: <strong>{wordCount}</strong>
            </p>
            <ActionButton type="submit" variant="primary" disabled={loading || !sessionReady}>
              {loading ? t.checking : t.checkWriting}
            </ActionButton>
          </div>

          {error && errorSource !== "auth" ? <p className="errorBox">{error}</p> : null}
        </Surface>

        <Surface as="section" className="resultsPanel">
          <div className="panelHeading resultPanelHeading">
            <div>
              <p className="sectionLabel">{t.resultEyebrow}</p>
              <h2>{result ? t.estimatedBand : t.emptyTitle}</h2>
            </div>
          </div>

          {result ? (
            <Surface className="reportPaper">
              <div className="resultHero">
                <div className="resultScore">
                  <p className="sectionLabel">{t.estimatedBand}</p>
                  <h2>{result.estimatedBand.toFixed(1)}</h2>
                </div>
                <div className="resultMeta">
                  <Pill>{result.taskType === "task1" ? t.task1 : t.task2}</Pill>
                  <Pill>
                    {locale === "zh-CN" ? "目标" : "Target"} {result.targetBand.toFixed(1)}
                  </Pill>
                  <Pill>
                    {result.wordCount} {locale === "zh-CN" ? "词" : "words"}
                  </Pill>
                  <Pill>{result.feedbackMode === "ai" ? t.aiMode : t.heuristicMode}</Pill>
                  <Pill>
                    {t.providerUsed}: {result.providerUsed}
                  </Pill>
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
            </Surface>
          ) : (
            <Surface className="emptyState">
              <p className="eyebrow">{t.ready}</p>
              <h2>{t.emptyTitle}</h2>
              <p>{t.emptyDescription}</p>
            </Surface>
          )}
        </Surface>
      </section>
    </main>
  );
}
