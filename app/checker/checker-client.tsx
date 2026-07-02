"use client";

import { ChangeEvent, DragEvent, FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppNavbar } from "@/components/app-navbar";
import { useAuthSession } from "@/lib/auth-client-session";
import { getMessages } from "@/lib/i18n/messages";
import { useRouteLocale } from "@/lib/i18n/use-route-locale";
import { ActionButton, ActionLink, Pill, Surface } from "@/components/ui-kit";
import type { AiProvider, FeedbackPayload, TargetBand, TaskType, WritingCheckResult } from "@/lib/types";
import {
  groupRevisionEditsByCategory,
  materializeRevisionEssay,
  parseAnnotatedEssay,
  renderAnnotatedEssay,
  type RevisionDecision,
  ScoreCard
} from "./checker-revision";

const TASK1_PLACEHOLDER = {
  prompt:
    "The table below gives information on consumer spending on different items in five different countries in 2002.",
  essay:
    "The table shows percentages of consumer expenditure for three categories of products and services in five countries in 2002.\n\nIt is clear that the largest proportion of consumer spending in each country went on food, drinks and tobacco.\n\nOn the other hand, the leisure/education category has the lowest percentages in the table. Out of the five countries, consumer spending on food, drinks and tobacco was noticeably higher in Turkey, at 32.14%, and Ireland, at nearly 29%. The proportion of spending on leisure and education was also highest in Turkey, at 4.35%, while expenditure on clothing and footwear was significantly higher in Italy, at 9%, than in any of the other countries.\n\nIt can be seen that Sweden had the lowest percentages of national consumer expenditure for food/drinks/tobacco and for clothing/footwear, at nearly 16% and just over 5% respectively. Spain had slightly higher figures for these categories, but the lowest figure for leisure/education, at only 1.98%."
};


const TASK2_PLACEHOLDER = {
  prompt:
    "Some people believe that unpaid community service should be a compulsory part of high school programmes. To what extent do you agree or disagree?",
  essay:
    "Some people thinks unpaid community service should be compulsory in high school programmes, I am agree with this opinion because it can helps students become more responsibility and know the society better.\n\nFirstly, students nowadays is always study in classroom and they dont have many chance to touch real life, so community service are a good ways for them to learning how other people live. For example help old peoples in a care home or cleaning the streets can let student understand the value of hard working. This kind of activity also make them more kindness, and they will not only thinking about themself.\n\nSecondly, unpaid work can improving many useful skills, such as communicate with others, teamwork and solve problems. When students join in a charity event, they need talk with different people and maybe organize some small things, these experience is very helpful for their future job. Also, if they only focus on exam, they may becomes selfish and lack of social ability.\n\nHowever some people may said compulsory community service is not good because students already have many homework and exams. This is true in some ways, but I think school can just ask them do few hours every month, it will not be too much pressure. If the activity is designed good, student will feel interesting and meaningful, not just a boring task.\n\nIn conclusion, I strongly agree unpaid community service should be a compulsory part of high school, because it teach students responsibility, kindness and useful skills. But school should not make it too heavy, otherwise students will hate it and the purpose will lost."
};

function isErrorPayload(value: unknown): value is { error?: string } {
  return typeof value === "object" && value !== null && "error" in value;
}

type EnergyState = {
  balance: number;
  totalConsumed: number;
  totalRecharged: number;
  updatedAt: string;
};

type ErrorSource = "auth" | "general";
type ReportView = "overview" | "revise";
type ReviseLayout = "split" | "stack";
type RevisionStageKey = "grammar" | "optimization";
type RevisionDecisions = Record<RevisionStageKey, Record<string, RevisionDecision>>;
type FeedbackChoice = "helpful" | "notHelpful";
type UploadedTaskImage = {
  objectKey: string;
  name: string;
  mimeType: string;
  fileSize: number;
  previewUrl: string;
};

type StoredCheckerDraft = {
  prompt: string;
  essay: string;
  targetBand: TargetBand;
  updatedAt: string;
};

type SessionCheckerDraft = StoredCheckerDraft & {
  taskImage: UploadedTaskImage | null;
};

type PendingTaskNavigation = {
  taskType: TaskType;
  href: string;
};

type LoadedDraftContext = {
  storageKey: string;
  scope: string;
  ownerId: string;
};

type PracticeQuestionPayload = {
  question: {
    id: string;
    taskType: TaskType;
    title: string;
    tags: string[];
    prompt: string;
    imageObjectKey: string | null;
    imageName: string | null;
    imageMimeType: string | null;
    imageSizeBytes: number | null;
  };
};

const TASK1_UPLOAD_LIMIT_BYTES = 8 * 1024 * 1024;
const TASK1_COMPRESSION_THRESHOLD_BYTES = 1.2 * 1024 * 1024;
const TASK1_MAX_IMAGE_DIMENSION = 1800;
const TASK1_COMPRESSED_MIME_TYPE = "image/jpeg";
const TASK1_COMPRESSED_QUALITY = 0.85;
const DRAFT_STORAGE_PREFIX = "ielts-writing-checker:draft:v1";
const DRAFT_SAVE_DELAY_MS = 600;

function getDraftStorageScope(taskType: TaskType, practiceId: string | null) {
  return practiceId ? `practice:${practiceId}:${taskType}` : `freeform:${taskType}`;
}

function getDraftStorageKey(ownerId: string, taskType: TaskType, practiceId: string | null) {
  return `${DRAFT_STORAGE_PREFIX}:user:${encodeURIComponent(ownerId)}:${getDraftStorageScope(taskType, practiceId)}`;
}

function isTargetBand(value: unknown): value is TargetBand {
  return value === 5 || value === 5.5 || value === 6 || value === 6.5 || value === 7 || value === 7.5 || value === 8;
}

function readStoredDraft(storageKey: string): StoredCheckerDraft | null {
  try {
    const rawDraft = window.localStorage.getItem(storageKey);
    if (!rawDraft) {
      return null;
    }

    const draft = JSON.parse(rawDraft) as Partial<StoredCheckerDraft>;
    if (typeof draft.prompt !== "string" || typeof draft.essay !== "string" || !isTargetBand(draft.targetBand)) {
      return null;
    }

    return {
      prompt: draft.prompt,
      essay: draft.essay,
      targetBand: draft.targetBand,
      updatedAt: typeof draft.updatedAt === "string" ? draft.updatedAt : new Date().toISOString()
    };
  } catch {
    return null;
  }
}

async function readResponseError(response: Response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) {
        return data.error;
      }
    } catch {
      return `HTTP_${response.status}`;
    }
  }

  try {
    const text = (await response.text()).trim();
    return text ? `HTTP_${response.status}:${text.slice(0, 160)}` : `HTTP_${response.status}`;
  } catch {
    return `HTTP_${response.status}`;
  }
}

