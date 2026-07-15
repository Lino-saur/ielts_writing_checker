# IELTS evaluation regression harness

The versioned case set is stored in `data/ielts-regression-cases.json`. It contains synthetic Task 2 question types and Task 1 visual-fact fixtures, including inaccurate and unreadable-data cases.

Record repeated model runs as JSON Lines. Each line must contain:

```json
{
  "caseId": "t2-opinion-clear",
  "runId": "2026-07-15-1",
  "attemptCount": 1,
  "score": {},
  "revision": {}
}
```

Failed runs should contain `error` instead of normalized score and revision results. Use three or more runs for each case when measuring score stability.

Run the offline metrics report with:

```bash
npx tsx scripts/evaluate-ielts-regression.ts --runs=tmp/ielts-runs.jsonl
```

The report measures:

- completed contract rate;
- first-attempt success rate;
- exact highlighted-quote rate;
- Task 1/Task 2 check completeness;
- server-derived overall-band consistency;
- revision ID and annotation alignment;
- per-case band spread and the percentage of repeated cases whose spread is at most 0.5.
- closed-loop issue resolution after applying all suggested edits;
- repeated and newly introduced grammar issue rates;
- grammatical-score non-regression;
- whether any score decrease has concrete new, repeated, or worsened-task evidence.

Run a live Task 2 closed-loop evaluation with explicit scope:

```bash
npm run evaluate:ielts-loop -- --case=t2-underdeveloped --repeats=1
```

Live mode performs the initial review, applies all grammar and optimization edits, submits the revised essay with parent-review context, and evaluates the resulting issue and score deltas. Use `--all-task2` only when the additional model cost is intentional.

Release targets are 99% first-attempt success, 100% exact quotes, task-check completeness, overall consistency and revision alignment, at least 95% of repeated cases within a 0.5 band spread, 100% grammar non-regression, 100% evidence-backed score changes, and near-zero repeated or newly introduced grammar issues.
