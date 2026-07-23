import { describe, expect, it } from "vitest";
import {
  buildGrammarConsolidationInstruction,
  getPromptBundle,
  loadBasePrompt
} from "../lib/ielts/prompts";

function placeholders(template: string) {
  return [...template.matchAll(/{{([A-Za-z0-9]+)}}/g)].map((match) => match[1]).sort();
}

describe("IELTS localized prompts", () => {
  it("selects a fully localized Chinese prompt bundle", async () => {
    const bundle = getPromptBundle("zh-CN");

    expect(await loadBasePrompt("zh-CN")).toContain("严谨、准确的 IELTS 写作评估员");
    expect(bundle.score).toContain("所有面向用户的 rationale、detail、reason、title、strengths 必须使用简体中文");
    expect(bundle.revision).toContain("edits[*].reason 必须包含完整、具体的简体中文说明");
    expect(bundle.revision).toContain("original 与 replacement 必须保持英文");
    expect(bundle.revision).toContain("{{revisionStageAtomicityRule}}");
  });

  it("keeps English as the default prompt locale", async () => {
    expect(await loadBasePrompt()).toContain("precise IELTS writing evaluator");
    expect(getPromptBundle("en").revision).toContain("Every reason must be exactly one concise sentence");
  });

  it("keeps the same template variables in both locales", () => {
    const english = getPromptBundle("en");
    const chinese = getPromptBundle("zh-CN");

    expect(placeholders(chinese.score)).toEqual(placeholders(english.score));
    expect(placeholders(chinese.revision)).toEqual(placeholders(english.revision));
  });

  it("requires grammar consolidation to reject false positives and find omissions", () => {
    const instruction = buildGrammarConsolidationInstruction("en", [
      {
        original: "was",
        corrected: "were",
        category: "subject_verb_agreement",
        reason: "The nearby noun is plural.",
        ruleReferences: [{ id: "grammar", version: 1 }]
      }
    ]);

    expect(instruction).toContain("unverified suggestions");
    expect(instruction).toContain("remove false positives");
    expect(instruction).toContain("Add clear grammar or mechanics errors missed by the first pass");
    expect(instruction).toContain("manufacturing was");
    expect(instruction).toContain("there were 16 million jobs");
    expect(instruction).toContain('"original":"was"');
  });
});
