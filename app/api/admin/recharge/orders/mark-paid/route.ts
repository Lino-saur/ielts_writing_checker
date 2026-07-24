import { NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/admin/auth";
import { recordAdminAudit } from "@/lib/admin/audit";
import { readJsonBody } from "@/lib/api-security";
import { settleRechargeOrder } from "@/lib/recharge";
import type { RechargeProvider } from "@/lib/types";

type MarkPaidBody = {
  orderId?: string;
  provider?: RechargeProvider;
  providerOrderId?: string;
};

export async function POST(request: Request) {
  try {
    const { adminUser } = await requireAdminRole(["finance"]);
    const body = await readJsonBody<MarkPaidBody>(request, 16 * 1024);

    const order = await settleRechargeOrder({
      orderId: body.orderId?.trim(),
      provider: body.provider,
      providerOrderId: body.providerOrderId?.trim() || null,
      source: `admin_reconcile:${adminUser.id}`
    });
    await recordAdminAudit({
      adminUserId: adminUser.id,
      action: "order.mark_paid",
      targetType: "recharge_order",
      targetId: order.id,
      detail: { provider: order.provider, providerOrderId: order.providerOrderId }
    });

    return NextResponse.json({ order });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    const status =
      message === "RECHARGE_ORDER_NOT_FOUND"
        ? 404
        : message === "RECHARGE_ORDER_IDENTIFIER_REQUIRED" || message === "RECHARGE_ORDER_NOT_PAYABLE"
          ? 400
          : message === "UNAUTHORIZED"
            ? 401
            : message === "FORBIDDEN"
              ? 403
              : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
