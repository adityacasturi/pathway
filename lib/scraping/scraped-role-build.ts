import type { RoleClassification } from "./classify-role.ts";
import {
  canonicalPlacesToField,
  countriesFromPlaces,
  resolveScrapedLocations,
  type LocationInput,
} from "../geo/server.ts";
import { inferSeason, type InferSeasonHints } from "./season.ts";
import type { ScrapedRole, ScrapedSeason } from "./types.ts";

const SCRAPED_DESCRIPTION_MAX_CHARS = 8192;
const RAW_LOCATION_MAX_CHARS = 500;

function truncateScrapedDescription(text: string, maxChars: number): string | null {
  const normalized = text.trim();
  if (!normalized) return null;
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars).trimEnd()}…`;
}

/** Original ATS location strings, preserved verbatim for debugging and fallback display. */
function buildRawLocation(classification: RoleClassification): string | null {
  const parts: string[] = [];
  for (const location of classification.locations) {
    if (location.trim()) parts.push(location.trim());
  }
  for (const structured of classification.structuredLocations) {
    const label =
      structured.rawLabel?.trim() ||
      [structured.city, structured.region, structured.countryCode]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(", ");
    if (label) parts.push(label);
    else if (structured.remote) parts.push("Remote");
  }
  const unique = [...new Set(parts)];
  if (unique.length === 0) return null;
  const joined = unique.join(" | ");
  return joined.length > RAW_LOCATION_MAX_CHARS
    ? `${joined.slice(0, RAW_LOCATION_MAX_CHARS).trimEnd()}…`
    : joined;
}

export interface BuildScrapedRoleInput {
  postingUrl: string;
  roleName: string;
  companyName: string;
  classification: RoleClassification;
  description?: string | null;
  seasonHints?: InferSeasonHints;
  companySlug?: string | null;
  /** When set, skips {@link inferSeason} (employer-specific season rules). */
  season?: ScrapedSeason | null;
}

/**
 * Build the normalized posting after classification passed. This is the single
 * place where raw location inputs become canonical places — adapters and the
 * persistence layer never resolve locations themselves.
 */
export function buildScrapedRole(input: BuildScrapedRoleInput): ScrapedRole {
  const description = input.description?.trim() ?? "";
  const { classification } = input;

  const inputs: LocationInput[] = [
    ...classification.structuredLocations,
    ...classification.locations,
  ];
  const resolved = resolveScrapedLocations(inputs, {
    companyName: input.companyName,
    companySlug: input.companySlug,
  });

  return {
    postingUrl: input.postingUrl,
    roleName: input.roleName,
    companyName: input.companyName,
    roleType: classification.roleType ?? "internship",
    season:
      input.season !== undefined
        ? input.season
        : inferSeason(input.roleName, description, input.seasonHints),
    location: canonicalPlacesToField(resolved.places),
    places: resolved.places,
    rawLocation: buildRawLocation(classification),
    locationConfidence: resolved.places.length > 0 ? resolved.minConfidence : null,
    countries: countriesFromPlaces(resolved.places),
    description: truncateScrapedDescription(description, SCRAPED_DESCRIPTION_MAX_CHARS),
  };
}
