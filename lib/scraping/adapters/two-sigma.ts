import { extractAvatureDetailDatePosted } from "../avature-dates.ts";
import { decodeHtmlEntities, stripHtml } from "../html-utils.ts";
import { atsPublishDate } from "../posted-date.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, resolveBoardToken, safeToIsoDate } from "./shared.ts";

/**
 * Two Sigma careers run on Avature (careers.twosigma.com), not Greenhouse.
 * Open roles are listed on HTML pages; job detail pages carry full descriptions.
 */
export const TWO_SIGMA_CAREERS_ORIGIN = "https://careers.twosigma.com";
export const TWO_SIGMA_OPEN_ROLES_URL = `${TWO_SIGMA_CAREERS_ORIGIN}/careers/OpenRoles`;
export const TWO_SIGMA_DEFAULT_PORTAL_ID = "106";

const TWO_SIGMA_PAGE_SIZE = 50;
const TWO_SIGMA_MAX_PAGES = 20;
const TWO_SIGMA_DETAIL_CONCURRENCY = 6;

/** Listings that may be internships / campus hires before we fetch detail HTML. */
const TWO_SIGMA_DETAIL_PREFETCH_PATTERN = /\b(intern(?:ship)?|co-?op|campus)\b/i;
const TWO_SIGMA_FULL_TIME_CAMPUS_PATTERN = /\bcampus\b[\s\S]*\bfull[- ]?time\b|\bfull[- ]?time\b[\s\S]*\bcampus\b/i;

const ARTICLE_BLOCK_PATTERN =
  /<article\s+class="article article--result"[^>]*>([\s\S]*?)<\/article>/gi;

const JOB_LINK_PATTERN =
  /<a\s+class="link"\s+href="(https:\/\/careers\.twosigma\.com\/careers\/JobDetail\/[^"]+)"[^>]*>\s*([\s\S]*?)\s*<\/a>/i;

const INNER_SPAN_PATTERN = /<span\s+class="paragraph_inner-span">([\s\S]*?)<\/span>/gi;

export interface TwoSigmaBoardConfig {
  portalId: string;
  openRolesUrl: string;
}

export interface TwoSigmaListing {
  title: string;
  postingUrl: string;
  location: string | null;
  function: string | null;
  experienceLevel: string | null;
  description?: string | null;
  datePosted?: string | null;
}

export function createTwoSigmaAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveTwoSigmaBoard(source);
  const resolvedSource =
    source.boardToken === board.portalId && source.sourceUrl === board.openRolesUrl
      ? source
      : { ...source, boardToken: board.portalId, sourceUrl: board.openRolesUrl };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const listings = await fetchAllTwoSigmaListings(board);
      const enriched = await enrichTwoSigmaListings(listings);
      return parseTwoSigmaJobs(enriched, resolvedSource);
    },
  };
}

export function resolveTwoSigmaBoard(source: CompanySourceConfig): TwoSigmaBoardConfig {
  const portalId =
    resolveBoardToken(source, () => TWO_SIGMA_DEFAULT_PORTAL_ID) || TWO_SIGMA_DEFAULT_PORTAL_ID;
  const openRolesUrl = normalizeTwoSigmaOpenRolesUrl(source.sourceUrl);

  return { portalId, openRolesUrl };
}

export function parseTwoSigmaOpenRolesHtml(html: string): TwoSigmaListing[] {
  const listings: TwoSigmaListing[] = [];

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

    const spans = [...block.matchAll(INNER_SPAN_PATTERN)].map((spanMatch) =>
      stripHtml(spanMatch[1] ?? ""),
    );
    const location = spans[0] || null;
    const functionName = spans[1] || null;
    const experienceLevel = spans[2] || null;

    listings.push({
      title,
      postingUrl,
      location,
      function: functionName,
      experienceLevel,
    });
  }

  return dedupeListingsByUrl(listings);
}

export function parseTwoSigmaJobs(
  listings: TwoSigmaListing[],
  source: CompanySourceConfig,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const listing of listings) {
    const roleName = listing.title.trim();
    const postingUrl = listing.postingUrl.trim();
    const description = buildTwoSigmaClassificationDescription(listing);
    const departments = [listing.function, listing.experienceLevel].filter(
      (value): value is string => Boolean(value?.trim()),
    );
    const locations = listing.location ? [listing.location] : [];

    if (TWO_SIGMA_FULL_TIME_CAMPUS_PATTERN.test(roleName)) {
      rejected.push({ title: roleName, reason: "not_internship" });
      continue;
    }

    const classification = classifyForSource(source, {
      title: roleName,
      description,
      commitment: listing.experienceLevel,
      team: listing.function,
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
        description: buildTwoSigmaClassificationDescription(listing),
        dates: atsPublishDate(safeToIsoDate(listing.datePosted)),
      }),
    );
  }

  return buildRoleParseResult(listings.length, roles, rejected);
}

