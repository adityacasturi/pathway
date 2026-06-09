import { NextResponse } from "next/server";
import { processDigestAlerts } from "@/lib/alerts/send-digest";
import { isCronAuthorized } from "@/lib/cron/is-authorized";
import { errorMessage, logServerEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processDigestAlerts();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    logServerEvent({
      level: "error",
      event: "cron.send_alert_digests.failed",
      route: "/api/cron/send-alert-digests",
      message: errorMessage(error),
    });
    return NextResponse.json({ ok: false, error: "Digest alerts failed." }, { status: 500 });
  }
}
