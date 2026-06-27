import { normalizeLogoCompany } from "../logo.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

interface CompanyWebsiteRow {
  slug: string;
  name: string;
  website_url: string | null;
  logo_asset_key: string | null;
}

export interface CompanyWebsiteLookups {
  bySlug: ReadonlyMap<string, string>;
  byName: ReadonlyMap<string, string>;
  slugByName: ReadonlyMap<string, string>;
  logoAssetByName: ReadonlyMap<string, string>;
}

/** Serializable map for client components (`normalizeLogoCompany` keys). */
export type CompanyWebsiteByName = Readonly<Record<string, string>>;

/** Discover catalog slug keyed by normalized company name (for static logos). */
export type CompanySlugByName = Readonly<Record<string, string>>;

/** `logo_asset_key` keyed by normalized company name. */
export type CompanyLogoAssetByName = Readonly<Record<string, string>>;

export interface CompanyLogoLookupRecords {
  companyWebsiteByName: CompanyWebsiteByName;
  companySlugByName: CompanySlugByName;
  companyLogoAssetByName: CompanyLogoAssetByName;
}

function lookupMapToRecord(map: ReadonlyMap<string, string>): Record<string, string> {
  return Object.fromEntries(map);
}

export async function loadCompanyWebsiteLookups(
  supabase: SupabaseClient,
): Promise<CompanyWebsiteLookups> {
  const { data, error } = await supabase
    .from("companies")
    .select("slug, name, website_url, logo_asset_key")
    .eq("is_active", true);

  if (error) throw error;

  const bySlug = new Map<string, string>();
  const byName = new Map<string, string>();
  const slugByName = new Map<string, string>();
  const logoAssetByName = new Map<string, string>();

  for (const row of (data ?? []) as CompanyWebsiteRow[]) {
    const slug = row.slug?.trim().toLowerCase();
    const nameKey = normalizeLogoCompany(row.name);
    const website = row.website_url?.trim();
    const logoAsset = row.logo_asset_key?.trim();

    if (slug && nameKey && !slugByName.has(nameKey)) {
      slugByName.set(nameKey, slug);
    }

    if (logoAsset && nameKey && !logoAssetByName.has(nameKey)) {
      logoAssetByName.set(nameKey, logoAsset);
    }

    if (!website) continue;

    if (slug && !bySlug.has(slug)) {
      bySlug.set(slug, website);
    }

    if (nameKey && !byName.has(nameKey)) {
      byName.set(nameKey, website);
    }
  }

  return { bySlug, byName, slugByName, logoAssetByName };
}

export function companyWebsiteByNameFromLookups(
  lookups: CompanyWebsiteLookups,
): CompanyWebsiteByName {
  return lookupMapToRecord(lookups.byName);
}

export function companySlugByNameFromLookups(lookups: CompanyWebsiteLookups): CompanySlugByName {
  return lookupMapToRecord(lookups.slugByName);
}

export function companyLogoAssetByNameFromLookups(
  lookups: CompanyWebsiteLookups,
): CompanyLogoAssetByName {
  return lookupMapToRecord(lookups.logoAssetByName);
}

export function companyLogoLookupRecordsFromLookups(
  lookups: CompanyWebsiteLookups,
): CompanyLogoLookupRecords {
  return {
    companyWebsiteByName: companyWebsiteByNameFromLookups(lookups),
    companySlugByName: companySlugByNameFromLookups(lookups),
    companyLogoAssetByName: companyLogoAssetByNameFromLookups(lookups),
  };
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

export function lookupCompanySlug(
  company: string,
  byName: CompanySlugByName,
  options?: { slug?: string | null },
): string | null;
export function lookupCompanySlug(
  company: string,
  lookups: CompanyWebsiteLookups,
  options?: { slug?: string | null },
): string | null;
export function lookupCompanySlug(
  company: string,
  lookups: CompanyWebsiteLookups | CompanySlugByName,
  options?: { slug?: string | null },
): string | null {
  const explicit = options?.slug?.trim().toLowerCase();
  if (explicit) return explicit;

  const nameKey = normalizeLogoCompany(company);
  if (isCompanyWebsiteLookups(lookups)) {
    return lookups.slugByName.get(nameKey) ?? null;
  }
  return lookups[nameKey] ?? null;
}

export function lookupCompanyLogoAssetKey(
  company: string,
  byName: CompanyLogoAssetByName,
  options?: { slug?: string | null; logoAssetKey?: string | null },
): string | null;
export function lookupCompanyLogoAssetKey(
  company: string,
  lookups: CompanyWebsiteLookups,
  options?: { slug?: string | null; logoAssetKey?: string | null },
): string | null;
export function lookupCompanyLogoAssetKey(
  company: string,
  lookups: CompanyWebsiteLookups | CompanyLogoAssetByName,
  options?: { slug?: string | null; logoAssetKey?: string | null },
): string | null {
  const explicit = options?.logoAssetKey?.trim();
  if (explicit) return explicit;

  const nameKey = normalizeLogoCompany(company);
  if (isCompanyWebsiteLookups(lookups)) {
    return lookups.logoAssetByName.get(nameKey) ?? null;
  }
  return lookups[nameKey] ?? null;
}
