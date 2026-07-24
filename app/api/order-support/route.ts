import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { apiErrorResponse, enforceRateLimit, readJsonBody } from "@/lib/api-security";
import { createOrderSupportRequest, listOrderSupportForUser } from "@/lib/order-support";
import type { OrderSupportKind } from "@/lib/types";

export async function GET() {
  try {
    const session = await requireSession();
    return NextResponse.json({ items: await listOrderSupportForUser(session.user.id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    await enforceRateLimit({ scope: "order-support-create", subject: session.user.id, limit: 5, windowSeconds: 300 });
    const body = await readJsonBody<{ orderId?: string; kind?: OrderSupportKind; reason?: string; details?: string }>(request, 32 * 1024);
    if (!body.orderId || (body.kind !== "inquiry" && body.kind !== "refund") || !body.reason?.trim()) {
      return NextResponse.json({ error: "INVALID_ORDER_SUPPORT_REQUEST" }, { status: 400 });
    }
    const item = await createOrderSupportRequest({
      userId: session.user.id,
      orderId: body.orderId,
      kind: body.kind,
      reason: body.reason,
      details: body.details
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    const normalized = apiErrorResponse(error);
    const rawMessage = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = rawMessage === "RECHARGE_ORDER_NOT_FOUND"
      ? 404
      : rawMessage === "ORDER_NOT_REFUNDABLE"
        ? 400
        : normalized.status;
    return NextResponse.json(
      { error: status === 500 ? normalized.message : rawMessage },
      { status, headers: normalized.retryAfterSeconds ? { "Retry-After": String(normalized.retryAfterSeconds) } : undefined }
    );
  }
}
