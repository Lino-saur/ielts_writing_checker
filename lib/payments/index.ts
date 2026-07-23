import { randomUUID } from "node:crypto";
import { buildRechargePaymentSession, settleRechargeOrder } from "@/lib/recharge";
import type { RechargeOrder } from "@/lib/types";
import type { RechargePaymentInitializationResult, RechargeWebhookResult } from "./types";

export async function initializeRechargePayment(order: RechargeOrder): Promise<RechargePaymentInitializationResult> {
  // Keep the order/payment boundary intact so a real WeChat adapter can replace
  // this branch without changing the recharge API or the client checkout flow.
  if (process.env.PAYMENTS_MODE !== "live") {
    const paidOrder = await settleRechargeOrder({
      orderId: order.id,
      providerOrderId: `sim_${randomUUID()}`,
      source: `recharge:simulated:${order.productCode}`
    });

    return {
      order: paidOrder,
      payment: {
        provider: order.provider,
        mode: "simulated",
        redirectUrl: null,
        qrCodeUrl: null,
        clientPayload: null,
        message: "Payment simulated successfully."
      }
    };
  }

  return {
    order,
    payment: buildRechargePaymentSession(order)
  };
}

export async function handlePaymentWebhook(_request: Request): Promise<RechargeWebhookResult> {
  void _request;
  return {
    received: true,
    ignored: true,
    provider: "manual",
    eventType: "ignored.unsupported_provider"
  };
}
