import { detectCountriesAcross } from "./location.ts";
import { splitScrapedLocationInput } from "../scraping/location.ts";

/** Same separator as {@link formatScrapedLocation} in lib/scraping/location.ts. */
export const US_LOCATION_SEPARATOR = " · ";

/**
 * Split stored location strings into individual place segments for country checks.
 */
export function expandLocationSegments(raw: string | readonly string[]): string[] {
  const out: string[] = [];
  const items = Array.isArray(raw) ? raw : [raw];
  for (const item of items) {
    out.push(...splitScrapedLocationInput(item));
  }
  return out;
}

export function detectSegmentCountries(segment: string): string[] {
  return detectCountriesAcross([segment]);
}

/**
 * True when the segment has at least one country signal and every signal is US.
 * Segments with no country signal fail closed.
 */
export function isUsSegment(segment: string): boolean {
  const countries = detectSegmentCountries(segment);
  return countries.length > 0 && countries.every((code) => code === "US");
}

/**
 * Keep only US location segments, deduped case-insensitively, joined for storage/display.
 */
export function trimToUsLocations(locations: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of locations) {
    for (const segment of expandLocationSegments(raw)) {
      if (!isUsSegment(segment)) {
        continue;
      }
      const key = segment.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      out.push(segment);
    }
  }

  return out;
}

export function formatUsLocations(locations: readonly string[]): string | null {
  const trimmed = trimToUsLocations(locations);
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed.join(US_LOCATION_SEPARATOR);
}

/** Short label for UI rows — caps how many place segments are shown before "+N more". */
export function formatCompactLocationSegments(
  segments: readonly string[],
  maxShown = 2,
): string {
  if (segments.length === 0) {
    return "";
  }
  if (segments.length <= maxShown) {
    return segments.join(US_LOCATION_SEPARATOR);
  }
  return `${segments.slice(0, maxShown).join(US_LOCATION_SEPARATOR)}${US_LOCATION_SEPARATOR}+${segments.length - maxShown} more`;
}

export function formatCompactLocationLabel(
  location: string | null | undefined,
  maxShown = 2,
): string | null {
  if (!location?.trim()) {
    return null;
  }
  const segments = expandLocationSegments(location);
  if (segments.length === 0) {
    return location.trim();
  }
  return formatCompactLocationSegments(segments, maxShown);
}

export function hasUsLocation(locations: readonly string[]): boolean {
  return trimToUsLocations(locations).length > 0;
}

export function countriesFromUsLocations(locations: readonly string[]): string[] {
  const codes = new Set<string>();
  for (const segment of trimToUsLocations(locations)) {
    for (const code of detectSegmentCountries(segment)) {
      codes.add(code);
    }
  }
  return Array.from(codes);
}

/** ISO codes detected across all location segments (not US-only). */
export function countriesFromLocations(locations: readonly string[]): string[] {
  const codes = new Set<string>();
  for (const raw of locations) {
    for (const segment of expandLocationSegments(raw)) {
      for (const code of detectSegmentCountries(segment)) {
        codes.add(code);
      }
    }
  }
  return Array.from(codes).sort();
}
