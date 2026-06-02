import { atsPublishDate } from "../posted-date.ts";
import { decodeHtmlEntities, stripHtml } from "../html-utils.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { htmlToPlainText } from "../plain-text.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, safeToIsoDate } from "./shared.ts";
import { INTERNSHIP_LIST_TITLE_PATTERN } from "../list-filters.ts";

/**
 * Etsy careers run on Clinch Talent (careers.etsy.com). Search HTML is behind AWS WAF;
 * public sitemap.xml lists job posting URLs without the challenge page.
 */
export const ETSY_CAREERS_ORIGIN = "https://careers.etsy.com";
export const ETSY_SITEMAP_URL = `${ETSY_CAREERS_ORIGIN}/sitemap.xml`;
export const ETSY_DEFAULT_SEARCH_URL = `${ETSY_CAREERS_ORIGIN}/jobs/search`;

const ETSY_DETAIL_CONCURRENCY = 6;

const ETSY_JOB_CARD_PATTERN =
  /<a[^>]+href="(https:\/\/careers\.etsy\.com\/jobs\/[^"]+)"[^>]*>\s*([^<]+)\s*<\/a>[\s\S]*?<span[^>]*job-component-location[^>]*>[\s\S]*?<span[^>]*>\s*([^<]+)\s*<\/span>[\s\S]*?<p class="card-text job-search-results-summary"[^>]*>([\s\S]*?)<\/p>/gi;

const ETSY_SITEMAP_JOB_PATTERN =
  /<loc>(https:\/\/careers\.etsy\.com\/jobs\/[^<]+)<\/loc>/gi;

const ETSY_UUID_SUFFIX_PATTERN =
  /-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ETSY_LOCATION_SUFFIXES = [
  "brooklyn-new-york-united-states",
  "cdmx-mexico-city-mexico",
  "dublin-ireland",
  "united-kingdom",
] as const;

export interface EtsyBoardConfig {
  careersOrigin: string;
  sitemapUrl: string;
  searchUrl: string;
}

export interface EtsyListing {
  title: string;
  postingUrl: string;
  location: string | null;
  summary: string | null;
  datePosted: string | null;
  description?: string | null;
}

export function createEtsyAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveEtsyBoard(source);
  const resolvedSource =
    source.sourceUrl === board.searchUrl ? source : { ...source, sourceUrl: board.searchUrl };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const listings = await fetchAllEtsyListings(board);
      const enriched = await enrichEtsyListings(listings);
      return parseEtsyJobs(enriched, resolvedSource);
    },
  };
}

export function resolveEtsyBoard(source: CompanySourceConfig): EtsyBoardConfig {
  const careersOrigin = parseEtsyCareersOrigin(source.sourceUrl) ?? ETSY_CAREERS_ORIGIN;
  const searchUrl = normalizeEtsySearchUrl(source.sourceUrl, careersOrigin);

  return {
    careersOrigin,
    sitemapUrl: `${careersOrigin.replace(/\/$/, "")}/sitemap.xml`,
    searchUrl,
  };
}

export function parseEtsyCareersOrigin(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    if (parsed.hostname.toLowerCase() === "careers.etsy.com") {
      return `${parsed.protocol}//${parsed.host}`;
    }
    return null;
  } catch {
    return null;
  }
}

export function parseEtsySitemapJobs(xml: string, careersOrigin: string): EtsyListing[] {
  const listings: EtsyListing[] = [];
  const seen = new Set<string>();

  for (const match of xml.matchAll(ETSY_SITEMAP_JOB_PATTERN)) {
    const postingUrl = match[1]?.trim() ?? "";
    if (!postingUrl || seen.has(postingUrl) || !isEtsyJobPostingUrl(postingUrl, careersOrigin)) {
      continue;
    }

    seen.add(postingUrl);
    const parsed = parseEtsyPostingUrl(postingUrl);
    if (!parsed) {
      continue;
    }

    listings.push({
      title: parsed.title,
      postingUrl,
      location: parsed.location,
      summary: null,
      datePosted: null,
    });
  }

  return listings;
}

