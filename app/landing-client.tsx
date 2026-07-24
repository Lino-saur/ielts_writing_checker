"use client";

import { useEffect } from "react";
import { AppNavbar } from "@/components/app-navbar";
import { getMessages } from "@/lib/i18n/messages";
import { useRouteLocale } from "@/lib/i18n/use-route-locale";

const copy = {
  "zh-CN": {
    nav: ["批改", "真题练习", "历史记录"],
    language: "简体中文",
    open: "进入批改器",
    badge: "Task 1 + Task 2 已支持",
    hero: "为下一次提分而设计的 IELTS 写作批改器",
    heroBody: "不只是给你一个分数。它把 Band 标准、文中修改、重点修正和历史记录放在同一个学习循环里，帮你直接推进下一稿。",
    tryTask2: "试用 Task 2",
    metrics: [["Task 1 + Task 2", "题型覆盖"], ["4 项 Band 维度", "评分标准"], ["History", "记录查看与复盘"]],
    scoreEyebrow: "Score Feedback Preview",
    scoreTitle: "把 Band 分数变成下一稿的修改路线",
    scoreBody: "预览区模拟一次 Task 2 批改：先看总分，再定位四项评分维度，最后进入文中反馈和重点修正。",
    finished: "批改完成 · 42 秒",
    estimated: "Estimated Band",
    improve: "可提升",
    inlineTitle: "文中修改建议",
    inlineNote: "建议补充更具体的例子，否则论证停留在概括层面。",
    priority: "下一稿优先修正",
    fixes: ["第二段补充更可验证的例子", "把主题句和题目关键词对齐", "减少重复表达，替换为更准确动词"],
    loopEyebrow: "Correction Loop",
    loopTitle: "一次批改，服务完整的重写循环",
    loopBody: "先提交作文，再理解分数与扣分点，最后带着明确优先级重写。",
    steps: [
      ["01 · Submit", "提交 Task 1 / Task 2 作文", "Task 1 可以先上传图表、流程图或表格图片；Task 2 直接提交正文，进入批改流程。"],
      ["02 · Diagnose", "看懂 Band 分数背后的原因", "从四项评分维度定位问题，快速判断是回应题目、逻辑、词汇还是语法拖慢了分数。"],
      ["03 · Rewrite", "按优先级推进下一稿", "把文中修改、重点修正和历史记录串起来，形成下一次练习前最清楚的改写清单。"]
    ],
    tasksEyebrow: "Supported Tasks",
    tasksTitle: "覆盖真实练习里最常见的两条路径",
    uploadLabel: "上传图表 / 表格 / 流程图",
    task1Title: "Task 1 · 图像题支持",
    task1Subtitle: "上传图片后再批改，更接近真实练习",
    task1Body: "先在浏览器端压缩题目图片，再把作文与原图关联到批改记录里，方便之后回看。",
    task2Title: "Task 2 · 反复修改",
    task2Subtitle: "更适合对照学习和下一轮改写",
    task2Body: "除了整体 Band 分数，还会给出文中修改和重点修正项，帮助你明确下一稿从哪里开始。",
    archiveEyebrow: "Review Archive",
    archiveTitle: "每一次批改，都回到你的复盘轨迹里",
    archiveBody: "登录后可以回看过往 Task 1 / Task 2 批改结果，把原文、原图和反馈上下文重新串起来，作为下一次重写的参考。",
    archiveCta: "打开历史记录",
    timeline: [["本周第 3 次 Task 2 改写", "Band 6.0 → 6.5，优先补强例证深度"], ["Task 1 图表作文记录", "原图与批改结果一起保存，方便二刷同一题型"], ["重点修正归档", "保留原文、分数与反馈上下文，用于下一轮对比"]],
    finalTitle: "打开批改器，获得更快的修改循环",
    finalBody: "Band 评分、文中反馈、题型覆盖和历史记录已经可以完整使用。",
    start: "开始批改",
    viewTask1: "查看 Task 1"
  },
  en: {
    nav: ["Checker", "Practice", "History"],
    language: "English",
    open: "Open checker",
    badge: "Task 1 + Task 2 supported",
    hero: "An IELTS writing checker built for your next band improvement",
    heroBody: "More than a score. Band criteria, inline edits, priority fixes, and review history form one learning loop that moves your next draft forward.",
    tryTask2: "Try Task 2",
    metrics: [["Task 1 + Task 2", "Task coverage"], ["4 Band criteria", "Scoring rubric"], ["History", "Review and reflect"]],
    scoreEyebrow: "Score Feedback Preview",
    scoreTitle: "Turn a Band score into a revision plan",
    scoreBody: "This Task 2 preview moves from the overall score to rubric dimensions, inline feedback, and the fixes that matter most.",
    finished: "Review complete · 42 sec",
    estimated: "Estimated Band",
    improve: "Can improve",
    inlineTitle: "Inline revision notes",
    inlineNote: "Add a more specific example so the argument moves beyond a general claim.",
    priority: "Priorities for the next draft",
    fixes: ["Add a verifiable example to paragraph two", "Align topic sentences with the prompt", "Replace repeated phrases with precise verbs"],
    loopEyebrow: "Correction Loop",
    loopTitle: "One review, a complete rewrite loop",
    loopBody: "Submit the essay, understand the score, then rewrite with clear priorities.",
    steps: [
      ["01 · Submit", "Submit a Task 1 or Task 2 essay", "Upload a chart, process, or table for Task 1; submit your text directly for Task 2."],
      ["02 · Diagnose", "Understand what drives the Band score", "Use four scoring dimensions to see whether task response, structure, vocabulary, or grammar is holding you back."],
      ["03 · Rewrite", "Move the next draft forward", "Combine inline edits, priority fixes, and history into one clear rewrite checklist."]
    ],
    tasksEyebrow: "Supported Tasks",
    tasksTitle: "The two paths you use most in real practice",
    uploadLabel: "Upload chart / table / process",
    task1Title: "Task 1 · Image support",
    task1Subtitle: "Review with the source image attached",
    task1Body: "The browser compresses the prompt image and links it to the review so it remains available when you return later.",
    task2Title: "Task 2 · Iterative revision",
    task2Subtitle: "Built for comparison and the next rewrite",
    task2Body: "Alongside the Band score, inline edits and priority fixes show exactly where the next draft should begin.",
    archiveEyebrow: "Review Archive",
    archiveTitle: "Every review returns to your learning timeline",
    archiveBody: "Reopen earlier Task 1 and Task 2 results with the original essay, source image, and feedback context ready for the next rewrite.",
    archiveCta: "Open history",
    timeline: [["Third Task 2 rewrite this week", "Band 6.0 → 6.5, with deeper examples next"], ["Task 1 chart essay", "Source image and review stay together"], ["Priority fix archive", "Keep the essay, score, and feedback context"]],
    finalTitle: "Open the checker and build a faster revision loop",
    finalBody: "Band scoring, inline feedback, task coverage, and review history are ready to use.",
    start: "Start a review",
    viewTask1: "View Task 1"
  }
} as const;

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

