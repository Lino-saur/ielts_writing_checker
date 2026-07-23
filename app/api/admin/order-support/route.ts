import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { listOrderSupportForAdmin, updateOrderSupportStatus } from "@/lib/order-support";

export async function GET() {
  try {
    await requireAdminSession();
    return NextResponse.json({ items: await listOrderSupportForAdmin() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdminSession();
    const body = (await request.json()) as {
      requestId?: string;
      action?: "review" | "reject" | "resolve" | "refund";
      adminNote?: string;
    };
    if (!body.requestId || !body.action || !["review", "reject", "resolve", "refund"].includes(body.action)) {
      return NextResponse.json({ error: "INVALID_ADMIN_ACTION" }, { status: 400 });
    }
    const item = await updateOrderSupportStatus({
      requestId: body.requestId,
      action: body.action,
      adminNote: body.adminNote
    });
    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
