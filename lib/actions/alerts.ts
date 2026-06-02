"use server";

import { revalidatePath } from "next/cache";
import { isCuratedSectorSlug } from "@/lib/alerts/curated-sectors";
import {
  ALERTS_PREVIEW_LOCKED_MESSAGE,
  isAlertsLaunched,
} from "@/lib/config/alerts-launch";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { formatSupabaseMutationError } from "@/lib/supabase/errors";
import { limitServerActionByIp } from "@/lib/rate-limit";

function previewLocked() {
  if (isAlertsLaunched()) {
    return null;
  }
  return { error: ALERTS_PREVIEW_LOCKED_MESSAGE };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALERTS_RATE_LIMIT_REQUESTS = 60;
const ALERTS_RATE_LIMIT_WINDOW_MS = 60_000;

async function limitAlertsWrite() {
  return limitServerActionByIp(
    "alerts:write",
    ALERTS_RATE_LIMIT_REQUESTS,
    ALERTS_RATE_LIMIT_WINDOW_MS,
  );
}

export async function updateAlertsEnabled(enabled: boolean) {
  const locked = previewLocked();
  if (locked) {
    return locked;
  }

  const rateLimit = await limitAlertsWrite();
  if (!rateLimit.ok) {
    return { error: rateLimit.error };
  }

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase.rpc("set_alert_emails_enabled", {
    p_enabled: enabled,
  });

  if (error) {
    return { error: formatSupabaseMutationError(error, "Unable to save instant alerts.") };
  }

  revalidatePath("/alerts");
  return { ok: true, emailsEnabled: enabled };
}

export async function updateDigestEnabled(enabled: boolean) {
  const locked = previewLocked();
  if (locked) {
    return locked;
  }

  const rateLimit = await limitAlertsWrite();
  if (!rateLimit.ok) {
    return { error: rateLimit.error };
  }

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase.rpc("set_alert_digest_enabled", {
    p_enabled: enabled,
  });

  if (error) {
    return { error: formatSupabaseMutationError(error, "Unable to save daily digest.") };
  }

  revalidatePath("/alerts");
  return { ok: true, digestEnabled: enabled };
}

export async function addSectorAlert(sectorSlug: string) {
  const locked = previewLocked();
  if (locked) {
    return locked;
  }

  const rateLimit = await limitAlertsWrite();
  if (!rateLimit.ok) {
    return { error: rateLimit.error };
  }

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const slug = sectorSlug.trim();
  if (!isCuratedSectorSlug(slug)) {
    return { error: "Sector not found." };
  }

  const { error } = await supabase.rpc("add_alert_sector_subscription", {
    p_sector_slug: slug,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "You already follow this sector." };
    }
    return { error: formatSupabaseMutationError(error, "Unable to add sector alert.") };
  }

  revalidatePath("/alerts");
  return { ok: true };
}

export async function removeSectorAlert(subscriptionId: string) {
  const locked = previewLocked();
  if (locked) {
    return locked;
  }

  const rateLimit = await limitAlertsWrite();
  if (!rateLimit.ok) {
    return { error: rateLimit.error };
  }

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  if (!UUID_RE.test(subscriptionId)) {
    return { error: "Invalid sector alert." };
  }

  const { error } = await supabase.rpc("delete_alert_subscription", {
    p_subscription_id: subscriptionId,
  });

  if (error) {
    return { error: formatSupabaseMutationError(error, "Unable to remove sector alert.") };
  }

  revalidatePath("/alerts");
  return { ok: true };
}

export async function addCompanyAlert(companyId: string) {
  const locked = previewLocked();
  if (locked) {
    return locked;
  }

  const rateLimit = await limitAlertsWrite();
  if (!rateLimit.ok) {
    return { error: rateLimit.error };
  }

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  if (!UUID_RE.test(companyId)) {
    return { error: "Choose a valid company." };
  }

  const { data, error: lookupError } = await supabase
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("is_active", true)
    .maybeSingle();

  if (lookupError || !data) {
    return { error: "Company not found." };
  }

  const { error } = await supabase.rpc("add_alert_company_subscription", {
    p_company_id: companyId,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "You already follow this company." };
    }
    return { error: formatSupabaseMutationError(error, "Unable to add company alert.") };
  }

  revalidatePath("/alerts");
  return { ok: true };
}

export async function removeCompanyAlert(subscriptionId: string) {
  const locked = previewLocked();
  if (locked) {
    return locked;
  }

  const rateLimit = await limitAlertsWrite();
  if (!rateLimit.ok) {
    return { error: rateLimit.error };
  }

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  if (!UUID_RE.test(subscriptionId)) {
    return { error: "Invalid company alert." };
  }

  const { error } = await supabase.rpc("delete_alert_subscription", {
    p_subscription_id: subscriptionId,
  });

  if (error) {
    return { error: formatSupabaseMutationError(error, "Unable to remove company alert.") };
  }

  revalidatePath("/alerts");
  return { ok: true };
}
