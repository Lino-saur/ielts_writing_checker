import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
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
    const body = (await request.json()) as { orderId?: string; kind?: OrderSupportKind; reason?: string; details?: string };
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
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHORIZED" ? 401 : message === "RECHARGE_ORDER_NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
