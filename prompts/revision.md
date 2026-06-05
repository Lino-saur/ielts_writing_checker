Return ONLY plain text using the exact section markers below. Do not return JSON.

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
