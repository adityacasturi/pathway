import { decodeHtmlEntities, stripHtml } from "../html-utils.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { htmlToPlainText } from "../plain-text.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, resolveBoardToken } from "./shared.ts";

/**
 * Electronic Arts careers run on Avature (jobs.ea.com, portal 4), not Greenhouse/Lever.
 * Listings are paginated via SearchJobs RSS; detail pages carry location and description.
 */
export const EA_CAREERS_ORIGIN = "https://jobs.ea.com";
export const EA_SEARCH_JOBS_URL = `${EA_CAREERS_ORIGIN}/en_US/careers/SearchJobs`;
export const EA_RSS_FEED_URL = `${EA_CAREERS_ORIGIN}/en_US/careers/SearchJobs/feed/`;
export const EA_DEFAULT_PORTAL_ID = "4";

const EA_HTML_PAGE_SIZE = 20;
const EA_HTML_MAX_PAGES = 60;
const EA_DETAIL_CONCURRENCY = 6;

const EA_DETAIL_PREFETCH_PATTERN =
  /\b(intern(?:ship)?|co-?op|apprentice|campus)\b|\bearly\s*careers?\b|\buniversity\b|\bstudent\b/i;

const RSS_ITEM_PATTERN = /<item>([\s\S]*?)<\/item>/gi;
const RSS_TITLE_PATTERN = /<title>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/title>/i;
const RSS_LINK_PATTERN = /<link>([^<]+)<\/link>/i;
const ARTICLE_BLOCK_PATTERN =
  /<article\s+class="article article--result[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;

const JOB_LINK_PATTERN =
  /<a\s+class="link link_result"\s+href="(https:\/\/jobs\.ea\.com[^"]+)"[^>]*>\s*([\s\S]*?)\s*<\/a>/i;

const LIST_LOCATION_PATTERN = /<span\s+class="list-item-location">([^<]*)<\/span>/i;

const DETAIL_FIELD_PATTERN =
  /article__content__view__field__label[^>]*>\s*([\s\S]*?)\s*<\/div>[\s\S]*?article__content__view__field__value[^>]*>\s*([\s\S]*?)\s*<\/div>/gi;

export interface ElectronicArtsBoardConfig {
  portalId: string;
  searchJobsUrl: string;
  rssFeedUrl: string;
}

export interface ElectronicArtsListing {
  title: string;
  postingUrl: string;
  location: string | null;
  studioDepartment: string | null;
  description?: string | null;
}

export function createElectronicArtsAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveElectronicArtsBoard(source);
  const resolvedSource =
    source.boardToken === board.portalId && source.sourceUrl === board.searchJobsUrl
      ? source
      : { ...source, boardToken: board.portalId, sourceUrl: board.searchJobsUrl };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const listings = await fetchAllElectronicArtsListings(board);
      const enriched = await enrichElectronicArtsListings(listings);
      return parseElectronicArtsJobs(enriched, resolvedSource);
    },
  };
}

export function resolveElectronicArtsBoard(source: CompanySourceConfig): ElectronicArtsBoardConfig {
  const portalId =
    resolveBoardToken(source, () => EA_DEFAULT_PORTAL_ID) || EA_DEFAULT_PORTAL_ID;
  const searchJobsUrl = normalizeElectronicArtsSearchJobsUrl(source.sourceUrl);

  return {
    portalId,
    searchJobsUrl,
    rssFeedUrl: EA_RSS_FEED_URL,
  };
}

export function parseElectronicArtsRssFeed(xml: string): ElectronicArtsListing[] {
  const listings: ElectronicArtsListing[] = [];

  for (const match of xml.matchAll(RSS_ITEM_PATTERN)) {
    const block = match[1] ?? "";
    const titleMatch = block.match(RSS_TITLE_PATTERN);
    const linkMatch = block.match(RSS_LINK_PATTERN);
    if (!titleMatch || !linkMatch) {
      continue;
    }

    const title = decodeHtmlEntities((titleMatch[1] ?? titleMatch[2] ?? "").trim());
    const postingUrl = normalizeElectronicArtsPostingUrl(linkMatch[1].trim());
    if (!title || !isHttpUrl(postingUrl)) {
      continue;
    }

    listings.push({
      title,
      postingUrl,
      location: null,
      studioDepartment: null,
    });
  }

  return dedupeListingsByUrl(listings);
}

