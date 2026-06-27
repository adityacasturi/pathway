import { dedupeAlertMatches } from "@/lib/alerts/dedupe-matches";
import {
  loadAlertFilterDefaults,
  loadAlertPostingCandidates,
  loadAlertSentKeys,
  loadAlertSubscriptions,
  loadUserEmails,
  recordAlertSentPostings,
  upsertAlertDigestState,
} from "@/lib/alerts/load-alert-data";
import { matchFeedDigestPostingsToUsers } from "@/lib/alerts/match-postings";
import type { AlertPostingCandidate } from "@/lib/alerts/types";
import { DIGEST_LOOKBACK_MS, DIGEST_MAX_POSTINGS } from "@/lib/config/alerts";
import {
  isAlertFeedSlug,
  MORNING_BRIEFING_FEED_SLUG,
  type AlertFeedSlug,
} from "@/lib/config/alert-feeds";
import {
  handleResendBatchFailure,
  pauseBetweenResendSends,
  type ResendBatchResult,
} from "@/lib/email/resend-batch";
import { isEmailConfigured, sendResendEmail } from "@/lib/email/resend-client";
import {
  buildDigestAlertHtml,
  buildDigestAlertSubject,
} from "@/lib/email/templates/digest-alert";
import { createAdminClient } from "@/lib/supabase/admin";

export async function processDigestAlerts(
  now = new Date(),
  options: { feedSlug?: AlertFeedSlug } = {},
): Promise<ResendBatchResult> {
  const feedSlug = options.feedSlug ?? MORNING_BRIEFING_FEED_SLUG;
  if (!isAlertFeedSlug(feedSlug)) {
    return { sent: 0, errors: 1 };
  }

  if (!isEmailConfigured()) {
    return { sent: 0, errors: 0 };
  }

  const supabase = createAdminClient();
  const [allSubscriptions, globalFiltersByUserId] = await Promise.all([
    loadAlertSubscriptions(supabase),
    loadAlertFilterDefaults(supabase),
  ]);
  const digestSubscriptions = allSubscriptions.filter(
    (sub) =>
      sub.targetType === "feed" &&
      sub.targetId === feedSlug &&
      sub.cadence === "digest" &&
      !sub.paused,
  );

  if (digestSubscriptions.length === 0) {
    return { sent: 0, errors: 0 };
  }

  const since = new Date(now.getTime() - DIGEST_LOOKBACK_MS);
  const postings = await loadAlertPostingCandidates(supabase, since);

  if (postings.length === 0) {
    return { sent: 0, errors: 0 };
  }

  const postingIds = postings.map((posting) => posting.postingId);
  const sentKeys = await loadAlertSentKeys(supabase, postingIds);
  const rawMatches = matchFeedDigestPostingsToUsers(postings, digestSubscriptions, {
    feedSlug,
    sentKeys,
    globalFiltersByUserId,
  });
  const matches = dedupeAlertMatches(rawMatches);

  if (matches.length === 0) {
    return { sent: 0, errors: 0 };
  }

  const postingsByUser = groupBriefingPostingsByUser(matches);
  const emails = await loadUserEmails(supabase, [...postingsByUser.keys()]);

  let sent = 0;
  let errors = 0;
  let stoppedReason: ResendBatchResult["stoppedReason"];
  let sendIndex = 0;

  for (const [userId, userPostings] of postingsByUser) {
    const email = emails.get(userId);
    if (!email) {
      errors += 1;
      continue;
    }

    if (sendIndex > 0) {
      await pauseBetweenResendSends();
    }
    sendIndex += 1;

    const capped = userPostings.slice(0, DIGEST_MAX_POSTINGS);
    const result = await sendResendEmail({
      to: email,
      subject: buildDigestAlertSubject(capped.length),
      html: buildDigestAlertHtml(userId, capped),
    });

    if (!result.ok) {
      errors += 1;
      const stop = handleResendBatchFailure(result, "alerts.digest_send_failed", {
        channel: "digest",
        userId,
      });
      if (stop) {
        stoppedReason = stop;
        break;
      }
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

  return { sent, errors, stoppedReason };
}

function groupBriefingPostingsByUser(
  matches: Array<{ userId: string; posting: AlertPostingCandidate }>,
): Map<string, AlertPostingCandidate[]> {
  const byUser = new Map<string, AlertPostingCandidate[]>();

  for (const match of matches) {
    const list = byUser.get(match.userId) ?? [];
    list.push(match.posting);
    byUser.set(match.userId, list);
  }

  for (const [userId, userPostings] of byUser) {
    userPostings.sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt));
    byUser.set(userId, userPostings);
  }

  return byUser;
}
