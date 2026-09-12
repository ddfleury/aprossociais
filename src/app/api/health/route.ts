import { NextResponse } from "next/server";

import { queryOne, type RowDataPacket } from "@/core/db/pool";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await queryOne<RowDataPacket>("SELECT 1 AS ok");
    return NextResponse.json(
      {
        status: "ok",
        database: "available",
        timestamp: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Health check do banco falhou", error);
    return NextResponse.json(
      {
        status: "degraded",
        database: "unavailable",
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
