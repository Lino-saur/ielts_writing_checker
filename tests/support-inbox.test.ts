import { describe, expect, it } from "vitest";
import { getSupportInboundIgnoreReason } from "@/lib/support-inbox";

describe("support inbox inbound filtering", () => {
  it("accepts genuine Resend inbound messages", () => {
    expect(getSupportInboundIgnoreReason({
      type: "email.received",
      data: {
        email_id: "inbound-1",
        from: "student@example.com",
        to: ["support@example.com"],
        subject: "Question about my review"
      }
    })).toBeNull();
  });

  it("ignores outbound Resend lifecycle events", () => {
    expect(getSupportInboundIgnoreReason({
      type: "email.sent",
      data: {
        email_id: "outbound-1",
        from: "IELTS Writing Checker <noreply@example.com>",
        to: ["student@example.com"],
        subject: "Welcome"
      }
    })).toBe("non_inbound_event");
  });

  it("ignores verification emails even in legacy payloads without an event type", () => {
    expect(getSupportInboundIgnoreReason({
      data: {
        from: "IELTS Writing Checker <noreply@example.com>",
        to: ["student@example.com"],
        subject: "Verify your email for IELTS Writing Checker"
      }
    })).toBe("verification_email");
  });
});