export default function LandingPageClient() {
  const [locale, setLocale] = useRouteLocale();
  const { navbar } = getMessages(locale);
  const t = copy[locale];
  const href = (path: string) => `/${locale}${path}`;

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
          <div className="framerActions">
            <a className="framerButton framerButtonDark" href={href("/checker")}>{t.open}<Arrow /></a>
            <a className="framerButton framerButtonLight" href={href("/checker?task=task2")}>{t.tryTask2}</a>
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
        <div className="framerWorkflowGrid">{t.steps.map(([eyebrow, title, body]) => <article key={eyebrow}><span>{eyebrow}</span><h3>{title}</h3><p>{body}</p><i aria-hidden="true">→</i></article>)}</div>
      </section>

      <section className="framerTasks framerReveal">
        <header className="framerSectionHeader"><p>{t.tasksEyebrow}</p><h2>{t.tasksTitle}</h2></header>
        <div className="framerTaskGrid">
          <article className="framerTaskCard">
            <div className="framerUploadVisual"><div className="framerUploadIcon">↑</div><strong>{t.uploadLabel}</strong><span>PNG · JPG · WEBP</span></div>
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
        <div className="framerStudyDetail"><span>Band scoring</span><span>Inline feedback</span><span>Task 1 + Task 2</span><span>Review history</span></div>
        <h2>{t.finalTitle}</h2><p>{t.finalBody}</p>
        <div className="framerActions"><a className="framerButton framerButtonWhite" href={href("/checker")}>{t.start}<Arrow /></a><a className="framerButton framerButtonGhost" href={href("/checker?task=task1")}>{t.viewTask1}</a></div>
      </section>

      <footer className="framerFooter"><span>© 2026 IELTS Writing Checker</span><div><a href={href("/privacy")}>{locale === "zh-CN" ? "隐私政策" : "Privacy"}</a><a href={href("/terms")}>{locale === "zh-CN" ? "用户协议" : "Terms"}</a><a href={href("/refund")}>{locale === "zh-CN" ? "退款规则" : "Refunds"}</a><a href="mailto:support@ielts-writing-checker.com">support@ielts-writing-checker.com</a></div></footer>
    </main>
  );
}
