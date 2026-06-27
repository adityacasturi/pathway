#!/usr/bin/env node
import { processDigestAlerts } from "../lib/alerts/send-digest.ts";
import { isAlertFeedSlug, MORNING_BRIEFING_FEED_SLUG } from "../lib/config/alert-feeds.ts";
import { errorMessage } from "../lib/observability.ts";
import { loadDotEnvLocal } from "./discover-queue/env.ts";

loadDotEnvLocal();

const feedArg = process.argv[2]?.trim().toLowerCase();
const feedSlug = feedArg && isAlertFeedSlug(feedArg) ? feedArg : MORNING_BRIEFING_FEED_SLUG;

try {
  const result = await processDigestAlerts(new Date(), { feedSlug });
  const stopped = result.stoppedReason ? ` · stopped=${result.stoppedReason}` : "";
  console.log(
    `Digest alerts complete (${feedSlug}) — sent=${result.sent} errors=${result.errors}${stopped}`,
  );
  process.exit(result.errors > 0 ? 1 : 0);
} catch (error) {
  console.error(`Digest alerts failed — ${errorMessage(error)}`);
  process.exit(1);
}
