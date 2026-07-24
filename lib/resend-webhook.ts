import { Webhook } from "svix";

export type ResendWebhookHeaders = {
  id: string;
  timestamp: string;
  signature: string;
};

export function verifyResendWebhookPayload(payload: string, headers: ResendWebhookHeaders, signingSecret: string) {
  return new Webhook(signingSecret).verify(payload, {
    "svix-id": headers.id,
    "svix-timestamp": headers.timestamp,
    "svix-signature": headers.signature
  }) as Record<string, unknown>;
}
