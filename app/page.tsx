"use client";

import { FormEvent, useState } from "react";
import { AiProvider, Locale, TaskType, WritingCheckResult } from "@/lib/types";

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

const UI_COPY = {
  en: {
    languageLabel: "Language",
    heroEyebrow: "AI Writing Review",
    heroTitle: "IELTS Writing Checker for Task 1 and Task 2",
    heroDescription:
      "Check a response against the four IELTS writing criteria and get targeted feedback with a sample rewrite.",
    modesLabel: "Modes",
    aiReview: "AI Review",
    heuristicReady: "Fallback Review",
    coverage: "Task 1 + Task 2",
    taskSwitcherAria: "Task type",
    task1: "Task 1",
    task2: "Task 2",
    providerDeepSeek: "DeepSeek",
    prompt: "Prompt",
    essay: "Essay",
    wordCount: "Word count",
    checking: "Checking...",
    checkWriting: "Check Writing",
    estimatedBand: "Estimated Band",
    aiMode: "AI mode",
    heuristicMode: "Heuristic mode",
    providerUsed: "Provider",
    taskAchievement: "Task Achievement",
    coherence: "Coherence & Cohesion",
    lexical: "Lexical Resource",
    grammar: "Grammar Range & Accuracy",
    strengths: "Strengths",
    priorityFixes: "Priority Fixes",
    sampleRewrite: "Sample Rewrite",
    ready: "Ready",
    emptyTitle: "Run the first review",
    emptyDescription:
      "Choose Task 1 or Task 2, paste the prompt and essay, then run the checker to get rubric-based feedback.",
    genericError: "Something went wrong."
  },
  "zh-CN": {
    languageLabel: "语言",
    heroEyebrow: "AI 写作评估",
    heroTitle: "IELTS 写作批改器（Task 1 / Task 2）",
    heroDescription:
      "根据 IELTS 写作四项评分标准检查作文，并返回重点修改建议和示范改写。",
    modesLabel: "模式",
    aiReview: "AI 评分",
    heuristicReady: "本地评分",
    coverage: "覆盖 Task 1 + Task 2",
    taskSwitcherAria: "题型选择",
    task1: "Task 1",
    task2: "Task 2",
    providerDeepSeek: "DeepSeek",
    prompt: "题目",
    essay: "作文",
    wordCount: "词数",
    checking: "评分中...",
    checkWriting: "开始批改",
    estimatedBand: "预估分数",
    aiMode: "AI 模式",
    heuristicMode: "本地启发式模式",
    providerUsed: "当前平台",
    taskAchievement: "任务回应",
    coherence: "连贯与衔接",
    lexical: "词汇资源",
    grammar: "语法范围与准确性",
    strengths: "优点",
    priorityFixes: "优先修改点",
    sampleRewrite: "示范改写",
    ready: "已就绪",
    emptyTitle: "开始第一次批改",
    emptyDescription: "选择 Task 1 或 Task 2，粘贴题目和作文，然后运行批改以获取按评分标准生成的反馈。",
    genericError: "发生了一些问题。"
  }
} as const;

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
  const [locale, setLocale] = useState<Locale>("zh-CN");
  const [taskType, setTaskType] = useState<TaskType>("task2");
  const provider: AiProvider = "deepseek";
  const [prompt, setPrompt] = useState(TASK_PLACEHOLDERS.task2.prompt);
  const [essay, setEssay] = useState(TASK_PLACEHOLDERS.task2.essay);
  const [result, setResult] = useState<WritingCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const t = UI_COPY[locale];

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
          provider,
          locale,
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
      setError(submissionError instanceof Error ? submissionError.message : t.genericError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="pageShell">
      <section className="hero">
        <div className="heroCopy">
          <div className="heroTopbar">
            <div>
              <p className="eyebrow">{t.heroEyebrow}</p>
            </div>
            <label className="localeControl">
              <span>{t.languageLabel}</span>
              <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
                <option value="zh-CN">简体中文</option>
                <option value="en">English</option>
              </select>
            </label>
          </div>
          <h1>{t.heroTitle}</h1>
          <p className="lede">{t.heroDescription}</p>
        </div>
        <div className="heroStat">
          <span>{t.modesLabel}</span>
          <strong>{result?.feedbackMode === "ai" ? t.aiReview : t.heuristicReady}</strong>
          <small>{t.coverage}</small>
        </div>
      </section>

      <section className="workspace">
        <form className="editorPanel" onSubmit={handleSubmit}>
          <div className="segmentedControl" role="tablist" aria-label={t.taskSwitcherAria}>
            <button
              type="button"
              className={taskType === "task1" ? "active" : ""}
              onClick={() => onTaskTypeChange("task1")}
            >
              {t.task1}
            </button>
            <button
              type="button"
              className={taskType === "task2" ? "active" : ""}
              onClick={() => onTaskTypeChange("task2")}
            >
              {t.task2}
            </button>
          </div>

          <label>
            <span>{t.prompt}</span>
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={5} />
          </label>

          <label>
            <span>{t.essay}</span>
            <textarea value={essay} onChange={(event) => setEssay(event.target.value)} rows={16} />
          </label>

          <div className="editorFooter">
            <p>
              {t.wordCount}: <strong>{essay.trim() ? essay.trim().split(/\s+/).length : 0}</strong>
            </p>
            <button type="submit" disabled={loading}>
              {loading ? t.checking : t.checkWriting}
            </button>
          </div>

          {error ? <p className="errorBox">{error}</p> : null}
        </form>

        <section className="resultsPanel">
          {result ? (
            <>
              <div className="resultHero">
                <div>
                  <p className="eyebrow">{t.estimatedBand}</p>
                  <h2>{result.estimatedBand.toFixed(1)}</h2>
                </div>
                <div className="resultMeta">
                  <span>{result.taskType === "task1" ? t.task1 : t.task2}</span>
                  <span>
                    {result.wordCount} {locale === "zh-CN" ? "词" : "words"}
                  </span>
                  <span>{result.feedbackMode === "ai" ? t.aiMode : t.heuristicMode}</span>
                  <span>
                    {locale === "zh-CN" ? "当前平台" : "Provider"}: {result.providerUsed}
                  </span>
                </div>
              </div>

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
                <h3>{t.strengths}</h3>
                <ul>
                  {result.strengths.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>

              <article className="feedbackSection">
                <h3>{t.priorityFixes}</h3>
                <ul>
                  {result.priorityFixes.map((item) => (
                    <li key={item.title}>
                      <strong>{item.title}:</strong> {item.detail}
                    </li>
                  ))}
                </ul>
              </article>

              <article className="feedbackSection">
                <h3>{t.sampleRewrite}</h3>
                <p>{result.sampleRewrite}</p>
              </article>
            </>
          ) : (
            <div className="emptyState">
              <p className="eyebrow">{t.ready}</p>
              <h2>{t.emptyTitle}</h2>
              <p>{t.emptyDescription}</p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
