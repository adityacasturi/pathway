"use server";

import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { validateExternalHttpUrl } from "@/lib/url";
import { APPLICATION_SEASONS, ApplicationSeason } from "@/types/application";
import { revalidatePath } from "next/cache";

const MAX_COMPANY_LENGTH = 120;
const MAX_ROLE_LENGTH = 160;
const MAX_LOCATION_LENGTH = 240;

function cleanRequiredText(raw: FormDataEntryValue | null, label: string, max: number) {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return { error: `${label} is required.` };
  if (value.length > max) return { error: `${label} is too long.` };
  return { value };
}

function cleanOptionalText(raw: string | null | undefined, label: string, max: number) {
  const value = (raw ?? "").trim();
  if (!value) return { value: null };
  if (value.length > max) return { error: `${label} is too long.` };
  return { value };
}

function isIsoDate(raw: string | null | undefined): raw is string {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === raw;
}

function coerceSeason(raw: string | null): ApplicationSeason | null {
  if (!raw) return null;
  return (APPLICATION_SEASONS as readonly string[]).includes(raw)
    ? (raw as ApplicationSeason)
    : null;
}

function parseFormData(formData: FormData) {
  const company = cleanRequiredText(formData.get("company"), "Company", MAX_COMPANY_LENGTH);
  if (company.error) return { error: company.error };

  const role = cleanRequiredText(formData.get("role"), "Role", MAX_ROLE_LENGTH);
  if (role.error) return { error: role.error };

  const postingUrl = validateExternalHttpUrl(formData.get("posting_url") as string | null);
  if (postingUrl.error) return { error: postingUrl.error };

  const location = cleanOptionalText(formData.get("location") as string | null, "Location", MAX_LOCATION_LENGTH);
  if (location.error) return { error: location.error };

  return {
    company:     company.value,
    role:        role.value,
    posting_url: postingUrl.url,
    location:    location.value,
    season:      coerceSeason(formData.get("season") as string | null),
  };
}

function revalidateApplicationSurfaces() {
  revalidatePath("/");
  revalidatePath("/applications");
  revalidatePath("/discover");
}

export async function createApplication(
  formData: FormData,
  options: { revalidate?: boolean } = {},
) {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };

  const fields = parseFormData(formData);
  if ("error" in fields) return { error: fields.error };
  const { data: app, error } = await supabase
    .from("applications")
    .insert({ ...fields, user_id: user.id, status: "applied" })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Use the client-supplied date so we get the user's local date, not the server's UTC date
  const rawDateApplied = formData.get("date_applied") as string | null;
  const dateApplied = isIsoDate(rawDateApplied)
    ? rawDateApplied
    : new Date().toISOString().slice(0, 10);

  const { error: eventError } = await supabase.from("application_events").insert({
    application_id: app.id,
    user_id:        user.id,
    event_type:     "applied",
    event_date:     dateApplied,
  });

  if (eventError) {
    await supabase
      .from("applications")
      .delete()
      .eq("id", app.id)
      .eq("user_id", user.id);
    return { error: eventError.message };
  }

  if (options.revalidate !== false) {
    revalidateApplicationSurfaces();
  }
  return { ok: true, id: app.id };
}

export async function updateApplicationFields(
  id: string,
  fields: {
    company?: string;
    role?: string;
    posting_url?: string | null;
    location?: string | null;
    season?: ApplicationSeason | null;
  },
) {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };

  // Normalize server-side too so a crafted client can't bypass client rules.
  const patch = { ...fields };
  if ("company" in patch) {
    const cleaned = cleanRequiredText(patch.company ?? "", "Company", MAX_COMPANY_LENGTH);
    if (cleaned.error) return { error: cleaned.error };
    patch.company = cleaned.value;
  }
  if ("role" in patch) {
    const cleaned = cleanRequiredText(patch.role ?? "", "Role", MAX_ROLE_LENGTH);
    if (cleaned.error) return { error: cleaned.error };
    patch.role = cleaned.value;
  }
  if ("posting_url" in patch) {
    const validated = validateExternalHttpUrl(patch.posting_url ?? "");
    if (validated.error) return { error: validated.error };
    patch.posting_url = validated.url;
  }
  if ("location" in patch) {
    const cleaned = cleanOptionalText(patch.location, "Location", MAX_LOCATION_LENGTH);
    if (cleaned.error) return { error: cleaned.error };
    patch.location = cleaned.value;
  }
  if ("season" in patch && patch.season !== null) {
    patch.season = coerceSeason(patch.season ?? null);
  }

  const { error } = await supabase
    .from("applications")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidateApplicationSurfaces();
  return { ok: true };
}

export async function updateApplicationArchive(id: string, archived: boolean) {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("applications")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidateApplicationSurfaces();
  return { ok: true };
}

export async function deleteApplication(id: string) {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("applications")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidateApplicationSurfaces();
  return { ok: true };
}
