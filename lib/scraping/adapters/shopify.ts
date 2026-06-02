import { atsPublishDate } from "../posted-date.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { htmlToPlainText } from "../plain-text.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, safeToIsoDate } from "./shared.ts";
import { INTERNSHIP_LIST_TITLE_PATTERN } from "../list-filters.ts";

/**
 * Shopify careers publishes a LinkedIn-compatible XML feed (not Greenhouse/Ashby/Lever).
 * Listings live on shopify.com/careers/{slug}_{partnerJobId}.
 */
export const SHOPIFY_CAREERS_ORIGIN = "https://www.shopify.com";
export const SHOPIFY_CAREERS_FEED_URL = `${SHOPIFY_CAREERS_ORIGIN}/careers/feed.xml`;
export const SHOPIFY_DEFAULT_SOURCE_URL = SHOPIFY_CAREERS_FEED_URL;

/** List titles must look internship-related before classification. */
export interface ShopifyBoardConfig {
  feedUrl: string;
  careersOrigin: string;
}

export interface ShopifyFeedJob {
  partnerJobId: string | null;
  title: string;
  description: string | null;
  applyUrl: string | null;
  location: string | null;
  workplaceTypes: string | null;
  experienceLevel: string | null;
  listDate: string | null;
}

export function createShopifyAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveShopifyBoard(source);
  const resolvedSource =
    source.sourceUrl === board.feedUrl ? source : { ...source, sourceUrl: board.feedUrl };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const xml = await fetchShopifyCareersFeed(board.feedUrl);
      const jobs = parseShopifyFeedXml(xml);
      const candidates = jobs.filter((job) => isShopifyListCandidate(job));
      return parseShopifyJobs(candidates, resolvedSource, jobs.length);
    },
  };
}

export function resolveShopifyBoard(source: CompanySourceConfig): ShopifyBoardConfig {
  const feedUrl = isShopifyFeedUrl(source.sourceUrl) ? source.sourceUrl.trim() : SHOPIFY_CAREERS_FEED_URL;

  return {
    feedUrl,
    careersOrigin: SHOPIFY_CAREERS_ORIGIN,
  };
}

export function isShopifyFeedUrl(sourceUrl: string): boolean {
  try {
    const parsed = new URL(sourceUrl);
    return (
      parsed.hostname.toLowerCase() === "www.shopify.com" &&
      parsed.pathname.replace(/\/$/, "") === "/careers/feed.xml"
    );
  } catch {
    return false;
  }
}

export function parseShopifyFeedXml(xml: string): ShopifyFeedJob[] {
  const jobs: ShopifyFeedJob[] = [];
  const jobBlockPattern = /<job>([\s\S]*?)<\/job>/gi;

  for (const match of xml.matchAll(jobBlockPattern)) {
    const block = match[1] ?? "";
    const title = readShopifyXmlField(block, "title");
    if (!title) {
      continue;
    }

    jobs.push({
      partnerJobId: readShopifyXmlField(block, "partnerJobId"),
      title,
      description: readShopifyXmlField(block, "description"),
      applyUrl: readShopifyXmlField(block, "applyUrl"),
      location: readShopifyXmlField(block, "location"),
      workplaceTypes: readShopifyXmlField(block, "workplaceTypes"),
      experienceLevel: readShopifyXmlField(block, "experienceLevel"),
      listDate: readShopifyXmlField(block, "listDate"),
    });
  }

  return jobs;
}

export function isShopifyListCandidate(job: ShopifyFeedJob): boolean {
  const title = job.title.trim();
  if (!title) {
    return false;
  }

  if (/\binternal\b|\binternational\b/i.test(title) && !INTERNSHIP_LIST_TITLE_PATTERN.test(title)) {
    return false;
  }

  if (INTERNSHIP_LIST_TITLE_PATTERN.test(title)) {
    return true;
  }

  const experience = job.experienceLevel?.trim().toUpperCase() ?? "";
  return experience.includes("INTERN");
}

