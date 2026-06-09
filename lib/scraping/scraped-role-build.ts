import { formatClassifiedScrapeLocation, type RoleClassification } from "./classify-role.ts";
import { inferSeason, type InferSeasonHints } from "./season.ts";
import type { ScrapedRole, ScrapedSeason } from "./types.ts";

const SCRAPED_DESCRIPTION_MAX_CHARS = 8192;

function truncateScrapedDescription(text: string, maxChars: number): string | null {
  const normalized = text.trim();
  if (!normalized) return null;
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars).trimEnd()}…`;
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
  season?: ScrapedSeason;
}

/** Build a stored role row after classification passed. */
export function buildScrapedRole(input: BuildScrapedRoleInput): ScrapedRole {
  const description = input.description?.trim() ?? "";
  const location = formatClassifiedScrapeLocation(input.classification, {
    companyName: input.companyName,
    companySlug: input.companySlug,
  });

  return {
    postingUrl: input.postingUrl,
    roleName: input.roleName,
    companyName: input.companyName,
    season: input.season ?? inferSeason(input.roleName, description, input.seasonHints),
    location,
    locationConfidence: input.classification.locationConfidence,
    description: truncateScrapedDescription(description, SCRAPED_DESCRIPTION_MAX_CHARS),
  };
}
