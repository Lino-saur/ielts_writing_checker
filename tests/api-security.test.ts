import { describe, expect, it } from "vitest";
import {
  ApiError,
  readJsonBody,
  requireBoundedString,
  requireIdempotencyKey
} from "../lib/api-security";

describe("API request security helpers", () => {
  it("reads a JSON body within the configured byte limit", async () => {
    const request = new Request("http://localhost/api/check", {
      method: "POST",
      body: JSON.stringify({ essay: "text" })
    });

    await expect(readJsonBody<{ essay: string }>(request, 1024)).resolves.toEqual({ essay: "text" });
  });

  it("rejects oversized and malformed JSON bodies", async () => {
    const oversized = new Request("http://localhost/api/check", {
      method: "POST",
      body: JSON.stringify({ essay: "x".repeat(100) })
    });
    await expect(readJsonBody(oversized, 20)).rejects.toMatchObject({
      message: "REQUEST_TOO_LARGE",
      status: 413
    });

    const malformed = new Request("http://localhost/api/check", {
      method: "POST",
      body: "{"
    });
    await expect(readJsonBody(malformed, 20)).rejects.toMatchObject({
      message: "INVALID_JSON",
      status: 400
    });
  });

  it("validates bounded strings", () => {
    expect(requireBoundedString("  essay  ", "essay", { maxLength: 10 })).toBe("essay");
    expect(() => requireBoundedString("too long", "essay", { maxLength: 3 })).toThrow(ApiError);
  });

  it("requires a stable idempotency key", () => {
    const valid = new Request("http://localhost", {
      headers: { "Idempotency-Key": "review_request_123456" }
    });
    expect(requireIdempotencyKey(valid)).toBe("review_request_123456");

    const invalid = new Request("http://localhost");
    expect(() => requireIdempotencyKey(invalid)).toThrow("INVALID_IDEMPOTENCY_KEY");
  });
});
