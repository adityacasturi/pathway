import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { extractLocationFromPlainText, isInvalidScrapedLocationToken, normalizeScrapedLocationPart } from "../location.ts";
import { htmlToPlainText } from "../plain-text.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl } from "./shared.ts";
import { INTERNSHIP_LIST_TITLE_PATTERN } from "../list-filters.ts";

export interface HiringThingBoardConfig {
  boardOrigin: string;
  listUrl: string;
}

export const VOLORIDGE_CAREERS_URL = "https://voloridge.com/join-our-team";
const VOLORIDGE_JOBS_ORIGIN = "https://voloridge.com";

export interface HiringThingListJob {
  jobId: string;
  slug: string;
  title: string;
  listUrl: string;
}

export function createHiringThingAdapter(source: CompanySourceConfig): ScrapeAdapter {
  if (isVoloridgeSource(source)) {
    const resolvedSource =
      source.sourceUrl === VOLORIDGE_CAREERS_URL ? source : { ...source, sourceUrl: VOLORIDGE_CAREERS_URL };

    return {
      source: resolvedSource,
      async fetchRoles() {
        const listHtml = await fetchHiringThingHtml(VOLORIDGE_CAREERS_URL);
        const listings = parseVoloridgeListHtml(listHtml);
        const candidates = listings.filter((job) => isHiringThingListCandidate(job));
        return parseVoloridgeJobs(candidates, resolvedSource, listings.length);
      },
    };
  }

  const board = resolveHiringThingBoard(source);
  const resolvedSource =
    source.sourceUrl === board.listUrl ? source : { ...source, sourceUrl: board.listUrl };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const listHtml = await fetchHiringThingHtml(board.listUrl);
      const listings = parseHiringThingListHtml(listHtml, board);
      const candidates = listings.filter((job) => isHiringThingListCandidate(job));
      return parseHiringThingJobs(candidates, resolvedSource, board, listings.length);
    },
  };
}

function isVoloridgeSource(source: CompanySourceConfig): boolean {
  return source.companySlug === "voloridge" || isVoloridgeCareersUrl(source.sourceUrl);
}

export function isVoloridgeCareersUrl(sourceUrl: string): boolean {
  try {
    const parsed = new URL(sourceUrl);
    return (
      parsed.hostname.toLowerCase() === "voloridge.com" &&
      parsed.pathname.replace(/\/$/, "") === "/join-our-team"
    );
  } catch {
    return false;
  }
}

export function resolveHiringThingBoard(source: CompanySourceConfig): HiringThingBoardConfig {
  const listUrl = source.sourceUrl?.trim();
  if (!listUrl || !isHiringThingListUrl(listUrl)) {
    throw new Error(`Invalid HiringThing list URL for adapter ${source.adapterKey}`);
  }

  const parsed = new URL(listUrl);
  const boardOrigin = `${parsed.protocol}//${parsed.host}`;

  return { boardOrigin, listUrl };
}

export function isHiringThingListUrl(sourceUrl: string): boolean {
  try {
    const parsed = new URL(sourceUrl);
    return parsed.hostname.endsWith(".hiringthing.com");
  } catch {
    return false;
  }
}

