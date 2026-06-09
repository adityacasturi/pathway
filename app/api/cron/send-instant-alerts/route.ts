import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron/is-authorized";
import { processInstantAlertsForCron } from "@/lib/cron/instant-alerts";
import { errorMessage, logServerEvent } from "@/lib/observability";

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
    logServerEvent({
      level: "error",
      event: "cron.send_instant_alerts.failed",
      route: "/api/cron/send-instant-alerts",
      message: errorMessage(error),
    });
    return NextResponse.json({ ok: false, error: "Instant alerts failed." }, { status: 500 });
  }
}
