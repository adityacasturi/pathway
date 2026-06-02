import { dedupeAlertMatches } from "@/lib/alerts/dedupe-matches";
import {
  loadAlertDigestState,
  loadAlertPostingCandidates,
  loadAlertSentKeys,
  loadAlertSubscriptions,
  loadDigestEnabledUserIds,
  loadUserEmails,
  recordAlertSentPostings,
  upsertAlertDigestState,
} from "@/lib/alerts/load-alert-data";
import { loadCuratedSectorCompanyMap } from "@/lib/alerts/load-curated-sectors";
import { matchPostingsToUsers } from "@/lib/alerts/match-postings";
import type { AlertPostingCandidate } from "@/lib/alerts/types";
import { DIGEST_MAX_POSTINGS } from "@/lib/config/alerts";
import { isAlertsLaunched } from "@/lib/config/alerts-launch";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEmailConfigured, sendResendEmail } from "@/lib/email/resend-client";
import {
  buildDigestAlertHtml,
  buildDigestAlertSubject,
} from "@/lib/email/templates/digest-alert";

const DEFAULT_DIGEST_LOOKBACK_MS = 24 * 60 * 60 * 1000;

export async function processDigestAlerts(now = new Date()): Promise<{ sent: number; errors: number }> {
  if (!isAlertsLaunched() || !isEmailConfigured()) {
    return { sent: 0, errors: 0 };
  }

  const supabase = createAdminClient();
  const digestUserIds = [...(await loadDigestEnabledUserIds(supabase))];

  if (digestUserIds.length === 0) {
    return { sent: 0, errors: 0 };
  }

  const digestState = await loadAlertDigestState(supabase, digestUserIds);
  const earliestSince = getEarliestDigestSince(digestState, now);
  const [subscriptions, postings, sectorMembers] = await Promise.all([
    loadAlertSubscriptions(supabase),
    loadAlertPostingCandidates(supabase, earliestSince),
    loadCuratedSectorCompanyMap(supabase),
  ]);

  if (postings.length === 0) {
    return { sent: 0, errors: 0 };
  }

  const postingIds = postings.map((posting) => posting.postingId);
  const sentKeys = await loadAlertSentKeys(supabase, postingIds);
  const enabledUserIds = new Set(digestUserIds);
  const rawMatches = matchPostingsToUsers(postings, subscriptions, sectorMembers, {
    enabledUserIds,
    sentKeys,
    channel: "digest",
    subscriptionCadences: ["instant", "digest"],
  });
  const matches = dedupeAlertMatches(rawMatches);

  if (matches.length === 0) {
    return { sent: 0, errors: 0 };
  }

  const postingsByUser = groupMatchesByUser(matches, digestState, now);
  const emails = await loadUserEmails(supabase, [...postingsByUser.keys()]);

  let sent = 0;
  let errors = 0;

  for (const [userId, userPostings] of postingsByUser) {
    const email = emails.get(userId);
    if (!email) {
      errors += 1;
      continue;
    }

    const capped = userPostings.slice(0, DIGEST_MAX_POSTINGS);
    const result = await sendResendEmail({
      to: email,
      subject: buildDigestAlertSubject(capped.length),
      html: buildDigestAlertHtml(userId, capped),
    });

    if (!result.ok) {
      errors += 1;
      continue;
    }

    sent += 1;
    await recordAlertSentPostings(
      supabase,
      capped.map((posting) => ({
        userId,
        postingId: posting.postingId,
        channel: "digest" as const,
      })),
    );
    await upsertAlertDigestState(supabase, userId, now);
  }

  return { sent, errors };
}

function getEarliestDigestSince(digestState: Map<string, Date>, now: Date): Date {
  let earliest = new Date(now.getTime() - DEFAULT_DIGEST_LOOKBACK_MS);

  for (const lastSentAt of digestState.values()) {
    if (lastSentAt < earliest) {
      earliest = lastSentAt;
    }
  }

  return earliest;
}

function groupMatchesByUser(
  matches: Array<{ userId: string; posting: AlertPostingCandidate }>,
  digestState: Map<string, Date>,
  now: Date,
): Map<string, AlertPostingCandidate[]> {
  const byUser = new Map<string, AlertPostingCandidate[]>();

  for (const match of matches) {
    const since =
      digestState.get(match.userId) ?? new Date(now.getTime() - DEFAULT_DIGEST_LOOKBACK_MS);
    if (Date.parse(match.posting.firstSeenAt) <= since.getTime()) {
      continue;
    }

    const list = byUser.get(match.userId) ?? [];
    list.push(match.posting);
    byUser.set(match.userId, list);
  }

  for (const [userId, userPostings] of byUser) {
    userPostings.sort((a, b) => Date.parse(b.firstSeenAt) - Date.parse(a.firstSeenAt));
    byUser.set(userId, userPostings);
  }

  return byUser;
}
