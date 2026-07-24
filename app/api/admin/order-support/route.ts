import { NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/admin/auth";
import { recordAdminAudit } from "@/lib/admin/audit";
import { apiErrorResponse, readJsonBody } from "@/lib/api-security";
import { listOrderSupportForAdmin, updateOrderSupportStatus } from "@/lib/order-support";

export async function GET() {
  try {
    await requireAdminRole(["support", "finance"]);
    return NextResponse.json({ items: await listOrderSupportForAdmin() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await readJsonBody<{
      requestId?: string;
      action?: "review" | "reject" | "resolve" | "refund";
      adminNote?: string;
    }>(request, 32 * 1024);
    if (!body.requestId || !body.action || !["review", "reject", "resolve", "refund"].includes(body.action)) {
      return NextResponse.json({ error: "INVALID_ADMIN_ACTION" }, { status: 400 });
    }
    const { adminUser } = await requireAdminRole(body.action === "refund" ? ["finance"] : ["support", "finance"]);
    const item = await updateOrderSupportStatus({
      requestId: body.requestId,
      action: body.action,
      adminNote: body.adminNote
    });
    await recordAdminAudit({
      adminUserId: adminUser.id,
      action: `order_support.${body.action}`,
      targetType: "order_support_request",
      targetId: item.id,
      detail: { orderId: item.orderId, status: item.status }
    });
    return NextResponse.json({ item });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const normalized = apiErrorResponse(error);
    const status = rawMessage === "FORBIDDEN"
      ? 403
      : rawMessage === "ORDER_SUPPORT_NOT_FOUND"
        ? 404
        : ["ORDER_NOT_REFUNDABLE", "ORDER_BENEFIT_ALREADY_USED", "ORDER_BENEFIT_NOT_FOUND"].includes(rawMessage)
          ? 400
          : normalized.status;
    return NextResponse.json(
      { error: status === 500 ? normalized.message : rawMessage },
      { status, headers: normalized.retryAfterSeconds ? { "Retry-After": String(normalized.retryAfterSeconds) } : undefined }
    );
  }
}
