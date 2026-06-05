Return ONLY plain text using the exact section markers below. Do not return JSON.

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
