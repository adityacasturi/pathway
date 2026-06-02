import { buildSentKey } from "@/lib/alerts/match-postings";
import type { AlertMatch } from "@/lib/alerts/types";

export function dedupeAlertMatches(matches: AlertMatch[]): AlertMatch[] {
  const seen = new Set<string>();
  const result: AlertMatch[] = [];

  for (const match of matches) {
    const key = buildSentKey(match.userId, match.posting.postingId, match.channel);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(match);
  }

  return result;
}
