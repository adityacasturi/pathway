#!/usr/bin/env node
import { processInstantAlerts } from "@/lib/alerts/send-instant";
import { INSTANT_ALERT_LOOKBACK_MS } from "@/lib/config/alerts";
import { errorMessage } from "@/lib/observability";
import { loadDotEnvLocal } from "./discover-queue/env.ts";

loadDotEnvLocal();

try {
  const since = new Date(Date.now() - INSTANT_ALERT_LOOKBACK_MS);
  const result = await processInstantAlerts(since);
  const stopped = result.stoppedReason ? ` · stopped=${result.stoppedReason}` : "";
  console.log(`Instant alerts complete — sent=${result.sent} errors=${result.errors}${stopped}`);
  process.exit(result.errors > 0 ? 1 : 0);
} catch (error) {
  console.error(`Instant alerts failed — ${errorMessage(error)}`);
  process.exit(1);
}
