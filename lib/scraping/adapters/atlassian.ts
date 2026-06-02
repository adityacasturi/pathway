import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { htmlToPlainText } from "../plain-text.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { atsPublishWithModified, pagePublishDate, parseFlexiblePostedDate } from "../posted-date.ts";
import { fetchJsonWithTimeout, isHttpUrl } from "./shared.ts";
import { INTERNSHIP_LIST_TITLE_PATTERN } from "../list-filters.ts";

/** Public careers snapshot on atlassian.com (iCIMS-backed; synced from globalcareers-atlassian.icims.com). */
export const ATLASSIAN_CAREERS_ORIGIN = "https://www.atlassian.com";
export const ATLASSIAN_LISTINGS_API_URL = `${ATLASSIAN_CAREERS_ORIGIN}/endpoint/careers/listings`;
export const ATLASSIAN_DEFAULT_CAREERS_URL = `${ATLASSIAN_CAREERS_ORIGIN}/company/careers/all-jobs`;

/** List titles must look internship-related before classification. */
export interface AtlassianBoardConfig {
  listingsUrl: string;
  careersOrigin: string;
}

export interface AtlassianPortalJobPost {
  portalId?: number;
  portalUrl?: string;
  id?: number;
  updatedDate?: string;
}

export interface AtlassianListing {
  id: number;
  portalId?: number;
  title?: string;
  type?: string;
  locations?: string[];
  category?: string;
  overview?: string;
  responsibilities?: string;
  qualifications?: string;
  portalJobPost?: AtlassianPortalJobPost;
}

export function createAtlassianAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveAtlassianBoard(source);
  const resolvedSource =
    source.sourceUrl === board.listingsUrl ? source : { ...source, sourceUrl: board.listingsUrl };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const listings = await fetchAtlassianListings(board.listingsUrl);
      const candidates = listings.filter((listing) => isAtlassianListCandidate(listing));
      return parseAtlassianJobs(candidates, resolvedSource, board, listings.length);
    },
  };
}

export function resolveAtlassianBoard(source: CompanySourceConfig): AtlassianBoardConfig {
  const listingsUrl = isAtlassianListingsUrl(source.sourceUrl)
    ? source.sourceUrl.trim()
    : ATLASSIAN_LISTINGS_API_URL;

  return {
    listingsUrl,
    careersOrigin: ATLASSIAN_CAREERS_ORIGIN,
  };
}

export function isAtlassianListingsUrl(sourceUrl: string): boolean {
  try {
    const parsed = new URL(sourceUrl);
    return (
      parsed.hostname.toLowerCase() === "www.atlassian.com" &&
      parsed.pathname.replace(/\/$/, "") === "/endpoint/careers/listings"
    );
  } catch {
    return false;
  }
}

export function buildAtlassianPostingUrl(board: AtlassianBoardConfig, listing: AtlassianListing): string {
  return `${board.careersOrigin}/company/careers/details/${listing.id}`;
}

export function formatAtlassianDescription(listing: AtlassianListing): string {
  const parts = [listing.overview, listing.responsibilities, listing.qualifications]
    .map((part) => htmlToPlainText(part ?? ""))
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.join("\n\n");
}

export function atlassianListingDates(listing: AtlassianListing) {
  const raw = listing.portalJobPost?.updatedDate ?? null;
  const published = parseFlexiblePostedDate(raw);
  if (published) {
    return pagePublishDate(published, "medium");
  }
  return atsPublishWithModified(null, null);
}

export function formatAtlassianLocations(listing: AtlassianListing): string[] {
  const locations = (listing.locations ?? []).map((location) => location.trim()).filter(Boolean);
  return Array.from(new Set(locations));
}

export function parseAtlassianJobs(
  listings: AtlassianListing[],
  source: CompanySourceConfig,
  board: AtlassianBoardConfig,
  fetchedTotal: number,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const listing of listings) {
    const roleName = listing.title?.trim() || "";
    const description = formatAtlassianDescription(listing);
    const locations = formatAtlassianLocations(listing);
    const postingUrl = buildAtlassianPostingUrl(board, listing);

    const classification = classifyForSource(source, {
      title: roleName,
      description,
      employmentType: listing.type ?? null,
      departments: listing.category ? [listing.category] : [],
      locations,
    });

    if (!classification.include) {
      if (roleName) {
        rejected.push({ title: roleName, reason: classification.reason });
      }
      continue;
    }

    if (!isHttpUrl(postingUrl)) {
      rejected.push({ title: roleName, reason: "invalid_url" });
      continue;
    }

    roles.push(
      buildScrapedRole({
        postingUrl,
        roleName,
        companyName: source.companyName,
        companySlug: source.companySlug,
        classification,
        description: formatAtlassianDescription(listing),
        dates: atlassianListingDates(listing),
      }),
    );
  }

  return buildRoleParseResult(fetchedTotal, roles, rejected);
}

export function parseAtlassianListingsResponse(payload: unknown, url: string): AtlassianListing[] {
  if (!Array.isArray(payload)) {
    throw new Error(`Atlassian listings response was not a JSON array for ${url}`);
  }

  return payload as AtlassianListing[];
}

export function isAtlassianListCandidate(listing: AtlassianListing): boolean {
  const title = listing.title?.trim() ?? "";
  if (/\binternal\b|\binternational\b/i.test(title) && !INTERNSHIP_LIST_TITLE_PATTERN.test(title)) {
    return false;
  }

  if (listing.category?.trim().toLowerCase() === "interns") {
    return true;
  }

  return INTERNSHIP_LIST_TITLE_PATTERN.test(title);
}

async function fetchAtlassianListings(listingsUrl: string): Promise<AtlassianListing[]> {
  const res = await fetchJsonWithTimeout(listingsUrl, {
    headers: {
      accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Atlassian listings returned ${res.status} for ${listingsUrl}`);
  }

  const payload = (await res.json()) as unknown;
  return parseAtlassianListingsResponse(payload, listingsUrl);
}

