import type { IntegrationTier } from "./integration-queue.ts";

export interface DiscoveredAts {
  tier: Exclude<IntegrationTier, "custom" | "discover">;
  boardToken: string;
  sourceUrl: string;
  adapterKey: string;
  evidence: string;
}

export type DiscoverAtsResult =
  | { ok: true; discovery: DiscoveredAts }
  | { ok: false; reason: string };

const SCRAPER_USER_AGENT = "Pathway internship tracker dev scraper (+https://pathway.local)";

const GREENHOUSE_HOSTS = ["boards.greenhouse.io", "job-boards.greenhouse.io"] as const;

export async function discoverAtsFromCareersPage(
  careersUrl: string,
  companySlug: string,
): Promise<DiscoverAtsResult> {
  const probeUrls = buildCareersProbeUrls(careersUrl);
  let lastReason = `Could not fetch careers page: ${careersUrl}`;

  for (const probeUrl of probeUrls) {
    const resolvedUrl = await resolveCareersUrl(probeUrl);
    if (!resolvedUrl) continue;

    const html = await fetchHtml(resolvedUrl);
    if (!html) {
      lastReason = `Empty or unreadable careers page: ${resolvedUrl}`;
      continue;
    }

    const attempt = await discoverFromHtml(html, resolvedUrl, companySlug);
    if (attempt.ok) return attempt;
    lastReason = attempt.reason;
  }

  return { ok: false, reason: lastReason };
}

async function discoverFromHtml(
  html: string,
  resolvedUrl: string,
  companySlug: string,
): Promise<DiscoverAtsResult> {
  const fromHtml = parseAtsFromHtml(html, resolvedUrl, companySlug);
  if (!fromHtml) {
    return {
      ok: false,
      reason:
        "No Greenhouse, Lever, or Ashby board found on careers page (custom ATS — block for manual integration).",
    };
  }

  const verified = await verifyDiscoveredBoard(fromHtml);
  if (!verified) {
    return {
      ok: false,
      reason: `Found ${fromHtml.tier} token "${fromHtml.boardToken}" on careers page but board API verify failed`,
    };
  }

  return {
    ok: true,
    discovery: { ...verified, evidence: `${fromHtml.evidence}; verified via API` },
  };
}

export function parseAtsFromHtml(
  html: string,
  pageUrl: string,
  companySlug: string,
): DiscoveredAts | null {
  const haystack = html;

  const greenhouse = matchFirst(haystack, [
    /https?:\/\/(?:boards|job-boards)\.greenhouse\.io\/([a-zA-Z0-9_-]+)/gi,
    /(?:boards|job-boards)\.greenhouse\.io\/([a-zA-Z0-9_-]+)/gi,
    /grnhse_company_id['"\s:=]+['"]?([a-zA-Z0-9_-]+)/gi,
    /greenhouse\.io\/embed\/job_board\/(?:js\/)?([a-zA-Z0-9_-]+)/gi,
  ]);
  if (greenhouse) {
    return buildDiscovery("greenhouse", greenhouse, companySlug, `HTML on ${pageUrl}`);
  }

  const lever = matchFirst(haystack, [
    /https?:\/\/jobs\.lever\.co\/([a-zA-Z0-9_-]+)/gi,
    /jobs\.lever\.co\/([a-zA-Z0-9_-]+)/gi,
  ]);
  if (lever) {
    return buildDiscovery("lever", lever, companySlug, `HTML on ${pageUrl}`);
  }

  const ashby = matchFirst(haystack, [
    /https?:\/\/jobs\.ashbyhq\.com\/([a-zA-Z0-9_-]+)/gi,
    /jobs\.ashbyhq\.com\/([a-zA-Z0-9_-]+)/gi,
    /https?:\/\/(?:www\.)?ashbyhq\.com\/([a-zA-Z0-9_-]+)/gi,
    /ashbyhq\.com\/([a-zA-Z0-9_-]+)/gi,
  ]);
  if (ashby) {
    return buildDiscovery("ashby", ashby, companySlug, `HTML on ${pageUrl}`);
  }

  return null;
}

function buildDiscovery(
  tier: DiscoveredAts["tier"],
  boardToken: string,
  companySlug: string,
  evidence: string,
): DiscoveredAts {
  const token = boardToken.trim().toLowerCase();
  const sourceUrl =
    tier === "greenhouse"
      ? `https://job-boards.greenhouse.io/${token}`
      : tier === "lever"
        ? `https://jobs.lever.co/${token}`
        : `https://jobs.ashbyhq.com/${token}`;

  return {
    tier,
    boardToken: token,
    sourceUrl,
    adapterKey: `${companySlug}-${tier}`,
    evidence,
  };
}

function matchFirst(html: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(html);
    if (match?.[1]) {
      const token = match[1].trim().toLowerCase();
      if (
        token.length >= 2 &&
        !["embed", "jobs", "no-reply", "www", "app", "api"].includes(token)
      ) {
        return token;
      }
    }
  }
  return null;
}

async function verifyDiscoveredBoard(discovery: DiscoveredAts): Promise<DiscoveredAts | null> {
  if (discovery.tier === "lever") {
    try {
      const response = await fetch(
        `https://api.lever.co/v0/postings/${discovery.boardToken}?mode=json`,
        {
          headers: { accept: "application/json", "user-agent": SCRAPER_USER_AGENT },
          signal: AbortSignal.timeout(12_000),
        },
      );
      if (!response.ok) return null;
      const payload = (await response.json()) as unknown;
      return Array.isArray(payload) ? discovery : null;
    } catch {
      return null;
    }
  }

  if (discovery.tier === "ashby") {
    try {
      const response = await fetch(
        `https://api.ashbyhq.com/posting-api/job-board/${discovery.boardToken}`,
        {
          headers: { accept: "application/json", "user-agent": SCRAPER_USER_AGENT },
          signal: AbortSignal.timeout(12_000),
        },
      );
      if (!response.ok) return null;
      const payload = (await response.json()) as { jobs?: unknown[] };
      return Array.isArray(payload.jobs) ? discovery : null;
    } catch {
      return null;
    }
  }

  for (const host of GREENHOUSE_HOSTS) {
    const url = `https://${host}/${discovery.boardToken}`;
    const api = `https://boards-api.greenhouse.io/v1/boards/${discovery.boardToken}/jobs?content=true`;
    try {
      const response = await fetch(api, {
        headers: { accept: "application/json", "user-agent": SCRAPER_USER_AGENT },
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) continue;
      const payload = (await response.json()) as { jobs?: unknown[] };
      if (Array.isArray(payload.jobs)) {
        return { ...discovery, sourceUrl: url };
      }
    } catch {
      continue;
    }
  }
  return null;
}

function buildCareersProbeUrls(careersUrl: string): string[] {
  const trimmed = careersUrl.trim();
  const base = trimmed.replace(/\/$/, "");
  const candidates = [
    trimmed,
    `${base}/us/en/search-results`,
    `${base}/search-results`,
    `${base}/jobs`,
    `${base}/careers/search`,
    `${base}/open-positions`,
  ];
  return [...new Set(candidates)];
}

async function resolveCareersUrl(careersUrl: string): Promise<string | null> {
  try {
    const response = await fetch(careersUrl, {
      headers: { "user-agent": SCRAPER_USER_AGENT, accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return null;
    return response.url || careersUrl;
  } catch {
    return null;
  }
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": SCRAPER_USER_AGENT, accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}
