import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, scraperDelay } from "./shared.ts";
import { INTERNSHIP_LIST_TITLE_PATTERN } from "../list-filters.ts";

/** Yoast career sitemap; not Cloudflare-blocked unlike wp-json. Detail pages are attempted
 *  with browser-like headers and fall back to slug-inferred location on 403. */
export const CITADEL_CAREER_SITEMAP_PATH = "/career-sitemap.xml";

const CITADEL_DETAIL_FETCH_DELAY_MS = 500;

export const CITADEL_BRAND_ORIGINS = {
  citadel: "https://www.citadel.com",
  citadelsecurities: "https://www.citadelsecurities.com",
} as const;

export type CitadelBrand = keyof typeof CITADEL_BRAND_ORIGINS;

/**
 * Fallback when detail pages are inaccessible and the slug has a region
 * suffix. Detail pages are Cloudflare-blocked in practice, so these map to
 * the actual offices Citadel hires interns into per region — "Europe" alone
 * resolves to no country and the posting would be invisible.
 */
const REGION_SUFFIX_LOCATIONS: Record<string, string | string[]> = {
  us: "United States",
  europe: "London, United Kingdom",
  asia: ["Hong Kong", "Singapore"],
  australia: "Australia",
  apac: ["Hong Kong", "Singapore"],
  uk: "London, United Kingdom",
};

const TITLE_ACRONYMS = new Set([
  "ai",
  "api",
  "bs",
  "gqs",
  "ml",
  "ms",
  "phd",
  "sdet",
  "ui",
  "uk",
  "us",
]);

export interface CitadelBoardConfig {
  brand: CitadelBrand;
  origin: string;
  sitemapUrl: string;
}

export interface CitadelSitemapEntry {
  postingUrl: string;
  slug: string;
  lastmod: string | null;
}

/** Data parsed from a detail page JSON-LD JobPosting block. */
export interface CitadelDetailData {
  title: string | null;
  locations: string[];
}

export function createCitadelAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveCitadelBoard(source);
  const resolvedSource =
    source.boardToken === board.brand ? source : { ...source, boardToken: board.brand };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const xml = await fetchCitadelSitemap(board);
      const entries = parseCitadelSitemapXml(xml);

      // Pre-filter to internship candidates before issuing detail-page requests.
      const candidates = entries.filter(
        (e) =>
          !shouldSkipCitadelSlug(e.slug) &&
          INTERNSHIP_LIST_TITLE_PATTERN.test(humanizeCitadelSlug(e.slug)) &&
          isHttpUrl(e.postingUrl),
      );

      const detailDataByUrl = new Map<string, CitadelDetailData>();
      for (let i = 0; i < candidates.length; i++) {
        const entry = candidates[i]!;
        const detail = await fetchCitadelDetailPage(entry.postingUrl);
        if (detail) {
          detailDataByUrl.set(entry.postingUrl, detail);
        }
        if (i < candidates.length - 1) {
          await scraperDelay(CITADEL_DETAIL_FETCH_DELAY_MS);
        }
      }

      return parseCitadelSitemapEntries(entries, resolvedSource, detailDataByUrl);
    },
  };
}

export function resolveCitadelBoard(source: CompanySourceConfig): CitadelBoardConfig {
  const brand = normalizeCitadelBrand(source.boardToken) ?? inferCitadelBrandFromUrl(source.sourceUrl);
  const origin = CITADEL_BRAND_ORIGINS[brand];
  return {
    brand,
    origin,
    sitemapUrl: `${origin}${CITADEL_CAREER_SITEMAP_PATH}`,
  };
}

export function parseCitadelSitemapXml(xml: string): CitadelSitemapEntry[] {
  const entries: CitadelSitemapEntry[] = [];
  const urlBlockPattern = /<url>([\s\S]*?)<\/url>/gi;

  for (const match of xml.matchAll(urlBlockPattern)) {
    const block = match[1] ?? "";
    const locMatch = block.match(/<loc>([^<]+)<\/loc>/i);
    if (!locMatch) {
      continue;
    }

    const postingUrl = locMatch[1]?.trim() ?? "";
    if (!postingUrl.includes("/careers/details/")) {
      continue;
    }

    const slug = slugFromPostingUrl(postingUrl);
    if (!slug) {
      continue;
    }

    const lastmodMatch = block.match(/<lastmod>([^<]+)<\/lastmod>/i);
    entries.push({
      postingUrl,
      slug,
      lastmod: lastmodMatch?.[1]?.trim() || null,
    });
  }

  return entries;
}

export function parseCitadelSitemapEntries(
  entries: CitadelSitemapEntry[],
  source: CompanySourceConfig,
  detailDataByUrl?: Map<string, CitadelDetailData>,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const entry of entries) {
    if (shouldSkipCitadelSlug(entry.slug)) {
      continue;
    }

    const detail = detailDataByUrl?.get(entry.postingUrl);
    const roleName = detail?.title?.trim() || humanizeCitadelSlug(entry.slug);

    if (!INTERNSHIP_LIST_TITLE_PATTERN.test(roleName)) {
      continue;
    }

    const locations = detail?.locations.length
      ? detail.locations
      : inferCitadelLocations(entry.slug);

    const classification = classifyForSource(source, {
      title: roleName,
      description: "",
      locations,
    });

    if (!classification.include) {
      rejected.push({ title: roleName, reason: classification.reason });
      continue;
    }

    if (!isHttpUrl(entry.postingUrl)) {
      rejected.push({ title: roleName, reason: "invalid_url" });
      continue;
    }

    roles.push(
      buildScrapedRole({
        postingUrl: entry.postingUrl,
        roleName,
        companyName: source.companyName,
        companySlug: source.companySlug,
        classification,
      }),
    );
  }

  return buildRoleParseResult(entries.length, roles, rejected);
}

