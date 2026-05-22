import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { getEnergyState, getReviewEnergyCost, rechargeEnergy } from "@/lib/energy";

type RechargeBody = {
  amount?: number;
};

export async function GET() {
  try {
    const session = await requireSession();
    const energy = await getEnergyState(session.user.id);
    return NextResponse.json({
      energy,
      cost: getReviewEnergyCost()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = (await request.json()) as RechargeBody;
    const energy = await rechargeEnergy(session.user.id, Number(body.amount));

    return NextResponse.json({
      energy,
      cost: getReviewEnergyCost()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    const status =
      message === "INVALID_RECHARGE_AMOUNT" ? 400 : message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
