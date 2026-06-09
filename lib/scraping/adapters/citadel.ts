import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl } from "./shared.ts";
import { INTERNSHIP_LIST_TITLE_PATTERN } from "../list-filters.ts";

/** Yoast career sitemap (not Cloudflare-blocked; wp-json and HTML detail pages are). */
export const CITADEL_CAREER_SITEMAP_PATH = "/career-sitemap.xml";

export const CITADEL_BRAND_ORIGINS = {
  citadel: "https://www.citadel.com",
  citadelsecurities: "https://www.citadelsecurities.com",
} as const;

export type CitadelBrand = keyof typeof CITADEL_BRAND_ORIGINS;

/** List titles must look internship-related before classification. */
const REGION_SUFFIX_LOCATIONS: Record<string, string | string[]> = {
  us: "United States",
  europe: "Europe",
  asia: ["Hong Kong", "Singapore"],
  australia: "Australia",
  apac: ["Hong Kong", "Singapore"],
  uk: "United Kingdom",
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

export function createCitadelAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveCitadelBoard(source);
  const resolvedSource =
    source.boardToken === board.brand ? source : { ...source, boardToken: board.brand };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const xml = await fetchCitadelSitemap(board);
      const entries = parseCitadelSitemapXml(xml);
      return parseCitadelSitemapEntries(entries, resolvedSource);
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
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const entry of entries) {
    if (shouldSkipCitadelSlug(entry.slug)) {
      continue;
    }

    const roleName = humanizeCitadelSlug(entry.slug);
    if (!INTERNSHIP_LIST_TITLE_PATTERN.test(roleName)) {
      continue;
    }

    const locations = inferCitadelLocations(entry.slug);
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

