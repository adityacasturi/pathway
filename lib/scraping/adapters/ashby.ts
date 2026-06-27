import { formatUsAtsPostalAddress, type AtsPostalAddress } from "../ats-postal-address.ts";
import { structuredPlaceFromPostalAddress } from "../structured-place.ts";
import type { StructuredPlaceInput } from "../../geo/types.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import {
  fetchJsonWithTimeout,
  fetchWithTimeout,
  isHttpUrl,
  parseLeadingPathToken,
  resolveBoardToken,
} from "./shared.ts";
import { mapWithConcurrency } from "../scrape-concurrency.ts";

const ASHBY_DETAIL_CONCURRENCY = 3;

interface AshbyJob {
  id: string | number;
  title?: string;
  jobUrl?: string;
  location?: string;
  secondaryLocations?: (string | { location?: string; name?: string })[];
  description?: string;
  descriptionHtml?: string;
  descriptionPlain?: string;
  employmentType?: string;
  team?: string;
  department?: string;
  isListed?: boolean;
  isRemote?: boolean | null;
  workplaceType?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  address?: {
    postalAddress?: AtsPostalAddress;
  };
}

export function createAshbyAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const boardToken = resolveBoardToken(source, (sourceUrl) =>
    parseLeadingPathToken(sourceUrl, ["jobs.ashbyhq.com"]),
  );
  const resolvedSource = source.boardToken === boardToken ? source : { ...source, boardToken };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const url = `https://api.ashbyhq.com/posting-api/job-board/${boardToken}`;
      const res = await fetchJsonWithTimeout(url);
      if (!res.ok) {
        throw new Error(`Ashby returned ${res.status} for ${url}`);
      }
      const payload = (await res.json()) as unknown;
      const jobs = parseAshbyResponse(payload, url);
      const parsed = parseAshbyJobs(jobs, resolvedSource);
      return {
        ...parsed,
        roles: await enrichAshbyRolesWithUpdatedAt(parsed.roles),
      };
    },
  };
}

export function parseAshbyJobs(jobs: AshbyJob[], source: CompanySourceConfig): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const job of jobs) {
    if (job.isListed === false) {
      continue;
    }

    const roleName = job.title?.trim() || "";
    const postingUrl =
      job.jobUrl?.trim() ||
      `https://jobs.ashbyhq.com/${source.boardToken || source.companySlug}/${job.id}`;
    const description =
      job.descriptionPlain?.trim() ||
      job.description?.trim() ||
      job.descriptionHtml ||
      "";
    const structuredLocations = collectAshbyStructuredPlaces(job);
    const departments = [job.department?.trim(), job.team?.trim()].filter(Boolean) as string[];
    const employmentType = normalizeAshbyEmploymentType(job.employmentType, job.workplaceType);

    const classification = classifyForSource(source, {
      title: roleName,
      description,
      employmentType,
      team: job.team ?? null,
      departments,
      structuredLocations,
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
        description,
        seasonHints: {
          employmentType: job.employmentType ?? null,
          departments,
        },
        atsDates: {
          publishedAt: job.publishedAt ?? null,
          updatedAt: job.updatedAt ?? null,
        },
      }),
    );
  }

  return buildRoleParseResult(jobs.length, roles, rejected);
}

/** Map Ashby enums to strings classify-role understands. */
export function normalizeAshbyEmploymentType(
  employmentType: string | null | undefined,
  workplaceType: string | null | undefined,
): string | null {
  const parts: string[] = [];
  if (employmentType?.trim()) {
    const normalized = employmentType.trim();
    if (/^intern$/i.test(normalized)) {
      parts.push("Internship");
    } else if (/^part[-\s]?time$/i.test(normalized) && /intern/i.test(normalized)) {
      parts.push(normalized);
    } else {
      parts.push(normalized);
    }
  }
  if (workplaceType?.trim()) {
    parts.push(workplaceType.trim());
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function formatAshbyLocation(job: AshbyJob): string | null {
  const locations = collectAshbyLocations(job);
  return locations.length > 0 ? locations.join(" · ") : null;
}

export function collectAshbyStructuredPlaces(job: AshbyJob): StructuredPlaceInput[] {
  const out: StructuredPlaceInput[] = [];
  const remote = job.isRemote === true;

  const fromPostal = structuredPlaceFromPostalAddress(job.address?.postalAddress, remote);
  if (fromPostal) {
    out.push(fromPostal);
    return out;
  }

  const primary = job.location?.trim();
  if (primary) out.push({ rawLabel: primary, remote });

  for (const sec of job.secondaryLocations ?? []) {
    if (typeof sec === "string") {
      const trimmed = sec.trim();
      if (trimmed) out.push({ rawLabel: trimmed, remote });
    } else if (sec && typeof sec === "object") {
      const val = (sec.location || sec.name || "").trim();
      if (val) out.push({ rawLabel: val, remote });
    }
  }

  if (remote && out.length === 0) {
    // Remote with no stated geography: keep the remote flag, never invent a country.
    out.push({ rawLabel: "Remote", remote: true });
  }

  return out;
}

export function collectAshbyLocations(job: AshbyJob): string[] {
  const parts: string[] = [];
  const primary = job.location?.trim();
  if (primary) parts.push(primary);

  for (const sec of job.secondaryLocations ?? []) {
    if (typeof sec === "string") {
      const trimmed = sec.trim();
      if (trimmed) parts.push(trimmed);
    } else if (sec && typeof sec === "object") {
      const val = (sec.location || sec.name || "").trim();
      if (val) parts.push(val);
    }
  }

  const fromAddress = formatUsAtsPostalAddress(job.address?.postalAddress);
  if (fromAddress) {
    parts.push(fromAddress);
  }

  if (job.isRemote === true) {
    parts.push("Remote");
  }

  return Array.from(new Set(parts));
}

function parseAshbyResponse(payload: unknown, url: string): AshbyJob[] {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { jobs?: unknown }).jobs)) {
    throw new Error(`Ashby response was not in expected format for ${url}`);
  }
  return (payload as { jobs: AshbyJob[] }).jobs;
}

export function ashbyRoleHasApiUpdatedAt(role: {
  atsDates?: { updatedAt?: string | null };
}): boolean {
  const updatedAt = role.atsDates?.updatedAt?.trim();
  return Boolean(updatedAt && !Number.isNaN(Date.parse(updatedAt)));
}

async function enrichAshbyRolesWithUpdatedAt<T extends ReturnType<typeof buildScrapedRole>>(
  roles: T[],
): Promise<T[]> {
  return mapWithConcurrency(roles, ASHBY_DETAIL_CONCURRENCY, async (role) => {
    if (ashbyRoleHasApiUpdatedAt(role)) {
      return role;
    }
    const updatedAt = await fetchAshbyPostingUpdatedAt(role.postingUrl);
    if (!updatedAt) {
      return role;
    }
    return {
      ...role,
      atsDates: {
        ...role.atsDates,
        updatedAt,
      },
    };
  });
}

async function fetchAshbyPostingUpdatedAt(url: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) {
      return null;
    }
    return parseAshbyPostingPageUpdatedAt(await res.text());
  } catch {
    return null;
  }
}

export function parseAshbyPostingPageUpdatedAt(html: string): string | null {
  const raw = html.match(/"updatedAt"\s*:\s*"([^"]+)"/)?.[1]?.trim();
  if (!raw || Number.isNaN(Date.parse(raw))) {
    return null;
  }
  return raw;
}
