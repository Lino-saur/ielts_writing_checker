import { describe, expect, it } from "vitest";
import { Webhook } from "svix";
import { verifyResendWebhookPayload } from "@/lib/resend-webhook";

describe("Resend webhook verification", () => {
  it("accepts a valid signed raw payload and rejects a modified payload", () => {
    const secret = `whsec_${Buffer.from("test-webhook-secret-test-webhook-secret").toString("base64")}`;
    const webhook = new Webhook(secret);
    const id = "msg_test_webhook";
    const timestamp = new Date();
    const payload = JSON.stringify({ type: "email.received", data: { id: "email_1" } });
    const signature = webhook.sign(id, timestamp, payload);
    const headers = { id, timestamp: String(Math.floor(timestamp.getTime() / 1000)), signature };

    expect(verifyResendWebhookPayload(payload, headers, secret)).toMatchObject({ type: "email.received" });
    expect(() => verifyResendWebhookPayload(`${payload} `, headers, secret)).toThrow();
  });
});
