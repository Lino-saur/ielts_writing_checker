import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { grantEnergy } from "@/lib/energy";

type GrantEnergyBody = {
  userId?: string;
  amount?: number;
  reason?: string;
};

function normalizeReason(reason?: string) {
  const trimmed = reason?.trim();
  return trimmed ? trimmed.slice(0, 120) : "manual_grant";
}

export async function POST(request: Request) {
  try {
    const { adminUser } = await requireAdminSession();
    const body = (await request.json()) as GrantEnergyBody;
    const userId = body.userId?.trim();
    const amount = Number(body.amount);

    if (!userId) {
      return NextResponse.json({ error: "USER_ID_REQUIRED" }, { status: 400 });
    }

    const energy = await grantEnergy(userId, amount, {
      source: `admin:${adminUser.id}:${normalizeReason(body.reason)}`
    });

    return NextResponse.json({
      userId,
      energy
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    const status =
      message === "INVALID_ENERGY_AMOUNT"
        ? 400
        : message === "UNAUTHORIZED"
          ? 401
          : message === "FORBIDDEN"
            ? 403
            : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
