import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getProductionReadiness } from "@/lib/production-readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  let databaseReady = false;
  try {
    await db.query("SELECT 1");
    databaseReady = true;
  } catch {
    databaseReady = false;
  }

  const configuration = getProductionReadiness();
  const production = process.env.NODE_ENV === "production";
  const ready = databaseReady && (!production || configuration.ready);

  return NextResponse.json(
    {
      status: ready ? "ok" : "not_ready",
      database: databaseReady ? "ok" : "unavailable",
      configuration: production
        ? { ready: configuration.ready, missing: configuration.checks.filter((check) => !check.ready).map((check) => check.key) }
        : { ready: true, missing: [] },
      durationMs: Date.now() - startedAt,
      timestamp: new Date().toISOString()
    },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
