import { buildSentKey } from "./match-postings.ts";
import type { AlertMatch } from "./types.ts";

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
