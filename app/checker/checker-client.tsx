"use client";

import { ChangeEvent, FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppNavbar } from "@/components/app-navbar";
import { useAuthSession } from "@/lib/auth-client-session";
import { CheckerMessages, getMessages } from "@/lib/i18n/messages";
import { useRouteLocale } from "@/lib/i18n/use-route-locale";
import { ActionButton, ActionLink, Pill, Surface } from "@/components/ui-kit";
import type { AiProvider, CorrectionNote, FeedbackPayload, TargetBand, TaskType, WritingCheckResult } from "@/lib/types";

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

type EnergyPayload = {
  energy: EnergyState;
  cost: number;
};

type ErrorSource = "auth" | "general";
type ReportView = "overview" | "revise";
type ReviseLayout = "split" | "stack";
type FeedbackChoice = "helpful" | "notHelpful";
type UploadedTaskImage = {
  objectKey: string;
  name: string;
  mimeType: string;
  fileSize: number;
  previewUrl: string;
};

const TASK1_UPLOAD_LIMIT_BYTES = 8 * 1024 * 1024;
const TASK1_COMPRESSION_THRESHOLD_BYTES = 1.2 * 1024 * 1024;
const TASK1_MAX_IMAGE_DIMENSION = 1800;
const TASK1_COMPRESSED_MIME_TYPE = "image/jpeg";
const TASK1_COMPRESSED_QUALITY = 0.85;

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

function parseAnnotatedEssay(text: string, correctionNotes: CorrectionNote[]) {
  const notesById = new Map(correctionNotes.map((note) => [note.id, note]));
  const parts: Array<
    | { type: "plain"; text: string }
    | { type: "edit"; id: string; original: string; corrected: string; note?: CorrectionNote; index: number }
    | { type: "del" | "add"; text: string }
  > = [];
  const edits: Array<{
    id: string;
    original: string;
    corrected: string;
    note?: CorrectionNote;
    index: number;
  }> = [];
  const pairPattern = /\[del#([A-Za-z0-9_-]+)\]([\s\S]*?)\[\/del#\1\]\[add#\1\]([\s\S]*?)\[\/add#\1\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let editIndex = 0;

  while ((match = pairPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "plain", text: text.slice(lastIndex, match.index) });
    }

    const edit = {
      id: match[1],
      original: match[2],
      corrected: match[3],
      note: notesById.get(match[1]),
      index: editIndex
    };

    parts.push({ type: "edit", ...edit });
    edits.push(edit);
    editIndex += 1;
    lastIndex = pairPattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "plain", text: text.slice(lastIndex) });
  }

  return { parts, edits };
}

