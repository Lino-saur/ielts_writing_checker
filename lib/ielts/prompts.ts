import { CheckInput, ProviderConfig, countWords, getLocale, getTargetBand } from "./shared";

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
reason: ...

===PRIORITY_FIXES===
1. title: ...
detail: ...
2. title: ...
detail: ...
3. title: ...
detail: ...

===END===

{{taskPrompt}}

Target band:
{{targetBand}}

Constraints:
- Use band scores from 0 to 9 in 0.5 increments.
- Keep rationales concise and specific to the essay.
- Include exactly 3 strengths.
- Include 1 to 3 highlightedSentences taken from the student's original essay.
- For each highlighted sentence, explain briefly why it is effective.
- Include exactly 3 priority fixes.
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
original: ...
corrected: ...
reason: ...

===END===

{{taskPrompt}}

Target band:
{{targetBand}}

Constraints:
- annotatedEssay must preserve the original essay order and mark edits inline using [del#1]original text[/del#1][add#1]improved text[/add#1], [del#2]...[/del#2][add#2]...[/add#2], etc.
- Every inline edit id in annotatedEssay must have exactly one matching correctionNotes item with the same id, and every correctionNotes id must appear exactly once in annotatedEssay.
- Every single revision in annotatedEssay must be annotated.
- Build the output in this order mentally: first decide the full correctionNotes list, then write annotatedEssay by reusing those same ids exactly once each.
- Before finalizing, count the ids in correctionNotes and count the [del#id]/[add#id] pairs in annotatedEssay. These two counts must be exactly the same.
- If you cannot fully annotate many tiny edits reliably, merge nearby edits into fewer larger revisions so that every revision still has one clear note.
- correctionNotes and annotatedEssay must actively correct grammar mistakes, spelling mistakes, punctuation problems, awkward phrasing, weak logic links, and unclear sentence structure wherever needed.
- annotatedEssay itself must read like the target-band version of the essay after all [add] text is applied.
- Keep the student's core stance, major supporting points, and overall paragraph plan whenever possible.
- If the original essay is underdeveloped, expand ideas inside annotatedEssay so that the revised result better matches the requested band level, but still stays recognizably based on the original response.
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
  task1: `Evaluate the user's response for IELTS Academic Writing Task 1.

Focus on:
- whether the response identifies the key features of the chart, graph, table, map, or process
- whether there is a clear overview
- whether important comparisons and trends are selected instead of listing every detail
- whether the data description is accurate and relevant

Task 1 image consistency checks:
- Compare the essay's reported figures, categories, dates, rankings, directions, stages, and trends against the uploaded image.
- If the essay description conflicts with the image data, explicitly point out the mismatch and treat it as a Task Achievement accuracy problem.
- If the uploaded image appears unrelated to the written prompt or does not match the expected Task 1 visual, explicitly warn about that problem instead of pretending the image is valid.
- Do not invent unreadable values. If part of the image is unclear, say that it is unclear and judge only what can be supported confidently.
- For revision, do not preserve clearly wrong data claims from the student's essay. Correct or generalize them so the revised response stays consistent with the visible image.
`,
  task2: `Evaluate the user's response for IELTS Writing Task 2.

Focus on:
- whether the response answers the question directly
- whether the position is clear and maintained
- whether body paragraphs are sufficiently developed
- whether supporting ideas are relevant and logically connected

When judging idea development for body paragraphs, explicitly evaluate whether the argument can be logically developed as a clear causal chain in the form "A inevitably leads to B, B inevitably leads to C, and C inevitably leads to D".
Use the IELTS writing criteria to judge whether that causal chain is clear, relevant, sufficiently explained, and well connected to the question.
If the essay does not follow that logic chain well, reflect the weakness in task achievement/task response and coherence/cohesion comments, and suggest how the chain could be made tighter.
`
} as const;

export async function loadBasePrompt() {
  return PROMPTS.base;
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
  const scoreTemplate = PROMPTS.score;
  const taskPrompt = input.taskType === "task1" ? PROMPTS.task1 : PROMPTS.task2;

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
  const revisionTemplate = PROMPTS.revision;
  const taskPrompt = input.taskType === "task1" ? PROMPTS.task1 : PROMPTS.task2;

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
