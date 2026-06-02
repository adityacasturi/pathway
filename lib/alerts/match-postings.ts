import { trimToUsLocations } from "@/lib/feed/us-locations";
import { isCompanyInCuratedSector } from "@/lib/alerts/curated-sectors";
import type { AlertCadence, AlertChannel } from "@/lib/config/alerts";
import type { AlertMatch, AlertPostingCandidate, AlertSubscription } from "@/lib/alerts/types";

export function isAlertEligiblePosting(posting: AlertPostingCandidate): boolean {
  const raw = posting.location?.trim() ?? "";
  if (!raw) return false;
  return trimToUsLocations([raw]).length > 0;
}

export function buildSentKey(userId: string, postingId: string, channel: AlertChannel): string {
  return `${userId}:${postingId}:${channel}`;
}

export function matchPostingsToUsers(
  postings: AlertPostingCandidate[],
  subscriptions: AlertSubscription[],
  sectorMembers: Map<string, Set<string>>,
  options: {
    enabledUserIds: Set<string>;
    sentKeys: Set<string>;
    channel: AlertChannel;
    /** Defaults to `[channel]`. Digest uses instant follows with digest delivery. */
    subscriptionCadences?: AlertCadence[];
  },
): AlertMatch[] {
  const matches: AlertMatch[] = [];
  const eligible = postings.filter(isAlertEligiblePosting);
  const subscriptionCadences = options.subscriptionCadences ?? [options.channel];

  for (const posting of eligible) {
    for (const sub of subscriptions) {
      if (!subscriptionCadences.includes(sub.cadence)) continue;
      if (!options.enabledUserIds.has(sub.userId)) continue;

      const matched =
        (sub.targetType === "company" && sub.targetId === posting.companyId) ||
        (sub.targetType === "industry" && sub.targetId === posting.industrySlug) ||
        (sub.targetType === "sector" &&
          isCompanyInCuratedSector(sub.targetId, posting.companySlug, sectorMembers));
      if (!matched) continue;

      const key = buildSentKey(sub.userId, posting.postingId, options.channel);
      if (options.sentKeys.has(key)) continue;

      matches.push({ userId: sub.userId, posting, channel: options.channel });
    }
  }

  return matches;
}
