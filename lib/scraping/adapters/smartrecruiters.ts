import { atsPublishDate } from "../posted-date.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, resolveBoardToken, safeToIsoDate } from "./shared.ts";
import { htmlToPlainText } from "../plain-text.ts";

const SMARTRECRUITERS_API_ORIGIN = "https://api.smartrecruiters.com";
const SMARTRECRUITERS_JOBS_ORIGIN = "https://jobs.smartrecruiters.com";
const PAGE_SIZE = 100;
const MAX_PAGES = 20;

export interface SmartRecruitersPostingSummary {
  id?: string;
  name?: string;
  releasedDate?: string;
  location?: {
    city?: string;
    region?: string;
    country?: string;
    fullLocation?: string;
  };
  department?: { label?: string };
  function?: { label?: string };
  typeOfEmployment?: { id?: string; label?: string };
  experienceLevel?: { id?: string; label?: string };
  company?: { identifier?: string; name?: string };
}

interface SmartRecruitersListResponse {
  offset?: number;
  limit?: number;
  totalFound?: number;
  content?: SmartRecruitersPostingSummary[];
}

export interface SmartRecruitersPostingDetail extends SmartRecruitersPostingSummary {
  postingUrl?: string;
  jobAd?: {
    sections?: Record<string, { title?: string; text?: string }>;
  };
}

export function createSmartRecruitersAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const companyId = resolveSmartRecruitersCompanyId(source);
  const resolvedSource = source.boardToken === companyId ? source : { ...source, boardToken: companyId };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const summaries = await fetchAllSmartRecruitersPostings(companyId);
      const details = await fetchSmartRecruitersDetailsForCandidates(summaries, companyId);
      return parseSmartRecruitersJobs(details, resolvedSource);
    },
  };
}

export function resolveSmartRecruitersCompanyId(source: CompanySourceConfig): string {
  return resolveBoardToken(source, (sourceUrl) => {
    try {
      const parsed = new URL(sourceUrl);
      if (parsed.hostname === "api.smartrecruiters.com") {
        const parts = parsed.pathname.split("/").filter(Boolean);
        const companiesIdx = parts.indexOf("companies");
        if (companiesIdx >= 0 && parts[companiesIdx + 1]) {
          return parts[companiesIdx + 1];
        }
      }
      if (parsed.hostname === "careers.smartrecruiters.com" || parsed.hostname === "jobs.smartrecruiters.com") {
        const segment = parsed.pathname.split("/").filter(Boolean)[0];
        if (segment) {
          return segment;
        }
      }
    } catch {
      // fall through
    }
    return null;
  });
}

export async function fetchAllSmartRecruitersPostings(companyId: string): Promise<SmartRecruitersPostingSummary[]> {
  const all: SmartRecruitersPostingSummary[] = [];
  let offset = 0;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = `${SMARTRECRUITERS_API_ORIGIN}/v1/companies/${encodeURIComponent(companyId)}/postings?limit=${PAGE_SIZE}&offset=${offset}`;
    const res = await fetchJsonWithTimeout(url);
    if (!res.ok) {
      throw new Error(`SmartRecruiters returned ${res.status} for ${url}`);
    }

    const payload = (await res.json()) as SmartRecruitersListResponse;
    const batch = Array.isArray(payload.content) ? payload.content : [];
    all.push(...batch);

    const total = typeof payload.totalFound === "number" ? payload.totalFound : all.length;
    offset += PAGE_SIZE;
    if (offset >= total || batch.length === 0) {
      break;
    }
  }

  return all;
}

export function isSmartRecruitersListInternCandidate(posting: SmartRecruitersPostingSummary): boolean {
  const title = posting.name?.trim() || "";
  if (/\bintern(?:ship|ships)?\b|\bco-?op\b/i.test(title)) {
    return true;
  }
  if (posting.typeOfEmployment?.id === "intern" || posting.typeOfEmployment?.label === "Intern") {
    return true;
  }
  if (posting.experienceLevel?.id === "internship" || posting.experienceLevel?.label === "Internship") {
    return true;
  }
  return false;
}

async function fetchSmartRecruitersDetailsForCandidates(
  summaries: SmartRecruitersPostingSummary[],
  companyId: string,
): Promise<SmartRecruitersPostingDetail[]> {
  const candidates = summaries.filter(isSmartRecruitersListInternCandidate);
  const details: SmartRecruitersPostingDetail[] = [];

  for (const summary of candidates) {
    const id = summary.id?.trim();
    if (!id) {
      continue;
    }

    const url = `${SMARTRECRUITERS_API_ORIGIN}/v1/companies/${encodeURIComponent(companyId)}/postings/${encodeURIComponent(id)}`;
    const res = await fetchJsonWithTimeout(url);
    if (!res.ok) {
      continue;
    }
    details.push((await res.json()) as SmartRecruitersPostingDetail);
  }

  return details;
}

export function formatSmartRecruitersLocation(posting: SmartRecruitersPostingSummary): string | null {
  const full = posting.location?.fullLocation?.trim();
  if (full) {
    return full;
  }

  const parts: string[] = [];
  const city = posting.location?.city?.trim();
  const region = posting.location?.region?.trim();
  const country = posting.location?.country?.trim();

  if (city && region) {
    parts.push(`${city}, ${region}`);
  } else if (city) {
    parts.push(city);
  }

  if (country) {
    parts.push(country.length === 2 ? country.toUpperCase() : country);
  }

  return parts.length > 0 ? parts.join(", ") : null;
}

export function buildSmartRecruitersPostingUrl(
  posting: SmartRecruitersPostingSummary,
  companyId: string,
): string {
  const fromDetail = (posting as SmartRecruitersPostingDetail).postingUrl?.trim();
  if (fromDetail && isHttpUrl(fromDetail)) {
    return fromDetail;
  }

  const id = posting.id?.trim();
  if (!id) {
    return "";
  }

  return `${SMARTRECRUITERS_JOBS_ORIGIN}/${encodeURIComponent(companyId)}/${encodeURIComponent(id)}`;
}

export function extractSmartRecruitersDescription(posting: SmartRecruitersPostingDetail): string {
  const sections = posting.jobAd?.sections;
  if (!sections) {
    return "";
  }

  const chunks: string[] = [];
  for (const section of Object.values(sections)) {
    const text = section.text?.trim();
    if (text) {
      chunks.push(htmlToPlainText(text));
    }
  }
  return chunks.join("\n\n");
}

export function parseSmartRecruitersJobs(
  postings: SmartRecruitersPostingDetail[],
  source: CompanySourceConfig,
): RoleParseResult {
  const companyId = resolveSmartRecruitersCompanyId(source);
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const posting of postings) {
    const roleName = posting.name?.trim() || "";
    const postingUrl = buildSmartRecruitersPostingUrl(posting, companyId);
    const location = formatSmartRecruitersLocation(posting);
    const description = extractSmartRecruitersDescription(posting);
    const departments = posting.department?.label ? [posting.department.label] : [];

    const classification = classifyForSource(source, {
      title: roleName,
      description,
      employmentType: posting.typeOfEmployment?.label ?? null,
      departments,
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
        description: extractSmartRecruitersDescription(posting),
        dates: atsPublishDate(safeToIsoDate(posting.releasedDate)),
      }),
    );
  }

  return buildRoleParseResult(postings.length, roles, rejected);
}

