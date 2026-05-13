"use server";

import { revalidatePath } from "next/cache";
import {
  isValidDiscoverCutoffDate,
  resolveDiscoverCutoffDate,
} from "@/lib/config/discover";
import { isAccentColor } from "@/lib/config/accent";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { formatSupabaseMutationError } from "@/lib/supabase/errors";

function isMissingAccentColumnError(error: { code?: string; message?: string } | null): boolean {
  return Boolean(
    error &&
      error.code === "42703" &&
      error.message?.toLowerCase().includes("accent_color"),
  );
}

export async function updateDiscoverCutoffDate(cutoffDate: string) {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };
  if (!isValidDiscoverCutoffDate(cutoffDate)) return { error: "Invalid cutoff date." };

  const resolved = resolveDiscoverCutoffDate(cutoffDate);
  const { error } = await supabase
    .from("user_preferences")
    .upsert(
      {
        user_id: user.id,
        discover_cutoff_date: resolved.cutoffDate,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (error) return { error: formatSupabaseMutationError(error, "Unable to save settings.") };
  revalidatePath("/discover");
  revalidatePath("/settings");

  return { ok: true, cutoffDate: resolved.cutoffDate };
}

export async function updateAccentColor(accentColor: string) {
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
