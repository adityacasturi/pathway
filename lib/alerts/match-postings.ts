import { isCompanyInCuratedSector } from "@/lib/alerts/curated-sectors";
import {
  DEFAULT_ALERT_FILTERS,
  mergeAlertFilters,
  postingMatchesAlertFilters,
  type AlertFilters,
} from "@/lib/alerts/filters";
import type { AlertCadence, AlertChannel } from "@/lib/config/alerts";
import { getAlertFeedDefinition } from "@/lib/config/alert-feeds";
import type { AlertMatch, AlertPostingCandidate, AlertSubscription } from "@/lib/alerts/types";

export function isAlertEligiblePosting(posting: AlertPostingCandidate): boolean {
  return Boolean(posting.location?.trim());
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
    /** Defaults to `[channel]`. */
    subscriptionCadences?: AlertCadence[];
    globalFiltersByUserId: Map<string, AlertFilters>;
  },
): AlertMatch[] {
  const matches: AlertMatch[] = [];
  const eligible = postings.filter(isAlertEligiblePosting);
  const subscriptionCadences = options.subscriptionCadences ?? [options.channel];

  for (const posting of eligible) {
    for (const sub of subscriptions) {
      if (sub.paused) continue;
      if (!subscriptionCadences.includes(sub.cadence)) continue;
      if (!options.enabledUserIds.has(sub.userId)) continue;

      const matched =
        (sub.targetType === "company" && sub.targetId === posting.companyId) ||
        (sub.targetType === "sector" &&
          isCompanyInCuratedSector(sub.targetId, posting.companySlug, sectorMembers));
      if (!matched) continue;

      const globalFilters =
        options.globalFiltersByUserId.get(sub.userId) ?? DEFAULT_ALERT_FILTERS;
      const effectiveFilters = mergeAlertFilters(globalFilters, sub.filterOverride);
      if (!postingMatchesAlertFilters(posting, effectiveFilters)) {
        continue;
      }

      const key = buildSentKey(sub.userId, posting.postingId, options.channel);
      if (options.sentKeys.has(key)) continue;

      matches.push({ userId: sub.userId, posting, channel: options.channel });
    }
  }

  return matches;
}

/** Morning briefing and other digest feeds: all eligible postings in the lookback window. */
export function matchFeedDigestPostingsToUsers(
  postings: AlertPostingCandidate[],
  subscriptions: AlertSubscription[],
  options: {
    feedSlug: string;
    sentKeys: Set<string>;
    globalFiltersByUserId: Map<string, AlertFilters>;
  },
): AlertMatch[] {
  const matches: AlertMatch[] = [];
  const eligible = postings.filter(isAlertEligiblePosting);
  const feedSubs = subscriptions.filter(
    (sub) =>
      !sub.paused &&
      sub.targetType === "feed" &&
      sub.targetId === options.feedSlug &&
      sub.cadence === "digest" &&
      getAlertFeedDefinition(sub.targetId)?.cadence === "digest",
  );

  for (const posting of eligible) {
    for (const sub of feedSubs) {
      const globalFilters =
        options.globalFiltersByUserId.get(sub.userId) ?? DEFAULT_ALERT_FILTERS;
      const effectiveFilters = mergeAlertFilters(globalFilters, sub.filterOverride);
      if (!postingMatchesAlertFilters(posting, effectiveFilters)) {
        continue;
      }

      const key = buildSentKey(sub.userId, posting.postingId, "digest");
      if (options.sentKeys.has(key)) continue;

      matches.push({ userId: sub.userId, posting, channel: "digest" });
    }
  }

  return matches;
}

/** @deprecated Use matchFeedDigestPostingsToUsers with feed subscriptions. */
export function matchBriefingPostingsToUsers(
  postings: AlertPostingCandidate[],
  options: {
    enabledUserIds: Set<string>;
    sentKeys: Set<string>;
  },
): AlertMatch[] {
  const matches: AlertMatch[] = [];

  for (const posting of postings) {
    for (const userId of options.enabledUserIds) {
      const key = buildSentKey(userId, posting.postingId, "digest");
      if (options.sentKeys.has(key)) continue;

      matches.push({ userId, posting, channel: "digest" });
    }
  }

  return matches;
}
