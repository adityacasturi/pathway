import { extractAvatureDetailDatePosted } from "../avature-dates.ts";
import { decodeHtmlEntities, stripHtml } from "../html-utils.ts";
import { atsPublishDate, pagePublishDate, parseFlexiblePostedDate } from "../posted-date.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { htmlToPlainText } from "../plain-text.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, resolveBoardToken } from "./shared.ts";

/**
 * Bloomberg careers run on Avature (bloomberg.avature.net), not Greenhouse/Workday.
 * Open roles are listed on SearchJobs HTML pages; detail pages carry location and description.
 */
export const BLOOMBERG_CAREERS_ORIGIN = "https://bloomberg.avature.net";
export const BLOOMBERG_SEARCH_JOBS_URL = `${BLOOMBERG_CAREERS_ORIGIN}/careers/SearchJobs`;
export const BLOOMBERG_DEFAULT_PORTAL_ID = "4";

const BLOOMBERG_PAGE_SIZE = 12;
const BLOOMBERG_MAX_PAGES = 45;
const BLOOMBERG_DETAIL_CONCURRENCY = 6;

/** Listings that may be internships before we fetch detail HTML. */
const BLOOMBERG_DETAIL_PREFETCH_PATTERN =
  /\b(intern(?:ship)?|co-?op|apprentice|campus)\b|\bearly\s*careers?\b|\bsummer\s+(?:analyst|intern)\b|\bseasonal\/off[- ]?cycle\b|\b(?:software|data|ml|machine learning)\s+(?:engineer|developer)\b.*\b20[2-9][0-9]\b/i;

const ARTICLE_BLOCK_PATTERN =
  /<article\s+class="article article--result"[^>]*>([\s\S]*?)<\/article>/gi;

const JOB_LINK_PATTERN =
  /<a\s+class="link"\s+href="(https:\/\/bloomberg\.avature\.net\/careers\/JobDetail\/[^"]+)"[^>]*>\s*([\s\S]*?)\s*<\/a>/i;

const LIST_LOCATION_PATTERN = /<span\s+class="list-item-location">([^<]*)<\/span>/i;

const DETAIL_FIELD_PATTERN =
  /article__content__view__field__label[^>]*>\s*([\s\S]*?)\s*<\/div>[\s\S]*?article__content__view__field__value[^>]*>\s*([\s\S]*?)\s*<\/div>/gi;

export interface BloombergBoardConfig {
  portalId: string;
  searchJobsUrl: string;
}

export interface BloombergListing {
  title: string;
  postingUrl: string;
  location: string | null;
  businessArea: string | null;
  description?: string | null;
  datePosted?: string | null;
}

export function createBloombergAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveBloombergBoard(source);
  const resolvedSource =
    source.boardToken === board.portalId && source.sourceUrl === board.searchJobsUrl
      ? source
      : { ...source, boardToken: board.portalId, sourceUrl: board.searchJobsUrl };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const listings = await fetchAllBloombergListings(board);
      const enriched = await enrichBloombergListings(listings);
      return parseBloombergJobs(enriched, resolvedSource);
    },
  };
}

export function resolveBloombergBoard(source: CompanySourceConfig): BloombergBoardConfig {
  const portalId =
    resolveBoardToken(source, () => BLOOMBERG_DEFAULT_PORTAL_ID) || BLOOMBERG_DEFAULT_PORTAL_ID;
  const searchJobsUrl = normalizeBloombergSearchJobsUrl(source.sourceUrl);

  return { portalId, searchJobsUrl };
}

export function parseBloombergSearchJobsHtml(html: string): BloombergListing[] {
  const listings: BloombergListing[] = [];

  for (const match of html.matchAll(ARTICLE_BLOCK_PATTERN)) {
    const block = match[1] ?? "";
    const linkMatch = block.match(JOB_LINK_PATTERN);
    if (!linkMatch) {
      continue;
    }

    const postingUrl = decodeHtmlEntities(linkMatch[1].trim());
    const title = stripHtml(linkMatch[2]);
    if (!title || !isHttpUrl(postingUrl)) {
      continue;
    }

    const location = block.match(LIST_LOCATION_PATTERN)?.[1]?.trim() || null;

    listings.push({
      title,
      postingUrl,
      location,
      businessArea: null,
    });
  }

  return dedupeListingsByUrl(listings);
}

export function parseBloombergJobDetailFields(html: string): {
  location: string | null;
  businessArea: string | null;
  description: string;
} {
  const fields = new Map<string, string>();

  for (const match of html.matchAll(DETAIL_FIELD_PATTERN)) {
    const label = stripHtml(match[1] ?? "");
    const value = stripHtml(match[2] ?? "");
    if (label && value) {
      fields.set(label.toLowerCase(), value);
    }
  }

  const location = fields.get("location") ?? null;
  const businessArea = fields.get("business area") ?? null;

  const descriptionParts: string[] = [];
  for (const [label, value] of fields) {
    if (label === "location" || label === "business area" || label === "ref #") {
      continue;
    }
    if (value.length > 40) {
      descriptionParts.push(value);
    }
  }

  const longText = extractBloombergLongDescriptionHtml(html);
  if (longText) {
    descriptionParts.push(longText);
  }

  return {
    location,
    businessArea,
    description: descriptionParts.join("\n"),
  };
}

export function bloombergListingDates(listing: BloombergListing) {
  const published = parseFlexiblePostedDate(listing.datePosted ?? null);
  if (published) {
    return pagePublishDate(published, "medium");
  }
  return atsPublishDate(null);
}

