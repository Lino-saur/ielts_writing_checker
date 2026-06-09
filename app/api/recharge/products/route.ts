import { NextResponse } from "next/server";
import { listRechargeProducts } from "@/lib/recharge";

export async function GET() {
  try {
    const items = await listRechargeProducts();
    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
