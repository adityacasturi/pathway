import { detectCountriesAcross } from "../feed/location.ts";
import { countriesFromPlaces } from "./countries.ts";
import { minConfidence } from "./confidence.ts";
import { canonicalPlacesToField } from "./format.ts";
import {
  canonicalizeLocationParts,
  parseStructuredPlaceInput,
  resolveLocationCandidates,
} from "./parse.ts";
import { sanitizeLocationInput, splitLocationInput } from "./sanitize.ts";
import type {
  CanonicalPlace,
  ResolvedLocations,
  ResolvedPlace,
  ScrapedLocationContext,
  StructuredPlaceInput,
} from "./types.ts";

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
  "latin america",
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

function normalizeLocationKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

export function isInvalidScrapedLocationToken(
  raw: string,
  context: ScrapedLocationContext = {},
): boolean {
  const value = raw.trim();
  if (!value) return true;

  const normalized = normalizeLocationKey(value);
  if (INVALID_LOCATION_TOKENS.has(normalized)) return true;
  if (WORKPLACE_ONLY_PATTERN.test(value)) return true;

  if (
    EMPLOYMENT_LEVEL_PATTERN.test(value) &&
    !/,/.test(value) &&
    detectCountriesAcross([value]).length === 0
  ) {
    return true;
  }

  return isCompanyNameAsLocation(value, context);
}

export function looksLikeGeographicLocation(raw: string, context: ScrapedLocationContext = {}): boolean {
  const value = raw.trim();
  if (!value || isInvalidScrapedLocationToken(value, context)) return false;

  if (/,/.test(value)) return true;
  if (detectCountriesAcross([value]).length > 0) return true;

  if (
    /\b(remote|hybrid)\b/i.test(value) &&
    detectCountriesAcross([value.replace(/\b(remote|hybrid|wfh)\b/gi, "")]).length > 0
  ) {
    return true;
  }

  if (/^\d{5}(-\d{4})?$/.test(value)) return false;

  const key = normalizeLocationKey(value);
  if (INVALID_LOCATION_TOKENS.has(key)) return false;
  if (detectCountriesAcross([value]).length > 0) return true;
  // Bare TitleCase words need 3+ letters: "In", "On", "At" are ATS noise, not places.
  if (value.length >= 3 && /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$/.test(value)) return true;
  return /^[A-Z]{2,}(?:\s+[A-Z]{2,})*$/.test(value) && value.length <= 48;
}

export function normalizeScrapedLocationPart(
  raw: string,
  context: ScrapedLocationContext = {},
): string | null {
  const value = sanitizeLocationInput(raw);
  if (!value) return null;
  if (isInvalidScrapedLocationToken(value, context)) return null;
  if (!looksLikeGeographicLocation(value, context)) return null;
  return value;
}

export function normalizeScrapedLocations(
  locations: readonly string[],
  context: ScrapedLocationContext = {},
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const raw of locations) {
    for (const part of splitLocationInput(raw)) {
      const normalized = normalizeScrapedLocationPart(part, context);
      if (!normalized) continue;
      const key = normalized.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(normalized);
    }
  }

  return out;
}

export type LocationInput = string | StructuredPlaceInput;

export function isStructuredPlaceInput(value: LocationInput): value is StructuredPlaceInput {
  return typeof value === "object" && value !== null;
}

export function resolveScrapedLocations(
  inputs: readonly LocationInput[],
  context: ScrapedLocationContext = {},
): ResolvedLocations {
  const resolved: ResolvedPlace[] = [];
  const seen = new Set<string>();

  for (const input of inputs) {
    let results: ResolvedPlace[] = [];
    const labelOnly =
      typeof input !== "string" &&
      !input.city &&
      !input.region &&
      !input.countryCode &&
      input.rawLabel?.trim();
    if (typeof input === "string" || labelOnly) {
      // A structured input that is only a label ("Remote (United States | Canada)")
      // is a plain string in disguise: split it like one so multi-place lists
      // aren't collapsed to their first entry by parseStructuredPlaceInput.
      const raw = typeof input === "string" ? input : input.rawLabel!;
      for (const part of splitLocationInput(raw)) {
        const normalized = normalizeScrapedLocationPart(part, context);
        if (!normalized) continue;
        results.push(...resolveLocationCandidates(normalized));
      }
      if (typeof input !== "string" && input.remote) {
        results = results.map((r) => ({ ...r, place: { ...r.place, remote: true } }));
      }
    } else {
      const r = parseStructuredPlaceInput(input);
      if (r) results = [r];
    }

    for (const r of results) {
      const key = [
        r.place.city ?? "",
        r.place.region ?? "",
        r.place.countryCode,
        r.place.remote ? "1" : "0",
      ].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      resolved.push(r);
    }
  }

  const places: CanonicalPlace[] = resolved.map((r) => r.place);
  const display = canonicalPlacesToField(places);
  const countries = countriesFromPlaces(places);

  return {
    places,
    minConfidence: minConfidence(resolved),
    display,
    countries,
  };
}

export function resolveScrapedLocationField(
  location: string | null | undefined,
  context: ScrapedLocationContext = {},
): ResolvedLocations {
  if (!location?.trim()) {
    return { places: [], minConfidence: 0, display: null, countries: [] };
  }
  return resolveScrapedLocations(splitLocationInput(location), context);
}

export function formatScrapedLocation(
  locations: readonly string[],
  context: ScrapedLocationContext = {},
): string | null {
  const validated = normalizeScrapedLocations(locations, context);
  const resolved = canonicalizeLocationParts(validated);
  if (resolved.length === 0) return null;
  return canonicalPlacesToField(resolved.map((r) => r.place));
}