export function parseEtsySearchJobsHtml(html: string): EtsyListing[] {
  if (isEtsyWafChallenge(html)) {
    return [];
  }

  const listings: EtsyListing[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(ETSY_JOB_CARD_PATTERN)) {
    const postingUrl = decodeHtmlEntities(match[1]?.trim() ?? "");
    const title = decodeHtmlEntities(stripHtml(match[2] ?? ""));
    const location = decodeHtmlEntities(stripHtml(match[3] ?? "")) || null;
    const summary = decodeHtmlEntities(stripHtml(match[4] ?? "")) || null;
    if (!postingUrl || !title || seen.has(postingUrl)) {
      continue;
    }

    seen.add(postingUrl);
    listings.push({
      title,
      postingUrl,
      location,
      summary,
      datePosted: null,
    });
  }

  return dedupeListingsByUrl(listings);
}

export function parseEtsyJobDetailHtml(html: string): {
  title: string | null;
  location: string | null;
  description: string;
  datePosted: string | null;
} {
  const title =
    readEtsyMeta(html, "og:title")?.replace(/\s+at\s+Etsy.*$/i, "").trim() ??
    html.match(/<h1[^>]*class="[^"]*job-title[^"]*"[^>]*>([^<]+)/i)?.[1]?.trim() ??
    null;

  const location =
    html.match(/job-component-location[\s\S]*?<span[^>]*>\s*([^<]+)\s*<\/span>/i)?.[1]?.trim() ??
    readEtsyMeta(html, "og:locality") ??
    null;

  const descriptionBlock =
    html.match(/<div[^>]*class="[^"]*block-job-description[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<div class="job-description-controls"/i)?.[1] ??
    html.match(/<div[^>]*class="[^"]*job-description[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i)?.[1];
  const description = descriptionBlock ? htmlToPlainText(descriptionBlock) : "";

  const datePosted =
    readEtsyMeta(html, "article:published_time") ??
    html.match(/<time[^>]+datetime="([^"]+)"/i)?.[1]?.trim() ??
    null;

  return {
    title,
    location,
    description,
    datePosted,
  };
}

export function parseEtsyJobs(
  listings: EtsyListing[],
  source: CompanySourceConfig,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const listing of listings) {
    const roleName = listing.title.trim();
    const postingUrl = listing.postingUrl.trim();
    const description = [listing.summary, listing.description].filter(Boolean).join("\n\n");
    const locations = listing.location ? [listing.location] : [];

    const classification = classifyForSource(source, {
      title: roleName,
      description,
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
        dates: atsPublishDate(safeToIsoDate(listing.datePosted)),
      }),
    );
  }

  return buildRoleParseResult(listings.length, roles, rejected);
}

