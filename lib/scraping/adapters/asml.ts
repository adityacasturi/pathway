import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { INTERNSHIP_LIST_TITLE_PATTERN } from "../list-filters.ts";
import { htmlToPlainText } from "../plain-text.ts";
import { mapWithConcurrency } from "../scrape-concurrency.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchWithTimeout, isHttpUrl, safeToIsoDate } from "./shared.ts";

/** ASML publishes job detail URLs in a public XML sitemap; pages embed Workday job data in Next.js. */
export const ASML_CAREERS_ORIGIN = "https://www.asml.com";
export const ASML_DEFAULT_CAREERS_URL = `${ASML_CAREERS_ORIGIN}/en/careers/find-your-job`;
export const ASML_JOB_SITEMAP_URL = `${ASML_CAREERS_ORIGIN}/api/job-posting-sitemap`;

const ASML_DETAIL_CONCURRENCY = 4;
const ASML_REQUEST_DELAY_MS = 200;

export interface AsmlBoardConfig {
  careersUrl: string;
  sitemapUrl: string;
}

export interface AsmlJobData {
  jobType?: string | null;
  displayJobTitle?: string | null;
  status?: string | null;
  datePosted?: string | null;
  location?: string | null;
  city?: string | null;
  country?: string | null;
  state?: string | null;
  cityAndState?: string | null;
  descriptionExternal?: string | null;
  detailPageUrl?: string | null;
  applyUrl?: string | null;
  team?: string[] | string | null;
}

interface AsmlNextPageProps {
  jobData?: AsmlJobData | null;
  notFound?: boolean;
}

export function createAsmlAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveAsmlBoard(source);

  return {
    source,
    async fetchRoles() {
      const postingUrls = await fetchAsmlSitemapUrls(board.sitemapUrl);
      const listCandidates = postingUrls.filter((url) => isAsmlListCandidate(url));
      const jobs = (
        await mapWithConcurrency(listCandidates, ASML_DETAIL_CONCURRENCY, async (postingUrl) => {
          await scraperDelay(ASML_REQUEST_DELAY_MS);
          return fetchAsmlJobData(postingUrl);
        })
      ).filter((job): job is AsmlJobDetail => job !== null);

      return parseAsmlJobs(jobs, source, postingUrls.length);
    },
  };
}

export interface AsmlJobDetail {
  postingUrl: string;
  job: AsmlJobData;
}

export function resolveAsmlBoard(source: CompanySourceConfig): AsmlBoardConfig {
  const careersUrl = isAsmlCareersUrl(source.sourceUrl) ? source.sourceUrl.trim() : ASML_DEFAULT_CAREERS_URL;
  return {
    careersUrl,
    sitemapUrl: ASML_JOB_SITEMAP_URL,
  };
}

export function isAsmlCareersUrl(sourceUrl: string): boolean {
  try {
    const parsed = new URL(sourceUrl);
    return parsed.hostname.toLowerCase() === "www.asml.com" && parsed.pathname.includes("/careers/");
  } catch {
    return false;
  }
}

export function parseAsmlSitemap(xml: string): string[] {
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => match[1]?.trim() ?? "")
    .filter((url) => url.includes("/careers/find-your-job/"));
  return [...new Set(urls)];
}

export function isAsmlListCandidate(postingUrl: string): boolean {
  const slug = postingUrl.split("/").pop() ?? "";
  const haystack = slug.replace(/-/g, " ");
  return INTERNSHIP_LIST_TITLE_PATTERN.test(haystack);
}

export function formatAsmlLocation(job: AsmlJobData): string | null {
  const direct = job.location?.trim();
  if (direct) {
    return direct;
  }

  const cityAndState = job.cityAndState?.trim();
  if (cityAndState) {
    return job.country?.trim() ? `${cityAndState}, ${job.country.trim()}` : cityAndState;
  }

  const city = job.city?.trim();
  const state = job.state?.trim();
  const country = job.country?.trim();
  const parts = [city, state, country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

export function buildAsmlPostingUrl(postingUrl: string, job: AsmlJobData): string {
  const detail = job.detailPageUrl?.trim();
  if (detail && isHttpUrl(detail)) {
    return detail;
  }
  return postingUrl;
}

export function asmlJobDescription(job: AsmlJobData): string {
  return htmlToPlainText(job.descriptionExternal ?? "");
}

export function parseAsmlNextDataPayload(payload: unknown, postingUrl: string): AsmlJobDetail | null {
  const pageProps = (payload as { props?: { pageProps?: AsmlNextPageProps } })?.props?.pageProps;
  const job = pageProps?.jobData;
  if (!job || pageProps?.notFound) {
    return null;
  }
  if ((job.status?.trim() ?? "").toLowerCase() !== "open") {
    return null;
  }
  return { postingUrl, job };
}

export function parseAsmlJobs(
  jobs: AsmlJobDetail[],
  source: CompanySourceConfig,
  fetchedCount: number,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const entry of jobs) {
    const roleName = entry.job.displayJobTitle?.trim() || "";
    const postingUrl = buildAsmlPostingUrl(entry.postingUrl, entry.job);
    const description = asmlJobDescription(entry.job);
    const location = formatAsmlLocation(entry.job);
    const teams = Array.isArray(entry.job.team)
      ? entry.job.team
      : entry.job.team?.trim()
        ? [entry.job.team.trim()]
        : [];

    const classification = classifyForSource(source, {
      title: roleName,
      description,
      departments: teams,
      locations: location ? [location] : [],
      employmentType: entry.job.jobType,
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

    const publishedAt = safeToIsoDate(entry.job.datePosted);

    roles.push(
      buildScrapedRole({
        postingUrl,
        roleName,
        companyName: source.companyName,
        companySlug: source.companySlug,
        classification,
        description,
        atsDates: publishedAt ? { publishedAt } : undefined,
      }),
    );
  }

  return buildRoleParseResult(fetchedCount, roles, rejected);
}

async function fetchAsmlSitemapUrls(sitemapUrl: string): Promise<string[]> {
  const res = await fetchWithTimeout(sitemapUrl, {
    headers: { accept: "application/xml,text/xml,*/*" },
  });
  if (!res.ok) {
    throw new Error(`ASML sitemap returned ${res.status} for ${sitemapUrl}`);
  }
  return parseAsmlSitemap(await res.text());
}

async function fetchAsmlJobData(postingUrl: string): Promise<AsmlJobDetail | null> {
  const res = await fetchWithTimeout(postingUrl, {
    headers: { accept: "text/html" },
  });
  if (!res.ok) {
    throw new Error(`ASML job page returned ${res.status} for ${postingUrl}`);
  }

  const html = await res.text();
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match?.[1]) {
    return null;
  }

  const payload = JSON.parse(match[1]) as unknown;
  return parseAsmlNextDataPayload(payload, postingUrl);
}

function scraperDelay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
