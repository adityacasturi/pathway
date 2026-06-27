"use server";

import { revalidatePath } from "next/cache";
import {
  filterOverrideToJson,
  parseAlertFilterOverride,
  parseAlertFiltersView,
  type AlertFilters,
  type AlertFiltersView,
} from "@/lib/alerts/filters";
import {
  getAlertFeedDefinition,
  isAlertFeedSlug,
  MORNING_BRIEFING_FEED_SLUG,
} from "@/lib/config/alert-feeds";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatSupabaseMutationError } from "@/lib/supabase/errors";
import { limitServerActionByIp } from "@/lib/rate-limit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALERTS_RATE_LIMIT_REQUESTS = 60;
const ALERTS_RATE_LIMIT_WINDOW_MS = 60_000;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function cleanSectorSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const slug = value.trim().toLowerCase();
  return slug || null;
}

async function limitAlertsWrite() {
  return limitServerActionByIp(
    "alerts:write",
    ALERTS_RATE_LIMIT_REQUESTS,
    ALERTS_RATE_LIMIT_WINDOW_MS,
  );
}

async function ensureInstantAlertsEnabled(userId: string) {
  const admin = createAdminClient();
  const { error } = await admin.from("alert_preferences").upsert(
    {
      user_id: userId,
      emails_enabled: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw new Error(formatSupabaseMutationError(error, "Unable to enable instant alerts."));
  }
}

async function syncDigestEnabledPreference(userId: string, enabled: boolean) {
  const admin = createAdminClient();
  const { error } = await admin.from("alert_preferences").upsert(
    {
      user_id: userId,
      digest_enabled: enabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw new Error(formatSupabaseMutationError(error, "Unable to save morning briefing."));
  }
}

function alertFilterError(error: string) {
  return { error };
}

async function removeAlertSubscriptionForUser(
  userId: string,
  subscriptionId: string,
  failureMessage: string,
) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("alert_subscriptions")
    .delete()
    .eq("id", subscriptionId)
    .eq("user_id", userId);

  if (error) {
    return { error: formatSupabaseMutationError(error, failureMessage) };
  }

  return { ok: true as const };
}

export async function updateAlertsEnabled(enabled: boolean) {
  if (typeof enabled !== "boolean") {
    return { error: "Invalid alert setting." };
  }

  const rateLimit = await limitAlertsWrite();
  if (!rateLimit.ok) {
    return { error: rateLimit.error };
  }

  const { user } = await getAuthenticatedUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("alert_preferences").upsert(
    {
      user_id: user.id,
      emails_enabled: enabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return { error: formatSupabaseMutationError(error, "Unable to save instant alerts.") };
  }

  revalidatePath("/alerts");
  revalidatePath("/settings");
  return { ok: true, emailsEnabled: enabled };
}

export async function updateDigestEnabled(enabled: boolean) {
  if (typeof enabled !== "boolean") {
    return { error: "Invalid alert setting." };
  }

  const rateLimit = await limitAlertsWrite();
  if (!rateLimit.ok) {
    return { error: rateLimit.error };
  }

  const { user } = await getAuthenticatedUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("alert_preferences").upsert(
    {
      user_id: user.id,
      digest_enabled: enabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return { error: formatSupabaseMutationError(error, "Unable to save daily briefing.") };
  }

  revalidatePath("/alerts");
  revalidatePath("/settings");
  return { ok: true, digestEnabled: enabled };
}

export async function addSectorAlert(sectorSlug: string) {
  const rateLimit = await limitAlertsWrite();
  if (!rateLimit.ok) {
    return { error: rateLimit.error };
  }

  const { user } = await getAuthenticatedUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const slug = cleanSectorSlug(sectorSlug);
  if (!slug) {
    return { error: "Choose a valid bundle." };
  }

  const admin = createAdminClient();
  const { data: sectorRow, error: sectorError } = await admin
    .from("alert_curated_sectors")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();

  if (sectorError) {
    return { error: formatSupabaseMutationError(sectorError, "Unable to verify bundle.") };
  }
  if (!sectorRow) {
    return { error: "Bundle not found." };
  }

  const { error } = await admin.from("alert_subscriptions").insert({
    user_id: user.id,
    target_type: "sector",
    target_id: slug,
    cadence: "instant",
    filter_override: null,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "You already follow this bundle." };
    }
    return { error: formatSupabaseMutationError(error, "Unable to add bundle alert.") };
  }

  try {
    await ensureInstantAlertsEnabled(user.id);
  } catch (enableError) {
    return {
      error:
        enableError instanceof Error ? enableError.message : "Unable to enable instant alerts.",
    };
  }

  revalidatePath("/alerts");
  return { ok: true };
}

export async function addFeedAlert(feedSlug: string) {
  const rateLimit = await limitAlertsWrite();
  if (!rateLimit.ok) {
    return { error: rateLimit.error };
  }

  const { user } = await getAuthenticatedUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const slug = typeof feedSlug === "string" ? feedSlug.trim().toLowerCase() : "";
  if (!isAlertFeedSlug(slug)) {
    return { error: "Choose a valid feed alert." };
  }

  const feed = getAlertFeedDefinition(slug);
  if (!feed) {
    return { error: "Feed alert not found." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("alert_subscriptions").insert({
    user_id: user.id,
    target_type: "feed",
    target_id: slug,
    cadence: feed.cadence,
    filter_override: null,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "You already follow this feed." };
    }
    return { error: formatSupabaseMutationError(error, "Unable to add feed alert.") };
  }

  try {
    if (feed.cadence === "instant") {
      await ensureInstantAlertsEnabled(user.id);
    }
    if (slug === MORNING_BRIEFING_FEED_SLUG) {
      await syncDigestEnabledPreference(user.id, true);
    }
  } catch (enableError) {
    return {
      error: enableError instanceof Error ? enableError.message : "Unable to enable feed alert.",
    };
  }

  revalidatePath("/alerts");
  return { ok: true };
}

export async function removeFeedAlert(subscriptionId: string) {
  const rateLimit = await limitAlertsWrite();
  if (!rateLimit.ok) {
    return { error: rateLimit.error };
  }

  const { user } = await getAuthenticatedUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  if (!isUuid(subscriptionId)) {
    return { error: "Invalid feed alert." };
  }

  const admin = createAdminClient();
  const { data: row, error: lookupError } = await admin
    .from("alert_subscriptions")
    .select("target_type, target_id")
    .eq("id", subscriptionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (lookupError) {
    return { error: formatSupabaseMutationError(lookupError, "Unable to verify feed alert.") };
  }
  if (!row || row.target_type !== "feed") {
    return { error: "Feed alert not found." };
  }

  const result = await removeAlertSubscriptionForUser(
    user.id,
    subscriptionId,
    "Unable to remove feed alert.",
  );
  if ("error" in result) {
    return result;
  }

  if (row.target_id === MORNING_BRIEFING_FEED_SLUG) {
    try {
      await syncDigestEnabledPreference(user.id, false);
    } catch (syncError) {
      return {
        error:
          syncError instanceof Error ? syncError.message : "Unable to update morning briefing.",
      };
    }
  }

  revalidatePath("/alerts");
  return { ok: true };
}

export async function removeSectorAlert(subscriptionId: string) {
  const rateLimit = await limitAlertsWrite();
  if (!rateLimit.ok) {
    return { error: rateLimit.error };
  }

  const { user } = await getAuthenticatedUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  if (!isUuid(subscriptionId)) {
    return { error: "Invalid bundle alert." };
  }

  const result = await removeAlertSubscriptionForUser(
    user.id,
    subscriptionId,
    "Unable to remove bundle alert.",
  );
  if ("error" in result) {
    return result;
  }

  revalidatePath("/alerts");
  return { ok: true };
}

export async function addCompanyAlert(companyId: string) {
  const rateLimit = await limitAlertsWrite();
  if (!rateLimit.ok) {
    return { error: rateLimit.error };
  }

  const { user } = await getAuthenticatedUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  if (!isUuid(companyId)) {
    return { error: "Choose a valid company." };
  }

  const admin = createAdminClient();
  const { data, error: lookupError } = await admin
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("is_active", true)
    .maybeSingle();

  if (lookupError || !data) {
    return { error: "Company not found." };
  }

  const { error } = await admin.from("alert_subscriptions").insert({
    user_id: user.id,
    target_type: "company",
    target_id: companyId,
    cadence: "instant",
    filter_override: null,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "You already follow this company." };
    }
    return { error: formatSupabaseMutationError(error, "Unable to add company alert.") };
  }

  try {
    await ensureInstantAlertsEnabled(user.id);
  } catch (enableError) {
    return {
      error:
        enableError instanceof Error ? enableError.message : "Unable to enable instant alerts.",
    };
  }

  revalidatePath("/alerts");
  return { ok: true };
}

export async function removeCompanyAlert(subscriptionId: string) {
  const rateLimit = await limitAlertsWrite();
  if (!rateLimit.ok) {
    return { error: rateLimit.error };
  }

  const { user } = await getAuthenticatedUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  if (!isUuid(subscriptionId)) {
    return { error: "Invalid company alert." };
  }

  const result = await removeAlertSubscriptionForUser(
    user.id,
    subscriptionId,
    "Unable to remove company alert.",
  );
  if ("error" in result) {
    return result;
  }

  revalidatePath("/alerts");
  return { ok: true };
}

export async function updateAlertGlobalFilters(view: AlertFiltersView) {
  const rateLimit = await limitAlertsWrite();
  if (!rateLimit.ok) {
    return { error: rateLimit.error };
  }

  const { user } = await getAuthenticatedUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const parsed = parseAlertFiltersView(view);
  if ("error" in parsed) return alertFilterError(parsed.error);
  const filters = parsed.value;

  const admin = createAdminClient();
  const { error } = await admin.from("alert_preferences").upsert(
    {
      user_id: user.id,
      alert_seasons: filters.seasons,
      alert_countries: filters.countries,
      alert_include_remote: filters.includeRemote,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return { error: formatSupabaseMutationError(error, "Unable to save alert filters.") };
  }

  revalidatePath("/alerts");
  return { ok: true };
}

export async function setAlertSubscriptionPaused(subscriptionId: string, paused: boolean) {
  if (typeof paused !== "boolean") {
    return { error: "Invalid pause setting." };
  }

  const rateLimit = await limitAlertsWrite();
  if (!rateLimit.ok) {
    return { error: rateLimit.error };
  }

  const { user } = await getAuthenticatedUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  if (!isUuid(subscriptionId)) {
    return { error: "Invalid alert follow." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("alert_subscriptions")
    .update({ paused })
    .eq("id", subscriptionId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: formatSupabaseMutationError(error, "Unable to update alert pause state.") };
  }
  if (!data) {
    return { error: "Alert follow not found." };
  }

  revalidatePath("/alerts");
  return { ok: true, paused };
}

export async function updateSubscriptionAlertFilters(
  subscriptionId: string,
  override: Partial<AlertFilters> | null,
) {
  const rateLimit = await limitAlertsWrite();
  if (!rateLimit.ok) {
    return { error: rateLimit.error };
  }

  const { user } = await getAuthenticatedUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  if (!isUuid(subscriptionId)) {
    return { error: "Invalid alert follow." };
  }

  const parsed = parseAlertFilterOverride(override);
  if ("error" in parsed) return alertFilterError(parsed.error);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("alert_subscriptions")
    .update({
      filter_override: filterOverrideToJson(parsed.value),
    })
    .eq("id", subscriptionId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: formatSupabaseMutationError(error, "Unable to save follow filters.") };
  }
  if (!data) {
    return { error: "Alert follow not found." };
  }

  revalidatePath("/alerts");
  return { ok: true };
}

/*
 * Intentionally no public alert write RPC calls below. Hosted migrations revoke
 * client execution and table write grants; alert mutations run as scoped
 * service-role writes from these server actions.
 */
