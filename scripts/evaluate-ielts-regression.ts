import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { evaluateWriting } from "../lib/ielts";
import {
  evaluateRegressionRuns,
  materializeRecommendedEssay,
  type EvaluationRun,
  type RegressionCase
} from "../lib/ielts/evaluation";

async function runLiveLoop(cases: RegressionCase[]) {
  const caseArgument = process.argv.find((argument) => argument.startsWith("--case="));
  const allTask2 = process.argv.includes("--all-task2");
  if (!caseArgument && !allTask2) {
    throw new Error("Live mode requires --case=<case-id> or --all-task2 to prevent accidental large AI runs.");
  }
  const repeatsArgument = process.argv.find((argument) => argument.startsWith("--repeats="));
  const repeats = Math.min(Math.max(Number(repeatsArgument?.slice("--repeats=".length) || 1), 1), 5);
  const selected = cases.filter((item) =>
    item.taskType === "task2" && (allTask2 || item.id === caseArgument?.slice("--case=".length))
  );
  if (!selected.length) throw new Error("No matching Task 2 regression case was found.");

  const runs: EvaluationRun[] = [];
  for (const regressionCase of selected) {
    for (let repeat = 1; repeat <= repeats; repeat += 1) {
      const runId = `${new Date().toISOString()}-${repeat}`;
      try {
        const initial = await evaluateWriting({
          taskType: regressionCase.taskType,
          prompt: regressionCase.prompt,
          essay: regressionCase.essay,
          locale: "en",
          targetBand: 7
        });
        const revisedEssay = materializeRecommendedEssay(initial);
        const acceptedRevisionIds = [
          ...(initial.grammarRevision?.correctionNotes ?? initial.correctionNotes)
            .map((note) => `grammar:${note.id}`),
          ...(initial.optimizationRevision?.correctionNotes ?? [])
            .map((note) => `optimization:${note.id}`),
          ...(initial.finalGrammarRevision?.correctionNotes ?? [])
            .map((note) => `finalGrammar:${note.id}`)
        ];
        const followup = await evaluateWriting({
          taskType: regressionCase.taskType,
          prompt: regressionCase.prompt,
          essay: revisedEssay,
          locale: "en",
          targetBand: 7,
          priorReview: {
            parentReviewId: `regression:${regressionCase.id}:${runId}`,
            previousEssay: regressionCase.essay,
            previousResult: initial,
            acceptedRevisionIds
          }
        });
        runs.push({
          caseId: regressionCase.id,
          runId,
          attemptCount: 1,
          score: initial,
          revision: initial,
          followup: { essay: revisedEssay, score: followup, revision: followup }
        });
      } catch (error) {
        runs.push({
          caseId: regressionCase.id,
          runId,
          attemptCount: 1,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }
  return runs;
}

async function main() {
  const casesPath = resolve(process.cwd(), "data/ielts-regression-cases.json");
  const casesText = await readFile(casesPath, "utf8");
  const casePayload = JSON.parse(casesText) as { cases: RegressionCase[] };
  const runsArgument = process.argv.find((argument) => argument.startsWith("--runs="));
  let runs: EvaluationRun[];
  if (process.argv.includes("--live")) {
    runs = await runLiveLoop(casePayload.cases);
  } else if (runsArgument) {
    const runsText = await readFile(resolve(process.cwd(), runsArgument.slice("--runs=".length)), "utf8");
    runs = runsText.split("\n").map((line) => line.trim()).filter(Boolean).map((line, index) => {
      try {
        return JSON.parse(line) as EvaluationRun;
      } catch (error) {
        throw new Error(`Invalid JSON on runs line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  } else {
    throw new Error("Usage: --runs=path/to/runs.jsonl or --live --case=<task2-case-id> [--repeats=1]");
  }

  console.log(JSON.stringify(evaluateRegressionRuns(casePayload.cases, runs), null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
