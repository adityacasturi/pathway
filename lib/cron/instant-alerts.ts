import { processInstantAlerts } from "@/lib/alerts/send-instant";
import type { ResendBatchResult } from "@/lib/email/resend-batch";
import { INSTANT_ALERT_LOOKBACK_MS } from "@/lib/config/alerts";

export async function processInstantAlertsForCron(now = new Date()): Promise<ResendBatchResult> {
  const since = new Date(now.getTime() - INSTANT_ALERT_LOOKBACK_MS);
  return processInstantAlerts(since);
}
