import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { apiErrorResponse, enforceRateLimit, readJsonBody } from "@/lib/api-security";
import { initializeRechargePayment } from "@/lib/payments";
import { createRechargeOrder, listRechargeOrdersForUser, markRechargeOrderFailed } from "@/lib/recharge";
import type { RechargeProvider } from "@/lib/types";

type CreateOrderBody = {
  productCode?: string;
  provider?: RechargeProvider;
};

function normalizeProvider(provider?: RechargeProvider) {
  if (provider === "wechat" || provider === "alipay" || provider === "manual") {
    return provider;
  }

  return "wechat" satisfies RechargeProvider;
}

export async function GET() {
  try {
    const session = await requireSession();
    const items = await listRechargeOrdersForUser(session.user.id);
    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    await enforceRateLimit({
      scope: "recharge-order-create",
      subject: session.user.id,
      limit: 10,
      windowSeconds: 60
    });
    const body = await readJsonBody<CreateOrderBody>(request, 16 * 1024);
    const productCode = body.productCode?.trim();

    if (!productCode) {
      return NextResponse.json({ error: "PRODUCT_CODE_REQUIRED" }, { status: 400 });
    }

    const order = await createRechargeOrder({
      userId: session.user.id,
      productCode,
      provider: normalizeProvider(body.provider)
    });

    try {
      const initialized = await initializeRechargePayment(order);

      return NextResponse.json({
        order: initialized.order,
        payment: initialized.payment
      });
    } catch (error) {
      await markRechargeOrderFailed(order.id);
      throw error;
    }
  } catch (error) {
    const normalized = apiErrorResponse(error);
    const message = normalized.message;
    const status =
      message === "RECHARGE_PRODUCT_NOT_FOUND"
        ? 404
        : message === "UNAUTHORIZED"
          ? 401
          : normalized.status;

    return NextResponse.json(
      { error: message },
      { status, headers: normalized.retryAfterSeconds ? { "Retry-After": String(normalized.retryAfterSeconds) } : undefined }
    );
  }
}
