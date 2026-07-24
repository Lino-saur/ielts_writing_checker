type ReadinessCheck = { key: string; ready: boolean };

function configured(name: string, minimumLength = 1) {
  return (process.env[name]?.trim().length ?? 0) >= minimumLength;
}

function secureUrl(name: string) {
  const value = process.env[name]?.trim();
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function strictDatabaseTls() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value || process.env.POSTGRES_SSL === "false") return false;
  try {
    return new URL(value).searchParams.get("sslmode") === "verify-full";
  } catch {
    return false;
  }
}

export function getProductionReadiness() {
  const checks: ReadinessCheck[] = [
    { key: "auth_secret", ready: configured("BETTER_AUTH_SECRET", 32) },
    { key: "auth_url", ready: secureUrl("BETTER_AUTH_URL") },
    { key: "public_url", ready: secureUrl("NEXT_PUBLIC_APP_URL") },
    { key: "database", ready: configured("DATABASE_URL") },
    { key: "database_tls", ready: strictDatabaseTls() },
    { key: "ai_provider", ready: configured("QIANWEN_API_KEY") || configured("DASHSCOPE_API_KEY") },
    { key: "email_provider", ready: configured("RESEND_API_KEY") && configured("AUTH_EMAIL_FROM") },
    { key: "email_webhook_signature", ready: configured("RESEND_WEBHOOK_SECRET") },
    {
      key: "object_storage",
      ready: [
        "REVIEW_IMAGE_STORAGE_ENDPOINT",
        "REVIEW_IMAGE_STORAGE_REGION",
        "REVIEW_IMAGE_STORAGE_BUCKET",
        "REVIEW_IMAGE_STORAGE_ACCESS_KEY_ID",
        "REVIEW_IMAGE_STORAGE_SECRET_ACCESS_KEY"
      ].every((name) => configured(name))
    },
    { key: "legal_identity", ready: configured("LEGAL_OPERATOR_NAME") && configured("LEGAL_SUPPORT_EMAIL") },
    { key: "safe_ai_logs", ready: process.env.AI_DEBUG_LOGS !== "true" }
  ];

  return { ready: checks.every((check) => check.ready), checks };
}
