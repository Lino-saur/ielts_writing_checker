"use client";

import { FormEvent, useState } from "react";
import { TaskType, WritingCheckResult } from "@/lib/types";

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
      "I largely agree that unpaid community service should be included in high school education because it can help students develop practical skills and a stronger sense of social responsibility. However, schools should design these programmes carefully so that they support learning rather than becoming an unfair burden.\n\nOne major benefit of community service is that it exposes students to real social problems. For example, teenagers who help in care homes or environmental projects can see that many issues require patience, teamwork and long-term commitment. These experiences are difficult to gain through textbooks alone, and they may encourage students to become more active citizens in adulthood.\n\nCommunity service can also build useful transferable skills. When students organise donations, support younger children or participate in local campaigns, they learn how to communicate with different people and manage their time. Such abilities are valuable both in higher education and in future employment.\n\nThat said, compulsory service should not ignore students' academic workload or personal circumstances. If schools require excessive hours, some pupils may feel stressed or resentful. A better approach would be to offer flexible options and ensure that activities are safe, meaningful and closely supervised.\n\nIn conclusion, community service should be a required part of high school programmes, but it must be implemented in a balanced and practical way."
  }
};

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
        <h3>{label}</h3>
        <span>{score.toFixed(1)}</span>
      </div>
      <p>{rationale}</p>
    </article>
  );
}

export default function HomePage() {
  const [taskType, setTaskType] = useState<TaskType>("task2");
  const [prompt, setPrompt] = useState(TASK_PLACEHOLDERS.task2.prompt);
  const [essay, setEssay] = useState(TASK_PLACEHOLDERS.task2.essay);
  const [result, setResult] = useState<WritingCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function onTaskTypeChange(nextType: TaskType) {
    setTaskType(nextType);
    setPrompt(TASK_PLACEHOLDERS[nextType].prompt);
    setEssay(TASK_PLACEHOLDERS[nextType].essay);
    setResult(null);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          taskType,
          prompt,
          essay
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Request failed.");
      }

      setResult(data);
    } catch (submissionError) {
      setResult(null);
      setError(submissionError instanceof Error ? submissionError.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="pageShell">
      <section className="hero">
        <div className="heroCopy">
          <p className="eyebrow">AI Powered MVP</p>
          <h1>IELTS Writing Checker for Task 1 and Task 2</h1>
          <p className="lede">
            Check a response against the four IELTS writing criteria, get band estimates, targeted fixes, and a short
            rewrite example. If `OPENAI_API_KEY` is configured the app uses AI feedback; otherwise it falls back to a
            deterministic local scorer.
          </p>
        </div>
        <div className="heroStat">
          <span>Modes</span>
          <strong>{result?.feedbackMode === "ai" ? "AI Review" : "MVP Ready"}</strong>
          <small>Task 1 + Task 2</small>
        </div>
      </section>

      <section className="workspace">
        <form className="editorPanel" onSubmit={handleSubmit}>
          <div className="segmentedControl" role="tablist" aria-label="Task type">
            <button
              type="button"
              className={taskType === "task1" ? "active" : ""}
              onClick={() => onTaskTypeChange("task1")}
            >
              Task 1
            </button>
            <button
              type="button"
              className={taskType === "task2" ? "active" : ""}
              onClick={() => onTaskTypeChange("task2")}
            >
              Task 2
            </button>
          </div>

          <label>
            <span>Prompt</span>
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={5} />
          </label>

          <label>
            <span>Essay</span>
            <textarea value={essay} onChange={(event) => setEssay(event.target.value)} rows={16} />
          </label>

          <div className="editorFooter">
            <p>
              Word count: <strong>{essay.trim() ? essay.trim().split(/\s+/).length : 0}</strong>
            </p>
            <button type="submit" disabled={loading}>
              {loading ? "Checking..." : "Check Writing"}
            </button>
          </div>

          {error ? <p className="errorBox">{error}</p> : null}
        </form>

        <section className="resultsPanel">
          {result ? (
            <>
              <div className="resultHero">
                <div>
                  <p className="eyebrow">Estimated Band</p>
                  <h2>{result.estimatedBand.toFixed(1)}</h2>
                </div>
                <div className="resultMeta">
                  <span>{result.taskType === "task1" ? "Task 1" : "Task 2"}</span>
                  <span>{result.wordCount} words</span>
                  <span>{result.feedbackMode === "ai" ? "AI mode" : "Heuristic mode"}</span>
                </div>
              </div>

              <div className="scoreGrid">
                <ScoreCard
                  label="Task Achievement"
                  score={result.bandBreakdown.taskAchievement.score}
                  rationale={result.bandBreakdown.taskAchievement.rationale}
                />
                <ScoreCard
                  label="Coherence & Cohesion"
                  score={result.bandBreakdown.coherenceAndCohesion.score}
                  rationale={result.bandBreakdown.coherenceAndCohesion.rationale}
                />
                <ScoreCard
                  label="Lexical Resource"
                  score={result.bandBreakdown.lexicalResource.score}
                  rationale={result.bandBreakdown.lexicalResource.rationale}
                />
                <ScoreCard
                  label="Grammar Range & Accuracy"
                  score={result.bandBreakdown.grammaticalRangeAndAccuracy.score}
                  rationale={result.bandBreakdown.grammaticalRangeAndAccuracy.rationale}
                />
              </div>

              <article className="feedbackSection">
                <h3>Strengths</h3>
                <ul>
                  {result.strengths.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>

              <article className="feedbackSection">
                <h3>Priority Fixes</h3>
                <ul>
                  {result.priorityFixes.map((item) => (
                    <li key={item.title}>
                      <strong>{item.title}:</strong> {item.detail}
                    </li>
                  ))}
                </ul>
              </article>

              <article className="feedbackSection">
                <h3>Sample Rewrite</h3>
                <p>{result.sampleRewrite}</p>
              </article>
            </>
          ) : (
            <div className="emptyState">
              <p className="eyebrow">Ready</p>
              <h2>Run the first review</h2>
              <p>
                Choose Task 1 or Task 2, paste the prompt and essay, then run the checker to get rubric-based feedback.
              </p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