export function parseElectronicArtsSearchJobsHtml(html: string): ElectronicArtsListing[] {
  const listings: ElectronicArtsListing[] = [];

  for (const match of html.matchAll(ARTICLE_BLOCK_PATTERN)) {
    const block = match[1] ?? "";
    const linkMatch = block.match(JOB_LINK_PATTERN);
    if (!linkMatch) {
      continue;
    }

    const postingUrl = normalizeElectronicArtsPostingUrl(linkMatch[1].trim());
    const title = stripHtml(linkMatch[2]);
    if (!title || !isHttpUrl(postingUrl)) {
      continue;
    }

    const location = block.match(LIST_LOCATION_PATTERN)?.[1]?.trim() || null;

    listings.push({
      title,
      postingUrl,
      location,
      studioDepartment: null,
    });
  }

  return dedupeListingsByUrl(listings);
}

export function parseElectronicArtsJobDetailFields(html: string): {
  location: string | null;
  studioDepartment: string | null;
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

  const studioDepartment = fields.get("studio/department") ?? null;

  const descriptionParts: string[] = [];
  for (const [label, value] of fields) {
    if (
      label === "studio/department" ||
      label === "role id" ||
      label === "worker type" ||
      label === "work model" ||
      label === "post to" ||
      label === "linkedinid"
    ) {
      continue;
    }
    if (value.length > 40) {
      descriptionParts.push(value);
    }
  }

  const longText = extractElectronicArtsLongDescriptionHtml(html);
  if (longText) {
    descriptionParts.push(longText);
  }

  return {
    location: null,
    studioDepartment,
    description: descriptionParts.join("\n"),
  };
}

export function parseElectronicArtsJobs(
  listings: ElectronicArtsListing[],
  source: CompanySourceConfig,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const listing of listings) {
    const roleName = listing.title.trim();
    const postingUrl = listing.postingUrl.trim();
    const description = buildElectronicArtsClassificationDescription(listing);
    const locations = listing.location ? [listing.location] : [];
    const departments = listing.studioDepartment ? [listing.studioDepartment] : [];

    const classification = classifyForSource(source, {
      title: roleName,
      description,
      team: listing.studioDepartment,
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
        description: buildElectronicArtsClassificationDescription(listing),
      }),
    );
  }

  return buildRoleParseResult(listings.length, roles, rejected);
}

export function shouldPrefetchElectronicArtsDetail(listing: ElectronicArtsListing): boolean {
  const haystack = [listing.title, listing.studioDepartment, listing.location]
    .filter(Boolean)
    .join(" ");
  return EA_DETAIL_PREFETCH_PATTERN.test(haystack);
}

async function fetchAllElectronicArtsListings(
  board: ElectronicArtsBoardConfig,
): Promise<ElectronicArtsListing[]> {
  const all: ElectronicArtsListing[] = [];
  const seenUrls = new Set<string>();

  for (let page = 0; page < EA_HTML_MAX_PAGES; page += 1) {
    const offset = page * EA_HTML_PAGE_SIZE;
    const url = `${board.searchJobsUrl}?jobRecordsPerPage=${EA_HTML_PAGE_SIZE}&jobOffset=${offset}`;
    const html = await fetchElectronicArtsText(url, "text/html,application/xhtml+xml");
    const batch = parseElectronicArtsSearchJobsHtml(html);
    let added = 0;

    for (const listing of batch) {
      if (seenUrls.has(listing.postingUrl)) {
        continue;
      }
      seenUrls.add(listing.postingUrl);
      all.push(listing);
      added += 1;
    }

    if (batch.length < EA_HTML_PAGE_SIZE || added === 0) {
      break;
    }
  }

  if (all.length > 0) {
    return all;
  }

  const xml = await fetchElectronicArtsText(
    `${board.rssFeedUrl}?jobRecordsPerPage=200`,
    "application/rss+xml, application/xml, text/xml",
  );
  return parseElectronicArtsRssFeed(xml);
}

