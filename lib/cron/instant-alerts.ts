import { processInstantAlerts } from "@/lib/alerts/send-instant";
import { INSTANT_ALERT_LOOKBACK_MS } from "@/lib/config/alerts";

export async function processInstantAlertsForCron(now = new Date()): Promise<{
  sent: number;
  errors: number;
}> {
  const since = new Date(now.getTime() - INSTANT_ALERT_LOOKBACK_MS);
  return processInstantAlerts(since);
}