export function formatShopifyLocations(job: ShopifyFeedJob): string[] {
  const locations: string[] = [];
  const rawLocation = job.location?.trim();
  const workplace = job.workplaceTypes?.trim();
  const title = job.title.trim();

  if (rawLocation) {
    const normalized = normalizeShopifyLocationToken(rawLocation, title);
    if (normalized) {
      locations.push(normalized);
    }
  }

  if (workplace) {
    locations.push(workplace);
  }

  for (const hint of extractShopifyLocationHintsFromTitle(title)) {
    locations.push(hint);
  }

  return Array.from(new Set(locations.map((location) => location.trim()).filter(Boolean)));
}

export function formatShopifyDescription(job: ShopifyFeedJob): string {
  return htmlToPlainText(job.description ?? "").trim();
}

export function normalizeShopifyPostingUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

export function parseShopifyListDate(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }

  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) {
    return safeToIsoDate(value);
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

export function parseShopifyJobs(
  jobs: ShopifyFeedJob[],
  source: CompanySourceConfig,
  fetchedTotal: number,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const job of jobs) {
    const roleName = job.title.trim();
    const description = formatShopifyDescription(job);
    const locations = formatShopifyLocations(job);
    const postingUrl = normalizeShopifyPostingUrl(job.applyUrl?.trim() || buildShopifyPostingUrl(job));

    const classification = classifyForSource(source, {
      title: roleName,
      description,
      employmentType: job.experienceLevel ?? null,
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
        description: formatShopifyDescription(job),
        dates: atsPublishDate(parseShopifyListDate(job.listDate)),
      }),
    );
  }

  return buildRoleParseResult(fetchedTotal, roles, rejected);
}

export function buildShopifyPostingUrl(job: ShopifyFeedJob): string {
  const id = job.partnerJobId?.trim();
  if (!id) {
    return SHOPIFY_CAREERS_ORIGIN;
  }

  const slug = slugifyShopifyTitle(job.title);
  return `${SHOPIFY_CAREERS_ORIGIN}/careers/${slug}_${id}`;
}

export function slugifyShopifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeShopifyLocationToken(rawLocation: string, title: string): string | null {
  const token = rawLocation.trim();
  if (!token) {
    return null;
  }

  const upper = token.toUpperCase();
  if (upper === "NAMER" || upper === "AMERICAS") {
    return title.includes("(Americas)") || /\bamericas\b/i.test(title) ? "United States" : "North America";
  }

  if (upper === "EMEA") {
    return "Europe";
  }

  return token;
}

function extractShopifyLocationHintsFromTitle(title: string): string[] {
  const hints: string[] = [];
  if (/\(americas\)/i.test(title) || /\bamericas\b/i.test(title)) {
    hints.push("United States");
  }

  const parenMatch = title.match(/\(([^)]+)\)\s*$/);
  if (parenMatch) {
    const region = parenMatch[1]?.trim() ?? "";
    if (/bellevue|los angeles|san francisco|new york|seattle|austin|denver|chicago|toronto|canada/i.test(region)) {
      for (const part of region.split(/,|\//)) {
        const trimmed = part.trim();
        if (trimmed) {
          hints.push(trimmed);
        }
      }
    }
  }

  return hints;
}

function readShopifyXmlField(block: string, tag: string): string | null {
  const pattern = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = block.match(pattern);
  if (!match) {
    return null;
  }

  let raw = match[1]?.trim() ?? "";
  const cdata = raw.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  if (cdata) {
    raw = cdata[1]?.trim() ?? "";
  }

  return raw.length > 0 ? raw : null;
}

async function fetchShopifyCareersFeed(feedUrl: string): Promise<string> {
  const res = await fetchJsonWithTimeout(feedUrl, {
    headers: {
      accept: "application/xml,text/xml,*/*",
    },
  });

  if (!res.ok) {
    throw new Error(`Shopify careers feed returned ${res.status} for ${feedUrl}`);
  }

  return res.text();
}

