import { readFile } from "node:fs/promises";
import { CheckInput, ProviderConfig, countWords, getLocale, getTargetBand } from "./shared";

async function readPromptFile(filename: string) {
  const fileUrl = new URL(`../../prompts/${filename}`, import.meta.url);
  return readFile(fileUrl, "utf8");
}

export async function loadBasePrompt() {
  return readPromptFile("base.md");
}

async function readPromptFiles(...filenames: string[]) {
  return Promise.all(filenames.map((filename) => readPromptFile(filename)));
}

function applyTemplate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((output, [key, value]) => {
    return output.replaceAll(`{{${key}}}`, String(value));
  }, template);
}

export async function buildScorePrompt(input: CheckInput, minimumWords: number, _providerName: ProviderConfig["name"]) {
  const locale = getLocale(input.locale);
  const targetBand = getTargetBand(input.targetBand);
  const outputLanguageInstruction =
    locale === "zh-CN"
      ? "Write rationale, strengths, highlighted sentence reasons, and priority fixes in Simplified Chinese."
      : "Write rationale, strengths, highlighted sentence reasons, and priority fixes in English.";
  const [scoreTemplate, taskPrompt] = await readPromptFiles(
    "score.md",
    input.taskType === "task1" ? "task1.md" : "task2.md"
  );

  return applyTemplate(scoreTemplate, {
    taskPrompt,
    targetBand,
    minimumWords,
    outputLanguageInstruction,
    userPrompt: input.prompt,
    essay: input.essay,
    wordCount: countWords(input.essay)
  }).trim();
}

export async function buildRevisionPrompt(input: CheckInput, minimumWords: number) {
  const locale = getLocale(input.locale);
  const targetBand = getTargetBand(input.targetBand);
  const outputLanguageInstruction =
    locale === "zh-CN"
      ? "Write correctionNotes.reason in Simplified Chinese. annotatedEssay, original, and corrected text must remain in natural English."
      : "Write correctionNotes.reason in English. annotatedEssay, original, and corrected text must remain in natural English.";
  const [revisionTemplate, taskPrompt] = await readPromptFiles(
    "revision.md",
    input.taskType === "task1" ? "task1.md" : "task2.md"
  );

  return applyTemplate(revisionTemplate, {
    taskPrompt,
    targetBand,
    minimumWords,
    outputLanguageInstruction,
    userPrompt: input.prompt,
    essay: input.essay,
    wordCount: countWords(input.essay)
  }).trim();
}
