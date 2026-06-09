import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { settleRechargeOrder } from "@/lib/recharge";
import type { RechargeProvider } from "@/lib/types";

type MarkPaidBody = {
  orderId?: string;
  provider?: RechargeProvider;
  providerOrderId?: string;
};

export async function POST(request: Request) {
  try {
    const { adminUser } = await requireAdminSession();
    const body = (await request.json()) as MarkPaidBody;

    const order = await settleRechargeOrder({
      orderId: body.orderId?.trim(),
      provider: body.provider,
      providerOrderId: body.providerOrderId?.trim() || null,
      source: `admin_reconcile:${adminUser.id}`
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
