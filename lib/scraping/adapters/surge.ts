import { classifyForSource } from "../adapter-parse.ts";
import { extractLocationsFromPlainText } from "../location.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { htmlToPlainText } from "../plain-text.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl } from "./shared.ts";
import { INTERNSHIP_LIST_TITLE_PATTERN } from "../list-filters.ts";

export const SURGE_CAREERS_ORIGIN = "https://www.surgehq.ai";
export const SURGE_CAREERS_INDEX_URL = `${SURGE_CAREERS_ORIGIN}/careers`;

export interface SurgeBoardConfig {
  careersOrigin: string;
  indexUrl: string;
}

export interface SurgeCareerListing {
  path: string;
  title: string;
  postingUrl: string;
}

export function createSurgeAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveSurgeBoard(source);
  const resolvedSource =
    source.sourceUrl === board.indexUrl ? source : { ...source, sourceUrl: board.indexUrl };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const indexHtml = await fetchSurgeHtml(board.indexUrl);
      const listings = parseSurgeIndexHtml(indexHtml, board);
      const candidates = listings.filter((listing) => isSurgeListCandidate(listing));
      return parseSurgeJobs(candidates, resolvedSource, board, listings.length);
    },
  };
}

export function resolveSurgeBoard(source: CompanySourceConfig): SurgeBoardConfig {
  const indexUrl = isSurgeCareersUrl(source.sourceUrl) ? source.sourceUrl.trim() : SURGE_CAREERS_INDEX_URL;

  return {
    careersOrigin: SURGE_CAREERS_ORIGIN,
    indexUrl,
  };
}

export function isSurgeCareersUrl(sourceUrl: string): boolean {
  try {
    const parsed = new URL(sourceUrl);
    return parsed.hostname.replace(/^www\./, "") === "surgehq.ai" && parsed.pathname.startsWith("/careers");
  } catch {
    return false;
  }
}

export function parseSurgeIndexHtml(html: string, board: SurgeBoardConfig): SurgeCareerListing[] {
  const listings: SurgeCareerListing[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(/href="(\/careers\/[^"#?]+)"/gi)) {
    const path = match[1]?.trim() ?? "";
    if (!path || path === "/careers" || seen.has(path)) {
      continue;
    }

    seen.add(path);
    const slug = path.replace(/^\/careers\//, "");
    listings.push({
      path,
      title: surgeSlugToTitle(slug),
      postingUrl: `${board.careersOrigin}${path}`,
    });
  }

  return listings;
}

export function isSurgeListCandidate(listing: SurgeCareerListing): boolean {
  const title = listing.title.trim();
  if (!title) {
    return false;
  }

  if (INTERNSHIP_LIST_TITLE_PATTERN.test(title)) {
    return true;
  }

  return INTERNSHIP_LIST_TITLE_PATTERN.test(listing.path);
}

export function parseSurgeDetailHtml(html: string): { title: string; description: string } {
  const title =
    readSurgeMeta(html, "og:title") ??
    readSurgeTagText(html, "h1") ??
    readSurgeTagText(html, "h2") ??
    "";

  const description =
    readSurgeMeta(html, "og:description") ??
    htmlToPlainText(extractSurgeMainContent(html));

  return {
    title: title.trim(),
    description: description.trim(),
  };
}

export async function parseSurgeJobs(
  listings: SurgeCareerListing[],
  source: CompanySourceConfig,
  board: SurgeBoardConfig,
  fetchedTotal: number,
): Promise<RoleParseResult> {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const listing of listings) {
    let roleName = listing.title;
    let description = "";

    try {
      const detailHtml = await fetchSurgeHtml(listing.postingUrl);
      const detail = parseSurgeDetailHtml(detailHtml);
      if (detail.title) {
        roleName = detail.title.replace(/\s*\|\s*Surge AI\s*$/i, "").trim();
      }
      description = detail.description;
    } catch {
      // Index title is sufficient when detail pages fail.
    }

    const locations = extractLocationsFromPlainText(description);
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

    if (!isHttpUrl(listing.postingUrl)) {
      rejected.push({ title: roleName, reason: "invalid_url" });
      continue;
    }

    roles.push(
      buildScrapedRole({
        postingUrl: listing.postingUrl,
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

function surgeSlugToTitle(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function readSurgeMeta(html: string, property: string): string | null {
  const pattern = new RegExp(
    `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const match = html.match(pattern);
  return match?.[1]?.trim() || null;
}

function readSurgeTagText(html: string, tag: string): string | null {
  const pattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = html.match(pattern);
  if (!match) {
    return null;
  }
  return htmlToPlainText(match[1] ?? "").trim() || null;
}

function extractSurgeMainContent(html: string): string {
  const match = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  return match?.[1] ?? html;
}

async function fetchSurgeHtml(url: string): Promise<string> {
  const res = await fetchJsonWithTimeout(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!res.ok) {
    throw new Error(`Surge careers returned ${res.status} for ${url}`);
  }

  return res.text();
}

