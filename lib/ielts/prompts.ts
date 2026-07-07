import { CheckInput, countWords, getLocale, getTargetBand } from "./shared";
import { GRAMMAR_REVISION_CATEGORIES, OPTIMIZATION_REVISION_CATEGORIES } from "./revision-categories";
import { buildApplicableTeachingRulesContext } from "@/lib/teaching-rules";

const PROMPTS = {
  base: `You are a precise IELTS writing evaluator.
Always follow the required tagged-section output format exactly.
`,
  score: `Return ONLY plain text using the exact section markers below. Do not return JSON.

Required output format:
===TASK_TYPE===
task1 or task2

===ESTIMATED_BAND===
5.5

===TASK_ACHIEVEMENT===
score: 5.5
rationale: ...

===COHERENCE_AND_COHESION===
score: 5.5
rationale: ...

===LEXICAL_RESOURCE===
score: 5.5
rationale: ...

===GRAMMATICAL_RANGE_AND_ACCURACY===
score: 5.5
rationale: ...

===STRENGTHS===
- ...
- ...
- ...

===HIGHLIGHTED_SENTENCES===
1. sentence: ...
rules: rule_id@v1
reason: ...

===PRIORITY_FIXES===
1. title: ...
rules: rule_id@v1
detail: ...
2. title: ...
rules: rule_id@v1
detail: ...
3. title: ...
rules: rule_id@v1
detail: ...

===END===

Task context:
{{taskContext}}

Published evaluation rules:
{{teachingRules}}

Target band:
{{targetBand}}

Constraints:
- Use band scores from 0 to 9 in 0.5 increments.
- Keep rationales concise and specific to the essay.
- Include exactly 3 strengths.
- Include 1 to 3 highlightedSentences taken from the student's original essay.
- For each highlighted sentence, explain briefly why it is effective.
- Include exactly 3 priority fixes.
- Every highlighted sentence and priority fix must include a rules line containing one to three exact rule_id@version references from Published evaluation rules. Use "rules: none" only when no published rule supports the observation.
- Never invent a rule id, version, source, or knowledge-point code.
- Consider the minimum word expectation of {{minimumWords}}.
- Use the exact section headers above and keep them in the same order.
- Put each section header on its own line, and put the section content on the following lines.
- Do not add any extra sections, markdown fences, commentary, revision text, or JSON syntax.
- {{outputLanguageInstruction}}

Prompt:
{{userPrompt}}

Essay:
{{essay}}

Detected word count: {{wordCount}}
`,
  revision: `Return ONLY plain text using the exact section markers below. Do not return JSON.

Required output format:
===TASK_TYPE===
task1 or task2

===ANNOTATED_ESSAY===
...

===CORRECTION_NOTES===
1. id: 1
category: ...
rules: rule_id@v1
original: ...
corrected: ...
reason: ...

===END===

Task context:
{{taskContext}}

Published evaluation rules:
{{teachingRules}}

Revision stage:
{{revisionStage}}

Target band:
{{targetBand}}

Constraints:
- annotatedEssay must preserve the essay order and mark edits inline using [del#1]original text[/del#1][add#1]improved text[/add#1], [del#2]...[/del#2][add#2]...[/add#2], etc.
- Every inline edit id in annotatedEssay must have exactly one matching correctionNotes item with the same id, and every correctionNotes id must appear exactly once in annotatedEssay.
- Every correctionNotes item must include a short category label.
- Every correctionNotes item must include a rules line containing one to three exact rule_id@version references from Published evaluation rules.
- Do not create a correction or optimization unless at least one published rule directly supports it. If no listed rule applies, preserve the original text instead of returning an unsupported edit.
- For article optimization, rule support is mandatory even when the proposed wording sounds stylistically better.
- Never invent a rule id, version, source, or knowledge-point code.
- Every correctionNotes item must include a non-empty reason. The reason is required for every id with no exceptions.
- Every reason must be specific and complete, not generic. Explain what is wrong in the original, what the corrected version changes, and why the correction is better in this context.
- Every reason must be at least 2 full sentences in the required output language.
- Do not write vague reasons such as "grammar mistake", "better wording", "more natural", "improves clarity", or "fixed error" unless you also explain the exact error and the exact improvement.
- For grammar stage, category must be exactly one of: {{grammarCategoryList}}.
- For optimization stage, category must be exactly one of: {{optimizationCategoryList}}.
- Before finalizing, count the note ids and the [del#id]/[add#id] pairs in annotatedEssay. These two counts must match exactly.
- Before finalizing, verify that every correctionNotes item contains id, category, original, corrected, and reason, and that no reason is blank.
- If you cannot fully annotate many tiny edits reliably, merge nearby edits into fewer larger revisions so that every revision still has one clear note.
- {{revisionStageConstraints}}
- {{revisionStageExpansionRule}}
- Consider the minimum word expectation of {{minimumWords}}.
- Use the exact section headers above and keep them in the same order.
- Put each section header on its own line, and put the section content on the following lines.
- Do not add any extra sections, markdown fences, commentary, score analysis, or JSON syntax.
- {{outputLanguageInstruction}}

Prompt:
{{userPrompt}}

Essay:
{{essay}}

Detected word count: {{wordCount}}
`,
} as const;

