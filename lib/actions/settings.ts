"use server";

import { revalidatePath } from "next/cache";
import {
  isValidDiscoverCutoffDate,
  resolveDiscoverCutoffDate,
} from "@/lib/config/discover";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { formatSupabaseMutationError } from "@/lib/supabase/errors";

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
