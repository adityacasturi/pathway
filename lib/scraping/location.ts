import { detectCountriesAcross } from "../feed/location.ts";

/** Normalize ATS country codes/names to ISO alpha-2 when possible. */
export function normalizeCountryCode(countryCode: string | null | undefined): string | null {
  if (!countryCode?.trim()) {
    return null;
  }

  const value = countryCode.trim();
  const upper = value.toUpperCase();
  if (upper === "US" || upper === "USA") {
    return "US";
  }
  if (/^united states/i.test(value)) {
    return "US";
  }
  if (value.length === 2) {
    return upper;
  }
  return upper;
}

/** When country is absent, callers may still emit a location string for downstream trim. */
export function isUsCountryCode(countryCode: string | null | undefined): boolean {
  const normalized = normalizeCountryCode(countryCode);
  return normalized === null || normalized === "US";
}

/**
 * Oracle / Goldman / JPMorgan-style primary + ISO country field.
 * Returns no locations when country is present and not US.
 */
export function formatPrimaryWithCountryCode(
  primary: string,
  country: string | null | undefined,
): string[] {
  const normalizedCountry = normalizeCountryCode(country);
  if (normalizedCountry && normalizedCountry !== "US") {
    return [];
  }

  const trimmedPrimary = primary.trim();
  if (!trimmedPrimary) {
    return normalizedCountry === "US" ? ["United States"] : [];
  }

  const countryToken = country?.trim() ?? "";
  if (
    countryToken.length === 2 &&
    !trimmedPrimary.toUpperCase().includes(countryToken.toUpperCase())
  ) {
    if (normalizedCountry === "US") {
      return trimmedPrimary.toLowerCase().includes("united states")
        ? [trimmedPrimary]
        : [`${trimmedPrimary}, United States`];
    }
    return [`${trimmedPrimary}, ${countryToken}`];
  }

  return [trimmedPrimary];
}

export interface ScrapedLocationContext {
  companyName?: string | null;
  companySlug?: string | null;
}

const LOCATION_SEPARATOR = " · ";

/** Tokens that are labels, levels, or regions too vague to show as a job location. */
const INVALID_LOCATION_TOKENS = new Set([
  "location",
  "locations",
  "office",
  "offices",
  "professional",
  "professionals",
  "experienced professional",
  "experienced professionals",
  "all offices",
  "multiple locations",
  "various locations",
  "unspecified",
  "tbd",
  "not specified",
  "see description",
  "global",
  "worldwide",
  "anywhere",
  "namer",
  "emea",
  "apac",
  "americas",
  "asia",
  "africa",
  "latam",
  "north america",
  "south america",
  "hybrid",
  "remote",
  "onsite",
  "on-site",
  "in-office",
  "in office",
]);

const EMPLOYMENT_LEVEL_PATTERN =
  /\b(?:entry[- ]level|mid[- ]level|senior|executive|director|manager|individual contributor|ic\d?|experienced)\b/i;

const WORKPLACE_ONLY_PATTERN = /^(?:remote|hybrid|onsite|on-site|in-office|in office|virtual|wfh)$/i;

/**
 * Split a stored location field or adapter list into individual place strings.
 */
export function splitScrapedLocationInput(raw: string | null | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }

  return raw
    .split(/\s*·\s*|\s*\|\s*|\s*;\s*|\s*\/\s*(?=\s*[A-Z])/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Normalize and filter location strings for scrape storage and classification.
 */
export function normalizeScrapedLocations(
  locations: readonly string[],
  context: ScrapedLocationContext = {},
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const raw of locations) {
    for (const part of splitScrapedLocationInput(raw)) {
      const normalized = normalizeScrapedLocationPart(part, context);
      if (!normalized) {
        continue;
      }
      const key = normalized.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      out.push(normalized);
    }
  }

  return out;
}

export function formatScrapedLocation(
  locations: readonly string[],
  context: ScrapedLocationContext = {},
): string | null {
  const normalized = normalizeScrapedLocations(locations, context);
  if (normalized.length === 0) {
    return null;
  }
  return normalized.join(LOCATION_SEPARATOR);
}

export function normalizeScrapedLocationField(
  location: string | null | undefined,
  context: ScrapedLocationContext = {},
): string | null {
  if (!location?.trim()) {
    return null;
  }
  return formatScrapedLocation(splitScrapedLocationInput(location), context);
}

export function normalizeScrapedLocationPart(
  raw: string,
  context: ScrapedLocationContext = {},
): string | null {
  let value = collapseRepeatedCommaParts(raw.replace(/\s+/g, " ").trim());
  if (!value) {
    return null;
  }

  value = normalizeCountrySpacing(value);

  if (isInvalidScrapedLocationToken(value, context)) {
    return null;
  }

  if (!looksLikeGeographicLocation(value)) {
    return null;
  }

  return value;
}