export async function loadBasePrompt() {
  return PROMPTS.base;
}

function applyTemplate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((output, [key, value]) => {
    return output.replaceAll(`{{${key}}}`, String(value));
  }, template);
}

export async function buildScorePrompt(input: CheckInput, minimumWords: number) {
  const locale = getLocale(input.locale);
  const targetBand = getTargetBand(input.targetBand);
  const outputLanguageInstruction =
    locale === "zh-CN"
      ? "Write rationale, strengths, highlighted sentence reasons, and priority fixes in Simplified Chinese."
      : "Write rationale, strengths, highlighted sentence reasons, and priority fixes in English.";
  const scoreTemplate = PROMPTS.score;
  const taskContext =
    input.taskType === "task1"
      ? "Evaluate the response as IELTS Academic Writing Task 1."
      : "Evaluate the response as IELTS Writing Task 2.";
  const teachingRules = await buildApplicableTeachingRulesContext(
    input.taskType,
    "score",
    input.prompt
  );

  return {
    prompt: applyTemplate(scoreTemplate, {
    taskContext,
    teachingRules: teachingRules.prompt,
    targetBand,
    minimumWords,
    outputLanguageInstruction,
    userPrompt: input.prompt,
    essay: input.essay,
      wordCount: countWords(input.essay)
    }).trim(),
    rules: teachingRules.rules
  };
}

export async function buildRevisionPrompt(
  input: CheckInput,
  minimumWords: number,
  stage: "grammar" | "optimization"
) {
  const locale = getLocale(input.locale);
  const targetBand = getTargetBand(input.targetBand);
  const outputLanguageInstruction =
    locale === "zh-CN"
      ? "Write correctionNotes.reason in Simplified Chinese. annotatedEssay, original, and corrected text must remain in natural English."
      : "Write correctionNotes.reason in English. annotatedEssay, original, and corrected text must remain in natural English.";
  const revisionTemplate = PROMPTS.revision;
  const taskContext =
    input.taskType === "task1"
      ? "Revise the response as IELTS Academic Writing Task 1."
      : "Revise the response as IELTS Writing Task 2.";
  const teachingRules = await buildApplicableTeachingRulesContext(
    input.taskType,
    stage,
    input.prompt
  );
  const revisionStage =
    stage === "grammar"
      ? "Stage 1: Grammar Check"
      : "Stage 2: Article Optimization";
  const revisionStageConstraints =
    "Follow the published rules that apply to this revision stage.";
  const revisionStageExpansionRule =
    "Do not exceed the scope defined by the published rules for this revision stage.";

  return {
    prompt: applyTemplate(revisionTemplate, {
    taskContext,
    teachingRules: teachingRules.prompt,
    revisionStage,
    revisionStageConstraints,
    revisionStageExpansionRule,
    grammarCategoryList: GRAMMAR_REVISION_CATEGORIES.join(", "),
    optimizationCategoryList: OPTIMIZATION_REVISION_CATEGORIES.join(", "),
    targetBand,
    minimumWords,
    outputLanguageInstruction,
    userPrompt: input.prompt,
    essay: input.essay,
      wordCount: countWords(input.essay)
    }).trim(),
    rules: teachingRules.rules
  };
}
