import { describe, expect, it } from "vitest";
import { clampBand, countSentences, countWords, getLocale, getTargetBand } from "../lib/ielts/shared";

describe("IELTS shared helpers", () => {
  it("counts words across repeated whitespace", () => {
    expect(countWords("  This is\nan IELTS\tessay. ")).toBe(5);
    expect(countWords("")).toBe(0);
  });

  it("counts basic sentence boundaries", () => {
    expect(countSentences("One. Two! Three?")).toBe(3);
  });

  it("rounds and bounds IELTS bands", () => {
    expect(clampBand(6.74)).toBe(6.5);
    expect(clampBand(8.76)).toBe(9);
    expect(clampBand(1)).toBe(3);
  });

  it("normalizes locale and target band defaults", () => {
    expect(getLocale("zh-CN")).toBe("zh-CN");
    expect(getLocale(undefined)).toBe("en");
    expect(getTargetBand(7.5)).toBe(7.5);
    expect(getTargetBand(undefined)).toBe(6.5);
  });
});
