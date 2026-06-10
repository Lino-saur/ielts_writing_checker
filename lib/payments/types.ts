import type { RechargeOrder, RechargePaymentSession, RechargeProvider } from "@/lib/types";

export type RechargePaymentInitializationResult = {
  order: RechargeOrder;
  payment: RechargePaymentSession;
};

export type RechargeWebhookResult = {
  received: boolean;
  ignored?: boolean;
  provider: RechargeProvider;
  eventType: string;
  order?: RechargeOrder | null;
};
