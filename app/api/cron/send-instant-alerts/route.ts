import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron/is-authorized";
import { processInstantAlertsForCron } from "@/lib/cron/instant-alerts";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processInstantAlertsForCron();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Instant alerts failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
