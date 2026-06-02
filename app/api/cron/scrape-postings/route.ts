import { NextResponse } from "next/server";
import { INSTANT_ALERT_LOOKBACK_MS } from "@/lib/config/alerts";
import { processInstantAlerts } from "@/lib/alerts/send-instant";
import { isCronAuthorized } from "@/lib/cron/is-authorized";
import { runAllScrapes } from "@/lib/scraping/run-all";

export const runtime = "nodejs";
/** Full Discover scrape runs parallel company fetches (see SCRAPE_COMPANY_CONCURRENCY) plus DB upserts. */
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await runAllScrapes();
    let alerts = { sent: 0, errors: 0 };
    try {
      const since = new Date(Date.now() - INSTANT_ALERT_LOOKBACK_MS);
      alerts = await processInstantAlerts(since);
    } catch (alertError) {
      console.error("Instant alerts failed:", alertError);
    }
    return NextResponse.json({ ok: true, sources: results, alerts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scrape failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
