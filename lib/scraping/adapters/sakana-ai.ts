import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { extractLocationsFromPlainText } from "../location.ts";
import { htmlToPlainText } from "../plain-text.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl } from "./shared.ts";

export const SAKANA_AI_CAREERS_URL = "https://sakana.ai/careers/";

const SKIP_HEADING_IDS = new Set([
  "open-positions",
  "careers-at-sakana-ai-",
  "主要業務-1",
]);

export interface SakanaAiBoardConfig {
  careersUrl: string;
}

export interface SakanaAiCareerListing {
  anchorId: string;
  title: string;
  postingUrl: string;
  description: string;
  location: string | null;
}

export function createSakanaAiAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveSakanaAiBoard(source);
  const resolvedSource =
    source.sourceUrl === board.careersUrl ? source : { ...source, sourceUrl: board.careersUrl };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const html = await fetchSakanaAiHtml(board.careersUrl);
      const listings = parseSakanaAiCareersHtml(html, board);
      return parseSakanaAiJobs(listings, resolvedSource, listings.length);
    },
  };
}

export function resolveSakanaAiBoard(source: CompanySourceConfig): SakanaAiBoardConfig {
  const careersUrl = isSakanaAiCareersUrl(source.sourceUrl) ? source.sourceUrl.trim() : SAKANA_AI_CAREERS_URL;
  return { careersUrl };
}

export function isSakanaAiCareersUrl(sourceUrl: string): boolean {
  try {
    const parsed = new URL(sourceUrl);
    return parsed.hostname.replace(/^www\./, "") === "sakana.ai" && parsed.pathname.startsWith("/careers");
  } catch {
    return false;
  }
}

export function parseSakanaAiCareersHtml(html: string, board: SakanaAiBoardConfig): SakanaAiCareerListing[] {
  const listings: SakanaAiCareerListing[] = [];
  const headingPattern = /<h2 id="([^"]+)">([\s\S]*?)<\/h2>/gi;

  for (const match of html.matchAll(headingPattern)) {
    const anchorId = match[1]?.trim() ?? "";
    const title = htmlToPlainText(match[2] ?? "").trim();
    if (!anchorId || !title || SKIP_HEADING_IDS.has(anchorId) || shouldSkipSakanaHeadingId(anchorId)) {
      continue;
    }

    const sectionHtml = extractSakanaSectionHtml(html, match.index ?? 0, match[0].length);
    const description = htmlToPlainText(sectionHtml).trim();
    const postingUrl = `${board.careersUrl.replace(/\/?$/, "/")}#${anchorId}`;

    listings.push({
      anchorId,
      title,
      postingUrl,
      description,
      location: inferSakanaLocations(description)[0] ?? null,
    });
  }

  return listings;
}

export function shouldSkipSakanaHeadingId(anchorId: string): boolean {
  return /[^\x00-\x7F]/.test(anchorId);
}

function extractSakanaSectionHtml(html: string, headingStart: number, headingLength: number): string {
  const sectionStart = headingStart + headingLength;
  const nextHeading = html.slice(sectionStart).search(/<h2 id="/i);
  if (nextHeading < 0) {
    return html.slice(sectionStart);
  }
  return html.slice(sectionStart, sectionStart + nextHeading);
}

export function inferSakanaLocations(description: string): string[] {
  const fromText = extractLocationsFromPlainText(description);
  if (fromText.length > 0) {
    return fromText;
  }
  if (/\bTokyo\b/i.test(description) || /\bJapan\b/i.test(description)) {
    return ["Tokyo, Japan"];
  }
  return [];
}

export function parseSakanaAiJobs(
  listings: SakanaAiCareerListing[],
  source: CompanySourceConfig,
  fetchedTotal: number,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const listing of listings) {
    const classification = classifyForSource(source, {
      title: listing.title,
      description: listing.description,
      locations: listing.location
        ? [listing.location]
        : inferSakanaLocations(listing.description),
    });

    if (!classification.include) {
      rejected.push({ title: listing.title, reason: classification.reason });
      continue;
    }

    if (!isHttpUrl(listing.postingUrl)) {
      rejected.push({ title: listing.title, reason: "invalid_url" });
      continue;
    }

    roles.push(
      buildScrapedRole({
        postingUrl: listing.postingUrl,
        roleName: listing.title,
        companyName: source.companyName,
        companySlug: source.companySlug,
        classification,
        description: listing.description,
      }),
    );
  }

  return buildRoleParseResult(fetchedTotal, roles, rejected);
}

async function fetchSakanaAiHtml(url: string): Promise<string> {
  const res = await fetchJsonWithTimeout(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!res.ok) {
    throw new Error(`Sakana AI careers returned ${res.status} for ${url}`);
  }

  return res.text();
}

