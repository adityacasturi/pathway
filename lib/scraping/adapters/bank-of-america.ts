import { decodeHtmlEntities, stripHtml } from "../html-utils.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { INTERNSHIP_LIST_TITLE_PATTERN } from "../list-filters.ts";
import { htmlToPlainText } from "../plain-text.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl } from "./shared.ts";

/**
 * Bank of America campus programs run on Oleeo/TAL (bankcampuscareers.tal.net), not Workday.
 * Listings are discovered from the candidate home jobboards; detail pages carry program descriptions.
 */
export const BOFA_CAMPUS_CANDIDATE_HOME = "https://bankcampuscareers.tal.net/candidate";

const BOFA_JOBBOARD_PATTERN =
  /href="(https:\/\/bankcampuscareers\.tal\.net\/[^"]+\/jobboard\/vacancy\/\d+\/adv\/)"[^>]*>/gi;

const BOFA_LISTING_PATTERN =
  /<a class="subject" href="([^"]+)"[^>]*>\s*([^<]+?)\s*<\/a>/gi;

const BOFA_DETAIL_CONCURRENCY = 6;

export interface BofaListing {
  title: string;
  postingUrl: string;
  location: string | null;
  description?: string | null;
}

export function createBankOfAmericaAdapter(source: CompanySourceConfig): ScrapeAdapter {
  return {
    source,
    async fetchRoles() {
      const listings = await fetchAllBofaListings();
      const enriched = await enrichBofaListings(listings);
      return parseBofaJobs(enriched, source);
    },
  };
}

export function parseBofaJobboardUrls(html: string): string[] {
  const urls = new Set<string>();
  for (const match of html.matchAll(BOFA_JOBBOARD_PATTERN)) {
    const url = match[1]?.trim();
    if (url) {
      urls.add(url);
    }
  }
  return [...urls];
}

export function parseBofaJobboardListingsHtml(html: string): BofaListing[] {
  const listings: BofaListing[] = [];

  for (const match of html.matchAll(BOFA_LISTING_PATTERN)) {
    const postingUrl = decodeHtmlEntities(match[1]?.trim() ?? "");
    const title = decodeHtmlEntities(stripHtml(match[2] ?? ""));
    if (!postingUrl || !title || !postingUrl.includes("/opp/")) {
      continue;
    }

    listings.push({
      title,
      postingUrl,
      location: parseBofaListingLocation(html, postingUrl, title),
    });
  }

  return dedupeListingsByUrl(listings);
}

export function parseBofaJobDetailFields(html: string): {
  title: string | null;
  location: string | null;
  description: string;
} {
  const title =
    html.match(/<h1 class="section">\s*([^<]+)/i)?.[1]?.trim() ??
    html.match(/<title>([^<]+?)\s*-\s*Bank of America<\/title>/i)?.[1]?.trim() ??
    null;

  const location =
    html.match(/<meta[^>]+name="description"[^>]+content="[^"]*City:\s*([^".]+)/i)?.[1]?.trim() ??
    html.match(/<span class="candidate-opp-field-label">City:<\/span>\s*([^<]+)/i)?.[1]?.trim() ??
    null;

  const descriptionBlock =
    html.match(/Program description[\s\S]*?<div[^>]+class="form-control-static"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ??
    "";
  const description = descriptionBlock ? htmlToPlainText(descriptionBlock) : "";

  return { title, location, description };
}

export function parseBofaJobs(
  listings: BofaListing[],
  source: CompanySourceConfig,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const listing of listings) {
    const roleName = listing.title.trim();
    const postingUrl = listing.postingUrl.trim();
    const description = buildBofaClassificationDescription(listing);
    const locations = listing.location ? [listing.location] : [];

    const classification = classifyForSource(source, {
      title: roleName,
      description,
      departments: [],
      locations,
    });

    if (!classification.include) {
      if (roleName) {
        rejected.push({ title: roleName, reason: classification.reason });
      }
      continue;
    }

    if (!postingUrl || !isHttpUrl(postingUrl)) {
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
        description,
      }),
    );
  }

  return buildRoleParseResult(listings.length, roles, rejected);
}

async function fetchAllBofaListings(): Promise<BofaListing[]> {
  const homeHtml = await fetchBofaHtml(BOFA_CAMPUS_CANDIDATE_HOME);
  const jobboardUrls = parseBofaJobboardUrls(homeHtml);
  if (jobboardUrls.length === 0) {
    throw new Error("Bank of America campus jobboards not found on candidate home");
  }

  const all: BofaListing[] = [];
  for (const jobboardUrl of jobboardUrls) {
    const html = await fetchBofaHtml(jobboardUrl);
    all.push(...parseBofaJobboardListingsHtml(html));
  }

  return dedupeListingsByUrl(all);
}

async function enrichBofaListings(listings: BofaListing[]): Promise<BofaListing[]> {
  const targets = listings.filter((listing) => INTERNSHIP_LIST_TITLE_PATTERN.test(listing.title));
  if (targets.length === 0) {
    return listings;
  }

  const details = new Map<string, ReturnType<typeof parseBofaJobDetailFields>>();
  let index = 0;

  async function worker(): Promise<void> {
    while (index < targets.length) {
      const current = targets[index];
      index += 1;
      if (!current) {
        continue;
      }
      try {
        const html = await fetchBofaHtml(current.postingUrl);
        details.set(current.postingUrl, parseBofaJobDetailFields(html));
      } catch {
        details.set(current.postingUrl, {
          title: null,
          location: null,
          description: "",
        });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(BOFA_DETAIL_CONCURRENCY, targets.length) }, () => worker()),
  );

  return listings.map((listing) => {
    const detail = details.get(listing.postingUrl);
    if (!detail) {
      return listing;
    }
    return {
      ...listing,
      title: detail.title ?? listing.title,
      location: detail.location ?? listing.location,
      description: detail.description || listing.description,
    };
  });
}

function parseBofaListingLocation(html: string, postingUrl: string, title: string): string | null {
  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rowPattern = new RegExp(
    `data-title="${escapedTitle}"[\\s\\S]*?<a class="subject" href="${postingUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[\\s\\S]*?</a>[\\s\\S]*?<td class="comm_list_tbody">\\s*([^<]+?)\\s*</td>`,
    "i",
  );
  const rowMatch = html.match(rowPattern);
  if (rowMatch?.[1]) {
    return decodeHtmlEntities(stripHtml(rowMatch[1]));
  }

  const tilePattern = new RegExp(
    `href="${postingUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[\\s\\S]*?<span class="candidate-opp-field-label">City:<\\/span>\\s*([^<]+)`,
    "i",
  );
  const tileMatch = html.match(tilePattern);
  return tileMatch?.[1] ? decodeHtmlEntities(stripHtml(tileMatch[1])) : null;
}

async function fetchBofaHtml(url: string): Promise<string> {
  const res = await fetchJsonWithTimeout(url, {
    headers: { accept: "text/html,application/xhtml+xml" },
  });
  if (!res.ok) {
    throw new Error(`Bank of America campus careers returned ${res.status} for ${url}`);
  }
  return res.text();
}

function buildBofaClassificationDescription(listing: BofaListing): string {
  return [listing.title, listing.location, listing.description].filter(Boolean).join("\n");
}

function dedupeListingsByUrl(listings: BofaListing[]): BofaListing[] {
  const seen = new Set<string>();
  const deduped: BofaListing[] = [];
  for (const listing of listings) {
    if (seen.has(listing.postingUrl)) {
      continue;
    }
    seen.add(listing.postingUrl);
    deduped.push(listing);
  }
  return deduped;
}
