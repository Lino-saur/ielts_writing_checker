import { NextResponse } from "next/server";
import { ingestSupportInbound } from "@/lib/support-inbox";

function isAuthorized(request: Request) {
  const expectedToken = process.env.RESEND_INBOUND_WEBHOOK_SECRET?.trim();
  if (!expectedToken) {
    return process.env.NODE_ENV !== "production";
  }

  const { searchParams } = new URL(request.url);
  return searchParams.get("token") === expectedToken;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const result = await ingestSupportInbound(payload);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
