"use server";

import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { limitServerActionByIp } from "@/lib/rate-limit";
import { formatSupabaseMutationError } from "@/lib/supabase/errors";
import { validateExternalHttpUrl } from "@/lib/url";
import { APPLICATION_SEASONS, ApplicationEvent, ApplicationSeason } from "@/types/application";
import { revalidatePath } from "next/cache";

const MAX_COMPANY_LENGTH = 120;
const MAX_ROLE_LENGTH = 160;
const MAX_LOCATION_LENGTH = 240;
const WRITE_RATE_LIMIT_REQUESTS = 60;
const WRITE_RATE_LIMIT_WINDOW_MS = 60_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ApplicationPatch = {
  company?: string;
  role?: string;
  posting_url?: string | null;
  location?: string | null;
  season?: ApplicationSeason | null;
};

type CreateApplicationRpcResult = {
  id?: unknown;
  appliedEvent?: unknown;
};

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

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

function parseApplicationPatch(fields: unknown): { patch: ApplicationPatch } | { error: string } {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    return { error: "Invalid application update." };
  }

  const source = fields as Record<string, unknown>;
  const patch: ApplicationPatch = {};

  if ("company" in source) {
    const cleaned = cleanRequiredText(
      typeof source.company === "string" ? source.company : "",
      "Company",
      MAX_COMPANY_LENGTH,
    );
    if (cleaned.error) return { error: cleaned.error };
    patch.company = cleaned.value;
  }

  if ("role" in source) {
    const cleaned = cleanRequiredText(
      typeof source.role === "string" ? source.role : "",
      "Role",
      MAX_ROLE_LENGTH,
    );
    if (cleaned.error) return { error: cleaned.error };
    patch.role = cleaned.value;
  }

  if ("posting_url" in source) {
    const postingUrl = typeof source.posting_url === "string" ? source.posting_url : null;
    const validated = validateExternalHttpUrl(postingUrl);
    if (validated.error) return { error: validated.error };
    patch.posting_url = validated.url;
  }

  if ("location" in source) {
    const location = typeof source.location === "string" ? source.location : null;
    const cleaned = cleanOptionalText(location, "Location", MAX_LOCATION_LENGTH);
    if (cleaned.error) return { error: cleaned.error };
    patch.location = cleaned.value;
  }

  if ("season" in source) {
    if (source.season !== null && typeof source.season !== "string") {
      return { error: "Invalid season." };
    }
    if (source.season === null || source.season === "") {
      patch.season = null;
    } else {
      const season = coerceSeason(source.season);
      if (!season) return { error: "Invalid season." };
      patch.season = season;
    }
  }

  if (Object.keys(patch).length === 0) {
    return { error: "No valid fields to update." };
  }

  return { patch };
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
  revalidatePath("/stats");
}

async function limitApplicationWrite() {
  return limitServerActionByIp(
    "applications:write",
    WRITE_RATE_LIMIT_REQUESTS,
    WRITE_RATE_LIMIT_WINDOW_MS,
  );
}

export async function createApplication(
  formData: FormData,
  options: { revalidate?: boolean } = {},
) {
  const rateLimit = await limitApplicationWrite();
  if (!rateLimit.ok) return { error: rateLimit.error };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };

  const fields = parseFormData(formData);
  if ("error" in fields) return { error: fields.error };

  // Use the client-supplied date so we get the user's local date, not the server's UTC date
  const rawDateApplied = formData.get("date_applied") as string | null;
  const dateApplied = isIsoDate(rawDateApplied)
    ? rawDateApplied
    : new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase.rpc("create_application_with_event", {
    p_company: fields.company,
    p_role: fields.role,
    p_posting_url: fields.posting_url,
    p_location: fields.location,
    p_season: fields.season,
    p_date_applied: dateApplied,
  });

  if (error) return { error: formatSupabaseMutationError(error, "Unable to add application.") };

  const payload = data as CreateApplicationRpcResult | null;
  if (typeof payload?.id !== "string" || !payload.appliedEvent) {
    return { error: "Unable to add application." };
  }

  if (options.revalidate !== false) {
    revalidateApplicationSurfaces();
  }
  return { ok: true, id: payload.id, appliedEvent: payload.appliedEvent as ApplicationEvent };
}

export async function updateApplicationFields(
  id: string,
  fields: ApplicationPatch,
) {
  const rateLimit = await limitApplicationWrite();
  if (!rateLimit.ok) return { error: rateLimit.error };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(id)) return { error: "Invalid application id." };

  // Normalize and whitelist server-side too so a crafted POST cannot smuggle
  // arbitrary columns into the update payload.
  const parsed = parseApplicationPatch(fields);
  if ("error" in parsed) return { error: parsed.error };

  const { error } = await supabase
    .from("applications")
    .update(parsed.patch)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: formatSupabaseMutationError(error, "Unable to update application.") };
  revalidateApplicationSurfaces();
  return { ok: true };
}

export async function updateApplicationArchive(id: string, archived: boolean) {
  const rateLimit = await limitApplicationWrite();
  if (!rateLimit.ok) return { error: rateLimit.error };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(id)) return { error: "Invalid application id." };
  if (typeof archived !== "boolean") return { error: "Invalid archive state." };

  const { error } = await supabase
    .from("applications")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: formatSupabaseMutationError(error, "Unable to update archive state.") };
  revalidateApplicationSurfaces();
  return { ok: true };
}

export async function deleteApplication(id: string) {
  const rateLimit = await limitApplicationWrite();
  if (!rateLimit.ok) return { error: rateLimit.error };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(id)) return { error: "Invalid application id." };

  const { error } = await supabase
    .from("applications")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: formatSupabaseMutationError(error, "Unable to delete application.") };
  revalidateApplicationSurfaces();
  return { ok: true };
}
