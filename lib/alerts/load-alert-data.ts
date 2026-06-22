import type { SupabaseClient } from "@supabase/supabase-js";
import { enrichAlertPostingCandidate } from "@/lib/alerts/enrich-posting";
import {
  alertFiltersFromPreferenceRow,
  parseFilterOverrideJson,
  type AlertFilters,
} from "@/lib/alerts/filters";
import { buildSentKey } from "@/lib/alerts/match-postings";
import type { AlertPostingCandidate, AlertSubscription } from "@/lib/alerts/types";
import type { AlertCadence, AlertTargetType } from "@/lib/config/alerts";

interface SubscriptionRow {
  id: string;
  user_id: string;
  target_type: AlertTargetType;
  target_id: string;
  cadence: AlertCadence;
  filter_override: Record<string, unknown> | null;
  paused: boolean;
}

interface PreferenceFilterRow {
  user_id: string;
  alert_seasons: string[] | null;
  alert_countries: string[] | null;
  alert_include_remote: boolean | null;
}

interface PostingRow {
  id: string;
  company_id: string;
  company_name: string;
  role_name: string;
  posting_url: string;
  season: string | null;
  location: string | null;
  location_places: import("@/lib/geo/types.ts").LocationPlaceJson[] | null;
  countries: string[] | null;
  posted_at: string;
  companies:
    | { industry: string | null; slug: string }
    | Array<{ industry: string | null; slug: string }>
    | null;
}

interface SentRow {
  user_id: string;
  posting_id: string;
  channel: string;
}

interface DigestStateRow {
  user_id: string;
  last_sent_at: string;
}

function mapSubscription(row: SubscriptionRow): AlertSubscription {
  return {
    id: row.id,
    userId: row.user_id,
    targetType: row.target_type,
    targetId: row.target_id,
    cadence: row.cadence,
    filterOverride: parseFilterOverrideJson(
      row.filter_override as Parameters<typeof parseFilterOverrideJson>[0],
    ),
    paused: row.paused,
  };
}

function mapPosting(row: PostingRow): AlertPostingCandidate | null {
  const company = Array.isArray(row.companies) ? row.companies[0] : row.companies;
  const industrySlug = company?.industry?.trim();
  const companySlug = company?.slug?.trim();
  if (!industrySlug || !companySlug) {
    return null;
  }

  return enrichAlertPostingCandidate({
    postingId: row.id,
    companyId: row.company_id,
    companySlug,
    industrySlug,
    companyName: row.company_name,
    roleName: row.role_name,
    postingUrl: row.posting_url,
    season: row.season,
    location: row.location,
    locationPlaces: row.location_places,
    countries: row.countries,
    postedAt: row.posted_at,
  });
}

export async function loadEnabledAlertUserIds(supabase: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("alert_preferences")
    .select("user_id")
    .eq("emails_enabled", true);

  if (error) {
    throw error;
  }

  return new Set((data ?? []).map((row) => row.user_id as string));
}

export async function loadDigestEnabledUserIds(supabase: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("alert_preferences")
    .select("user_id")
    .eq("digest_enabled", true);

  if (error) {
    throw error;
  }

  return new Set((data ?? []).map((row) => row.user_id as string));
}

export async function loadAlertFilterDefaults(
  supabase: SupabaseClient,
): Promise<Map<string, AlertFilters>> {
  const { data, error } = await supabase
    .from("alert_preferences")
    .select("user_id, alert_seasons, alert_countries, alert_include_remote");

  if (error) {
    throw error;
  }

  const map = new Map<string, AlertFilters>();
  for (const row of (data ?? []) as PreferenceFilterRow[]) {
    map.set(
      row.user_id,
      alertFiltersFromPreferenceRow({
        alert_seasons: row.alert_seasons,
        alert_countries: row.alert_countries,
        alert_include_remote: row.alert_include_remote,
      }),
    );
  }
  return map;
}

export async function loadAlertSubscriptions(supabase: SupabaseClient): Promise<AlertSubscription[]> {
  const { data, error } = await supabase
    .from("alert_subscriptions")
    .select("id, user_id, target_type, target_id, cadence, filter_override, paused");

  if (error) {
    throw error;
  }

  return ((data ?? []) as SubscriptionRow[]).map(mapSubscription);
}

export async function loadAlertPostingCandidates(
  supabase: SupabaseClient,
  since: Date,
): Promise<AlertPostingCandidate[]> {
  const { data, error } = await supabase
    .from("scraped_postings")
    .select(
      `
      id,
      company_id,
      company_name,
      role_name,
      posting_url,
      season,
      location,
      location_places,
      countries,
      posted_at,
      companies!inner ( industry, slug )
    `,
    )
    .eq("status", "open")
    .gte("posted_at", since.toISOString());

  if (error) {
    throw error;
  }

  const postings: AlertPostingCandidate[] = [];
  for (const row of (data ?? []) as PostingRow[]) {
    const mapped = mapPosting(row);
    if (mapped) {
      postings.push(mapped);
    }
  }
  return postings;
}

export async function loadAlertSentKeys(
  supabase: SupabaseClient,
  postingIds: string[],
): Promise<Set<string>> {
  if (postingIds.length === 0) {
    return new Set();
  }

  const { data, error } = await supabase
    .from("alert_sent_postings")
    .select("user_id, posting_id, channel")
    .in("posting_id", postingIds);

  if (error) {
    throw error;
  }

  const keys = new Set<string>();
  for (const row of (data ?? []) as SentRow[]) {
    keys.add(buildSentKey(row.user_id, row.posting_id, row.channel as "instant" | "digest"));
  }
  return keys;
}

export async function loadAlertDigestState(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, Date>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("alert_digest_state")
    .select("user_id, last_sent_at")
    .in("user_id", userIds);

  if (error) {
    throw error;
  }

  const map = new Map<string, Date>();
  for (const row of (data ?? []) as DigestStateRow[]) {
    map.set(row.user_id, new Date(row.last_sent_at));
  }
  return map;
}

export async function loadUserEmails(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, string>> {
  const emails = new Map<string, string>();

  for (const userId of userIds) {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error || !data.user?.email) {
      continue;
    }
    emails.set(userId, data.user.email);
  }

  return emails;
}

export async function recordAlertSentPostings(
  supabase: SupabaseClient,
  rows: Array<{ userId: string; postingId: string; channel: "instant" | "digest" }>,
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase.from("alert_sent_postings").upsert(
    rows.map((row) => ({
      user_id: row.userId,
      posting_id: row.postingId,
      channel: row.channel,
      sent_at: new Date().toISOString(),
    })),
    { onConflict: "user_id,posting_id,channel" },
  );

  if (error) {
    throw error;
  }
}

export async function upsertAlertDigestState(
  supabase: SupabaseClient,
  userId: string,
  sentAt: Date,
): Promise<void> {
  const { error } = await supabase.from("alert_digest_state").upsert(
    {
      user_id: userId,
      last_sent_at: sentAt.toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw error;
  }
}

export async function consumeUnsubscribeNonce(
  supabase: SupabaseClient,
  userId: string,
  nonce: string,
): Promise<boolean> {
  const { error } = await supabase.from("alert_unsubscribe_nonces").insert({
    nonce,
    user_id: userId,
  });

  if (error?.code === "23505") {
    return false;
  }

  if (error) {
    throw error;
  }

  return true;
}

export async function disableAlertEmails(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase.from("alert_preferences").upsert(
    {
      user_id: userId,
      emails_enabled: false,
      digest_enabled: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw error;
  }
}
