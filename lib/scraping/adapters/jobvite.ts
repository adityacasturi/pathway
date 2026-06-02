import { atsPublishDate } from "../posted-date.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { htmlToPlainText } from "../plain-text.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, resolveBoardToken, safeToIsoDate } from "./shared.ts";
import { INTERNSHIP_LIST_TITLE_PATTERN } from "../list-filters.ts";

const JOBVITE_HOST = "jobs.jobvite.com";
export interface JobviteBoardConfig {
  boardOrigin: string;
  companySlug: string;
  listUrl: string;
}

export interface JobviteListJob {
  jobId: string;
  title: string;
  listUrl: string;
  location: string | null;
}

export function createJobviteAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveJobviteBoard(source);
  const resolvedSource =
    source.boardToken === board.companySlug && source.sourceUrl === board.listUrl
      ? source
      : { ...source, boardToken: board.companySlug, sourceUrl: board.listUrl };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const listHtml = await fetchJobviteHtml(board.listUrl);
      const listings = parseJobviteListHtml(listHtml, board);
      const candidates = listings.filter((job) => isJobviteListCandidate(job));
      return parseJobviteJobs(candidates, resolvedSource, board, listings.length);
    },
  };
}

export function resolveJobviteBoard(source: CompanySourceConfig): JobviteBoardConfig {
  const companySlug = resolveBoardToken(source, (sourceUrl) => parseJobviteCompanySlug(sourceUrl));
  const listUrl = source.sourceUrl?.trim() || `https://${JOBVITE_HOST}/${companySlug}`;
  const parsed = new URL(listUrl);

  if (parsed.hostname !== JOBVITE_HOST) {
    throw new Error(`Invalid Jobvite list URL for adapter ${source.adapterKey}`);
  }

  const pathSlug = parsed.pathname.split("/").filter(Boolean)[0];
  if (pathSlug && pathSlug !== companySlug) {
    throw new Error(`Jobvite board token mismatch: ${companySlug} vs ${pathSlug}`);
  }

  return {
    boardOrigin: `${parsed.protocol}//${parsed.host}`,
    companySlug,
    listUrl: `${parsed.protocol}//${parsed.host}/${companySlug}`,
  };
}

export function parseJobviteCompanySlug(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    if (parsed.hostname !== JOBVITE_HOST) {
      return null;
    }
    return parsed.pathname.split("/").filter(Boolean)[0] ?? null;
  } catch {
    return null;
  }
}

export function parseJobviteListHtml(html: string, board: JobviteBoardConfig): JobviteListJob[] {
  const jobs: JobviteListJob[] = [];
  const seen = new Set<string>();

  const rowPattern =
    /<tr>\s*<td class="jv-job-list-name">\s*<a href="\/([^/]+)\/job\/([^"]+)">([^<]+)<\/a>\s*<\/td>\s*<td class="jv-job-list-location">([\s\S]*?)<\/td>/gi;

  for (const match of html.matchAll(rowPattern)) {
    const companySlug = match[1]?.trim() ?? "";
    const jobId = match[2]?.trim() ?? "";
    const title = match[3]?.trim() ?? "";
    const locationRaw = match[4] ?? "";
    if (companySlug !== board.companySlug || !jobId || !title || seen.has(jobId)) {
      continue;
    }

    seen.add(jobId);
    jobs.push({
      jobId,
      title,
      listUrl: `${board.boardOrigin}/${companySlug}/job/${jobId}`,
      location: normalizeJobviteLocation(locationRaw),
    });
  }

  const featuredPattern = new RegExp(
    `<a href="/${board.companySlug}/job/([^"]+)">([^<]+)</a>`,
    "gi",
  );
  for (const match of html.matchAll(featuredPattern)) {
    const jobId = match[1]?.trim() ?? "";
    const title = match[2]?.trim() ?? "";
    if (!jobId || !title || seen.has(jobId)) {
      continue;
    }
    seen.add(jobId);
    jobs.push({
      jobId,
      title,
      listUrl: `${board.boardOrigin}/${board.companySlug}/job/${jobId}`,
      location: null,
    });
  }

  return jobs;
}

export function isJobviteListCandidate(job: JobviteListJob): boolean {
  const title = job.title.trim();
  if (!title) {
    return false;
  }
  return INTERNSHIP_LIST_TITLE_PATTERN.test(title);
}

export function parseJobviteJobDetailHtml(html: string): {
  title: string;
  description: string;
  location: string | null;
  postedOn: string | null;
} {
  const title =
    readJobviteMeta(html, "og:title")?.replace(/\s+at\s+.+$/i, "").trim() ??
    readJobviteTagText(html, "h1") ??
    "";

  const description =
    readJobviteMeta(html, "og:description") ??
    htmlToPlainText(extractJobviteDescriptionBlock(html));

  const location = extractJobviteDetailLocation(html) ?? readJobviteMeta(html, "og:locality");

  const postedOn = readJobviteMeta(html, "article:published_time");

  return {
    title: title.trim(),
    description: description.trim(),
    location: location?.trim() || null,
    postedOn: postedOn?.trim() || null,
  };
}

export async function parseJobviteJobs(
  listings: JobviteListJob[],
  source: CompanySourceConfig,
  board: JobviteBoardConfig,
  fetchedTotal: number,
): Promise<RoleParseResult> {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const listing of listings) {
    let roleName = listing.title;
    let description = "";
    let location: string | null = listing.location;
    let datePosted: string | null = null;

    try {
      const detailHtml = await fetchJobviteHtml(listing.listUrl);
      const detail = parseJobviteJobDetailHtml(detailHtml);
      if (detail.title) {
        roleName = detail.title;
      }
      description = detail.description;
      location = detail.location ?? location;
      datePosted = safeToIsoDate(detail.postedOn);
    } catch {
      // List metadata is enough for classification when detail fetch fails.
    }

    const classification = classifyForSource(source, {
      title: roleName,
      description,
      locations: location ? [location] : [],
    });

    if (!classification.include) {
      if (roleName) {
        rejected.push({ title: roleName, reason: classification.reason });
      }
      continue;
    }

    const postingUrl = listing.listUrl;
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
        dates: atsPublishDate(datePosted),
      }),
    );
  }

  return buildRoleParseResult(fetchedTotal, roles, rejected);
}

function normalizeJobviteLocation(raw: string): string | null {
  const text = htmlToPlainText(raw).replace(/\s+/g, " ").trim();
  return text || null;
}

function extractJobviteDetailLocation(html: string): string | null {
  const match = html.match(/<p class="jv-job-detail-meta">([\s\S]*?)<\/p>/i);
  if (!match) {
    return null;
  }

  const parts = htmlToPlainText(match[1] ?? "")
    .split(/\s*·\s*|\s*\|\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return parts[0] ?? null;
  }

  return parts.slice(1).join(", ") || null;
}

function extractJobviteDescriptionBlock(html: string): string {
  const match = html.match(/<div class="jv-job-detail-description"[^>]*>([\s\S]*?)<\/div>/i);
  return match?.[1] ?? "";
}

function readJobviteMeta(html: string, property: string): string | null {
  const pattern = new RegExp(
    `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const match = html.match(pattern);
  return match?.[1]?.trim() || null;
}

function readJobviteTagText(html: string, tag: string): string | null {
  const pattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = html.match(pattern);
  if (!match) {
    return null;
  }
  return htmlToPlainText(match[1] ?? "").trim() || null;
}

async function fetchJobviteHtml(url: string): Promise<string> {
  const res = await fetchJsonWithTimeout(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!res.ok) {
    throw new Error(`Jobvite returned ${res.status} for ${url}`);
  }

  return res.text();
}

