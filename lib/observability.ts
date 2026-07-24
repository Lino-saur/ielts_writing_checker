type OperationalLevel = "error" | "warn";

function sanitizeDetails(details: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(details).filter(([key]) => !/(essay|prompt|content|email|token|secret|authorization|cookie)/i.test(key))
  );
}

export async function reportOperationalEvent(
  level: OperationalLevel,
  event: string,
  details: Record<string, unknown> = {}
) {
  const payload = {
    level,
    event,
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
    region: process.env.VERCEL_REGION || process.env.AWS_REGION || null,
    details: sanitizeDetails(details)
  };

  console[level](JSON.stringify(payload));

  const alertUrl = process.env.OPS_ALERT_WEBHOOK_URL?.trim();
  if (level !== "error" || !alertUrl) return;
  try {
    const parsed = new URL(alertUrl);
    if (parsed.protocol !== "https:") throw new Error("ALERT_WEBHOOK_MUST_USE_HTTPS");
    await fetch(parsed, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3_000)
    });
  } catch (alertError) {
    console.error(JSON.stringify({
      level: "error",
      event: "ops_alert_delivery_failed",
      timestamp: new Date().toISOString(),
      details: { message: alertError instanceof Error ? alertError.message : "UNKNOWN_ERROR" }
    }));
  }
}
