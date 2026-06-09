import { NextResponse } from "next/server";
import { settleRechargeOrder } from "@/lib/recharge";
import type { RechargeProvider } from "@/lib/types";

type PaymentWebhookBody = {
  provider?: RechargeProvider;
  eventType?: string;
  orderId?: string;
  providerOrderId?: string;
};

function isSuccessfulPaymentEvent(eventType?: string) {
  return eventType === "payment.succeeded" || eventType === "checkout.session.completed";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PaymentWebhookBody;

    if (!body.provider) {
      return NextResponse.json({ error: "PROVIDER_REQUIRED" }, { status: 400 });
    }

    if (!isSuccessfulPaymentEvent(body.eventType)) {
      return NextResponse.json({
        received: true,
        ignored: true
      });
    }

    const order = await settleRechargeOrder({
      orderId: body.orderId?.trim(),
      provider: body.provider,
      providerOrderId: body.providerOrderId?.trim() || null,
      source: `webhook:${body.provider}:${body.eventType || "payment.succeeded"}`
    });

    return NextResponse.json({
      received: true,
      order
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
