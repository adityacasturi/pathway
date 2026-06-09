import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl } from "./shared.ts";

/** Public Breezy HR career portal JSON feed (no auth). */
export const BREEZY_PORTAL_ORIGIN = "https://breezy.hr";

export interface BreezyPortalJob {
  id?: string;
  friendly_id?: string;
  name?: string;
  url?: string;
  published_date?: string;
  type?: { id?: string; name?: string };
  department?: string;
  location?: {
    name?: string;
    city?: string;
    is_remote?: boolean;
    country?: { id?: string; name?: string };
    state?: { id?: string; name?: string };
  };
  locations?: Array<{
    name?: string;
    city?: string;
    is_remote?: boolean;
    country?: { id?: string; name?: string };
    state?: { id?: string; name?: string };
  }>;
}

export function createBreezyAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const portalSlug = resolveBreezyPortalSlug(source);
  const portalUrl = `https://${portalSlug}.breezy.hr/`;
  const resolvedSource =
    source.boardToken === portalSlug && source.sourceUrl === portalUrl
      ? source
      : { ...source, boardToken: portalSlug, sourceUrl: portalUrl };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const url = `${portalUrl}json`;
      const res = await fetchJsonWithTimeout(url);
      if (!res.ok) {
        throw new Error(`Breezy returned ${res.status} for ${url}`);
      }

      const payload = (await res.json()) as unknown;
      if (!Array.isArray(payload)) {
        throw new Error(`Breezy JSON for ${portalSlug} was not an array`);
      }

      return parseBreezyJobs(payload as BreezyPortalJob[], resolvedSource);
    },
  };
}

export function resolveBreezyPortalSlug(source: CompanySourceConfig): string {
  const explicit = source.boardToken?.trim();
  if (explicit) {
    return explicit;
  }

  try {
    const parsed = new URL(source.sourceUrl);
    const match = parsed.hostname.match(/^([a-z0-9-]+)\.breezy\.hr$/i);
    if (match?.[1]) {
      return match[1].toLowerCase();
    }
  } catch {
    // fall through
  }

  const fromSlug = source.companySlug.trim();
  if (fromSlug) {
    return fromSlug;
  }

  throw new Error(`Unable to resolve Breezy portal slug for adapter ${source.adapterKey}`);
}

export function formatBreezyLocation(job: BreezyPortalJob): string | null {
  const parts: string[] = [];

  const primaryName = job.location?.name?.trim();
  if (primaryName) {
    parts.push(primaryName);
  }

  if (job.location?.is_remote) {
    parts.push("Remote");
  }

  for (const loc of job.locations ?? []) {
    const name = loc.name?.trim();
    if (name) {
      parts.push(name);
    }
    if (loc.is_remote) {
      parts.push("Remote");
    }
  }

  const unique = Array.from(new Set(parts.map((part) => part.trim()).filter(Boolean)));
  return unique.length > 0 ? unique.join(" · ") : null;
}

export function parseBreezyJobs(jobs: BreezyPortalJob[], source: CompanySourceConfig): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const job of jobs) {
    const roleName = job.name?.trim() || "";
    const postingUrl = normalizeBreezyPostingUrl(job.url ?? "");
    const location = formatBreezyLocation(job);
    const descriptionParts = [job.department?.trim(), job.type?.name?.trim()].filter(Boolean);

    const classification = classifyForSource(source, {
      title: roleName,
      description: descriptionParts.join("\n"),
      employmentType: job.type?.name ?? null,
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
      }),
    );
  }

  return buildRoleParseResult(jobs.length, roles, rejected);
}

export function normalizeBreezyPostingUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const parsed = new URL(trimmed);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