function renderAnnotatedEssay(
  text: string,
  highlightedSentences: string[],
  correctionNotes: CorrectionNote[],
  activeEditIndex: number | null,
  onToggleEdit: (index: number) => void,
  t: CheckerMessages
) {
  const { parts } = parseAnnotatedEssay(text, correctionNotes);

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

function CheckerPageContent() {
  const { sessionContext, sessionResolved, refreshSessionContext: refreshAuthSessionContext } = useAuthSession();
  const activeEditRef = useRef<HTMLDivElement | null>(null);
  const reportSectionRef = useRef<HTMLDivElement | null>(null);
  const taskImageInputRef = useRef<HTMLInputElement | null>(null);
  const [locale, setLocale] = useRouteLocale();
  const searchParams = useSearchParams();
  const provider: AiProvider = "deepseek";
  const [taskType, setTaskType] = useState<TaskType>("task2");
  const [targetBand, setTargetBand] = useState<TargetBand>(6.5);
  const [prompt, setPrompt] = useState(TASK2_PLACEHOLDER.prompt);
  const [essay, setEssay] = useState(TASK2_PLACEHOLDER.essay);
  const [taskImage, setTaskImage] = useState<UploadedTaskImage | null>(null);
  const [taskImageUploading, setTaskImageUploading] = useState(false);
  const [result, setResult] = useState<WritingCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorSource, setErrorSource] = useState<ErrorSource>("general");
  const [loading, setLoading] = useState(false);
  const [activeEditIndex, setActiveEditIndex] = useState<number | null>(null);
  const [energy, setEnergy] = useState<EnergyState | null>(sessionContext.energy as EnergyState | null);
  const [reviewCost, setReviewCost] = useState(sessionContext.reviewCost ?? 1);
  const [authRequest, setAuthRequest] = useState<{ mode: "signIn" | "signUp"; id: number } | null>(null);
  const [promptEditing, setPromptEditing] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [reportView, setReportView] = useState<ReportView>("overview");
  const [reviseLayout, setReviseLayout] = useState<ReviseLayout>("split");
  const [feedbackChoice, setFeedbackChoice] = useState<FeedbackChoice | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [exportingRevision, setExportingRevision] = useState(false);

  const { checker: t, navbar } = getMessages(locale);
  const sessionReady = sessionResolved;
  const isAuthenticated = Boolean(sessionContext.user);
  const wordCount = essay.trim() ? essay.trim().split(/\s+/).length : 0;
  const wordCountTone = wordCount < 220 ? "low" : wordCount <= 320 ? "ready" : "extended";
  const promptEditLabel = promptEditing ? t.doneEditing : t.editPrompt;
  const parsedRevision = result ? parseAnnotatedEssay(result.annotatedEssay, result.correctionNotes) : null;
  const activeCorrection = parsedRevision && activeEditIndex !== null ? parsedRevision.edits[activeEditIndex] ?? null : null;
  const isTask1 = taskType === "task1";

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
    setResult(null);
    setActiveEditIndex(null);
    setFeedbackChoice(null);
    setFeedbackComment("");
    setFeedbackSubmitted(false);
    setFeedbackError(null);

    if (taskType === "task1") {
      setPrompt(TASK1_PLACEHOLDER.prompt);
      setEssay(TASK1_PLACEHOLDER.essay);
      setTaskImage(null);
    } else {
      setPrompt(TASK2_PLACEHOLDER.prompt);
      setEssay(TASK2_PLACEHOLDER.essay);
      setTaskImage(null);
    }
  }, [taskType]);

  useEffect(() => {
    return () => {
      if (taskImage?.previewUrl) {
        window.URL.revokeObjectURL(taskImage.previewUrl);
      }
    };
  }, [taskImage]);

  useEffect(() => {
    setEnergy(sessionContext.energy as EnergyState | null);
    setReviewCost(sessionContext.reviewCost ?? 1);
  }, [sessionContext.energy, sessionContext.reviewCost]);

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
    setFeedbackChoice(null);
    setFeedbackComment("");
    setFeedbackSubmitting(false);
    setFeedbackSubmitted(false);
    setFeedbackError(null);
  }, [result]);

  useEffect(() => {
    if (!confirmDialogOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setConfirmDialogOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [confirmDialogOpen]);

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
          essay,
          taskImageObjectKey: taskImage?.objectKey,
          taskImageName: taskImage?.name,
          taskImageMimeType: taskImage?.mimeType,
          taskImageSizeBytes: taskImage?.fileSize
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

        if (isErrorPayload(data) && data.error === "AI_REVIEW_FAILED") {
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

  async function handleTask1ImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setTaskImage(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      showError(t.task1ImageTypeError);
      event.target.value = "";
      return;
    }

    if (file.size > TASK1_UPLOAD_LIMIT_BYTES) {
      showError(t.task1ImageSizeError);
      event.target.value = "";
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
        throw new Error(("error" in signData && signData.error) || "UPLOAD_URL_FAILED");
      }

      const uploadResponse = await fetch(signData.uploadUrl, {
        method: "PUT",
        headers: signData.headers || {
          "Content-Type": uploadFile.type || TASK1_COMPRESSED_MIME_TYPE
        },
        body: uploadFile
      });

      if (!uploadResponse.ok) {
        throw new Error("UPLOAD_FAILED");
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
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "UPLOAD_FAILED";
      if (message === "MEDIA_UPLOAD_LIMIT_REACHED" || message === "MEDIA_UPLOADS_BLOCKED") {
        showError(t.task1ImageQuotaError);
      } else {
        showError(t.task1ImageReadError);
      }
      event.target.value = "";
    } finally {
      setTaskImageUploading(false);
    }
  }

  function clearTask1Image() {
    if (taskImage?.previewUrl) {
      window.URL.revokeObjectURL(taskImage.previewUrl);
    }
    setTaskImage(null);
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionReady || loading) {
      return;
    }

    if (!isAuthenticated) {
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
      />

      <section className="checkerStudio" id="workspace">
        <Surface as="form" className="checkerWorkbench" onSubmit={handleSubmit}>
          <div className="checkerField checkerPromptBlock">
            <div className="checkerPromptHeader">
              <span>{t.prompt}</span>
              <div className="checkerPromptControls">
                <button
                  type="button"
                  className="checkerPromptEditButton"
                  onClick={() => setPromptEditing((value) => !value)}
                >
                  {promptEditLabel}
                </button>
              </div>
            </div>
            <div className="checkerPromptBody">
              {promptEditing ? (
                <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={4} />
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
                <p className="checkerUploadHint">{t.task1ImageHint}</p>
                <input
                  ref={taskImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(event) => void handleTask1ImageChange(event)}
                  disabled={taskImageUploading}
                />
                {taskImage ? (
                  <div className="checkerUploadMeta">
                    <span>{taskImage.name}</span>
                    <button type="button" className="checkerPromptEditButton" onClick={clearTask1Image}>
                      {t.task1ImageRemove}
                    </button>
                  </div>
                ) : null}
                {taskImage ? (
                  <div className="checkerUploadPreview">
                    <img src={taskImage.previewUrl} alt={t.task1ImageLabel} className="checkerUploadPreviewImage" />
                  </div>
                ) : null}
                {taskImageUploading ? <p className="checkerUploadStatus">{t.task1ImageProcessing}</p> : null}
              </div>
            </div>
          ) : null}

          <div className="checkerDraftPanel">
            <div className="checkerDraftHeader">
              <div>
                <h2>{t.essay}</h2>
              </div>
              <label className="checkerInlineSelect">
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
            </div>

            {error && errorSource !== "auth" ? <p className="errorBox">{error}</p> : null}

            <label className="checkerEssayField">
              <span className="srOnly">{t.essay}</span>
              <textarea
                className="checkerEssayInput"
                value={essay}
                onChange={(event) => setEssay(event.target.value)}
                rows={24}
              />
            </label>

            <div className="checkerDraftFooter">
              <span className={`checkerWordHint is-${wordCountTone}`}>
                <strong>{wordCount}</strong>
                <span>{t.wordCount}</span>
              </span>
              <ActionButton type="submit" variant="primary" disabled={loading || !sessionReady}>
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
                <section className={`reviseWorkspace${reviseLayout === "stack" ? " is-stacked" : ""}`}>
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
                    <div className="annotatedEssay reviseAnnotatedEssay" ref={activeEditRef}>
                      {renderAnnotatedEssay(
                        result.annotatedEssay,
                        result.highlightedSentences.map((item) => item.sentence),
                        result.correctionNotes,
                        activeEditIndex,
                        (index) => setActiveEditIndex((current) => (current === index ? null : index)),
                        t
                      )}
                    </div>
                  </article>

                  <aside className="feedbackSection reviseSidebar">
                    <p className="sectionLabel">{t.revisionBundle}</p>
                    {activeCorrection ? (
                      <div className="reviseDetailCard">
                        <div className="revisePair">
                          <span>{t.reviseOriginal}</span>
                          <p>{activeCorrection.original}</p>
                        </div>
                        <div className="revisePair revisePairSuggested">
                          <span>{t.reviseSuggested}</span>
                          <p>{activeCorrection.corrected}</p>
                        </div>
                        <div className="reviseReason">
                          <span>{t.correctionReason}</span>
                          <p>{activeCorrection.note?.reason ?? ""}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="reviseEmpty">{t.reviseEmpty}</p>
                    )}

                    <div className="reviseSupportBlock">
                      <p className="subsectionTitle">{t.priorityFixes}</p>
                      <ul>
                        {result.priorityFixes.map((item) => (
                          <li key={item.title}>
                            <strong>{item.title}:</strong> {item.detail}
                          </li>
                        ))}
                      </ul>
                    </div>
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