export function parseEtsyPostingUrl(
  postingUrl: string,
): { title: string; location: string | null } | null {
  try {
    const parsed = new URL(postingUrl);
    if (parsed.hostname.toLowerCase() !== "careers.etsy.com") {
      return null;
    }

    let slug = parsed.pathname.replace(/^\/jobs\//, "").replace(/\/$/, "");
    slug = slug.replace(ETSY_UUID_SUFFIX_PATTERN, "");

    let location: string | null = null;
    for (const suffix of ETSY_LOCATION_SUFFIXES) {
      if (slug.endsWith(`-${suffix}`)) {
        location = humanizeEtsySlug(suffix);
        slug = slug.slice(0, -(suffix.length + 1));
        break;
      }
    }

    const title = humanizeEtsySlug(slug);
    if (!title) {
      return null;
    }

    return { title, location };
  } catch {
    return null;
  }
}

export function isEtsyJobPostingUrl(postingUrl: string, careersOrigin: string): boolean {
  try {
    const parsed = new URL(postingUrl);
    const origin = new URL(careersOrigin);
    return (
      parsed.hostname.toLowerCase() === origin.hostname.toLowerCase() &&
      parsed.pathname.startsWith("/jobs/") &&
      parsed.pathname !== "/jobs/search" &&
      !parsed.pathname.startsWith("/jobs/search")
    );
  } catch {
    return false;
  }
}

export function isEtsyWafChallenge(html: string): boolean {
  return html.includes("awsWaf") || html.includes("AwsWafIntegration");
}

export function shouldPrefetchEtsyDetail(listing: EtsyListing): boolean {
  const haystack = [listing.title, listing.summary, listing.location].filter(Boolean).join(" ");
  return INTERNSHIP_LIST_TITLE_PATTERN.test(haystack);
}

async function fetchAllEtsyListings(board: EtsyBoardConfig): Promise<EtsyListing[]> {
  const sitemapXml = await fetchEtsyText(board.sitemapUrl, "application/xml,text/xml");
  if (isEtsyWafChallenge(sitemapXml)) {
    throw new Error(`Etsy careers sitemap returned AWS WAF challenge for ${board.sitemapUrl}`);
  }

  const fromSitemap = parseEtsySitemapJobs(sitemapXml, board.careersOrigin);
  if (fromSitemap.length > 0) {
    return fromSitemap;
  }

  const searchHtml = await fetchEtsyText(board.searchUrl, "text/html,application/xhtml+xml");
  if (isEtsyWafChallenge(searchHtml)) {
    throw new Error(`Etsy careers search returned AWS WAF challenge for ${board.searchUrl}`);
  }

  return parseEtsySearchJobsHtml(searchHtml);
}

async function enrichEtsyListings(
  listings: EtsyListing[],
): Promise<EtsyListing[]> {
  const targets = listings.filter((listing) => shouldPrefetchEtsyDetail(listing));
  if (targets.length === 0) {
    return listings;
  }

  const details = new Map<string, ReturnType<typeof parseEtsyJobDetailHtml>>();
  let index = 0;

  async function worker(): Promise<void> {
    while (index < targets.length) {
      const current = targets[index];
      index += 1;
      if (!current) {
        continue;
      }
      try {
        const html = await fetchEtsyText(current.postingUrl, "text/html,application/xhtml+xml");
        if (isEtsyWafChallenge(html)) {
          continue;
        }
        details.set(current.postingUrl, parseEtsyJobDetailHtml(html));
      } catch {
        // Detail pages may be WAF-protected; list/sitemap data is enough for classification.
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(ETSY_DETAIL_CONCURRENCY, targets.length) }, () => worker()),
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
      datePosted: detail.datePosted ?? listing.datePosted,
    };
  });
}

async function fetchEtsyText(url: string, accept: string): Promise<string> {
  const res = await fetchJsonWithTimeout(url, {
    headers: { accept },
  });

  if (res.status === 202 || res.status === 403) {
    throw new Error(`Etsy careers returned ${res.status} for ${url}`);
  }

  if (!res.ok) {
    throw new Error(`Etsy careers returned ${res.status} for ${url}`);
  }

  return res.text();
}

function normalizeEtsySearchUrl(sourceUrl: string, careersOrigin: string): string {
  const trimmed = sourceUrl.trim();
  if (trimmed) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.hostname.toLowerCase() === "careers.etsy.com") {
        return parsed.toString();
      }
    } catch {
      // fall through
    }
  }

  return `${careersOrigin.replace(/\/$/, "")}/jobs/search`;
}

function humanizeEtsySlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => {
      if (word.toLowerCase() === "cdmx") {
        return "CDMX";
      }
      if (word.toLowerCase() === "ii" || word.toLowerCase() === "iii") {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ")
    .replace(/\bIi\b/g, "II")
    .replace(/\bIii\b/g, "III")
    .trim();
}

function readEtsyMeta(html: string, property: string): string | null {
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)="${property}"[^>]+content="([^"]+)"`,
    "i",
  );
  const reverse = new RegExp(
    `<meta[^>]+content="([^"]+)"[^>]+(?:property|name)="${property}"`,
    "i",
  );
  return html.match(pattern)?.[1]?.trim() ?? html.match(reverse)?.[1]?.trim() ?? null;
}

function dedupeListingsByUrl(listings: EtsyListing[]): EtsyListing[] {
  const byUrl = new Map<string, EtsyListing>();
  for (const listing of listings) {
    byUrl.set(listing.postingUrl, listing);
  }
  return Array.from(byUrl.values());
}

