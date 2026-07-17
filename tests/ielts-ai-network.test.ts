import { describe, expect, it } from "vitest";
import { isAiTimeoutError, isRetryableAiNetworkError } from "@/lib/ielts/ai";

describe("IELTS AI network recovery", () => {
  it("retries nested connection timeouts from fetch", () => {
    const cause = new Error("Connect Timeout Error");
    cause.name = "ConnectTimeoutError";
    const error = new TypeError("fetch failed", { cause });

    expect(isRetryableAiNetworkError(error)).toBe(true);
    expect(isAiTimeoutError(error)).toBe(true);
  });

  it("does not retry the configured whole-request timeout", () => {
    const error = new Error("The operation was aborted due to timeout");
    error.name = "TimeoutError";

    expect(isRetryableAiNetworkError(error)).toBe(false);
    expect(isAiTimeoutError(error)).toBe(true);
  });

  it("does not retry unrelated programming or validation errors", () => {
    expect(isRetryableAiNetworkError(new TypeError("Invalid JSON shape"))).toBe(false);
    expect(isAiTimeoutError(new TypeError("Invalid JSON shape"))).toBe(false);
  });
});
