import { NextResponse } from "next/server";
import { handlePaymentWebhook } from "@/lib/payments";

export async function POST(request: Request) {
  try {
    const result = await handlePaymentWebhook(request);

    return NextResponse.json({
      received: true,
      ignored: result.ignored ?? false,
      provider: result.provider,
      eventType: result.eventType,
      order: result.order ?? null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    const status =
      message === "RECHARGE_ORDER_NOT_FOUND"
        ? 404
        : message === "RECHARGE_ORDER_IDENTIFIER_REQUIRED" || message === "RECHARGE_ORDER_NOT_PAYABLE"
          ? 400
          : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
