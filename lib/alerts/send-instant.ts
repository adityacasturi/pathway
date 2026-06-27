import { dedupeAlertMatches } from "@/lib/alerts/dedupe-matches";
import {
  loadAlertFilterDefaults,
  loadAlertPostingCandidates,
  loadAlertSentKeys,
  loadAlertSubscriptions,
  loadEnabledAlertUserIds,
  loadUserEmails,
  recordAlertSentPostings,
} from "@/lib/alerts/load-alert-data";
import { loadCuratedSectorCompanyMap } from "@/lib/alerts/load-curated-sectors";
import { matchPostingsToUsers } from "@/lib/alerts/match-postings";
import {
  handleResendBatchFailure,
  pauseBetweenResendSends,
  type ResendBatchResult,
} from "@/lib/email/resend-batch";
import { isEmailConfigured, sendResendEmail } from "@/lib/email/resend-client";
import {
  buildInstantAlertHtml,
  buildInstantAlertSubject,
} from "@/lib/email/templates/instant-alert";
import { createAdminClient } from "@/lib/supabase/admin";

export async function processInstantAlerts(since: Date): Promise<ResendBatchResult> {
  if (!isEmailConfigured()) {
    return { sent: 0, errors: 0 };
  }

  const supabase = createAdminClient();
  const [enabledUserIds, allSubscriptions, postings, sectorMembers, globalFiltersByUserId] =
    await Promise.all([
      loadEnabledAlertUserIds(supabase),
      loadAlertSubscriptions(supabase),
      loadAlertPostingCandidates(supabase, since),
      loadCuratedSectorCompanyMap(supabase),
      loadAlertFilterDefaults(supabase),
    ]);

  const subscriptions = allSubscriptions.filter((sub) => sub.cadence === "instant");

  if (enabledUserIds.size === 0 || subscriptions.length === 0 || postings.length === 0) {
    return { sent: 0, errors: 0 };
  }

  const postingIds = postings.map((posting) => posting.postingId);
  const sentKeys = await loadAlertSentKeys(supabase, postingIds);
  const rawMatches = matchPostingsToUsers(postings, subscriptions, sectorMembers, {
    enabledUserIds,
    sentKeys,
    globalFiltersByUserId,
  });
  const matches = dedupeAlertMatches(rawMatches);

  if (matches.length === 0) {
    return { sent: 0, errors: 0 };
  }

  const userIds = [...new Set(matches.map((match) => match.userId))];
  const emails = await loadUserEmails(supabase, userIds);

  let sent = 0;
  let errors = 0;
  let stoppedReason: ResendBatchResult["stoppedReason"];

  for (let index = 0; index < matches.length; index += 1) {
    if (index > 0) {
      await pauseBetweenResendSends();
    }

    const match = matches[index]!;
    const email = emails.get(match.userId);
    if (!email) {
      errors += 1;
      continue;
    }

    const result = await sendResendEmail({
      to: email,
      subject: buildInstantAlertSubject(match.posting),
      html: buildInstantAlertHtml(match.userId, match.posting),
    });

    if (!result.ok) {
      errors += 1;
      const stop = handleResendBatchFailure(result, "alerts.instant_send_failed", {
        channel: "instant",
        postingId: match.posting.postingId,
      });
      if (stop) {
        stoppedReason = stop;
        break;
      }
      continue;
    }

    await recordAlertSentPostings(supabase, [
      {
        userId: match.userId,
        postingId: match.posting.postingId,
        channel: "instant",
      },
    ]);
    sent += 1;
  }

  return { sent, errors, stoppedReason };
}
