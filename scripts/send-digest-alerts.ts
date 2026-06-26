#!/usr/bin/env node
import { processDigestAlerts } from "@/lib/alerts/send-digest";
import { errorMessage } from "@/lib/observability";
import { loadDotEnvLocal } from "./discover-queue/env.ts";

loadDotEnvLocal();

try {
  const result = await processDigestAlerts();
  const stopped = result.stoppedReason ? ` · stopped=${result.stoppedReason}` : "";
  console.log(`Digest alerts complete — sent=${result.sent} errors=${result.errors}${stopped}`);
  process.exit(result.errors > 0 ? 1 : 0);
} catch (error) {
  console.error(`Digest alerts failed — ${errorMessage(error)}`);
  process.exit(1);
}
