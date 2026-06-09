import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import {
  fetchJsonWithTimeout,
  isHttpUrl,
  parseLeadingPathToken,
  resolveBoardToken,
} from "./shared.ts";

interface LeverJob {
  id: string;
  text?: string;
  hostedUrl?: string;
  description?: string;
  descriptionPlain?: string;
  categories?: {
    location?: string;
    allLocations?: string[];
    commitment?: string;
    team?: string;
    department?: string;
  };
  workplaceType?: string;
}

export function createLeverAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const boardToken = resolveBoardToken(source, (sourceUrl) =>
    parseLeadingPathToken(sourceUrl, ["jobs.lever.co"]),
  );
  const resolvedSource = source.boardToken === boardToken ? source : { ...source, boardToken };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const url = `https://api.lever.co/v0/postings/${boardToken}?mode=json`;
      const res = await fetchJsonWithTimeout(url);
      if (!res.ok) {
        throw new Error(`Lever returned ${res.status} for ${url}`);
      }
      const payload = (await res.json()) as unknown;
      const jobs = parseLeverResponse(payload, url);
      return parseLeverJobs(jobs, resolvedSource);
    },
  };
}

export function parseLeverJobs(jobs: LeverJob[], source: CompanySourceConfig): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const job of jobs) {
    const roleName = job.text?.trim() || "";
    const postingUrl = job.hostedUrl?.trim() || "";
    const description = job.descriptionPlain?.trim() || job.description || "";
    const locations = collectLeverLocations(job);
    const departments = [job.categories?.department?.trim(), job.categories?.team?.trim()].filter(
      Boolean,
    ) as string[];

    const classification = classifyForSource(source, {
      title: roleName,
      description,
      commitment: job.categories?.commitment ?? null,
      team: job.categories?.team ?? null,
      employmentType: job.workplaceType ?? null,
      departments,
      locations,
    });

    if (!classification.include) {
      if (roleName) {
        rejected.push({ title: roleName, reason: classification.reason });
      }
      continue;
    }

    if (!postingUrl || !isHttpUrl(postingUrl)) {
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
          commitment: job.categories?.commitment ?? null,
          departments,
        },
      }),
    );
  }

  return buildRoleParseResult(jobs.length, roles, rejected);
}

export function collectLeverLocations(job: LeverJob): string[] {
  const primary = job.categories?.location?.trim() || "";
  const additional = job.categories?.allLocations ?? [];
  const parts = [primary, ...additional.map((loc) => loc.trim()).filter(Boolean)];

  const workplace = job.workplaceType?.trim();
  if (workplace && /remote|hybrid/i.test(workplace)) {
    parts.push(workplace);
  }

  return Array.from(new Set(parts.filter(Boolean)));
}

function parseLeverResponse(payload: unknown, url: string): LeverJob[] {
  if (!Array.isArray(payload)) {
    throw new Error(`Lever response was not in expected format for ${url}`);
  }
  return payload as LeverJob[];
}
