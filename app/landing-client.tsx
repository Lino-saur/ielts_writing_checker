"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { AppNavbar } from "@/components/app-navbar";
import { LingFeatureIcon, type LingFeatureIconName } from "@/components/icons/ling-feature-icon";
import { LingUiIcon } from "@/components/icons/ling-ui-icon";
import { LingMascot } from "@/components/ling-mascot";
import { getMessages } from "@/lib/i18n/messages";
import { useRouteLocale } from "@/lib/i18n/use-route-locale";
import type { HistoricalPracticeQuestion, PracticeQuestion } from "@/lib/types";

type PracticePreviewState = {
  historical: HistoricalPracticeQuestion[];
  library: PracticeQuestion[];
};

const copy = {
  "zh-CN": {
    nav: ["批改", "真题练习", "历史记录"],
    language: "简体中文",
    badge: "Task 1 + Task 2 已支持",
    hero: "看懂这一稿，写好下一稿",
    heroBody: "翎儿不只给你一个分数，还会把 Band 标准、文中修改、重点修正和历史记录串成一个学习循环，陪你直接推进下一稿。",
    lingName: "翎儿",
    lingRole: "你的雅思写作教练",
    lingIntro: "陪你读懂反馈，再把下一稿写得更好。",
    metrics: [["Task 1 + Task 2", "题型覆盖"], ["4 项 Band 维度", "评分标准"], ["History", "记录查看与复盘"]],
    scoreEyebrow: "Score Feedback Preview",
    scoreTitle: "把 Band 分数变成下一稿的修改路线",
    scoreBody: "翎儿会先帮你看懂总分，再定位四项评分维度，最后把文中反馈和重点修正整理成下一稿的路线。",
    finished: "批改完成 · 42 秒",
    estimated: "Estimated Band",
    improve: "可提升",
    inlineTitle: "文中修改建议",
    inlineNote: "建议补充更具体的例子，否则论证停留在概括层面。",
    priority: "下一稿优先修正",
    fixes: ["第二段补充更可验证的例子", "把主题句和题目关键词对齐", "减少重复表达，替换为更准确动词"],
    loopEyebrow: "Correction Loop",
    loopTitle: "一次批改，服务完整的重写循环",
    loopBody: "从提交作文、理解分数与扣分点，到带着明确优先级重写，翎儿陪你走完整个循环。",
    steps: [
      ["01 · Submit", "提交 Task 1 / Task 2 作文", "Task 1 可以先上传图表、流程图或表格图片；Task 2 直接提交正文，进入批改流程。"],
      ["02 · Diagnose", "看懂 Band 分数背后的原因", "从四项评分维度定位问题，快速判断是回应题目、逻辑、词汇还是语法拖慢了分数。"],
      ["03 · Rewrite", "按优先级推进下一稿", "把文中修改、重点修正和历史记录串起来，形成下一次练习前最清楚的改写清单。"]
    ],
    practiceEyebrow: "Practice Hub",
    practiceTitle: "从一道题开始，让翎儿陪你完成练习与复盘",
    practiceBody: "浏览近期历史考题，或让翎儿从系统题库中陪你找到适合当前阶段的下一道练习。",
    historicalKicker: "按时间回顾",
    historicalTitle: "历史真题练习",
    historicalBody: "按年份、Task 和题型查看历史写作考题，选择一道题，让翎儿陪你开始针对性练习。",
    historicalCta: "查看历史真题",
    libraryKicker: "系统化练习",
    libraryTitle: "练习题库",
    libraryBody: "按剑桥册次、Test、Task 和主题标签筛选，翎儿陪你逐步覆盖常见写作题型。",
    libraryCta: "浏览练习题库",
    chooseQuestion: "进入题库选择适合你的下一道题",
    tasksEyebrow: "Supported Tasks",
    tasksTitle: "覆盖真实练习里最常见的两条路径",
    uploadLabel: "上传图表 / 表格 / 流程图",
    task1Title: "Task 1 · 图像题支持",
    task1Subtitle: "上传图片后再批改，更接近真实练习",
    task1Body: "上传图表、流程图或表格后，翎儿会结合原图理解作文，并把它们一起保存到批改记录里。",
    task2Title: "Task 2 · 反复修改",
    task2Subtitle: "更适合对照学习和下一轮改写",
    task2Body: "翎儿会在整体 Band 分数之外标注文中修改和重点修正项，帮你明确下一稿从哪里开始。",
    archiveEyebrow: "Review Archive",
    archiveTitle: "每一次批改，都回到你的复盘轨迹里",
    archiveBody: "翎儿会把每次 Task 1 / Task 2 的原文、原图和反馈上下文留在复盘轨迹里，让它们继续服务下一次重写。",
    archiveCta: "打开历史记录",
    timeline: [["本周第 3 次 Task 2 改写", "Band 6.0 → 6.5，优先补强例证深度"], ["Task 1 图表作文记录", "原图与批改结果一起保存，方便二刷同一题型"], ["重点修正归档", "保留原文、分数与反馈上下文，用于下一轮对比"]],
    finalTitle: "打开批改器，获得更快的修改循环",
    finalBody: "准备好下一稿了吗？翎儿会在批改器里陪你完成评分、反馈、修改与复盘。",
    finalLingLabel: "翎儿正在陪你准备下一稿",
    start: "开始批改",
    viewTask1: "查看 Task 1"
  },
  en: {
    nav: ["Checker", "Practice", "History"],
    language: "English",
    badge: "Task 1 + Task 2 supported",
    hero: "Understand this draft. Write a stronger next one.",
    heroBody: "Ling goes beyond a score, connecting Band criteria, inline edits, priority fixes, and review history into one loop that moves your next draft forward.",
    lingName: "Ling",
    lingRole: "Your IELTS writing coach",
    lingIntro: "Understand the feedback, then make the next draft stronger.",
    metrics: [["Task 1 + Task 2", "Task coverage"], ["4 Band criteria", "Scoring rubric"], ["History", "Review and reflect"]],
    scoreEyebrow: "Score Feedback Preview",
    scoreTitle: "Turn a Band score into a revision plan",
    scoreBody: "Ling helps you understand the overall score, locate the four rubric dimensions, and turn inline feedback into a route for the next draft.",
    finished: "Review complete · 42 sec",
    estimated: "Estimated Band",
    improve: "Can improve",
    inlineTitle: "Inline revision notes",
    inlineNote: "Add a more specific example so the argument moves beyond a general claim.",
    priority: "Priorities for the next draft",
    fixes: ["Add a verifiable example to paragraph two", "Align topic sentences with the prompt", "Replace repeated phrases with precise verbs"],
    loopEyebrow: "Correction Loop",
    loopTitle: "One review, a complete rewrite loop",
    loopBody: "From submission and diagnosis to a focused rewrite, Ling stays with you through the complete learning loop.",
    steps: [
      ["01 · Submit", "Submit a Task 1 or Task 2 essay", "Upload a chart, process, or table for Task 1; submit your text directly for Task 2."],
      ["02 · Diagnose", "Understand what drives the Band score", "Use four scoring dimensions to see whether task response, structure, vocabulary, or grammar is holding you back."],
      ["03 · Rewrite", "Move the next draft forward", "Combine inline edits, priority fixes, and history into one clear rewrite checklist."]
    ],
    practiceEyebrow: "Practice Hub",
    practiceTitle: "Start with a question and let Ling guide the practice loop",
    practiceBody: "Browse recent recalled exam questions or let Ling help you find the right structured exercise for your current stage.",
    historicalKicker: "Browse by date",
    historicalTitle: "Past exam practice",
    historicalBody: "Choose a historical question by year, task, or type, then let Ling guide a focused practice.",
    historicalCta: "View past questions",
    libraryKicker: "Structured practice",
    libraryTitle: "Practice library",
    libraryBody: "Filter by Cambridge book, test, task, and topic while Ling helps you cover common writing question types.",
    libraryCta: "Browse the library",
    chooseQuestion: "Open the library and choose your next question",
    tasksEyebrow: "Supported Tasks",
    tasksTitle: "The two paths you use most in real practice",
    uploadLabel: "Upload chart / table / process",
    task1Title: "Task 1 · Image support",
    task1Subtitle: "Review with the source image attached",
    task1Body: "Upload the chart, process, or table so Ling can review the essay with its source image and keep both in the same record.",
    task2Title: "Task 2 · Iterative revision",
    task2Subtitle: "Built for comparison and the next rewrite",
    task2Body: "Alongside the Band score, Ling marks inline edits and priority fixes so you know where the next draft should begin.",
    archiveEyebrow: "Review Archive",
    archiveTitle: "Every review returns to your learning timeline",
    archiveBody: "Ling keeps each essay, source image, and feedback context connected so earlier reviews can guide the next rewrite.",
    archiveCta: "Open history",
    timeline: [["Third Task 2 rewrite this week", "Band 6.0 → 6.5, with deeper examples next"], ["Task 1 chart essay", "Source image and review stay together"], ["Priority fix archive", "Keep the essay, score, and feedback context"]],
    finalTitle: "Open the checker and build a faster revision loop",
    finalBody: "Ready for the next draft? Ling is waiting in the checker to guide scoring, feedback, revision, and reflection.",
    finalLingLabel: "Ling is ready to help with your next draft",
    start: "Start a review",
    viewTask1: "View Task 1"
  }
} as const;

