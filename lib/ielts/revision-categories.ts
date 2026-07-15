import type { Locale } from "../types";

export const GRAMMAR_REVISION_CATEGORIES = [
  "subject_verb_agreement",
  "tense",
  "articles",
  "preposition",
  "word_form",
  "sentence_structure",
  "clause_structure",
  "word_order",
  "verb_pattern",
  "voice",
  "pronoun_reference",
  "parallelism",
  "punctuation",
  "capitalization",
  "collocation",
  "naturalness",
  "other"
] as const;

export const OPTIMIZATION_REVISION_CATEGORIES = [
  "cohesion",
  "clarity",
  "lexical_choice",
  "concision",
  "paragraph_flow",
  "task_response",
  "idea_development",
  "data_accuracy",
  "other"
] as const;

const CATEGORY_LABELS: Record<string, Record<Locale, string>> = {
  subject_verb_agreement: { en: "Grammar - Subject-Verb Agreement", "zh-CN": "主谓一致" },
  tense: { en: "Grammar - Tense", "zh-CN": "时态错误" },
  articles: { en: "Grammar - Articles", "zh-CN": "冠词错误" },
  preposition: { en: "Grammar - Prepositions", "zh-CN": "介词错误" },
  word_form: { en: "Grammar - Word Form", "zh-CN": "词形错误" },
  sentence_structure: { en: "Grammar - Sentence Structure", "zh-CN": "句子结构错误" },
  clause_structure: { en: "Grammar - Clause Structure", "zh-CN": "从句错误" },
  word_order: { en: "Grammar - Word Order", "zh-CN": "语序错误" },
  verb_pattern: { en: "Grammar - Verb Pattern", "zh-CN": "动词搭配 / 非谓语" },
  voice: { en: "Grammar - Voice", "zh-CN": "语态错误" },
  pronoun_reference: { en: "Grammar - Pronoun Reference", "zh-CN": "代词指代错误" },
  parallelism: { en: "Grammar - Parallelism", "zh-CN": "平行结构错误" },
  punctuation: { en: "Mechanics - Punctuation", "zh-CN": "标点错误" },
  capitalization: { en: "Mechanics - Capitalization", "zh-CN": "大小写错误" },
  collocation: { en: "Usage - Collocation", "zh-CN": "搭配错误" },
  naturalness: { en: "Usage - Naturalness", "zh-CN": "表达不自然" },
  cohesion: { en: "Cohesion", "zh-CN": "衔接优化" },
  clarity: { en: "Clarity", "zh-CN": "表达更清晰" },
  lexical_choice: { en: "Lexical Choice", "zh-CN": "词汇选择" },
  concision: { en: "Concision", "zh-CN": "表达更简洁" },
  paragraph_flow: { en: "Paragraph Flow", "zh-CN": "段落衔接" },
  task_response: { en: "Task Response", "zh-CN": "任务回应" },
  idea_development: { en: "Idea Development", "zh-CN": "论点展开" },
  data_accuracy: { en: "Data Accuracy", "zh-CN": "数据准确性" },
  other: { en: "Other", "zh-CN": "其它" }
};

const CATEGORY_ALIASES: Record<string, string> = {
  "主谓一致": "subject_verb_agreement",
  "时态错误": "tense",
  "冠词错误": "articles",
  "介词错误": "preposition",
  "词形错误": "word_form",
  "句子结构错误": "sentence_structure",
  "从句错误": "clause_structure",
  "语序错误": "word_order",
  "动词搭配 / 非谓语": "verb_pattern",
  "语态错误": "voice",
  "代词指代错误": "pronoun_reference",
  "平行结构错误": "parallelism",
  "标点错误": "punctuation",
  "大小写错误": "capitalization",
  "搭配错误": "collocation",
  "表达不自然": "naturalness",
  "衔接优化": "cohesion",
  "表达更清晰": "clarity",
  "词汇选择": "lexical_choice",
  "表达更简洁": "concision",
  "段落衔接": "paragraph_flow",
  "任务回应": "task_response",
  "论点展开": "idea_development",
  "数据准确性": "data_accuracy",
  "其它": "other",
  "其他": "other",
  other: "other"
};

export function normalizeRevisionCategory(category?: string) {
  if (!category) {
    return "other";
  }

  const compact = category.trim();
  if (!compact) {
    return "other";
  }

  const snake = compact.toLowerCase().replace(/[ -]+/g, "_");
  const withoutDomainPrefix = snake.replace(/^(grammar|mechanics|usage)_/, "");

  if (CATEGORY_LABELS[snake]) {
    return snake;
  }

  if (CATEGORY_LABELS[withoutDomainPrefix]) {
    return withoutDomainPrefix;
  }

  return CATEGORY_ALIASES[compact.toLowerCase()] ?? CATEGORY_ALIASES[compact] ?? "other";
}

export function getRevisionCategoryLabel(category: string | undefined, locale: Locale) {
  const normalized = normalizeRevisionCategory(category);
  return CATEGORY_LABELS[normalized]?.[locale] ?? CATEGORY_LABELS.other[locale];
}
