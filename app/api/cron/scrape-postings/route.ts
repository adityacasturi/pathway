import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron/is-authorized";
import { processInstantAlertsForCron } from "@/lib/cron/instant-alerts";
import { parseScrapeCronParams } from "@/lib/cron/scrape-request";
import { runAllScrapes } from "@/lib/scraping/run-all";

export const runtime = "nodejs";
/** Full Discover scrape runs parallel company fetches (see SCRAPE_COMPANY_CONCURRENCY) plus DB upserts. */
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = parseScrapeCronParams(new URL(request.url).searchParams);
  if (!params.ok) {
    return NextResponse.json({ ok: false, error: params.error }, { status: 400 });
  }

  try {
    const results = await runAllScrapes({ sourceShard: params.value.sourceShard });
    let alerts: { sent: number; errors: number } | null = null;
    if (params.value.includeAlerts) {
      try {
        alerts = await processInstantAlertsForCron();
      } catch (alertError) {
        console.error("Instant alerts failed:", alertError);
        alerts = { sent: 0, errors: 1 };
      }
    }
    return NextResponse.json({
      ok: true,
      shard: params.value.sourceShard ?? null,
      sources: results,
      alerts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scrape failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