function Arrow() {
  return <LingUiIcon name="arrow-up-right" size={16} />;
}

const workflowIcons: LingFeatureIconName[] = [
  "workflow-submit",
  "workflow-diagnose",
  "workflow-rewrite"
];

export default function LandingPageClient() {
  const [locale, setLocale] = useRouteLocale();
  const { navbar } = getMessages(locale);
  const t = copy[locale];
  const href = (path: string) => `/${locale}${path}`;
  const [practicePreview, setPracticePreview] = useState<PracticePreviewState>({
    historical: [],
    library: []
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadPreview<T>(url: string) {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) return [] as T[];
        const payload = (await response.json()) as { items?: T[] };
        return Array.isArray(payload.items) ? payload.items.slice(0, 2) : [];
      } catch {
        return [] as T[];
      }
    }

    void Promise.all([
      loadPreview<HistoricalPracticeQuestion>("/api/practice/historical?page=1"),
      loadPreview<PracticeQuestion>("/api/practice/questions?page=1&contentStatus=complete")
    ]).then(([historical, library]) => {
      if (!controller.signal.aborted) setPracticePreview({ historical, library });
    });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(".framerReveal"));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -7%" });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <main className="framerLanding">
      <div className="framerLandingNav">
        <AppNavbar locale={locale} onLocaleChange={setLocale} copy={navbar} taskMenuMode="all" />
      </div>

      <section className="framerHero framerReveal">
        <div className="framerHeroCopy">
          <p className="framerBadge">{t.badge}</p>
          <h1>{t.hero}</h1>
          <p className="framerLead">{t.heroBody}</p>
          <div className="framerLingIntro">
            <Image src="/app-icons/icon.png" alt={`${t.lingName} · ${t.lingRole}`} width={56} height={56} priority />
            <div>
              <strong><span className="framerLingName">{t.lingName}</span> · {t.lingRole}</strong>
              <span>{t.lingIntro}</span>
            </div>
            <a className="framerLingCta" href={href("/checker")}>{t.start}<Arrow /></a>
          </div>
        </div>
        <div className="framerMetrics">
          {t.metrics.map(([value, label]) => <article key={label}><strong>{value}</strong><span>{label}</span></article>)}
        </div>
      </section>

      <section className="framerScoreSection framerReveal">
        <header className="framerSectionHeader centered">
          <p>{t.scoreEyebrow}</p><h2>{t.scoreTitle}</h2><span>{t.scoreBody}</span>
        </header>
        <div className="framerCheckerPreview">
          <div className="framerPreviewBar">
            <div className="framerWindowDots"><i /><i /><i /></div>
            <div className="framerTaskSwitch"><span>Task 1</span><strong>Task 2</strong></div>
            <span>{t.finished}</span>
          </div>
          <div className="framerPreviewBody">
            <article className="framerBandPanel">
              <div className="framerScoreHeader"><div><span>{t.estimated}</span><strong>6.5</strong></div><em>{t.improve}</em></div>
              {[["Task Response", "6.0", "60%"], ["Coherence", "7.0", "75%"], ["Lexical", "6.5", "68%"]].map(([label, score, width]) => (
                <div className="framerBandRow" key={label}><span>{label} · {score}</span><i><b style={{ width }} /></i></div>
              ))}
            </article>
            <article className="framerFeedbackPanel">
              <h3>{t.inlineTitle}</h3>
              <div><p>Some people believe that online learning can replace traditional schools…</p><aside>{t.inlineNote}</aside><p>The conclusion is clear, but the second body paragraph needs a stronger link back to the question.</p></div>
            </article>
            <article className="framerPriorityPanel"><h3>{t.priority}</h3>{t.fixes.map((fix, index) => <p key={fix}><b>{index + 1}</b>{fix}</p>)}</article>
          </div>
        </div>
      </section>

      <section className="framerWorkflow framerReveal">
        <header className="framerSectionHeader centered"><p>{t.loopEyebrow}</p><h2>{t.loopTitle}</h2><span>{t.loopBody}</span></header>
        <div className="framerWorkflowGrid">{t.steps.map(([eyebrow, title, body], index) => <article key={eyebrow}><b className="framerWorkflowMark" aria-hidden="true"><LingFeatureIcon name={workflowIcons[index]} size={40} /></b><span>{eyebrow}</span><h3>{title}</h3><p>{body}</p><i aria-hidden="true"><LingUiIcon name="arrow-right" size={20} /></i></article>)}</div>
      </section>

      <section className="framerPracticeHub framerReveal">
        <header className="framerSectionHeader centered"><p>{t.practiceEyebrow}</p><h2>{t.practiceTitle}</h2><span>{t.practiceBody}</span></header>
        <div className="framerPracticeHubGrid">
          <article className="framerPracticeModule is-historical">
            <div className="framerPracticeModuleHead">
              <span className="framerPracticeModuleMark"><LingFeatureIcon name="historical-practice" size={42} /></span>
              <p>{t.historicalKicker}</p>
            </div>
            <h3>{t.historicalTitle}</h3>
            <p className="framerPracticeModuleBody">{t.historicalBody}</p>
            <div className="framerPracticeQuestionList">
              {practicePreview.historical.length ? practicePreview.historical.map((item) => (
                <a key={item.id} href={href(`/checker?task=${item.taskType}&historicalId=${encodeURIComponent(item.id)}`)}>
                  <span><b>{item.taskType === "task1" ? "Task 1" : "Task 2"}</b><em>{item.date} · {item.category}</em></span>
                  <strong>{item.prompt}</strong>
                </a>
              )) : <span className="framerPracticeQuestionEmpty">{t.chooseQuestion}</span>}
            </div>
            <a className="framerPracticeModuleCta" href={href("/practice?source=historical")}>{t.historicalCta}<Arrow /></a>
          </article>

          <article className="framerPracticeModule is-library">
            <div className="framerPracticeModuleHead">
              <span className="framerPracticeModuleMark"><LingFeatureIcon name="practice-library" size={42} /></span>
              <p>{t.libraryKicker}</p>
            </div>
            <h3>{t.libraryTitle}</h3>
            <p className="framerPracticeModuleBody">{t.libraryBody}</p>
            <div className="framerPracticeQuestionList">
              {practicePreview.library.length ? practicePreview.library.map((item) => (
                <a key={item.id} href={href(`/checker?task=${item.taskType}&practiceId=${encodeURIComponent(item.id)}`)}>
                  <span><b>{item.taskType === "task1" ? "Task 1" : "Task 2"}</b><em>Cambridge {item.bookNumber} · Test {item.testNumber}</em></span>
                  <strong>{item.title}</strong>
                </a>
              )) : <span className="framerPracticeQuestionEmpty">{t.chooseQuestion}</span>}
            </div>
            <a className="framerPracticeModuleCta" href={href("/practice")}>{t.libraryCta}<Arrow /></a>
          </article>
        </div>
      </section>

      <section className="framerTasks framerReveal">
        <header className="framerSectionHeader"><p>{t.tasksEyebrow}</p><h2>{t.tasksTitle}</h2></header>
        <div className="framerTaskGrid">
          <article className="framerTaskCard">
            <div className="framerUploadVisual"><div className="framerUploadIcon"><LingUiIcon name="upload" size={23} /></div><strong>{t.uploadLabel}</strong><span>PNG · JPG · WEBP</span></div>
            <div><h3>{t.task1Title}</h3><strong>{t.task1Subtitle}</strong><p>{t.task1Body}</p></div>
          </article>
          <article className="framerTaskCard alt">
            <div className="framerRevisionVisual"><div><span>Thesis clarity</span><strong>+0.5</strong></div><i><b /></i><div><span>Example depth</span><em>Priority</em></div></div>
            <div><h3>{t.task2Title}</h3><strong>{t.task2Subtitle}</strong><p>{t.task2Body}</p></div>
          </article>
        </div>
      </section>

      <section className="framerArchive framerReveal">
        <div className="framerArchiveCopy"><p className="framerEyebrow">{t.archiveEyebrow}</p><h2>{t.archiveTitle}</h2><span>{t.archiveBody}</span><a className="framerButton framerButtonLight" href={href("/history")}>{t.archiveCta}<Arrow /></a></div>
        <div className="framerTimeline">{t.timeline.map(([title, body], index) => <article className={index === 0 ? "current" : ""} key={title}><i>{index + 1}</i><div><strong>{title}</strong><p>{body}</p></div></article>)}</div>
      </section>

      <section className="framerFinal framerReveal">
        <LingMascot state="progress" size="large" motion label={t.finalLingLabel} className="framerFinalLing" />
        <div className="framerStudyDetail"><span>Band scoring</span><span>Inline feedback</span><span>Task 1 + Task 2</span><span>Review history</span></div>
        <h2>{t.finalTitle}</h2><p>{t.finalBody}</p>
        <div className="framerActions"><a className="framerButton framerButtonWhite" href={href("/checker")}>{t.start}<Arrow /></a><a className="framerButton framerButtonGhost" href={href("/checker?task=task1")}>{t.viewTask1}</a></div>
      </section>

      <footer className="framerFooter"><span>© 2026 IELTS Writing Checker</span><div><a href={href("/privacy")}>{locale === "zh-CN" ? "隐私政策" : "Privacy"}</a><a href={href("/terms")}>{locale === "zh-CN" ? "用户协议" : "Terms"}</a><a href={href("/refund")}>{locale === "zh-CN" ? "退款规则" : "Refunds"}</a><a href="mailto:support@ielts-writing-checker.com">support@ielts-writing-checker.com</a></div></footer>
    </main>
  );
}
