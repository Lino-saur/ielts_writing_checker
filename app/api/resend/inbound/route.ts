import { NextResponse } from "next/server";
import { reportOperationalEvent } from "@/lib/observability";
import { ingestSupportInbound } from "@/lib/support-inbox";
import { verifyResendWebhookPayload } from "@/lib/resend-webhook";

function verifyPayload(request: Request, payload: string) {
  const signingSecret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (signingSecret) {
    return verifyResendWebhookPayload(payload, {
      id: request.headers.get("svix-id") || "",
      timestamp: request.headers.get("svix-timestamp") || "",
      signature: request.headers.get("svix-signature") || ""
    }, signingSecret);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("RESEND_WEBHOOK_SECRET_NOT_CONFIGURED");
  }

  return JSON.parse(payload) as Record<string, unknown>;
}

export async function POST(request: Request) {
  const rawPayload = await request.text();
  if (Buffer.byteLength(rawPayload, "utf8") > 1024 * 1024) {
    return NextResponse.json({ error: "REQUEST_TOO_LARGE" }, { status: 413 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = verifyPayload(request, rawPayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const configurationError = message === "RESEND_WEBHOOK_SECRET_NOT_CONFIGURED";
    return NextResponse.json(
      { error: configurationError ? message : "INVALID_WEBHOOK_SIGNATURE" },
      { status: configurationError ? 503 : 401 }
    );
  }

  try {
    const result = await ingestSupportInbound(payload);
    return NextResponse.json(result);
  } catch (error) {
    reportOperationalEvent("error", "support_inbound_ingestion_failed", { error });
    return NextResponse.json({ error: "WEBHOOK_PROCESSING_FAILED" }, { status: 500 });
  }
}
