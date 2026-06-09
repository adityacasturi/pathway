import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import type { StructuredPlaceInput } from "../../geo/types.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl } from "./shared.ts";

export const RIPPLING_CAREERS_URL = "https://www.rippling.com/careers/open-roles";
export const RIPPLING_BOARD_TOKEN = "rippling";

export interface RipplingBoardConfig {
  careersUrl: string;
  boardToken: string;
}

export interface RipplingJobLocation {
  name?: string;
  country?: string;
  countryCode?: string;
  state?: string;
  stateCode?: string;
  city?: string;
  workplaceType?: string;
}

export interface RipplingJob {
  id: string;
  name: string;
  url: string;
  department?: { name?: string };
  locations?: RipplingJobLocation[];
  language?: string;
}

export function createRipplingAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveRipplingBoard(source);
  const resolvedSource =
    source.sourceUrl === board.careersUrl && source.boardToken === board.boardToken
      ? source
      : { ...source, sourceUrl: board.careersUrl, boardToken: board.boardToken };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const html = await fetchRipplingCareersHtml(board.careersUrl);
      const jobs = extractRipplingJobsFromCareersHtml(html);
      return parseRipplingJobs(jobs, resolvedSource);
    },
  };
}

export function resolveRipplingBoard(source: CompanySourceConfig): RipplingBoardConfig {
  const careersUrl = isRipplingCareersUrl(source.sourceUrl) ? source.sourceUrl.trim() : RIPPLING_CAREERS_URL;
  const boardToken = source.boardToken?.trim() || RIPPLING_BOARD_TOKEN;
  return { careersUrl, boardToken };
}

export function isRipplingCareersUrl(sourceUrl: string): boolean {
  try {
    const parsed = new URL(sourceUrl);
    return (
      parsed.hostname.replace(/^www\./, "") === "rippling.com" &&
      parsed.pathname.startsWith("/careers")
    );
  } catch {
    return false;
  }
}

export function extractRipplingJobsFromCareersHtml(html: string): RipplingJob[] {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match?.[1]) {
    return [];
  }

  try {
    const data = JSON.parse(match[1]) as {
      props?: { pageProps?: { jobs?: { items?: unknown } } };
    };
    const items = data.props?.pageProps?.jobs?.items;
    if (!Array.isArray(items)) {
      return [];
    }

    const jobs = items.filter(
      (item): item is RipplingJob =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as RipplingJob).id === "string" &&
        typeof (item as RipplingJob).name === "string" &&
        typeof (item as RipplingJob).url === "string",
    );

    return dedupeRipplingJobs(jobs);
  } catch {
    return [];
  }
}

export function parseRipplingJobs(jobs: RipplingJob[], source: CompanySourceConfig): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const job of jobs) {
    const roleName = job.name.trim();
    const postingUrl = job.url.trim();
    const departments = job.department?.name?.trim() ? [job.department.name.trim()] : [];
    const structuredLocations = collectRipplingStructuredPlaces(job);
    const locations = structuredLocations
      .map((place) => place.rawLabel?.trim())
      .filter(Boolean) as string[];

    const classification = classifyForSource(source, {
      title: roleName,
      description: "",
      departments,
      structuredLocations,
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
        description: "",
        seasonHints: {
          departments,
        },
      }),
    );
  }

  return buildRoleParseResult(jobs.length, roles, rejected);
}

export function collectRipplingStructuredPlaces(job: RipplingJob): StructuredPlaceInput[] {
  const places: StructuredPlaceInput[] = [];

  for (const location of job.locations ?? []) {
    const remote = location.workplaceType?.toUpperCase() === "REMOTE";
    const city = location.city?.trim() || null;
    const region = location.stateCode?.trim() || location.state?.trim() || null;
    const countryCode = location.countryCode?.trim() || null;
    const rawLabel = location.name?.trim() || null;

    if (!city && !region && !countryCode && !rawLabel) {
      continue;
    }

    places.push({ city, region, countryCode, rawLabel, remote });
  }

  return places;
}

function dedupeRipplingJobs(jobs: RipplingJob[]): RipplingJob[] {
  const byId = new Map<string, RipplingJob>();
  for (const job of jobs) {
    byId.set(job.id, job);
  }
  return Array.from(byId.values());
}

async function fetchRipplingCareersHtml(url: string): Promise<string> {
  const res = await fetchJsonWithTimeout(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!res.ok) {
    throw new Error(`Rippling careers returned ${res.status} for ${url}`);
  }

  return res.text();
}