export function slugFromPostingUrl(postingUrl: string): string | null {
  try {
    const pathname = new URL(postingUrl).pathname;
    const match = pathname.match(/\/careers\/details\/([^/]+)\/?$/i);
    return match?.[1]?.trim().toLowerCase() || null;
  } catch {
    return null;
  }
}

export function humanizeCitadelSlug(slug: string): string {
  return slug
    .split("-")
    .map((segment) => {
      const lower = segment.toLowerCase();
      if (lower === "bs" || lower === "ms") {
        return lower.toUpperCase();
      }
      if (lower === "phd") {
        return "PhD";
      }
      if (TITLE_ACRONYMS.has(lower)) {
        return lower.toUpperCase();
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ")
    .replace(/\bBs Ms\b/g, "BS/MS");
}

export function inferCitadelLocations(slug: string): string[] {
  const normalized = slug.trim().toLowerCase();
  for (const [suffix, location] of Object.entries(REGION_SUFFIX_LOCATIONS)) {
    if (normalized === suffix || normalized.endsWith(`-${suffix}`)) {
      return Array.isArray(location) ? location : [location];
    }
  }
  return [];
}

/** Parse city names from a JSON-LD JobPosting block embedded in a detail page. */
export function parseCitadelDetailHtml(html: string): CitadelDetailData | null {
  const scriptPattern =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(scriptPattern)) {
    const content = match[1]?.trim();
    if (!content) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      continue;
    }

    const detail = extractCitadelJobPosting(parsed);
    if (detail) return detail;
  }

  return null;
}

function extractCitadelJobPosting(data: unknown): CitadelDetailData | null {
  if (!data || typeof data !== "object") return null;

  const obj = data as Record<string, unknown>;

  // Yoast SEO wraps structured data in an @graph array.
  if (Array.isArray(obj["@graph"])) {
    for (const item of obj["@graph"] as unknown[]) {
      const result = extractCitadelJobPosting(item);
      if (result) return result;
    }
    return null;
  }

  if (obj["@type"] !== "JobPosting") return null;

  const title =
    (typeof obj["title"] === "string" ? obj["title"] : null) ??
    (typeof obj["name"] === "string" ? obj["name"] : null);

  const rawLocations = Array.isArray(obj["jobLocation"])
    ? obj["jobLocation"]
    : obj["jobLocation"]
      ? [obj["jobLocation"]]
      : [];

  const locations: string[] = [];
  for (const loc of rawLocations as unknown[]) {
    if (!loc || typeof loc !== "object") continue;
    const locObj = loc as Record<string, unknown>;
    const address = locObj["address"];
    if (!address || typeof address !== "object") continue;
    const addr = address as Record<string, unknown>;
    const city =
      typeof addr["addressLocality"] === "string" ? addr["addressLocality"].trim() : "";
    if (city) locations.push(city);
  }

  if (!title && locations.length === 0) return null;

  return { title: title?.trim() ?? null, locations };
}

async function fetchCitadelDetailPage(url: string): Promise<CitadelDetailData | null> {
  try {
    const res = await fetchJsonWithTimeout(url, {
      headers: {
        accept: "text/html,application/xhtml+xml,*/*",
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    return parseCitadelDetailHtml(html);
  } catch {
    return null;
  }
}

function shouldSkipCitadelSlug(slug: string): boolean {
  return slug.startsWith("campus-referrals");
}

function normalizeCitadelBrand(boardToken: string | null | undefined): CitadelBrand | null {
  if (!boardToken) {
    return null;
  }

  const normalized = boardToken.trim().toLowerCase().replace(/[^a-z]/g, "");
  if (normalized === "citadel" || normalized === "citadelllc") {
    return "citadel";
  }
  if (normalized === "citadelsecurities" || normalized === "citsec") {
    return "citadelsecurities";
  }
  return null;
}

function inferCitadelBrandFromUrl(sourceUrl: string): CitadelBrand {
  try {
    const host = new URL(sourceUrl).hostname.toLowerCase();
    if (host.includes("citadelsecurities.com")) {
      return "citadelsecurities";
    }
  } catch {
    // fall through
  }
  return "citadel";
}

async function fetchCitadelSitemap(board: CitadelBoardConfig): Promise<string> {
  const res = await fetchJsonWithTimeout(board.sitemapUrl, {
    headers: {
      accept: "application/xml,text/xml,*/*",
    },
  });
  if (!res.ok) {
    throw new Error(`Citadel career sitemap returned ${res.status} for ${board.sitemapUrl}`);
  }
  return res.text();
}
