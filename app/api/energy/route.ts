import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { getEnergyState, getReviewEnergyCost } from "@/lib/energy";

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
