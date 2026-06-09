#!/usr/bin/env node
import { processInstantAlertsForCron } from "@/lib/cron/instant-alerts";
import { errorMessage } from "@/lib/observability";
import { loadDotEnvLocal } from "./discover-queue/env.ts";

loadDotEnvLocal();

try {
  const result = await processInstantAlertsForCron();
  const stopped = result.stoppedReason ? ` · stopped=${result.stoppedReason}` : "";
  console.log(`Instant alerts complete — sent=${result.sent} errors=${result.errors}${stopped}`);
  process.exit(result.errors > 0 ? 1 : 0);
} catch (error) {
  console.error(`Instant alerts failed — ${errorMessage(error)}`);
  process.exit(1);
}
