import { detectCountriesAcross } from "./location.ts";
import { expandLocationSegments } from "./us-locations.ts";
import { normalizeCountryCode } from "../geo/countries.ts";

/** Canonical English labels for filter pills (never raw ISO or variant names). */
export const CANONICAL_COUNTRY_LABELS: Record<string, string> = {
  US: "United States",
  CA: "Canada",
  GB: "United Kingdom",
  IE: "Ireland",
  DE: "Germany",
  FR: "France",
  NL: "Netherlands",
  CH: "Switzerland",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  PL: "Poland",
  ES: "Spain",
  IT: "Italy",
  PT: "Portugal",
  BE: "Belgium",
  AT: "Austria",
  IL: "Israel",
  IN: "India",
  CN: "China",
  HK: "Hong Kong",
  TW: "Taiwan",
  JP: "Japan",
  KR: "South Korea",
  SG: "Singapore",
  AU: "Australia",
  NZ: "New Zealand",
  MX: "Mexico",
  BR: "Brazil",
  AE: "United Arab Emirates",
};

/** Maps country names and code variants to canonical ISO 3166-1 alpha-2. */
const COUNTRY_CODE_ALIASES: Record<string, string> = {
  us: "US",
  usa: "US",
  "u s": "US",
  "u s a": "US",
  america: "US",
  "united states": "US",
  "united states of america": "US",
  ca: "CA",
  canada: "CA",
  uk: "GB",
  "u k": "GB",
  gb: "GB",
  "great britain": "GB",
  britain: "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  "northern ireland": "GB",
  "united kingdom": "GB",
  ie: "IE",
  ireland: "IE",
  "republic of ireland": "IE",
  de: "DE",
  germany: "DE",
  deutschland: "DE",
  fr: "FR",
  france: "FR",
  cn: "CN",
  china: "CN",
  prc: "CN",
  "china mainland": "CN",
  "mainland china": "CN",
  "people's republic of china": "CN",
  hk: "HK",
  "hong kong": "HK",
  tw: "TW",
  taiwan: "TW",
  jp: "JP",
  japan: "JP",
  kr: "KR",
  korea: "KR",
  "south korea": "KR",
  "republic of korea": "KR",
  sg: "SG",
  singapore: "SG",
  in: "IN",
  india: "IN",
  bharat: "IN",
  au: "AU",
  australia: "AU",
  aus: "AU",
  nz: "NZ",
  "new zealand": "NZ",
  mx: "MX",
  mexico: "MX",
  br: "BR",
  brazil: "BR",
  brasil: "BR",
  il: "IL",
  israel: "IL",
  ae: "AE",
  uae: "AE",
  "united arab emirates": "AE",
  nl: "NL",
  netherlands: "NL",
  holland: "NL",
  "the netherlands": "NL",
  ch: "CH",
  switzerland: "CH",
  se: "SE",
  sweden: "SE",
  no: "NO",
  norway: "NO",
  dk: "DK",
  denmark: "DK",
  fi: "FI",
  finland: "FI",
  pl: "PL",
  poland: "PL",
  es: "ES",
  spain: "ES",
  it: "IT",
  italy: "IT",
  pt: "PT",
  portugal: "PT",
  be: "BE",
  belgium: "BE",
  at: "AT",
  austria: "AT",
};

const regionDisplay = new Intl.DisplayNames(["en"], { type: "region" });

function normalizeCountryKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Map a stored or detected country token to one canonical ISO alpha-2 code.
 * Returns null when the value cannot be classified.
 */
export function canonicalCountryCode(raw: string | null | undefined): string | null {
  if (!raw?.trim()) {
    return null;
  }

  const trimmed = raw.trim();
  const key = normalizeCountryKey(trimmed);
  if (COUNTRY_CODE_ALIASES[key]) {
    return COUNTRY_CODE_ALIASES[key];
  }

  const fromScraping = normalizeCountryCode(trimmed);
  if (fromScraping?.length === 2) {
    const alias = COUNTRY_CODE_ALIASES[fromScraping.toLowerCase()];
    if (alias) {
      return alias;
    }
    if (CANONICAL_COUNTRY_LABELS[fromScraping]) {
      return fromScraping;
    }
    try {
      if (regionDisplay.of(fromScraping)) {
        return fromScraping;
      }
    } catch {
      return null;
    }
  }

  return null;
}

export function formatCountryCode(code: string): string {
  const canonical = canonicalCountryCode(code) ?? code.toUpperCase();
  if (CANONICAL_COUNTRY_LABELS[canonical]) {
    return CANONICAL_COUNTRY_LABELS[canonical];
  }
  try {
    return regionDisplay.of(canonical) ?? canonical;
  } catch {
    return canonical;
  }
}

/** Ordered, deduped canonical ISO codes for one posting or application. */
export function normalizeCountryCodes(codes: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of codes) {
    const canonical = canonicalCountryCode(raw);
    if (!canonical || seen.has(canonical)) {
      continue;
    }
    seen.add(canonical);
    out.push(canonical);
  }
  return out;
}

/** Prefer stored ISO codes; fall back to parsing location strings. */
export function resolvePostingCountries(
  countries: readonly string[],
  locations: readonly string[],
): string[] {
  const detected =
    countries.length > 0 ? countries : detectCountriesAcross(locations);
  return normalizeCountryCodes(detected);
}

export function countriesFromLocationField(location: string | null | undefined): string[] {
  if (!location?.trim()) {
    return [];
  }
  const segments = expandLocationSegments(location);
  return normalizeCountryCodes(
    detectCountriesAcross(segments.length > 0 ? segments : [location]),
  );
}

export function matchesCountryFilter(
  itemCountries: readonly string[],
  selectedCodes: ReadonlySet<string>,
): boolean {
  if (selectedCodes.size === 0) {
    return true;
  }
  const normalized = normalizeCountryCodes(itemCountries);
  if (normalized.length === 0) {
    return false;
  }
  return normalized.some((code) => selectedCodes.has(code));
}

export interface CountryFilterOption {
  code: string;
  label: string;
  count?: number;
}

export function buildCountryFilterOptions(
  countryCounts: ReadonlyMap<string, number>,
): CountryFilterOption[] {
  const merged = new Map<string, number>();
  for (const [raw, count] of countryCounts) {
    const code = canonicalCountryCode(raw);
    if (!code) {
      continue;
    }
    merged.set(code, (merged.get(code) ?? 0) + count);
  }

  return [...merged.entries()]
    .sort((a, b) => b[1] - a[1] || formatCountryCode(a[0]).localeCompare(formatCountryCode(b[0])))
    .map(([code, count]) => ({
      code,
      label: formatCountryCode(code),
      count,
    }));
}

/** Count postings/applications per canonical country (each item counted at most once per country). */
export function countCountriesInDataset(
  items: ReadonlyArray<{ countries: readonly string[] }>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const codes = normalizeCountryCodes(item.countries);
    for (const code of codes) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }
  return counts;
}
