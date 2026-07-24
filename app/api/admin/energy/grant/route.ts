import { NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/admin/auth";
import { recordAdminAudit } from "@/lib/admin/audit";
import { readJsonBody } from "@/lib/api-security";
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
    const { adminUser } = await requireAdminRole(["finance"]);
    const body = await readJsonBody<GrantEnergyBody>(request, 16 * 1024);
    const userId = body.userId?.trim();
    const amount = Number(body.amount);

    if (!userId) {
      return NextResponse.json({ error: "USER_ID_REQUIRED" }, { status: 400 });
    }

    const energy = await grantEnergy(userId, amount, {
      source: `admin:${adminUser.id}:${normalizeReason(body.reason)}`
    });
    await recordAdminAudit({
      adminUserId: adminUser.id,
      action: "energy.grant",
      targetType: "user",
      targetId: userId,
      detail: { amount, reason: normalizeReason(body.reason) }
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
