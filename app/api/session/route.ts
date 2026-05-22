import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";

export async function GET() {
  try {
    const session = await requireSession();

    return NextResponse.json({
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        isAnonymous: Boolean(session.user.isAnonymous)
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