async function enrichElectronicArtsListings(
  listings: ElectronicArtsListing[],
): Promise<ElectronicArtsListing[]> {
  const targets = listings.filter(shouldPrefetchElectronicArtsDetail);
  if (targets.length === 0) {
    return listings;
  }

  const details = new Map<string, ReturnType<typeof parseElectronicArtsJobDetailFields>>();
  let index = 0;

  async function worker(): Promise<void> {
    while (index < targets.length) {
      const current = targets[index];
      index += 1;
      if (!current) {
        continue;
      }
      try {
        const html = await fetchElectronicArtsText(current.postingUrl, "text/html,application/xhtml+xml");
        details.set(current.postingUrl, parseElectronicArtsJobDetailFields(html));
      } catch {
        details.set(current.postingUrl, {
          location: null,
          studioDepartment: null,
          description: "",
        });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(EA_DETAIL_CONCURRENCY, targets.length) }, () => worker()),
  );

  return listings.map((listing) => {
    const detail = details.get(listing.postingUrl);
    if (!detail) {
      return listing;
    }
    return {
      ...listing,
      location: detail.location ?? listing.location,
      studioDepartment: detail.studioDepartment ?? listing.studioDepartment,
      description: detail.description || listing.description,
    };
  });
}

async function fetchElectronicArtsText(url: string, accept: string): Promise<string> {
  const res = await fetchJsonWithTimeout(url, {
    headers: { accept },
  });
  if (!res.ok) {
    throw new Error(`EA careers returned ${res.status} for ${url}`);
  }
  return res.text();
}

function extractElectronicArtsLongDescriptionHtml(html: string): string {
  const articles = [
    ...html.matchAll(/<article class="article article--details[^"]*"[^>]*>([\s\S]*?)<\/article>/g),
  ];
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

function buildElectronicArtsClassificationDescription(listing: ElectronicArtsListing): string {
  const boost: string[] = [];
  if (/\bintern(?:ship)?\b/i.test(listing.title)) {
    boost.push("internship university program");
  }
  if (/\bco-?op\b/i.test(listing.title)) {
    boost.push("co-op internship program");
  }
  if (/\bcampus\b/i.test(listing.title)) {
    boost.push("campus internship program");
  }
  if (listing.studioDepartment && /technology|engineering|software/i.test(listing.studioDepartment)) {
    boost.push("engineering technology internship");
  }

  return [...boost, listing.description ?? "", listing.location ?? ""].filter(Boolean).join("\n");
}

function normalizeElectronicArtsSearchJobsUrl(sourceUrl: string): string {
  const trimmed = sourceUrl.trim();
  if (!trimmed) {
    return EA_SEARCH_JOBS_URL;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname.toLowerCase() === "jobs.ea.com") {
      parsed.pathname = "/en_US/careers/SearchJobs";
      parsed.search = "";
      return parsed.toString().replace(/\/$/, "");
    }
  } catch {
    return EA_SEARCH_JOBS_URL;
  }

  return EA_SEARCH_JOBS_URL;
}

function normalizeElectronicArtsPostingUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.toLowerCase() !== "jobs.ea.com") {
      return url;
    }
    if (!parsed.pathname.startsWith("/en_US/")) {
      parsed.pathname = `/en_US${parsed.pathname.startsWith("/") ? "" : "/"}${parsed.pathname}`;
    }
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

function dedupeListingsByUrl(listings: ElectronicArtsListing[]): ElectronicArtsListing[] {
  const byUrl = new Map<string, ElectronicArtsListing>();
  for (const listing of listings) {
    byUrl.set(listing.postingUrl, listing);
  }
  return Array.from(byUrl.values());
}