export function parseHiringThingListHtml(html: string, board: HiringThingBoardConfig): HiringThingListJob[] {
  const jobs: HiringThingListJob[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(/href="(\/job\/(\d+)\/([^"?#]+))"/gi)) {
    const path = match[1]?.trim() ?? "";
    const jobId = match[2]?.trim() ?? "";
    const slug = match[3]?.trim() ?? "";
    if (!path || !jobId || !slug || seen.has(jobId)) {
      continue;
    }

    seen.add(jobId);
    const title = slugToTitle(slug);
    jobs.push({
      jobId,
      slug,
      title,
      listUrl: `${board.boardOrigin}${path}`,
    });
  }

  return jobs;
}

export function parseVoloridgeListHtml(html: string): HiringThingListJob[] {
  const jobs: HiringThingListJob[] = [];
  const seen = new Set<string>();
  const internshipSection = html.match(/Internship Opportunities([\s\S]*?)(?:Career Opportunities|Health Career Opportunities)/i)?.[1] ?? html;

  for (const match of internshipSection.matchAll(
    /href=["']([^"']*\/jobs\/voloridgeinvestmentmanagement\/(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const rawUrl = match[1]?.trim() ?? "";
    const jobId = match[2]?.trim() ?? "";
    const title = htmlToPlainText(match[3] ?? "").trim();
    if (!rawUrl || !jobId || !title || seen.has(jobId)) {
      continue;
    }

    seen.add(jobId);
    jobs.push({
      jobId,
      slug: titleToSlug(title),
      title,
      listUrl: new URL(rawUrl, VOLORIDGE_JOBS_ORIGIN).toString(),
    });
  }

  return jobs;
}

export function isHiringThingListCandidate(job: HiringThingListJob): boolean {
  const title = job.title.trim();
  if (!title) {
    return false;
  }

  if (INTERNSHIP_LIST_TITLE_PATTERN.test(title)) {
    return true;
  }

  return /\bintern\b/i.test(job.slug);
}

export function parseHiringThingJobDetailHtml(
  html: string,
  context: { companyName?: string; companySlug?: string } = {},
): {
  title: string;
  description: string;
  location: string | null;
} {
  const title =
    readHiringThingMeta(html, "og:title") ??
    readHiringThingTagText(html, "h1") ??
    readHiringThingTagText(html, "h2") ??
    "";

  const description =
    readHiringThingMeta(html, "og:description") ??
    htmlToPlainText(extractHiringThingDescriptionBlock(html));

  const location = extractHiringThingLocation(html, description, context);

  return {
    title: title.trim(),
    description: description.trim(),
    location,
  };
}

export function parseVoloridgeJobDetailHtml(
  html: string,
  fallbackTitle: string,
): {
  title: string;
  description: string;
  location: string | null;
} {
  const description = htmlToPlainText(html);
  const location = extractVoloridgeLocation(description);

  return {
    title: fallbackTitle.trim(),
    description: description.trim(),
    location,
  };
}

function extractVoloridgeLocation(description: string): string | null {
  const match = description.match(/Voloridge Investment Management\s+[—-]\s+([A-Z][A-Za-z .'-]+,\s*[A-Z]{2})/);
  return match?.[1]?.trim() ?? null;
}

export function extractHiringThingLocation(
  html: string,
  description: string,
  context: { companyName?: string; companySlug?: string } = {},
): string | null {
  const locationContext = {
    companyName: context.companyName ?? null,
    companySlug: context.companySlug ?? null,
  };

  const fromHtml = extractHiringThingLocationFromHtml(html);
  if (fromHtml) {
    const normalized = normalizeScrapedLocationPart(fromHtml, locationContext);
    if (normalized) {
      return normalized;
    }
  }

  const fromMeta = readHiringThingMeta(html, "og:locality");
  if (fromMeta && !isInvalidScrapedLocationToken(fromMeta, locationContext)) {
    const normalized = normalizeScrapedLocationPart(fromMeta, locationContext);
    if (normalized) {
      return normalized;
    }
  }

  return extractLocationFromPlainText(description);
}

export async function parseVoloridgeJobs(
  listings: HiringThingListJob[],
  source: CompanySourceConfig,
  fetchedTotal: number,
): Promise<RoleParseResult> {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const listing of listings) {
    let detail: ReturnType<typeof parseVoloridgeJobDetailHtml> = {
      title: listing.title,
      description: "",
      location: null,
    };

    try {
      const detailHtml = await fetchHiringThingHtml(listing.listUrl);
      detail = parseVoloridgeJobDetailHtml(detailHtml, listing.title);
    } catch {
      // List metadata is enough for classification when detail fetch fails.
    }

    const classification = classifyForSource(source, {
      title: detail.title,
      description: detail.description,
      locations: detail.location ? [detail.location] : [],
    });

    if (!classification.include) {
      rejected.push({ title: detail.title, reason: classification.reason });
      continue;
    }

    if (!isHttpUrl(listing.listUrl)) {
      rejected.push({ title: detail.title, reason: "invalid_url" });
      continue;
    }

    roles.push(
      buildScrapedRole({
        postingUrl: listing.listUrl,
        roleName: detail.title,
        companyName: source.companyName,
        companySlug: source.companySlug,
        classification,
        description: detail.description,
      }),
    );
  }

  return buildRoleParseResult(fetchedTotal, roles, rejected);
}

export async function parseHiringThingJobs(
  listings: HiringThingListJob[],
  source: CompanySourceConfig,
  board: HiringThingBoardConfig,
  fetchedTotal: number,
): Promise<RoleParseResult> {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const listing of listings) {
    let roleName = listing.title;
    let description = "";
    let location: string | null = null;

    try {
      const detailHtml = await fetchHiringThingHtml(listing.listUrl);
      const detail = parseHiringThingJobDetailHtml(detailHtml, {
        companyName: source.companyName,
        companySlug: source.companySlug,
      });
      if (detail.title) {
        roleName = detail.title;
      }
      description = detail.description;
      location = detail.location;
    } catch {
      // List metadata is enough for classification when detail fetch fails.
    }

    const classification = classifyForSource(source, {
      title: roleName,
      description,
      locations: location ? [location] : [],
    });

    if (!classification.include) {
      if (roleName) {
        rejected.push({ title: roleName, reason: classification.reason });
      }
      continue;
    }

    const postingUrl = listing.listUrl;
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
        description,
      }),
    );
  }

  return buildRoleParseResult(fetchedTotal, roles, rejected);
}

function slugToTitle(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function titleToSlug(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readHiringThingMeta(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }
  return null;
}

function readHiringThingTagText(html: string, tag: string): string | null {
  const pattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = html.match(pattern);
  if (!match) {
    return null;
  }
  return htmlToPlainText(match[1] ?? "").trim() || null;
}

function extractHiringThingDescriptionBlock(html: string): string {
  const match = html.match(/<div[^>]+class="[^"]*job-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  return match?.[1] ?? "";
}

function extractHiringThingLocationFromHtml(html: string): string | null {
  const labeled =
    html.match(/<[^>]*class="[^"]*job-location[^"]*"[^>]*>([^<]+)/i)?.[1]?.trim() ??
    html.match(/Location\s*<\/[^>]+>\s*([^<]{2,80})/i)?.[1]?.trim() ??
    html.match(/<meta[^>]+name=["']geo\.placename["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim() ??
    null;

  return labeled || null;
}

async function fetchHiringThingHtml(url: string): Promise<string> {
  const res = await fetchJsonWithTimeout(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!res.ok) {
    throw new Error(`HiringThing returned ${res.status} for ${url}`);
  }

  return res.text();
}
