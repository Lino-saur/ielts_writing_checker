import { buildRechargePaymentSession } from "@/lib/recharge";
import type { RechargeOrder } from "@/lib/types";
import type { RechargePaymentInitializationResult, RechargeWebhookResult } from "./types";

export async function initializeRechargePayment(order: RechargeOrder): Promise<RechargePaymentInitializationResult> {
  return {
    order,
    payment: buildRechargePaymentSession(order)
  };
}

export async function handlePaymentWebhook(_request: Request): Promise<RechargeWebhookResult> {
  return {
    received: true,
    ignored: true,
    provider: "manual",
    eventType: "ignored.unsupported_provider"
  };
}
