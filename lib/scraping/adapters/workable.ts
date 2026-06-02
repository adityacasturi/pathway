import { atsPublishDate } from "../posted-date.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, safeToIsoDate } from "./shared.ts";

/** Public Workable job-board widget API (no auth). */
export const WORKABLE_WIDGET_API_ORIGIN = "https://apply.workable.com";

export interface WorkableWidgetJob {
  title?: string;
  shortcode?: string;
  code?: string;
  employment_type?: string;
  department?: string;
  url?: string;
  shortlink?: string;
  application_url?: string;
  published_on?: string;
  created_at?: string;
  country?: string;
  city?: string;
  state?: string;
  experience?: string;
  function?: string;
  locations?: Array<{
    country?: string;
    city?: string;
    region?: string;
  }>;
}

export interface WorkableWidgetResponse {
  name?: string;
  jobs?: WorkableWidgetJob[];
}

export function createWorkableAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const account = resolveWorkableAccount(source);
  const resolvedSource = source.boardToken === account ? source : { ...source, boardToken: account };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const url = `${WORKABLE_WIDGET_API_ORIGIN}/api/v1/widget/accounts/${account}`;
      const res = await fetchJsonWithTimeout(url);
      if (!res.ok) {
        throw new Error(`Workable returned ${res.status} for ${url}`);
      }

      const payload = (await res.json()) as WorkableWidgetResponse;
      const jobs = Array.isArray(payload.jobs) ? payload.jobs : [];
      return parseWorkableJobs(jobs, resolvedSource);
    },
  };
}

export function resolveWorkableAccount(source: CompanySourceConfig): string {
  const explicit = source.boardToken?.trim();
  if (explicit) {
    return explicit;
  }

  try {
    const parsed = new URL(source.sourceUrl);
    if (parsed.hostname === "apply.workable.com") {
      const segment = parsed.pathname.split("/").filter(Boolean)[0];
      if (segment) {
        return segment;
      }
    }
  } catch {
    // fall through
  }

  const fromSlug = source.companySlug.trim();
  if (fromSlug) {
    return fromSlug.replace(/-/g, "");
  }

  throw new Error(`Unable to resolve Workable account for adapter ${source.adapterKey}`);
}

export function formatWorkableLocation(job: WorkableWidgetJob): string | null {
  const parts: string[] = [];
  const city = job.city?.trim();
  const state = job.state?.trim();
  const country = job.country?.trim();

  if (city && state) {
    parts.push(`${city}, ${state}`);
  } else if (city) {
    parts.push(city);
  }

  if (country) {
    parts.push(country);
  }

  for (const loc of job.locations ?? []) {
    const locCity = loc.city?.trim();
    const locRegion = loc.region?.trim();
    const locCountry = loc.country?.trim();
    if (locCity && locRegion) {
      parts.push(`${locCity}, ${locRegion}`);
    } else if (locCity) {
      parts.push(locCity);
    }
    if (locCountry) {
      parts.push(locCountry);
    }
  }

  const unique = Array.from(new Set(parts.map((part) => part.trim()).filter(Boolean)));
  return unique.length > 0 ? unique.join(" · ") : null;
}

export function parseWorkableJobs(jobs: WorkableWidgetJob[], source: CompanySourceConfig): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const job of jobs) {
    const roleName = job.title?.trim() || "";
    const postingUrl = normalizeWorkablePostingUrl(job.application_url ?? job.url ?? job.shortlink ?? "");
    const location = formatWorkableLocation(job);
    const descriptionParts = [
      job.department?.trim(),
      job.employment_type?.trim(),
      job.experience?.trim(),
      job.function?.trim(),
    ].filter(Boolean);

    const classification = classifyForSource(source, {
      title: roleName,
      description: descriptionParts.join("\n"),
      employmentType: job.employment_type ?? null,
      departments: job.department ? [job.department] : [],
      locations: location ? [location] : [],
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
        description: descriptionParts.join("\n"),
        dates: atsPublishDate(safeToIsoDate(job.published_on ?? job.created_at)),
      }),
    );
  }

  return buildRoleParseResult(jobs.length, roles, rejected);
}

export function normalizeWorkablePostingUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const parsed = new URL(trimmed, WORKABLE_WIDGET_API_ORIGIN);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

