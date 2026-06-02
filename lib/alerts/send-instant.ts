import { dedupeAlertMatches } from "@/lib/alerts/dedupe-matches";
import {
  loadAlertPostingCandidates,
  loadAlertSentKeys,
  loadAlertSubscriptions,
  loadEnabledAlertUserIds,
  loadUserEmails,
  recordAlertSentPostings,
} from "@/lib/alerts/load-alert-data";
import { loadCuratedSectorCompanyMap } from "@/lib/alerts/load-curated-sectors";
import { matchPostingsToUsers } from "@/lib/alerts/match-postings";
import type { AlertMatch } from "@/lib/alerts/types";
import { isAlertsLaunched } from "@/lib/config/alerts-launch";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEmailConfigured, sendResendEmail } from "@/lib/email/resend-client";
import {
  buildInstantAlertHtml,
  buildInstantAlertSubject,
} from "@/lib/email/templates/instant-alert";

export async function processInstantAlerts(since: Date): Promise<{ sent: number; errors: number }> {
  if (!isAlertsLaunched() || !isEmailConfigured()) {
    return { sent: 0, errors: 0 };
  }

  const supabase = createAdminClient();
  const [enabledUserIds, allSubscriptions, postings, sectorMembers] = await Promise.all([
    loadEnabledAlertUserIds(supabase),
    loadAlertSubscriptions(supabase),
    loadAlertPostingCandidates(supabase, since),
    loadCuratedSectorCompanyMap(supabase),
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
    channel: "instant",
  });
  const matches = dedupeAlertMatches(rawMatches);

  if (matches.length === 0) {
    return { sent: 0, errors: 0 };
  }

  const userIds = [...new Set(matches.map((match) => match.userId))];
  const emails = await loadUserEmails(supabase, userIds);

  let sent = 0;
  let errors = 0;

  for (const match of matches) {
    const email = emails.get(match.userId);
    if (!email) {
      errors += 1;
      continue;
    }

    const result = await sendInstantAlertEmail(match, email);
    if (!result.ok) {
      errors += 1;
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

  return { sent, errors };
}

async function sendInstantAlertEmail(
  match: AlertMatch,
  email: string,
): Promise<{ ok: true } | { ok: false }> {
  const result = await sendResendEmail({
    to: email,
    subject: buildInstantAlertSubject(match.posting),
    html: buildInstantAlertHtml(match.userId, match.posting),
  });

  return result.ok ? { ok: true } : { ok: false };
}
