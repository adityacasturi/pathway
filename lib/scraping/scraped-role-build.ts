import { formatClassifiedScrapeLocation, type RoleClassification } from "./classify-role.ts";
import { inferSeason, type InferSeasonHints } from "./season.ts";
import type { ScrapedRole, ScrapedRoleDates, ScrapedSeason } from "./types.ts";

export interface BuildScrapedRoleInput {
  postingUrl: string;
  roleName: string;
  companyName: string;
  classification: RoleClassification;
  dates: ScrapedRoleDates;
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
    datePosted: null,
    dates: input.dates,
  };
}