export function isInvalidScrapedLocationToken(
  raw: string,
  context: ScrapedLocationContext = {},
): boolean {
  const value = raw.trim();
  if (!value) {
    return true;
  }

  const normalized = normalizeLocationKey(value);
  if (INVALID_LOCATION_TOKENS.has(normalized)) {
    return true;
  }

  if (WORKPLACE_ONLY_PATTERN.test(value)) {
    return true;
  }

  if (
    EMPLOYMENT_LEVEL_PATTERN.test(value) &&
    !/,/.test(value) &&
    detectCountriesAcross([value]).length === 0
  ) {
    return true;
  }

  if (isCompanyNameAsLocation(value, context)) {
    return true;
  }

  return false;
}

export function looksLikeGeographicLocation(raw: string): boolean {
  const value = raw.trim();
  if (!value || isInvalidScrapedLocationToken(value)) {
    return false;
  }

  if (/,/.test(value)) {
    return true;
  }

  if (detectCountriesAcross([value]).length > 0) {
    return true;
  }

  if (
    /\b(remote|hybrid)\b/i.test(value) &&
    detectCountriesAcross([value.replace(/\b(remote|hybrid|wfh)\b/gi, "")]).length > 0
  ) {
    return true;
  }

  if (/^\d{5}(-\d{4})?$/.test(value)) {
    return false;
  }

  // Single token: allow well-known cities/countries only (e.g. "Singapore", "Austin").
  const key = normalizeLocationKey(value);
  if (INVALID_LOCATION_TOKENS.has(key)) {
    return false;
  }

  if (detectCountriesAcross([value]).length > 0) {
    return true;
  }

  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$/.test(value)) {
    return true;
  }

  // PCSX / boards sometimes emit uppercase city names (e.g. LOWELL).
  return /^[A-Z]{2,}(?:\s+[A-Z]{2,})*$/.test(value) && value.length <= 48;
}

function isCompanyNameAsLocation(raw: string, context: ScrapedLocationContext): boolean {
  const value = normalizeLocationKey(raw);
  const slug = context.companySlug?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  const name = context.companyName?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

  if (slug && (value === slug || value.replace(/[^a-z0-9]+/g, "") === slug)) {
    return true;
  }

  if (name && name.length >= 4 && value.replace(/[^a-z0-9]+/g, "") === name) {
    return true;
  }

  return false;
}

/** "Singapore, Singapore, Singapore" → "Singapore". */
export function collapseRepeatedCommaParts(raw: string): string {
  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) {
    return raw.trim();
  }

  const unique: string[] = [];
  for (const part of parts) {
    const key = part.toLowerCase();
    if (!unique.some((existing) => existing.toLowerCase() === key)) {
      unique.push(part);
    }
  }

  return unique.join(", ");
}

/** "Los Gatos,California,United States" → spaced commas. */
function normalizeCountrySpacing(value: string): string {
  return value.replace(/,([^\s,])/g, ", $1");
}

function normalizeLocationKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Best-effort city, ST (or city, country) extraction from plain text (e.g. job descriptions).
 */
export function extractLocationFromPlainText(text: string): string | null {
  const locations = extractLocationsFromPlainText(text);
  return locations[0] ?? null;
}

/** Collect US-relevant place strings from free-form job copy (HTML pages, Valve, Surge, etc.). */
export function extractLocationsFromPlainText(text: string): string[] {
  if (!text?.trim()) {
    return [];
  }

  const out: string[] = [];
  const seen = new Set<string>();

  function push(candidate: string | null) {
    if (!candidate) {
      return;
    }
    const key = candidate.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    out.push(candidate);
  }

  const patterns = [
    /\bLocation\s*[:–-]\s*([^\n.;]{3,80})/i,
    /\b(?:based in|located in|office in)\s+([A-Z][^\n.;]{2,60})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) {
      continue;
    }
    push(normalizeScrapedLocationPart(match[1]?.trim() ?? ""));
  }

  for (const match of text.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})\b/g)) {
    push(normalizeScrapedLocationPart(`${match[1]?.trim()}, ${match[2]?.trim()}`));
  }

  for (const match of text.matchAll(
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g,
  )) {
    push(normalizeScrapedLocationPart(`${match[1]?.trim()}, ${match[2]?.trim()}`));
  }

  if (/\bUnited States\b|\bUSA\b|\bU\.S\.A?\.?\b/i.test(text)) {
    push("United States");
  }

  if (/\bremote\b.*\b(united states|usa|u\.s\.)\b/i.test(text)) {
    push("Remote, United States");
  }

  return out;
}