export function parseTwoSigmaJobDetailFields(html: string): {
  description: string;
  datePosted: string | null;
} {
  return {
    description: extractTwoSigmaJobDescription(html),
    datePosted: extractAvatureDetailDatePosted(html),
  };
}

export function extractTwoSigmaJobDescription(html: string): string {
  const marker = html.indexOf('<div><div>Two Sigma');
  if (marker >= 0) {
    const end = html.indexOf("</div><div><br></div><div><strong>You will enjoy", marker);
    const slice = end > marker ? html.slice(marker, end) : html.slice(marker, marker + 12_000);
    return stripHtml(slice);
  }

  const ogDescription = html.match(
    /<meta\s+property="og:description"\s+content="([^"]*)"/i,
  )?.[1];
  if (ogDescription?.trim()) {
    return decodeHtmlEntities(ogDescription.trim());
  }

  return "";
}

export function shouldPrefetchTwoSigmaDetail(listing: TwoSigmaListing): boolean {
  const haystack = [listing.title, listing.function, listing.experienceLevel]
    .filter(Boolean)
    .join(" ");
  return TWO_SIGMA_DETAIL_PREFETCH_PATTERN.test(haystack);
}

async function fetchAllTwoSigmaListings(board: TwoSigmaBoardConfig): Promise<TwoSigmaListing[]> {
  const all: TwoSigmaListing[] = [];

  for (let page = 0; page < TWO_SIGMA_MAX_PAGES; page += 1) {
    const offset = page * TWO_SIGMA_PAGE_SIZE;
    const url = `${board.openRolesUrl}?jobRecordsPerPage=${TWO_SIGMA_PAGE_SIZE}&jobOffset=${offset}`;
    const html = await fetchTwoSigmaHtml(url);
    const batch = parseTwoSigmaOpenRolesHtml(html);
    all.push(...batch);

    if (batch.length < TWO_SIGMA_PAGE_SIZE) {
      break;
    }
    const nextOffset = offset + TWO_SIGMA_PAGE_SIZE;
    if (!html.includes(`jobOffset=${nextOffset}`)) {
      break;
    }
  }

  return dedupeListingsByUrl(all);
}

async function enrichTwoSigmaListings(listings: TwoSigmaListing[]): Promise<TwoSigmaListing[]> {
  const targets = listings.filter(shouldPrefetchTwoSigmaDetail);
  if (targets.length === 0) {
    return listings;
  }

  const details = new Map<string, ReturnType<typeof parseTwoSigmaJobDetailFields>>();
  let index = 0;

  async function worker(): Promise<void> {
    while (index < targets.length) {
      const current = targets[index];
      index += 1;
      if (!current) {
        continue;
      }
      try {
        const html = await fetchTwoSigmaHtml(current.postingUrl);
        details.set(current.postingUrl, parseTwoSigmaJobDetailFields(html));
      } catch {
        details.set(current.postingUrl, { description: "", datePosted: null });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(TWO_SIGMA_DETAIL_CONCURRENCY, targets.length) }, () => worker()),
  );

  return listings.map((listing) => {
    const detail = details.get(listing.postingUrl);
    if (!detail) {
      return listing;
    }
    return {
      ...listing,
      description: detail.description || listing.description,
      datePosted: detail.datePosted ?? listing.datePosted,
    };
  });
}

async function fetchTwoSigmaHtml(url: string): Promise<string> {
  const res = await fetchJsonWithTimeout(url, {
    headers: { accept: "text/html,application/xhtml+xml" },
  });
  if (!res.ok) {
    throw new Error(`Two Sigma careers returned ${res.status} for ${url}`);
  }
  return res.text();
}

/** Avature campus titles do not always say "intern". */
function buildTwoSigmaClassificationDescription(listing: TwoSigmaListing): string {
  const boost: string[] = [];
  if (/\bcampus\b/i.test(listing.title) && /\bintern(?:ship)?|co-?op\b/i.test(listing.title)) {
    boost.push("campus internship");
  }

  return [...boost, listing.description ?? ""].filter(Boolean).join("\n");
}

function normalizeTwoSigmaOpenRolesUrl(sourceUrl: string): string {
  const trimmed = sourceUrl.trim();
  if (!trimmed) {
    return TWO_SIGMA_OPEN_ROLES_URL;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname.toLowerCase() === "careers.twosigma.com") {
      parsed.pathname = "/careers/OpenRoles";
      parsed.search = "";
      return parsed.toString().replace(/\/$/, "");
    }
  } catch {
    return TWO_SIGMA_OPEN_ROLES_URL;
  }

  return TWO_SIGMA_OPEN_ROLES_URL;
}

function dedupeListingsByUrl(listings: TwoSigmaListing[]): TwoSigmaListing[] {
  const byUrl = new Map<string, TwoSigmaListing>();
  for (const listing of listings) {
    byUrl.set(listing.postingUrl, listing);
  }
  return Array.from(byUrl.values());
}
