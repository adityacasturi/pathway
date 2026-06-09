import { normalizeCountryCode, isUsCountryCode } from "../geo/countries.ts";
import {
  canonicalPlacesToField,
  canonicalizeLocationParts,
  collapseRepeatedCommaParts,
  formatScrapedLocation,
  isInvalidScrapedLocationToken,
  looksLikeGeographicLocation,
  normalizeScrapedLocationPart,
  normalizeScrapedLocations,
  resolveScrapedLocationField,
  resolveScrapedLocations,
  splitLocationInput,
} from "../geo/server.ts";

export type { ScrapedLocationContext } from "../geo/types.ts";

export { normalizeCountryCode, isUsCountryCode };

/**
 * Oracle / Goldman / JPMorgan-style primary + ISO country field.
 */
export function formatPrimaryWithCountryCode(
  primary: string,
  country: string | null | undefined,
): string[] {
  const normalizedCountry = normalizeCountryCode(country);
  const trimmedPrimary = primary.trim();
  if (!trimmedPrimary) {
    if (normalizedCountry === "US") {
      return ["United States"];
    }
    if (normalizedCountry) {
      return [country?.trim() || normalizedCountry];
    }
    return [];
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

export {
  splitLocationInput as splitScrapedLocationInput,
  collapseRepeatedCommaParts,
  normalizeScrapedLocations,
  normalizeScrapedLocationPart,
  isInvalidScrapedLocationToken,
  looksLikeGeographicLocation,
  formatScrapedLocation,
  resolveScrapedLocations,
  resolveScrapedLocationField,
};

/** Canonical city/region/country strings for scraped_postings storage. */
export function canonicalizeScrapedLocationsForStorage(
  locations: readonly string[],
  context: Parameters<typeof normalizeScrapedLocations>[1] = {},
): string[] {
  const validated = normalizeScrapedLocations(locations, context);
  const resolved = canonicalizeLocationParts(validated);
  return resolved.map((r) => canonicalPlacesToField([r.place]) ?? "").filter(Boolean);
}

export { canonicalizeLocationParts as canonicalizeScrapedLocationParts, canonicalPlacesToJson } from "../geo/server.ts";

export function normalizeScrapedLocationField(
  location: string | null | undefined,
  context: Parameters<typeof resolveScrapedLocationField>[1] = {},
): string | null {
  return resolveScrapedLocationField(location, context).display;
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
