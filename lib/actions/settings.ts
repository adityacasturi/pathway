"use server";

import { revalidatePath } from "next/cache";
import { normalizeEmail } from "@/lib/auth/validation";
import { isAccentColor } from "@/lib/config/accent";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { limitServerActionByIp } from "@/lib/rate-limit";
import { isMissingPreferenceColumnError } from "@/lib/config/user-preferences";
import { formatSupabaseMutationError } from "@/lib/supabase/errors";

function getPasswordResetRedirectTo() {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    "http://localhost:3000";
  const normalized = siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`;
  return new URL("/set-password", normalized).toString();
}

const SETTINGS_RATE_LIMIT_REQUESTS = 30;
const SETTINGS_RATE_LIMIT_WINDOW_MS = 60_000;

function isMissingAccentColumnError(error: { code?: string; message?: string } | null): boolean {
  return Boolean(
    error &&
      error.code === "42703" &&
      error.message?.toLowerCase().includes("accent_color"),
  );
}

async function limitSettingsWrite() {
  return limitServerActionByIp(
    "settings:write",
    SETTINGS_RATE_LIMIT_REQUESTS,
    SETTINGS_RATE_LIMIT_WINDOW_MS,
  );
}

export async function updateAccentColor(accentColor: string) {
  const rateLimit = await limitSettingsWrite();
  if (!rateLimit.ok) return { error: rateLimit.error };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };
  if (!isAccentColor(accentColor)) return { error: "Choose a supported accent color." };

  const { error } = await supabase
    .from("user_preferences")
    .upsert(
      {
        user_id: user.id,
        accent_color: accentColor,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (isMissingAccentColumnError(error)) {
    return {
      ok: true,
      accentColor,
      localOnly: true,
      warning: "Accent color saved on this device. Apply the latest database migration to sync it across devices.",
    };
  }
  if (error) return { error: formatSupabaseMutationError(error, "Unable to save accent color.") };
  revalidatePath("/settings");

  return { ok: true, accentColor };
}

export async function updateQuickTrackEnabled(enabled: boolean) {
  const rateLimit = await limitSettingsWrite();
  if (!rateLimit.ok) return { error: rateLimit.error };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };
  if (typeof enabled !== "boolean") return { error: "Invalid quick track setting." };

  const { error } = await supabase
    .from("user_preferences")
    .upsert(
      {
        user_id: user.id,
        quick_track_enabled: enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (isMissingPreferenceColumnError(error, "quick_track_enabled")) {
    return {
      error: "Quick track is unavailable until the latest database migration is applied.",
    };
  }
  if (error) {
    return { error: formatSupabaseMutationError(error, "Unable to save quick track setting.") };
  }

  revalidatePath("/settings");
  revalidatePath("/openings");
  revalidatePath("/companies");

  return { ok: true, quickTrackEnabled: enabled };
}

export async function requestPasswordResetEmail() {
  const rateLimit = await limitSettingsWrite();
  if (!rateLimit.ok) return { error: rateLimit.error };

  const { user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };

  const email = user.email?.trim();
  if (!email) return { error: "No email on file for this account." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
    redirectTo: getPasswordResetRedirectTo(),
  });
  if (error) {
    return { error: formatSupabaseMutationError(error, "Unable to send password reset email.") };
  }

  return { ok: true };
}
