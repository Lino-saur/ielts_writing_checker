import type { Locale, StudentWritingAssignment } from "@/lib/types";

export function getAssignmentCopy(locale: Locale) {
  if (locale === "zh-CN") {
    return {
      title: "我的作业",
      body: "查看老师布置的作文作业，提交作文，并接收老师反馈。",
      loading: "加载中...",
      empty: "暂时没有作业。",
      loadError: "作业加载失败，请稍后重试。",
      detailLoadError: "作业详情加载失败，请稍后重试。",
      notFound: "没有找到这份作业。",
      authTitle: "登录后查看作文作业",
      authBody: "老师布置的作业会绑定到你的账号，请先登录或注册。",
      login: "去登录",
      signUp: "去注册",
      dueAt: "截止时间",
      noDueAt: "不限截止时间",
      instructions: "作业说明",
      prompt: "题目",
      essay: "你的作文",
      essayPlaceholder: "在这里输入或粘贴你的作文。",
      submit: "提交作业",
      resubmit: "重新提交",
      submitting: "提交中...",
      submitted: "已提交",
      reviewed: "老师已反馈",
      notSubmitted: "未提交",
      feedback: "老师反馈",
      score: "老师评分",
      submitError: "提交失败，请检查作文内容后重试。",
      checker: "去自由批改",
      readonly: "题目只读",
      submittedAt: "提交时间",
      wordsUnit: "词",
      wordCount: "字数",
      viewDetail: "进入作业",
      backToList: "返回作业列表",
      hasImage: "含 Task 1 图片",
      createdAt: "发布时间",
      filterAll: "全部",
      filterNotSubmitted: "未提交",
      filterSubmitted: "已提交",
      filterReviewed: "已反馈",
      taskAll: "全部 Task",
      draftSaved: "草稿已自动保存",
      draftRestored: "已恢复本地草稿",
      lateDueAt: "补交截止",
      lateSubmission: "补交",
      resubmissionLocked: "老师已关闭重复提交",
      deadlinePassed: "已过提交截止时间",
      assignmentClosed: "作业已关闭",
      rewriteRequired: "老师要求重写/二次提交",
      scoreBreakdown: "维度评分",
      annotations: "逐条批注",
      suggestion: "建议",
      submitBlocked: "当前不可提交"
    };
  }

  return {
    title: "My assignments",
    body: "View writing assignments from your teacher, submit essays, and read feedback.",
    loading: "Loading...",
    empty: "No assignments yet.",
    loadError: "Failed to load assignments. Please try again later.",
    detailLoadError: "Failed to load assignment details. Please try again later.",
    notFound: "Assignment not found.",
    authTitle: "Sign in to view assignments",
    authBody: "Teacher assignments are linked to your account.",
    login: "Sign in",
    signUp: "Sign up",
    dueAt: "Due",
    noDueAt: "No due date",
    instructions: "Instructions",
    prompt: "Prompt",
    essay: "Your essay",
    essayPlaceholder: "Type or paste your essay here.",
    submit: "Submit assignment",
    resubmit: "Resubmit",
    submitting: "Submitting...",
    submitted: "Submitted",
    reviewed: "Reviewed",
    notSubmitted: "Not submitted",
    feedback: "Teacher feedback",
    score: "Teacher score",
    submitError: "Submission failed. Please check your essay and try again.",
    checker: "Open checker",
    readonly: "Read only",
    submittedAt: "Submitted",
    wordsUnit: "words",
    wordCount: "Word count",
    viewDetail: "Open assignment",
    backToList: "Back to assignments",
    hasImage: "Task 1 image attached",
    createdAt: "Assigned",
    filterAll: "All",
    filterNotSubmitted: "Not submitted",
    filterSubmitted: "Submitted",
    filterReviewed: "Reviewed",
    taskAll: "All tasks",
    draftSaved: "Draft autosaved",
    draftRestored: "Local draft restored",
    lateDueAt: "Late submission deadline",
    lateSubmission: "Late",
    resubmissionLocked: "Resubmission is locked",
    deadlinePassed: "Submission deadline has passed",
    assignmentClosed: "Assignment closed",
    rewriteRequired: "Revision requested",
    scoreBreakdown: "Score breakdown",
    annotations: "Annotations",
    suggestion: "Suggestion",
    submitBlocked: "Submission unavailable"
  };
}

export function formatAssignmentDate(value: string | null, locale: Locale, fallback: string) {
  if (!value) {
    return fallback;
  }
  return new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function assignmentStatusClass(status: StudentWritingAssignment["submissionStatus"]) {
  return status === "reviewed" ? "is-reviewed" : status === "submitted" ? "is-submitted" : "";
}

export function countAssignmentWords(text: string) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}