function CheckerPageContent() {
  const { sessionContext, sessionResolved, refreshSessionContext: refreshAuthSessionContext } = useAuthSession();
  const reviseWorkspaceRef = useRef<HTMLElement | null>(null);
  const reportSectionRef = useRef<HTMLDivElement | null>(null);
  const taskImageInputRef = useRef<HTMLInputElement | null>(null);
  const checkRequestIdRef = useRef<string | null>(null);
  const sessionDraftsRef = useRef(new Map<string, SessionCheckerDraft>());
  const draftSnapshotRef = useRef<Omit<SessionCheckerDraft, "updatedAt">>({
    prompt: "",
    essay: "",
    targetBand: 6.5,
    taskImage: null
  });
  const loadedDraftContextRef = useRef<LoadedDraftContext | null>(null);
  const [locale, setLocale] = useRouteLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const practiceId = searchParams.get("practiceId");
  const provider: AiProvider = "deepseek";
  const [taskType, setTaskType] = useState<TaskType>(searchParams.get("task") === "task1" ? "task1" : "task2");
  const [targetBand, setTargetBand] = useState<TargetBand>(6.5);
  const [prompt, setPrompt] = useState("");
  const [essay, setEssay] = useState("");
  const [taskImage, setTaskImage] = useState<UploadedTaskImage | null>(null);
  const [taskImageUploading, setTaskImageUploading] = useState(false);
  const [taskImageDragActive, setTaskImageDragActive] = useState(false);
  const [result, setResult] = useState<WritingCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorSource, setErrorSource] = useState<ErrorSource>("general");
  const [loading, setLoading] = useState(false);
  const [activeEditIndex, setActiveEditIndex] = useState<number | null>(null);
  const [activeRevisionStage, setActiveRevisionStage] = useState<RevisionStageKey>("grammar");
  const [energy, setEnergy] = useState<EnergyState | null>(sessionContext.energy as EnergyState | null);
  const [reviewCost, setReviewCost] = useState(sessionContext.reviewCost ?? 1);
  const [authRequest, setAuthRequest] = useState<{ mode: "signIn" | "signUp"; id: number } | null>(null);
  const [pendingReviewAfterAuth, setPendingReviewAfterAuth] = useState(false);
  const [promptEditing, setPromptEditing] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [loadExampleDialogOpen, setLoadExampleDialogOpen] = useState(false);
  const [pendingTaskNavigation, setPendingTaskNavigation] = useState<PendingTaskNavigation | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [draftDirty, setDraftDirty] = useState(false);
  const [reportView, setReportView] = useState<ReportView>("overview");
  const [reviseLayout, setReviseLayout] = useState<ReviseLayout>("split");
  const [feedbackChoice, setFeedbackChoice] = useState<FeedbackChoice | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [exportingRevision, setExportingRevision] = useState(false);
  const [expandedRevisionCategories, setExpandedRevisionCategories] = useState<Record<string, boolean>>({});
  const [revisionCategoryFilter, setRevisionCategoryFilter] = useState("all");
  const [revisionDecisions, setRevisionDecisions] = useState<RevisionDecisions>({
    grammar: {},
    optimization: {}
  });
  const [revisionCopyState, setRevisionCopyState] = useState<"idle" | "copied" | "error">("idle");

  const { checker: t, navbar } = getMessages(locale);
  const sessionReady = sessionResolved;
  const isAuthenticated = Boolean(sessionContext.user);
  const wordCount = essay.trim() ? essay.trim().split(/\s+/).length : 0;
  const minimumWordCount = taskType === "task1" ? 150 : 250;
  const remainingWordCount = Math.max(0, minimumWordCount - wordCount);
  const wordCountProgress = Math.min(100, Math.round((wordCount / minimumWordCount) * 100));
  const wordCountTone = remainingWordCount > 0 ? "low" : "ready";
  const promptEditLabel = promptEditing ? t.doneEditing : t.editPrompt;
  const currentRevisionStage = useMemo(
    () =>
      result == null
        ? null
        : activeRevisionStage === "grammar"
          ? (result.grammarRevision ?? {
              annotatedEssay: result.annotatedEssay,
              correctionNotes: result.correctionNotes
            })
          : (result.optimizationRevision ?? {
              annotatedEssay: result.annotatedEssay,
              correctionNotes: result.correctionNotes
            }),
    [activeRevisionStage, result]
  );
  const parsedRevision = useMemo(
    () =>
      currentRevisionStage
        ? parseAnnotatedEssay(currentRevisionStage.annotatedEssay, currentRevisionStage.correctionNotes)
        : null,
    [currentRevisionStage]
  );
  const groupedRevisionEdits = useMemo(
    () => (parsedRevision ? groupRevisionEditsByCategory(parsedRevision.edits, locale) : []),
    [parsedRevision, locale]
  );
  const filteredRevisionGroups = useMemo(
    () =>
      revisionCategoryFilter === "all"
        ? groupedRevisionEdits
        : groupedRevisionEdits.filter((group) => group.key === revisionCategoryFilter),
    [groupedRevisionEdits, revisionCategoryFilter]
  );
  const filteredRevisionEdits = useMemo(
    () => filteredRevisionGroups.flatMap((group) => group.edits).sort((left, right) => left.index - right.index),
    [filteredRevisionGroups]
  );
  const currentRevisionDecisions = revisionDecisions[activeRevisionStage];
  const revisionDecisionCount =
    parsedRevision?.edits.filter((edit) => currentRevisionDecisions[edit.id] != null).length ?? 0;
  const acceptedRevisionCount =
    parsedRevision?.edits.filter((edit) => currentRevisionDecisions[edit.id] === "accepted").length ?? 0;
  const revisionTotalCount = parsedRevision?.edits.length ?? 0;
  const activeFilteredEditPosition =
    activeEditIndex === null
      ? -1
      : filteredRevisionEdits.findIndex((edit) => edit.index === activeEditIndex);
  const resolvedRevisionEssay = useMemo(
    () =>
      currentRevisionStage
        ? materializeRevisionEssay(
            currentRevisionStage.annotatedEssay,
            currentRevisionStage.correctionNotes,
            currentRevisionDecisions
          )
        : essay,
    [currentRevisionDecisions, currentRevisionStage, essay]
  );
  const isTask1 = taskType === "task1";
  const draftOwnerId = sessionContext.user?.id ?? "guest";
  const currentDraftScope = useMemo(
    () => getDraftStorageScope(taskType, practiceId),
    [practiceId, taskType]
  );
  const currentDraftStorageKey = useMemo(
    () => getDraftStorageKey(draftOwnerId, taskType, practiceId),
    [draftOwnerId, practiceId, taskType]
  );
  draftSnapshotRef.current = {
    prompt,
    essay,
    targetBand,
    taskImage
  };

  const persistCurrentDraft = useCallback((storageKey: string) => {
    const snapshot = draftSnapshotRef.current;
    const draft: SessionCheckerDraft = {
      ...snapshot,
      updatedAt: new Date().toISOString()
    };

    sessionDraftsRef.current.set(storageKey, draft);

    try {
      const storedDraft: StoredCheckerDraft = {
        prompt: draft.prompt,
        essay: draft.essay,
        targetBand: draft.targetBand,
        updatedAt: draft.updatedAt
      };
      window.localStorage.setItem(storageKey, JSON.stringify(storedDraft));
      setDraftDirty(false);
    } catch {
      // Keep the in-memory draft available for task switches when storage is unavailable.
    }
  }, []);

  const getAvailableDraft = useCallback((storageKey: string) => {
    const sessionDraft = sessionDraftsRef.current.get(storageKey);
    if (sessionDraft) {
      return sessionDraft;
    }

    const storedDraft = readStoredDraft(storageKey);
    return storedDraft ? { ...storedDraft, taskImage: null } : null;
  }, []);

  const prepareDraft = useCallback((storageKey: string, scope: string) => {
    const previousContext = loadedDraftContextRef.current;
    if (previousContext && previousContext.storageKey !== storageKey) {
      persistCurrentDraft(previousContext.storageKey);
    }

    let draft = getAvailableDraft(storageKey);
    if (!draft) {
      const legacyStorageKey = `${DRAFT_STORAGE_PREFIX}:${scope}`;
      const legacyDraft = readStoredDraft(legacyStorageKey);

      if (legacyDraft) {
        draft = { ...legacyDraft, taskImage: null };
        sessionDraftsRef.current.set(storageKey, draft);

        try {
          window.localStorage.setItem(storageKey, JSON.stringify(legacyDraft));
          window.localStorage.removeItem(legacyStorageKey);
        } catch {
          // Keep the migrated draft in memory when storage is unavailable.
        }
      }
    }

    const shouldAdoptGuestDraft =
      !draft &&
      previousContext?.ownerId === "guest" &&
      draftOwnerId !== "guest" &&
      previousContext.scope === scope;

    if (shouldAdoptGuestDraft) {
      persistCurrentDraft(storageKey);
      draft = getAvailableDraft(storageKey);
    }

    loadedDraftContextRef.current = {
      storageKey,
      scope,
      ownerId: draftOwnerId
    };

    return draft;
  }, [draftOwnerId, getAvailableDraft, persistCurrentDraft]);

  function markDraftDirty() {
    setDraftDirty(true);
  }

  function applyExampleDraft() {
    const example = taskType === "task1" ? TASK1_PLACEHOLDER : TASK2_PLACEHOLDER;
    if (taskImage) {
      clearTask1Image();
    }
    setPrompt(example.prompt);
    setEssay(example.essay);
    setPromptEditing(false);
    setResult(null);
    setLoadExampleDialogOpen(false);
    markDraftDirty();
  }

  function requestExampleDraft() {
    if (!prompt.trim() && !essay.trim() && !taskImage) {
      applyExampleDraft();
      return;
    }

    setLoadExampleDialogOpen(true);
  }

  function handleTaskNavigate(nextTaskType: TaskType, href: string) {
    if (nextTaskType === taskType && !practiceId) {
      return;
    }

    if (draftDirty) {
      setPendingTaskNavigation({ taskType: nextTaskType, href });
      return;
    }

    persistCurrentDraft(currentDraftStorageKey);
    router.push(href);
  }

  function confirmTaskNavigation() {
    if (!pendingTaskNavigation) {
      return;
    }

    const { href } = pendingTaskNavigation;
    persistCurrentDraft(currentDraftStorageKey);
    setPendingTaskNavigation(null);
    router.push(href);
  }

  function clearError() {
    setError(null);
    setErrorSource("general");
  }

  function showError(message: string, source: ErrorSource = "general") {
    setError(message);
    setErrorSource(source);
  }

  useEffect(() => {
    const nextTask = searchParams.get("task") === "task1" ? "task1" : "task2";
    setTaskType(nextTask);
  }, [searchParams]);

  useEffect(() => {
    if (practiceId || !sessionReady) {
      return;
    }

    setDraftReady(false);
    setResult(null);
    setActiveEditIndex(null);
    setActiveRevisionStage("grammar");
    setFeedbackChoice(null);
    setFeedbackComment("");
    setFeedbackSubmitted(false);
    setFeedbackError(null);
    const draft = prepareDraft(currentDraftStorageKey, currentDraftScope);
    setPrompt(draft?.prompt ?? "");
    setEssay(draft?.essay ?? "");
    setTargetBand(draft?.targetBand ?? 6.5);
    setTaskImage(draft?.taskImage ?? null);
    setPromptEditing(!draft?.prompt);
    setDraftDirty(false);
    setDraftReady(true);
  }, [currentDraftScope, currentDraftStorageKey, practiceId, prepareDraft, sessionReady, taskType]);

  useEffect(() => {
    if (!practiceId || !sessionReady) {
      return;
    }

    let cancelled = false;
    setDraftReady(false);

    async function loadPracticeQuestion() {
      clearError();

      try {
        const response = await fetch(`/api/practice/questions/${encodeURIComponent(practiceId || "")}`, {
          cache: "no-store"
        });
        const data = (await response.json()) as PracticeQuestionPayload | { error?: string };

        if (!response.ok || !("question" in data)) {
          throw new Error("PRACTICE_QUESTION_LOAD_FAILED");
        }

        if (cancelled) {
          return;
        }

        const question = data.question;
        const practiceDraftScope = getDraftStorageScope(question.taskType, practiceId);
        const practiceDraftKey = getDraftStorageKey(draftOwnerId, question.taskType, practiceId);
        const savedDraft = prepareDraft(practiceDraftKey, practiceDraftScope);
        const questionImage =
          question.taskType === "task1" && question.imageObjectKey && question.imageName && question.imageMimeType
            ? {
                objectKey: question.imageObjectKey,
                name: question.imageName,
                mimeType: question.imageMimeType,
                fileSize: question.imageSizeBytes ?? 0,
                previewUrl: `/api/practice/questions/${encodeURIComponent(question.id)}/image`
              }
            : null;

        setTaskType(question.taskType);
        setPrompt(savedDraft?.prompt ?? question.prompt);
        setEssay(savedDraft?.essay ?? "");
        setTargetBand(savedDraft?.targetBand ?? 6.5);
        setPromptEditing(false);
        setResult(null);
        setActiveEditIndex(null);
        setActiveRevisionStage("grammar");
        setFeedbackChoice(null);
        setFeedbackComment("");
        setFeedbackSubmitted(false);
        setFeedbackError(null);
        setTaskImage(savedDraft?.taskImage ?? questionImage);
        setDraftDirty(false);
      } catch {
        if (!cancelled) {
          showError(t.genericError);
        }
      } finally {
        if (!cancelled) {
          setDraftReady(true);
        }
      }
    }

    void loadPracticeQuestion();

    return () => {
      cancelled = true;
    };
  }, [draftOwnerId, practiceId, prepareDraft, sessionReady, t.authRequired, t.genericError]);

  useEffect(() => {
    const sessionDrafts = sessionDraftsRef.current;
    return () => {
      for (const draft of sessionDrafts.values()) {
        if (draft.taskImage?.previewUrl.startsWith("blob:")) {
          window.URL.revokeObjectURL(draft.taskImage.previewUrl);
        }
      }
    };
  }, []);

  useEffect(() => {
    setEnergy(sessionContext.energy as EnergyState | null);
    setReviewCost(sessionContext.reviewCost ?? 1);
  }, [sessionContext.energy, sessionContext.reviewCost]);

  useEffect(() => {
    if (!draftReady) {
      return;
    }

    const timer = window.setTimeout(() => {
      persistCurrentDraft(currentDraftStorageKey);
    }, DRAFT_SAVE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [currentDraftStorageKey, draftReady, essay, persistCurrentDraft, prompt, targetBand, taskImage]);

  useEffect(() => {
    function handleBeforeUnload() {
      if (draftReady && draftDirty) {
        persistCurrentDraft(currentDraftStorageKey);
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [currentDraftStorageKey, draftDirty, draftReady, essay, persistCurrentDraft, prompt, targetBand, taskImage]);

  async function loadImageElement(file: Blob) {
    const objectUrl = window.URL.createObjectURL(file);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error("IMAGE_LOAD_FAILED"));
        element.src = objectUrl;
      });

      return image;
    } finally {
      window.URL.revokeObjectURL(objectUrl);
    }
  }

  async function compressTask1Image(file: File) {
    if (file.size < TASK1_COMPRESSION_THRESHOLD_BYTES) {
      return file;
    }

    const image = await loadImageElement(file);
    const longestSide = Math.max(image.naturalWidth, image.naturalHeight);

    if (longestSide <= TASK1_MAX_IMAGE_DIMENSION && file.type === TASK1_COMPRESSED_MIME_TYPE) {
      return file;
    }

    const scale = Math.min(1, TASK1_MAX_IMAGE_DIMENSION / longestSide);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("IMAGE_COMPRESS_FAILED");
    }

    context.drawImage(image, 0, 0, width, height);

    const compressedBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
            return;
          }

          reject(new Error("IMAGE_COMPRESS_FAILED"));
        },
        TASK1_COMPRESSED_MIME_TYPE,
        TASK1_COMPRESSED_QUALITY
      );
    });

    const baseName = file.name.replace(/\.[^.]+$/, "") || "task1-image";
    const compressedName = file.type === TASK1_COMPRESSED_MIME_TYPE ? file.name : `${baseName}.jpg`;

    return new File([compressedBlob], compressedName, {
      type: TASK1_COMPRESSED_MIME_TYPE,
      lastModified: file.lastModified
    });
  }

  useEffect(() => {
    if (activeEditIndex === null) {
      return;
    }

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (!reviseWorkspaceRef.current) {
        return;
      }

      const target = event.target;
      if (target instanceof Node && !reviseWorkspaceRef.current.contains(target)) {
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
    if (!groupedRevisionEdits.length) {
      setExpandedRevisionCategories((current) => (Object.keys(current).length ? {} : current));
      return;
    }

    setExpandedRevisionCategories((current) => {
      const next: Record<string, boolean> = {};

      groupedRevisionEdits.forEach((group, index) => {
        next[group.key] = current[group.key] ?? index === 0;
      });

      const currentKeys = Object.keys(current);
      const nextKeys = Object.keys(next);
      if (
        currentKeys.length === nextKeys.length &&
        nextKeys.every((key) => current[key] === next[key])
      ) {
        return current;
      }

      return next;
    });
  }, [groupedRevisionEdits]);

  useEffect(() => {
    if (activeEditIndex === null || !parsedRevision) {
      return;
    }

    const activeEdit = parsedRevision.edits.find((edit) => edit.index === activeEditIndex);
    const activeCategory = activeEdit?.note?.category?.trim() || "other";

    setExpandedRevisionCategories((current) =>
      current[activeCategory]
        ? current
        : {
            ...current,
            [activeCategory]: true
          }
    );

    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-revise-card-index="${activeEditIndex}"]`)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, [activeEditIndex, parsedRevision]);

  useEffect(() => {
    if (
      revisionCategoryFilter !== "all" &&
      !groupedRevisionEdits.some((group) => group.key === revisionCategoryFilter)
    ) {
      setRevisionCategoryFilter("all");
      return;
    }

    if (
      activeEditIndex !== null &&
      !filteredRevisionEdits.some((edit) => edit.index === activeEditIndex)
    ) {
      setActiveEditIndex(null);
    }
  }, [activeEditIndex, filteredRevisionEdits, groupedRevisionEdits, revisionCategoryFilter]);

  useEffect(() => {
    if (!result || !reportSectionRef.current) {
      return;
    }

    window.requestAnimationFrame(() => {
      reportSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  }, [result]);

  useEffect(() => {
    if (!result) {
      return;
    }

    setReportView("overview");
    setReviseLayout("split");
    setActiveEditIndex(null);
    setActiveRevisionStage("grammar");
    setRevisionCategoryFilter("all");
    setRevisionDecisions({
      grammar: {},
      optimization: {}
    });
    setRevisionCopyState("idle");
    setFeedbackChoice(null);
    setFeedbackComment("");
    setFeedbackSubmitting(false);
    setFeedbackSubmitted(false);
    setFeedbackError(null);
  }, [result]);

  useEffect(() => {
    if (!confirmDialogOpen && !loadExampleDialogOpen && !pendingTaskNavigation) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setConfirmDialogOpen(false);
        setLoadExampleDialogOpen(false);
        setPendingTaskNavigation(null);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [confirmDialogOpen, loadExampleDialogOpen, pendingTaskNavigation]);

  useEffect(() => {
    if (isAuthenticated && errorSource === "auth") {
      clearError();
    }
  }, [errorSource, isAuthenticated]);

  async function syncSessionDerivedState() {
    const nextContext = await refreshAuthSessionContext();
    setEnergy(nextContext.energy as EnergyState | null);
    setReviewCost(nextContext.reviewCost ?? 1);
  }

  async function runCheck() {
    setLoading(true);
    clearError();
    const requestId = checkRequestIdRef.current || window.crypto.randomUUID();
    checkRequestIdRef.current = requestId;

    try {
      const response = await fetch("/api/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": requestId
        },
        body: JSON.stringify({
          ...(practiceId ? { practiceId } : {}),
          taskType,
          provider,
          locale,
          targetBand,
          prompt,
          essay,
          taskImageObjectKey: taskImage?.objectKey,
          taskImageName: taskImage?.name
        })
      });

      const data = (await response.json()) as
        | {
            result: WritingCheckResult;
            energy: EnergyState;
            cost: number;
          }
        | { error?: string; energy?: EnergyState; cost?: number };

      if (response.ok || !isErrorPayload(data) || data.error !== "REVIEW_IN_PROGRESS") {
        checkRequestIdRef.current = null;
      }

      if (!response.ok) {
        if (response.status === 401) {
          await syncSessionDerivedState();
          showError(t.authRequired, "auth");
          return;
        }

        if (isErrorPayload(data) && data.error === "INSUFFICIENT_ENERGY") {
          if ("energy" in data && data.energy) {
            setEnergy(data.energy);
          }
          showError(t.insufficientEnergy);
          return;
        }

        if (
          isErrorPayload(data) &&
          (data.error === "AI_REVIEW_FAILED" || data.error === "AI_REVIEW_TIMEOUT")
        ) {
          window.alert(t.aiReviewFailedAlert);
          return;
        }

        if (isErrorPayload(data) && data.error === "REVIEW_IMAGE_STORAGE_NOT_CONFIGURED") {
          showError(t.task1HistoryStorageError);
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

  async function processTask1Image(file: File) {
    if (!file.type.startsWith("image/")) {
      showError(t.task1ImageTypeError);
      if (taskImageInputRef.current) {
        taskImageInputRef.current.value = "";
      }
      return;
    }

    if (file.size > TASK1_UPLOAD_LIMIT_BYTES) {
      showError(t.task1ImageSizeError);
      if (taskImageInputRef.current) {
        taskImageInputRef.current.value = "";
      }
      return;
    }

    setTaskImageUploading(true);
    clearError();

    try {
      const uploadFile = await compressTask1Image(file);
      const signResponse = await fetch("/api/review-images/upload-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fileName: uploadFile.name,
          mimeType: uploadFile.type || TASK1_COMPRESSED_MIME_TYPE,
          fileSize: uploadFile.size
        })
      });
      const signData = (await signResponse.json()) as
        | {
            objectKey: string;
            uploadUrl: string;
            headers?: Record<string, string>;
          }
        | { error?: string };

      if (!signResponse.ok || !("uploadUrl" in signData)) {
        throw new Error(("error" in signData && signData.error) || (await readResponseError(signResponse)) || "UPLOAD_URL_FAILED");
      }

      const uploadResponse = await fetch(signData.uploadUrl, {
        method: "PUT",
        headers: signData.headers || {
          "Content-Type": uploadFile.type || TASK1_COMPRESSED_MIME_TYPE
        },
        body: uploadFile
      });

      if (!uploadResponse.ok) {
        throw new Error((await readResponseError(uploadResponse)) || "UPLOAD_FAILED");
      }

      const previewUrl = window.URL.createObjectURL(uploadFile);
      if (taskImage?.previewUrl) {
        window.URL.revokeObjectURL(taskImage.previewUrl);
      }
      setTaskImage({
        objectKey: signData.objectKey,
        name: uploadFile.name,
        mimeType: uploadFile.type || TASK1_COMPRESSED_MIME_TYPE,
        fileSize: uploadFile.size,
        previewUrl
      });
      markDraftDirty();
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "UPLOAD_FAILED";
      if (message === "MEDIA_UPLOAD_LIMIT_REACHED" || message === "MEDIA_UPLOADS_BLOCKED") {
        showError(t.task1ImageQuotaError);
      } else if (message === "UNAUTHORIZED") {
        showError(t.authRequired, "auth");
      } else if (message === "REVIEW_IMAGE_STORAGE_NOT_CONFIGURED") {
        showError(t.task1HistoryStorageError);
      } else if (
        message === "IMAGE_LOAD_FAILED" ||
        message === "IMAGE_COMPRESS_FAILED"
      ) {
        showError(t.task1ImageReadError);
      } else {
        showError(t.task1ImageUploadError);
      }
      if (taskImageInputRef.current) {
        taskImageInputRef.current.value = "";
      }
    } finally {
      setTaskImageUploading(false);
    }
  }

  async function handleTask1ImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    await processTask1Image(file);
  }

  function handleTask1ImageDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setTaskImageDragActive(false);

    if (taskImageUploading) {
      return;
    }

    const file = event.dataTransfer.files?.[0];
    if (file) {
      void processTask1Image(file);
    }
  }

  function clearTask1Image() {
    if (taskImage?.previewUrl) {
      window.URL.revokeObjectURL(taskImage.previewUrl);
    }
    setTaskImage(null);
    markDraftDirty();
    if (taskImageInputRef.current) {
      taskImageInputRef.current.value = "";
    }
  }

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!result || !feedbackChoice || feedbackSubmitting || feedbackSubmitted) {
      return;
    }

    setFeedbackSubmitting(true);
    setFeedbackError(null);

    const payload: FeedbackPayload = {
      kind: "review",
      helpful: feedbackChoice === "helpful",
      comment: feedbackComment.trim(),
      page: "/checker",
      taskType: result.taskType,
      targetBand: result.targetBand,
      providerUsed: result.providerUsed,
      feedbackMode: result.feedbackMode,
      estimatedBand: result.estimatedBand,
      wordCount: result.wordCount,
      context: {
        uid: sessionContext.user?.id ?? null,
        strengthCount: result.strengths.length,
        priorityFixCount: result.priorityFixes.length,
        correctionCount: result.correctionNotes.length,
        highlightedSentenceCount: result.highlightedSentences.length
      }
    };

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "REQUEST_FAILED");
      }

      setFeedbackSubmitted(true);
    } catch {
      setFeedbackError(t.genericError);
    } finally {
      setFeedbackSubmitting(false);
    }
  }

  async function exportRevisionDoc() {
    if (!result || exportingRevision) {
      return;
    }

    setExportingRevision(true);

    try {
      const response = await fetch("/api/export/revision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt,
          essay,
          locale,
          result
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "EXPORT_FAILED");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `ielts-writing-revision-${new Date().toISOString().slice(0, 10)}.docx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      showError(t.exportRevisionFailed);
    } finally {
      setExportingRevision(false);
    }
  }

  function updateRevisionDecision(editId: string, decision: RevisionDecision) {
    setRevisionDecisions((current) => ({
      ...current,
      [activeRevisionStage]: {
        ...current[activeRevisionStage],
        [editId]: decision
      }
    }));
    setRevisionCopyState("idle");
  }

  function navigateRevision(direction: "previous" | "next") {
    if (!filteredRevisionEdits.length) {
      return;
    }

    const nextPosition =
      activeFilteredEditPosition === -1
        ? direction === "next"
          ? 0
          : filteredRevisionEdits.length - 1
        : activeFilteredEditPosition + (direction === "next" ? 1 : -1);
    const nextEdit = filteredRevisionEdits[nextPosition];

    if (nextEdit) {
      setActiveEditIndex(nextEdit.index);
    }
  }

  function acceptAllGrammarRevisions() {
    if (activeRevisionStage !== "grammar" || !parsedRevision) {
      return;
    }

    const accepted = Object.fromEntries(
      parsedRevision.edits.map((edit) => [edit.id, "accepted" as const])
    );
    setRevisionDecisions((current) => ({
      ...current,
      grammar: accepted
    }));
    setRevisionCopyState("idle");
  }

  async function copyResolvedRevision() {
    try {
      await navigator.clipboard.writeText(resolvedRevisionEssay);
      setRevisionCopyState("copied");
      window.setTimeout(() => setRevisionCopyState("idle"), 1800);
    } catch {
      setRevisionCopyState("error");
    }
  }

  function continueWithResolvedRevision() {
    if (!acceptedRevisionCount) {
      return;
    }

    setEssay(resolvedRevisionEssay);
    setResult(null);
    setReportView("overview");
    setActiveEditIndex(null);
    markDraftDirty();

    window.requestAnimationFrame(() => {
      const editor = document.querySelector<HTMLTextAreaElement>(".checkerEssayInput");
      editor?.scrollIntoView({ behavior: "smooth", block: "center" });
      editor?.focus();
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionReady || loading) {
      return;
    }

    if (!isAuthenticated) {
      persistCurrentDraft(currentDraftStorageKey);
      setPendingReviewAfterAuth(true);
      showError(t.authRequired, "auth");
      setAuthRequest({ mode: "signIn", id: Date.now() });
      return;
    }

    if (taskType === "task1" && !taskImage) {
      showError(t.task1ImageRequired);
      return;
    }

    setConfirmDialogOpen(true);
  }

  const handleSessionUpdated = useCallback(() => {
    if (!pendingReviewAfterAuth) {
      return;
    }

    setPendingReviewAfterAuth(false);
    setError(null);
    setErrorSource("general");

    if (isTask1 && !taskImage) {
      setError(t.task1ImageRequired);
      return;
    }

    setConfirmDialogOpen(true);
  }, [isTask1, pendingReviewAfterAuth, t.task1ImageRequired, taskImage]);

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
          <div className="topErrorActions">
            <button
              type="button"
              className="topErrorDismiss"
              onClick={() => setAuthRequest({ mode: "signIn", id: Date.now() })}
            >
              {t.authRequiredLogin}
            </button>
            <button
              type="button"
              className="topErrorDismiss"
              onClick={() => setAuthRequest({ mode: "signUp", id: Date.now() })}
            >
              {t.authRequiredSignUp}
            </button>
            <button type="button" className="topErrorDismiss" onClick={clearError} aria-label={navbar.authClose}>
              {navbar.authClose}
            </button>
          </div>
        </div>
      ) : null}

      {loadExampleDialogOpen ? (
        <div className="authDialogBackdrop" onClick={() => setLoadExampleDialogOpen(false)}>
          <Surface
            className="authDialog confirmDialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="load-example-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="authDialogHeader confirmDialogHeader">
              <div className="authCardIntro confirmDialogIntro">
                <div>
                  <h2 id="load-example-title">{t.loadExampleConfirmTitle}</h2>
                  <p className="authHint">{t.loadExampleConfirmBody}</p>
                </div>
              </div>
              <button type="button" className="authDialogClose" onClick={() => setLoadExampleDialogOpen(false)}>
                <i className="ai-cross" aria-hidden="true" />
                <span className="srOnly">{navbar.authClose}</span>
              </button>
            </div>
            <section className="authCardInner confirmDialogBody">
              <div className="confirmDialogActions">
                <ActionButton type="button" variant="secondary" onClick={() => setLoadExampleDialogOpen(false)}>
                  {t.loadExampleCancel}
                </ActionButton>
                <ActionButton type="button" variant="primary" onClick={applyExampleDraft}>
                  {t.loadExampleConfirm}
                </ActionButton>
              </div>
            </section>
          </Surface>
        </div>
      ) : null}

      {pendingTaskNavigation ? (
        <div className="authDialogBackdrop" onClick={() => setPendingTaskNavigation(null)}>
          <Surface
            className="authDialog confirmDialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="switch-task-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="authDialogHeader confirmDialogHeader">
              <div className="authCardIntro confirmDialogIntro">
                <div>
                  <h2 id="switch-task-title">{t.switchTaskConfirmTitle}</h2>
                  <p className="authHint">
                    {t.switchTaskConfirmBody.replace(
                      "{task}",
                      pendingTaskNavigation.taskType === "task1" ? navbar.task1 : navbar.task2
                    )}
                  </p>
                </div>
              </div>
              <button type="button" className="authDialogClose" onClick={() => setPendingTaskNavigation(null)}>
                <i className="ai-cross" aria-hidden="true" />
                <span className="srOnly">{navbar.authClose}</span>
              </button>
            </div>
            <section className="authCardInner confirmDialogBody">
              <div className="confirmDialogActions">
                <ActionButton type="button" variant="secondary" onClick={() => setPendingTaskNavigation(null)}>
                  {t.switchTaskCancel}
                </ActionButton>
                <ActionButton type="button" variant="primary" onClick={confirmTaskNavigation}>
                  {t.switchTaskConfirm}
                </ActionButton>
              </div>
            </section>
          </Surface>
        </div>
      ) : null}

      {confirmDialogOpen ? (
        <div className="authDialogBackdrop" onClick={() => setConfirmDialogOpen(false)}>
          <Surface className="authDialog confirmDialog" onClick={(event) => event.stopPropagation()}>
            <div className="authDialogHeader confirmDialogHeader">
              <div className="authCardIntro confirmDialogIntro">
                <div>
                  <h2>{t.confirmReviewTitle}</h2>
                  <p className="authHint">{t.confirmReviewBody}</p>
                </div>
              </div>
              <button type="button" className="authDialogClose" onClick={() => setConfirmDialogOpen(false)}>
                <i className="ai-cross" aria-hidden="true" />
                <span className="srOnly">{navbar.authClose}</span>
              </button>
            </div>

            <section className="authCardInner confirmDialogBody">
              <div className="confirmEnergyRow">
                <span>{t.energyCost}</span>
                <span className="confirmEnergyDivider" aria-hidden="true">
                  ·
                </span>
                <strong>
                  {reviewCost} {t.energyUnit}
                </strong>
              </div>

              <div className="confirmDialogActions">
                <ActionButton type="button" variant="secondary" onClick={() => setConfirmDialogOpen(false)}>
                  {t.confirmReviewCancel}
                </ActionButton>
                <ActionButton
                  type="button"
                  variant="primary"
                  onClick={() => {
                    setConfirmDialogOpen(false);
                    void runCheck();
                  }}
                >
                  {t.confirmReviewConfirm}
                </ActionButton>
              </div>
            </section>
          </Surface>
        </div>
      ) : null}

      <AppNavbar
        locale={locale}
        onLocaleChange={setLocale}
        copy={navbar}
        taskMenuMode="all"
        energyBalance={energy?.balance ?? null}
        energyLabel={t.energy}
        authRequest={authRequest}
        authHint={t.authDialogHint}
        onSessionUpdated={handleSessionUpdated}
        onTaskNavigate={handleTaskNavigate}
      />

      <section className="checkerStudio" id="workspace">
        <Surface as="form" className="checkerWorkbench" onSubmit={handleSubmit}>
          <div className="checkerTaskContext" aria-label={t.taskContextLabel}>
            <Pill>{isTask1 ? navbar.task1 : navbar.task2}</Pill>
            <div>
              <strong>{t.taskContextLabel}</strong>
              <span>{isTask1 ? t.task1ContextBody : t.task2ContextBody}</span>
            </div>
          </div>

          <div className="checkerField checkerPromptBlock">
            <div className="checkerPromptHeader">
              <span>{t.prompt}</span>
              <div className="checkerPromptControls">
                {!practiceId ? (
                  <>
                  <button type="button" className="checkerPromptEditButton" onClick={requestExampleDraft}>
                    {t.loadExample}
                  </button>
                    <button
                      type="button"
                      className="checkerPromptEditButton"
                      onClick={() => setPromptEditing((value) => !value)}
                      disabled={promptEditing && !prompt.trim()}
                    >
                      {promptEditLabel}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
            <div className="checkerPromptBody">
              {promptEditing && !practiceId ? (
                <textarea
                  value={prompt}
                  onChange={(event) => {
                    setPrompt(event.target.value);
                    markDraftDirty();
                  }}
                  rows={4}
                  placeholder={t.promptPlaceholder}
                />
              ) : (
                <p className="checkerPromptText">{prompt}</p>
              )}
            </div>
          </div>

          {isTask1 ? (
            <div className="checkerField checkerUploadBlock">
              <div className="checkerPromptHeader">
                <span>{t.task1ImageLabel}</span>
              </div>
              <div className="checkerPromptBody checkerUploadBody">
                {!practiceId ? <p className="checkerUploadHint">{t.task1ImageHint}</p> : null}
                {practiceId ? (
                  <div className={`checkerUploadDropzone is-readonly${taskImage ? " has-preview" : ""}`}>
                    {taskImage ? (
                      <>
                        {/* The source is an authenticated endpoint, so it must bypass Next's server image optimizer. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={taskImage.previewUrl} alt={t.task1ImageLabel} className="checkerUploadPreviewImage" />
                      </>
                    ) : (
                      <span className="checkerUploadReadonlyEmpty">{t.practiceImageUnavailable}</span>
                    )}
                  </div>
                ) : (
                  <label
                    className={`checkerUploadDropzone${taskImage ? " has-preview" : ""}${taskImageDragActive ? " is-dragging" : ""}${taskImageUploading ? " is-uploading" : ""}`}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      if (!taskImageUploading) {
                        setTaskImageDragActive(true);
                      }
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDragLeave={() => setTaskImageDragActive(false)}
                    onDrop={handleTask1ImageDrop}
                  >
                    <input
                      ref={taskImageInputRef}
                      className="srOnly"
                      type="file"
                      accept="image/*"
                      onChange={(event) => void handleTask1ImageChange(event)}
                      disabled={taskImageUploading}
                    />
                  {taskImage ? (
                    <>
                      {/* The source is a local blob or authenticated endpoint, so it must bypass Next's server image optimizer. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={taskImage.previewUrl} alt={t.task1ImageLabel} className="checkerUploadPreviewImage" />
                    </>
                  ) : (
                    <>
                      <span className="checkerUploadDropIcon" aria-hidden="true" />
                      <strong>{t.task1ImageDropTitle}</strong>
                      <span className="checkerUploadDropBody">{t.task1ImageDropBody}</span>
                    </>
                  )}
                  </label>
                )}
                {!practiceId && taskImageUploading ? <p className="checkerUploadStatus">{t.task1ImageProcessing}</p> : null}
              </div>
            </div>
          ) : null}

          <div className="checkerDraftPanel">
            <div className="checkerDraftHeader">
              <div>
                <h2>{t.essay}</h2>
                {draftReady ? (
                  <span className={`checkerDraftStatus${draftDirty ? " is-saving" : ""}`} aria-live="polite">
                    {draftDirty ? t.draftSaving : t.draftSaved}
                  </span>
                ) : null}
              </div>
              <div className="checkerTargetBandControl">
                <label className="checkerInlineSelect">
                  <span>{t.targetBand}</span>
                  <select
                    value={targetBand}
                    aria-describedby="target-band-hint"
                    onChange={(event) => {
                      setTargetBand(Number(event.target.value) as TargetBand);
                      markDraftDirty();
                    }}
                  >
                    <option value={5}>5.0</option>
                    <option value={5.5}>5.5</option>
                    <option value={6}>6.0</option>
                    <option value={6.5}>6.5</option>
                    <option value={7}>7.0</option>
                    <option value={7.5}>7.5</option>
                    <option value={8}>8.0</option>
                  </select>
                </label>
                <span id="target-band-hint" className="checkerTargetBandHint">
                  {t.targetBandHint}
                </span>
              </div>
            </div>

            {error && errorSource !== "auth" ? <p className="errorBox">{error}</p> : null}

            <label className="checkerEssayField">
              <span className="srOnly">{t.essay}</span>
              <textarea
                className="checkerEssayInput"
                value={essay}
                onChange={(event) => {
                  setEssay(event.target.value);
                  markDraftDirty();
                }}
                rows={24}
                placeholder={t.essayPlaceholder}
              />
            </label>

            <div className={`checkerDraftFooter${result ? "" : " is-mobile-sticky"}`}>
              <div className="checkerDraftMeta">
                {draftReady ? (
                  <span className={`checkerMobileDraftStatus${draftDirty ? " is-saving" : ""}`}>
                    {draftDirty ? t.draftSaving : t.draftSaved}
                  </span>
                ) : null}
                <div className={`checkerWordProgress is-${wordCountTone}`}>
                  <div className="checkerWordProgressHeader">
                    <span className={`checkerWordHint is-${wordCountTone}`}>
                      <strong>{wordCount}</strong>
                      <span>
                        / {minimumWordCount} {t.wordsUnit}
                      </span>
                    </span>
                    <span className="checkerWordGuidance">
                      {remainingWordCount > 0
                        ? t.wordCountRemaining.replace("{count}", String(remainingWordCount))
                        : t.wordCountReady}
                    </span>
                  </div>
                  <span
                    className="checkerWordProgressTrack"
                    role="progressbar"
                    aria-label={t.wordCountProgressLabel}
                    aria-valuemin={0}
                    aria-valuemax={minimumWordCount}
                    aria-valuenow={Math.min(wordCount, minimumWordCount)}
                  >
                    <span className="checkerWordProgressFill" style={{ width: `${wordCountProgress}%` }} />
                  </span>
                </div>
              </div>
              <ActionButton type="submit" variant="primary" disabled={loading || !sessionReady || !draftReady}>
                {loading ? t.checking : isAuthenticated ? t.checkWriting : t.checkWritingLocked}
              </ActionButton>
            </div>
          </div>
        </Surface>

        {result ? (
          <div ref={reportSectionRef}>
            <Surface as="section" className="checkerReportShell is-revealed">
            <Surface className="reportPaper checkerReportPaper">
              <div className="resultHero">
                <div className="resultScore">
                  <p className="sectionLabel">{t.estimatedBand}</p>
                  <h2>{result.estimatedBand.toFixed(1)}</h2>
                </div>
                <div className="resultHeroActions">
                  <div className="resultMeta">
                    <Pill>
                      {t.targetChipLabel} {result.targetBand.toFixed(1)}
                    </Pill>
                    <Pill>
                      {result.wordCount} {t.wordsUnit}
                    </Pill>
                    <Pill>{t.aiMode}</Pill>
                  </div>
                  <ActionLink href={`/${locale}/history`} variant="secondary">
                    {t.viewHistory}
                  </ActionLink>
                </div>
              </div>
              <div className="reportModeSwitch" role="tablist" aria-label="Review modes">
                <button
                  type="button"
                  className={`reportModeButton${reportView === "overview" ? " is-active" : ""}`}
                  onClick={() => setReportView("overview")}
                >
                  {t.overviewTab}
                </button>
                <button
                  type="button"
                  className={`reportModeButton${reportView === "revise" ? " is-active" : ""}`}
                  onClick={() => setReportView("revise")}
                >
                  {t.reviseTab}
                </button>
              </div>

              {reportView === "overview" ? (
                <>
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
                </>
              ) : (
                <section
                  className={`reviseWorkspace${reviseLayout === "stack" ? " is-stacked" : ""}`}
                  ref={reviseWorkspaceRef}
                >
                  <div className="reviseWorkbenchToolbar">
                    <div className="reviseProgressBlock">
                      <div className="reviseProgressHeader">
                        <span>{t.revisionProgress}</span>
                        <strong>
                          {revisionDecisionCount} / {revisionTotalCount}
                        </strong>
                      </div>
                      <progress
                        className="reviseProgress"
                        max={revisionTotalCount || 1}
                        value={revisionDecisionCount}
                        aria-label={t.revisionProgress}
                      />
                      <p>{t.revisionPendingKeepsOriginal}</p>
                    </div>
                    <div className="reviseWorkbenchActions">
                      {activeRevisionStage === "grammar" ? (
                        <ActionButton
                          type="button"
                          variant="secondary"
                          onClick={acceptAllGrammarRevisions}
                          disabled={!revisionTotalCount || revisionDecisionCount === revisionTotalCount}
                        >
                          {t.revisionAcceptAllGrammar}
                        </ActionButton>
                      ) : null}
                      <ActionButton
                        type="button"
                        variant="secondary"
                        onClick={() => void copyResolvedRevision()}
                        disabled={!acceptedRevisionCount}
                      >
                        {revisionCopyState === "copied"
                          ? t.revisionCopied
                          : revisionCopyState === "error"
                            ? t.revisionCopyFailed
                            : t.revisionCopyFullText}
                      </ActionButton>
                      <ActionButton
                        type="button"
                        variant="primary"
                        onClick={continueWithResolvedRevision}
                        disabled={!acceptedRevisionCount}
                      >
                        {t.revisionContinueReview}
                      </ActionButton>
                    </div>
                  </div>

                  <article className="feedbackSection reviseEssayPanel">
                    <div className="revisePanelHeader">
                      <p className="sectionLabel">{t.reviseTitle}</p>
                      <div className="reviseHeaderActions">
                        <ActionButton
                          type="button"
                          variant="secondary"
                          onClick={() => void exportRevisionDoc()}
                          disabled={exportingRevision}
                        >
                          {exportingRevision ? t.exportingRevisionDoc : t.exportRevisionDoc}
                        </ActionButton>
                        <div className="reviseLayoutSwitch" role="group" aria-label="Revise layout">
                          <button
                            type="button"
                            className={`reviseLayoutButton${reviseLayout === "split" ? " is-active" : ""}`}
                            onClick={() => setReviseLayout("split")}
                          >
                            <i className="ai-layout-column" aria-hidden="true" />
                            <span>{t.layoutSplit}</span>
                          </button>
                          <button
                            type="button"
                            className={`reviseLayoutButton${reviseLayout === "stack" ? " is-active" : ""}`}
                            onClick={() => setReviseLayout("stack")}
                          >
                            <i className="ai-layout-row" aria-hidden="true" />
                            <span>{t.layoutStack}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                    <p className="revisionHint">{t.reviseBody}</p>
                    <div className="reviseLayoutSwitch revisionStageSwitch" role="group" aria-label="Revision stage">
                      <button
                        type="button"
                        className={`reviseLayoutButton${activeRevisionStage === "grammar" ? " is-active" : ""}`}
                        onClick={() => {
                          setActiveRevisionStage("grammar");
                          setActiveEditIndex(null);
                          setRevisionCategoryFilter("all");
                          setRevisionCopyState("idle");
                        }}
                      >
                        <span>{t.revisionStageGrammar}</span>
                      </button>
                      <button
                        type="button"
                        className={`reviseLayoutButton${activeRevisionStage === "optimization" ? " is-active" : ""}`}
                        onClick={() => {
                          setActiveRevisionStage("optimization");
                          setActiveEditIndex(null);
                          setRevisionCategoryFilter("all");
                          setRevisionCopyState("idle");
                        }}
                      >
                        <span>{t.revisionStageOptimization}</span>
                      </button>
                    </div>
                    <div className="annotatedEssay reviseAnnotatedEssay">
                      {currentRevisionStage
                        ? renderAnnotatedEssay(
                            currentRevisionStage.annotatedEssay,
                            result.highlightedSentences.map((item) => item.sentence),
                            currentRevisionStage.correctionNotes,
                            currentRevisionDecisions,
                            activeEditIndex,
                            (index) => setActiveEditIndex((current) => (current === index ? null : index)),
                            t
                          )
                        : null}
                    </div>
                  </article>

                  <aside className="feedbackSection reviseSidebar">
                    <p className="sectionLabel">
                      {activeRevisionStage === "grammar" ? t.revisionStageGrammar : t.revisionStageOptimization}
                    </p>
                    <div className="reviseCategoryFilter" role="group" aria-label={t.revisionCategoryFilter}>
                      <button
                        type="button"
                        className={`reviseFilterButton${revisionCategoryFilter === "all" ? " is-active" : ""}`}
                        aria-pressed={revisionCategoryFilter === "all"}
                        onClick={() => setRevisionCategoryFilter("all")}
                      >
                        {t.revisionFilterAll}
                      </button>
                      {groupedRevisionEdits.map((group) => (
                        <button
                          key={`revision-filter-${group.key}`}
                          type="button"
                          className={`reviseFilterButton${revisionCategoryFilter === group.key ? " is-active" : ""}`}
                          aria-pressed={revisionCategoryFilter === group.key}
                          onClick={() => {
                            setRevisionCategoryFilter(group.key);
                            setExpandedRevisionCategories((current) => ({
                              ...current,
                              [group.key]: true
                            }));
                          }}
                        >
                          {group.label}
                        </button>
                      ))}
                    </div>
                    <div className="reviseNavigation">
                      <button
                        type="button"
                        onClick={() => navigateRevision("previous")}
                        disabled={activeFilteredEditPosition <= 0}
                      >
                        <span aria-hidden="true">←</span> {t.revisionPrevious}
                      </button>
                      <span>
                        {activeFilteredEditPosition >= 0 ? activeFilteredEditPosition + 1 : 0} /{" "}
                        {filteredRevisionEdits.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => navigateRevision("next")}
                        disabled={
                          !filteredRevisionEdits.length ||
                          activeFilteredEditPosition === filteredRevisionEdits.length - 1
                        }
                      >
                        {t.revisionNext} <span aria-hidden="true">→</span>
                      </button>
                    </div>
                    {groupedRevisionEdits.length ? (
                      <div className="reviseDetailList">
                        {filteredRevisionGroups.map((group) => {
                          const isOpen = expandedRevisionCategories[group.key] ?? false;
                          const completedInGroup = group.edits.filter(
                            (edit) => currentRevisionDecisions[edit.id] != null
                          ).length;

                          return (
                            <section key={`revise-group-${group.key}`} className="reviseCategoryGroup">
                              <button
                                type="button"
                                className={`reviseCategoryButton${isOpen ? " is-open" : ""}`}
                                onClick={() =>
                                  setExpandedRevisionCategories((current) => ({
                                    ...current,
                                    [group.key]: !isOpen
                                  }))
                                }
                              >
                                <span className="reviseCategoryTitle">{group.label}</span>
                                <span className="reviseCategoryMeta">
                                  {completedInGroup}/{group.edits.length}
                                  <i className={`ai-chevron-${isOpen ? "up" : "down"}`} aria-hidden="true" />
                                </span>
                              </button>
                              {isOpen ? (
                                <div className="reviseCategoryItems">
                                  {group.edits.map((edit) => {
                                    const isActive = activeEditIndex === edit.index;
                                    const decision = currentRevisionDecisions[edit.id];

                                    return (
                                      <article
                                        key={`revise-detail-${edit.id}-${edit.index}`}
                                        data-revise-card-index={edit.index}
                                        className={`reviseDetailCard${isActive ? " is-active" : ""}${
                                          decision ? ` is-${decision}` : ""
                                        }`}
                                      >
                                        <button
                                          type="button"
                                          className="reviseDetailSelect"
                                          onClick={() =>
                                            setActiveEditIndex((current) =>
                                              current === edit.index ? null : edit.index
                                            )
                                          }
                                        >
                                          <div className="reviseDetailHeader">
                                            <span className="reviseDetailIndex">
                                              {String(edit.index + 1).padStart(2, "0")}
                                            </span>
                                            {decision ? (
                                              <span className={`reviseDecisionBadge is-${decision}`}>
                                                {decision === "accepted"
                                                  ? t.revisionAccepted
                                                  : t.revisionIgnored}
                                              </span>
                                            ) : null}
                                          </div>
                                          <div className="reviseDetailSummary">
                                            <p className="reviseDetailOriginal">{edit.original}</p>
                                            <i className="ai-arrow-right" aria-hidden="true" />
                                            <p className="reviseDetailSuggested">{edit.corrected}</p>
                                          </div>
                                        </button>
                                        {isActive ? (
                                          <div className="reviseDetailBody">
                                            <div className="reviseReason">
                                              <span>{t.correctionReason}</span>
                                              <p>{edit.note?.reason ?? ""}</p>
                                            </div>
                                            <div className="reviseDecisionActions">
                                              <button
                                                type="button"
                                                className={`reviseDecisionButton is-ignore${
                                                  decision === "ignored" ? " is-active" : ""
                                                }`}
                                                aria-pressed={decision === "ignored"}
                                                onClick={() => updateRevisionDecision(edit.id, "ignored")}
                                              >
                                                {t.revisionIgnore}
                                              </button>
                                              <button
                                                type="button"
                                                className={`reviseDecisionButton is-accept${
                                                  decision === "accepted" ? " is-active" : ""
                                                }`}
                                                aria-pressed={decision === "accepted"}
                                                onClick={() => updateRevisionDecision(edit.id, "accepted")}
                                              >
                                                {t.revisionAccept}
                                              </button>
                                            </div>
                                          </div>
                                        ) : null}
                                      </article>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </section>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="reviseEmpty">{t.reviseEmpty}</p>
                    )}
                  </aside>
                </section>
              )}

              <article className="feedbackSection resultFeedbackPanel">
                <div className="resultFeedbackHeader">
                  <div>
                    <p className="sectionLabel">{t.feedbackTitle}</p>
                    <p>{t.feedbackBody}</p>
                  </div>
                  {feedbackSubmitted ? <Pill>{t.feedbackSubmitted}</Pill> : null}
                </div>

                <form className="resultFeedbackForm" onSubmit={submitFeedback}>
                  <div className="feedbackChoiceRow" role="group" aria-label={t.feedbackTitle}>
                    <button
                      type="button"
                      className={`feedbackChoiceButton${feedbackChoice === "helpful" ? " is-active" : ""}`}
                      onClick={() => setFeedbackChoice("helpful")}
                      disabled={feedbackSubmitting || feedbackSubmitted}
                    >
                      {t.feedbackHelpful}
                    </button>
                    <button
                      type="button"
                      className={`feedbackChoiceButton${feedbackChoice === "notHelpful" ? " is-active" : ""}`}
                      onClick={() => setFeedbackChoice("notHelpful")}
                      disabled={feedbackSubmitting || feedbackSubmitted}
                    >
                      {t.feedbackNotHelpful}
                    </button>
                  </div>

                  <label className="feedbackCommentField">
                    <span>{t.feedbackCommentLabel}</span>
                    <textarea
                      value={feedbackComment}
                      onChange={(event) => setFeedbackComment(event.target.value)}
                      rows={4}
                      maxLength={2000}
                      placeholder={t.feedbackCommentPlaceholder}
                      disabled={feedbackSubmitting || feedbackSubmitted}
                    />
                  </label>

                  {feedbackError ? <p className="errorBox">{feedbackError}</p> : null}

                  <div className="resultFeedbackActions">
                    <ActionButton
                      type="submit"
                      variant="secondary"
                      disabled={!feedbackChoice || feedbackSubmitting || feedbackSubmitted}
                    >
                      {feedbackSubmitting ? t.feedbackSubmitting : feedbackSubmitted ? t.feedbackSubmitted : t.feedbackSubmit}
                    </ActionButton>
                  </div>
                </form>
              </article>
            </Surface>
          </Surface>
          </div>
        ) : null}
      </section>
    </main>
  );
}

export default function CheckerPageClient() {
  return (
    <Suspense fallback={null}>
      <CheckerPageContent />
    </Suspense>
  );
}
