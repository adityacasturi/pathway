import { normalizeLogoCompany } from "../logo.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

interface CompanyWebsiteRow {
  slug: string;
  name: string;
  website_url: string | null;
}

export interface CompanyWebsiteLookups {
  bySlug: ReadonlyMap<string, string>;
  byName: ReadonlyMap<string, string>;
}

/** Serializable map for client components (`normalizeLogoCompany` keys). */
export type CompanyWebsiteByName = Readonly<Record<string, string>>;

export async function loadCompanyWebsiteLookups(
  supabase: SupabaseClient,
): Promise<CompanyWebsiteLookups> {
  const { data, error } = await supabase
    .from("companies")
    .select("slug, name, website_url")
    .eq("is_active", true);

  if (error) throw error;

  const bySlug = new Map<string, string>();
  const byName = new Map<string, string>();

  for (const row of (data ?? []) as CompanyWebsiteRow[]) {
    const website = row.website_url?.trim();
    if (!website) continue;

    const slug = row.slug?.trim().toLowerCase();
    if (slug && !bySlug.has(slug)) {
      bySlug.set(slug, website);
    }

    const nameKey = normalizeLogoCompany(row.name);
    if (nameKey && !byName.has(nameKey)) {
      byName.set(nameKey, website);
    }
  }

  return { bySlug, byName };
}

export function companyWebsiteByNameFromLookups(
  lookups: CompanyWebsiteLookups,
): CompanyWebsiteByName {
  return Object.fromEntries(lookups.byName);
}

function isCompanyWebsiteLookups(
  lookups: CompanyWebsiteLookups | CompanyWebsiteByName,
): lookups is CompanyWebsiteLookups {
  return "bySlug" in lookups && lookups.bySlug instanceof Map;
}

export function lookupCompanyWebsiteUrl(
  company: string,
  byName: CompanyWebsiteByName,
  options?: { slug?: string | null; explicit?: string | null },
): string | null;
export function lookupCompanyWebsiteUrl(
  company: string,
  lookups: CompanyWebsiteLookups,
  options?: { slug?: string | null; explicit?: string | null },
): string | null;
export function lookupCompanyWebsiteUrl(
  company: string,
  lookups: CompanyWebsiteLookups | CompanyWebsiteByName,
  options?: { slug?: string | null; explicit?: string | null },
): string | null {
  const explicit = options?.explicit?.trim();
  if (explicit) return explicit;

  const slug = options?.slug?.trim().toLowerCase();
  if (slug && isCompanyWebsiteLookups(lookups)) {
    const fromSlug = lookups.bySlug.get(slug);
    if (fromSlug) return fromSlug;
  }

  const nameKey = normalizeLogoCompany(company);
  if (isCompanyWebsiteLookups(lookups)) {
    return lookups.byName.get(nameKey) ?? null;
  }
  return lookups[nameKey] ?? null;
}
