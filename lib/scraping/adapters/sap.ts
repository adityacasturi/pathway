import { atsPublishDate } from "../posted-date.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { htmlToPlainText } from "../plain-text.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, safeToIsoDate } from "./shared.ts";

/** SAP US intern listings (SuccessFactors RMK RSS category). */
export const SAP_CAREERS_ORIGIN = "https://jobs.sap.com";
export const SAP_US_INTERN_CATEGORY_ID = "872801";
export const SAP_US_INTERN_RSS_URL = `${SAP_CAREERS_ORIGIN}/services/rss/category/?catid=${SAP_US_INTERN_CATEGORY_ID}`;
export const SAP_US_INTERN_CAREERS_URL = `${SAP_CAREERS_ORIGIN}/go/Intern-Jobs-in-the-United-States/${SAP_US_INTERN_CATEGORY_ID}/`;

const INTERNSHIP_LIST_TITLE_PATTERN =
  /\bintern(?:ship|ships)?\b|\bco-?op\b|\bfellowship\b|\buniversity\b|\bixp\b/i;

export interface SapBoardConfig {
  feedUrl: string;
  careersOrigin: string;
}

export interface SapRssItem {
  title: string;
  link: string;
  description: string | null;
  pubDate: string | null;
}

export function createSapAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveSapBoard(source);
  const resolvedSource =
    source.sourceUrl === board.feedUrl ? source : { ...source, sourceUrl: board.feedUrl };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const xml = await fetchSapRssFeed(board.feedUrl);
      const items = parseSapRssXml(xml);
      const candidates = items.filter((item) => isSapListCandidate(item));
      return parseSapJobs(candidates, resolvedSource, items.length);
    },
  };
}

export function resolveSapBoard(source: CompanySourceConfig): SapBoardConfig {
  const categoryId = source.boardToken?.trim() || SAP_US_INTERN_CATEGORY_ID;
  const feedUrl = isSapRssFeedUrl(source.sourceUrl)
    ? source.sourceUrl.trim()
    : `${SAP_CAREERS_ORIGIN}/services/rss/category/?catid=${categoryId}`;

  return {
    feedUrl,
    careersOrigin: SAP_CAREERS_ORIGIN,
  };
}

export function isSapRssFeedUrl(sourceUrl: string): boolean {
  try {
    const parsed = new URL(sourceUrl);
    return (
      parsed.hostname.toLowerCase() === "jobs.sap.com" &&
      parsed.pathname.replace(/\/$/, "") === "/services/rss/category"
    );
  } catch {
    return false;
  }
}

export function parseSapRssXml(xml: string): SapRssItem[] {
  const items: SapRssItem[] = [];
  const itemPattern = /<item>([\s\S]*?)<\/item>/gi;

  for (const match of xml.matchAll(itemPattern)) {
    const block = match[1] ?? "";
    const title = readSapRssField(block, "title");
    const link = readSapRssField(block, "link");
    if (!title || !link) {
      continue;
    }

    items.push({
      title,
      link,
      description: readSapRssField(block, "description"),
      pubDate: readSapRssField(block, "pubDate"),
    });
  }

  return items;
}

export function isSapListCandidate(item: SapRssItem): boolean {
  const title = item.title.trim();
  if (!title) {
    return false;
  }

  if (/\binternal\b|\binternational\b/i.test(title) && !INTERNSHIP_LIST_TITLE_PATTERN.test(title)) {
    return false;
  }

  return INTERNSHIP_LIST_TITLE_PATTERN.test(title);
}

export function extractSapLocationFromTitle(title: string): string | null {
  const parenMatch = title.match(/\(([^)]+)\)\s*$/);
  if (!parenMatch) {
    return null;
  }

  const segment = parenMatch[1]?.trim() ?? "";
  if (!segment) {
    return null;
  }

  if (/\bUS\b/i.test(segment) || /United States/i.test(segment)) {
    return segment.replace(/\bUS\b/i, "US").trim();
  }

  return segment;
}

export function normalizeSapPostingUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

export function parseSapPubDate(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }
  return safeToIsoDate(value.trim());
}

export function parseSapJobs(
  items: SapRssItem[],
  source: CompanySourceConfig,
  fetchedTotal: number,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const item of items) {
    const roleName = item.title.trim();
    const description = htmlToPlainText(item.description ?? "").trim();
    const location = extractSapLocationFromTitle(roleName);
    const locations = location ? [location] : [];
    const postingUrl = normalizeSapPostingUrl(item.link.trim());

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
        description: htmlToPlainText(item.description ?? "").trim(),
        dates: atsPublishDate(parseSapPubDate(item.pubDate)),
      }),
    );
  }

  return buildRoleParseResult(fetchedTotal, roles, rejected);
}

function readSapRssField(block: string, tag: string): string | null {
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

async function fetchSapRssFeed(feedUrl: string): Promise<string> {
  const res = await fetchJsonWithTimeout(feedUrl, {
    headers: {
      accept: "application/rss+xml, application/xml, text/xml, */*",
    },
  });

  if (!res.ok) {
    throw new Error(`SAP careers RSS returned ${res.status} for ${feedUrl}`);
  }

  return res.text();
}

