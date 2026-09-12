import { NextResponse } from "next/server";

import { getEnv } from "@/core/config/env";
import { safeEqual, sha256 } from "@/core/crypto/hash";
import { processMessageQueue } from "@/modules/communications/processor";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const expected = getEnv().CRON_SECRET;
  const received =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || !received || !safeEqual(sha256(expected), sha256(received)))
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const result = await processMessageQueue({ limit: 50 });
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