export function parseBloombergJobs(
  listings: BloombergListing[],
  source: CompanySourceConfig,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const listing of listings) {
    const roleName = listing.title.trim();
    const postingUrl = listing.postingUrl.trim();
    const description = buildBloombergClassificationDescription(listing);
    const locations = listing.location ? [listing.location] : [];
    const departments = listing.businessArea ? [listing.businessArea] : [];

    const classification = classifyForSource(source, {
      title: roleName,
      description,
      team: listing.businessArea,
      departments,
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
        description: buildBloombergClassificationDescription(listing),
        dates: bloombergListingDates(listing),
      }),
    );
  }

  return buildRoleParseResult(listings.length, roles, rejected);
}

export function shouldPrefetchBloombergDetail(listing: BloombergListing): boolean {
  const haystack = [listing.title, listing.businessArea, listing.location]
    .filter(Boolean)
    .join(" ");
  return BLOOMBERG_DETAIL_PREFETCH_PATTERN.test(haystack);
}

async function fetchAllBloombergListings(board: BloombergBoardConfig): Promise<BloombergListing[]> {
  const all: BloombergListing[] = [];

  for (let page = 0; page < BLOOMBERG_MAX_PAGES; page += 1) {
    const offset = page * BLOOMBERG_PAGE_SIZE;
    const url = `${board.searchJobsUrl}?jobRecordsPerPage=${BLOOMBERG_PAGE_SIZE}&jobOffset=${offset}`;
    const html = await fetchBloombergHtml(url);
    const batch = parseBloombergSearchJobsHtml(html);
    all.push(...batch);

    if (batch.length < BLOOMBERG_PAGE_SIZE) {
      break;
    }
    const nextOffset = offset + BLOOMBERG_PAGE_SIZE;
    if (!html.includes(`jobOffset=${nextOffset}`)) {
      break;
    }
  }

  return dedupeListingsByUrl(all);
}

async function enrichBloombergListings(listings: BloombergListing[]): Promise<BloombergListing[]> {
  const targets = listings.filter(shouldPrefetchBloombergDetail);
  if (targets.length === 0) {
    return listings;
  }

  const details = new Map<
    string,
    ReturnType<typeof parseBloombergJobDetailFields> & { datePosted: string | null }
  >();
  let index = 0;

  async function worker(): Promise<void> {
    while (index < targets.length) {
      const current = targets[index];
      index += 1;
      if (!current) {
        continue;
      }
      try {
        const html = await fetchBloombergHtml(current.postingUrl);
        const fields = parseBloombergJobDetailFields(html);
        details.set(current.postingUrl, {
          ...fields,
          datePosted: extractAvatureDetailDatePosted(html),
        });
      } catch {
        details.set(current.postingUrl, {
          location: null,
          businessArea: null,
          description: "",
          datePosted: null,
        });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(BLOOMBERG_DETAIL_CONCURRENCY, targets.length) }, () => worker()),
  );

  return listings.map((listing) => {
    const detail = details.get(listing.postingUrl);
    if (!detail) {
      return listing;
    }
    return {
      ...listing,
      location: detail.location ?? listing.location,
      businessArea: detail.businessArea ?? listing.businessArea,
      description: detail.description || listing.description,
      datePosted: detail.datePosted ?? listing.datePosted ?? null,
    };
  });
}

async function fetchBloombergHtml(url: string): Promise<string> {
  const res = await fetchJsonWithTimeout(url, {
    headers: { accept: "text/html,application/xhtml+xml" },
  });
  if (!res.ok) {
    throw new Error(`Bloomberg careers returned ${res.status} for ${url}`);
  }
  return res.text();
}

function extractBloombergLongDescriptionHtml(html: string): string {
  const articles = [...html.matchAll(/<article class="article article--details[^"]*"[^>]*>([\s\S]*?)<\/article>/g)];
  const chunks: string[] = [];

  for (const match of articles) {
    const block = match[1] ?? "";
    const values = [...block.matchAll(/article__content__view__field__value[^>]*>\s*([\s\S]*?)\s*<\/div>/g)]
      .map((valueMatch) => htmlToPlainText(valueMatch[1] ?? ""))
      .filter((value) => value.length > 80);
    chunks.push(...values);
  }

  return chunks.join("\n");
}

function buildBloombergClassificationDescription(listing: BloombergListing): string {
  const boost: string[] = [];
  if (/\bapprentice/i.test(listing.title)) {
    boost.push("apprenticeship internship program");
  }
  if (/\bsummer\s+(?:analyst|intern)/i.test(listing.title)) {
    boost.push("summer internship analyst program");
  }
  if (/\bsummer\s+analyst\b/i.test(listing.title)) {
    boost.push("summer analyst internship program");
  }
  if (/\bseasonal\/off[- ]?cycle\b/i.test(listing.title)) {
    boost.push("seasonal off cycle internship program");
  }
  if (listing.businessArea && /engineering|technology|software/i.test(listing.businessArea)) {
    boost.push("engineering technology internship");
  }

  return [...boost, listing.description ?? ""].filter(Boolean).join("\n");
}

function normalizeBloombergSearchJobsUrl(sourceUrl: string): string {
  const trimmed = sourceUrl.trim();
  if (!trimmed) {
    return BLOOMBERG_SEARCH_JOBS_URL;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname.toLowerCase() === "bloomberg.avature.net") {
      parsed.pathname = "/careers/SearchJobs";
      parsed.search = "";
      return parsed.toString().replace(/\/$/, "");
    }
  } catch {
    return BLOOMBERG_SEARCH_JOBS_URL;
  }

  return BLOOMBERG_SEARCH_JOBS_URL;
}

function dedupeListingsByUrl(listings: BloombergListing[]): BloombergListing[] {
  const byUrl = new Map<string, BloombergListing>();
  for (const listing of listings) {
    byUrl.set(listing.postingUrl, listing);
  }
  return Array.from(byUrl.values());
}

