import { afterEach, describe, expect, it, vi } from "vitest";
import { getProductionReadiness } from "@/lib/production-readiness";

const required = {
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "https://example.com",
  NEXT_PUBLIC_APP_URL: "https://example.com",
  DATABASE_URL: "postgresql://example/database?sslmode=verify-full",
  AI_DEBUG_LOGS: "false",
  QIANWEN_API_KEY: "test",
  RESEND_API_KEY: "test",
  AUTH_EMAIL_FROM: "Test <test@example.com>",
  RESEND_WEBHOOK_SECRET: "whsec_test",
  REVIEW_IMAGE_STORAGE_ENDPOINT: "https://storage.example.com",
  REVIEW_IMAGE_STORAGE_REGION: "auto",
  REVIEW_IMAGE_STORAGE_BUCKET: "reviews",
  REVIEW_IMAGE_STORAGE_ACCESS_KEY_ID: "test",
  REVIEW_IMAGE_STORAGE_SECRET_ACCESS_KEY: "test",
  LEGAL_OPERATOR_NAME: "Example Co.",
  LEGAL_SUPPORT_EMAIL: "support@example.com"
};

afterEach(() => vi.unstubAllEnvs());

describe("production readiness", () => {
  it("passes when every production dependency is configured", () => {
    Object.entries(required).forEach(([key, value]) => vi.stubEnv(key, value));
    expect(getProductionReadiness()).toMatchObject({ ready: true });
  });

  it("reports unsafe auth and missing legal identity", () => {
    Object.entries(required).forEach(([key, value]) => vi.stubEnv(key, value));
    vi.stubEnv("BETTER_AUTH_URL", "http://example.com");
    vi.stubEnv("LEGAL_OPERATOR_NAME", "");
    const result = getProductionReadiness();
    expect(result.ready).toBe(false);
    expect(result.checks.filter((check) => !check.ready).map((check) => check.key)).toEqual(["auth_url", "legal_identity"]);
  });

  it("rejects a database connection that does not verify the server certificate", () => {
    Object.entries(required).forEach(([key, value]) => vi.stubEnv(key, value));
    vi.stubEnv("DATABASE_URL", "postgresql://example/database?sslmode=require");
    const result = getProductionReadiness();
    expect(result.ready).toBe(false);
    expect(result.checks.find((check) => check.key === "database_tls")?.ready).toBe(false);
  });
});
