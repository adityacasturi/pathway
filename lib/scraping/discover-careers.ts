/** Non-obvious careers entry points; keyed by queue slug. */
export const KNOWN_CAREERS_URLS: Record<string, string> = {
  meta: "https://www.metacareers.com/jobs",
  block: "https://block.xyz/careers",
  spotify: "https://www.lifeatspotify.com/jobs",
  pinterest: "https://www.pinterestcareers.com",
  instacart: "https://instacart.careers",
  "scale-ai": "https://scale.com/careers",
  gitlab: "https://about.gitlab.com/jobs",
  confluent: "https://careers.confluent.io",
  "jane-street": "https://www.janestreet.com/join-jane-street/open-roles",
  "character-ai": "https://character.ai/careers",
  xai: "https://x.ai/careers",
  twilio: "https://www.twilio.com/company/jobs",
  okta: "https://www.okta.com/company/careers",
  databricks: "https://www.databricks.com/company/careers",
  toast: "https://careers.toasttab.com",
  carta: "https://cart.com/careers",
  nvidia: "https://jobs.nvidia.com",
  amazon: "https://www.amazon.jobs",
};

export interface DiscoverCareersInput {
  slug: string;
  name: string;
  careersUrl?: string;
  /** Optional root domain hint, e.g. `block.xyz` */
  domain?: string;
}

export type DiscoverCareersResult =
  | { ok: true; careersUrl: string; evidence: string }
  | { ok: false; reason: string };

const SCRAPER_USER_AGENT = "Pathway internship tracker dev scraper (+https://pathway.local)";

const CAREERS_PATH_HINTS = [
  "/careers",
  "/jobs",
  "/join-us",
  "/join",
  "/company/careers",
  "/company/jobs",
  "/about/careers",
  "/open-roles",
  "/work-with-us",
  "/search-results",
] as const;

const LINK_TEXT_HINTS = /\b(careers?|jobs?|join us|we're hiring|open roles?|work with us)\b/i;

const BLOCKED_LINK_HOSTS = [
  "linkedin.com",
  "twitter.com",
  "x.com",
  "facebook.com",
  "instagram.com",
  "youtube.com",
  "glassdoor.com",
  "indeed.com",
];

export async function discoverCareersUrl(input: DiscoverCareersInput): Promise<DiscoverCareersResult> {
  const slug = input.slug.trim().toLowerCase();
  const hint = input.careersUrl?.trim();
  if (hint) {
    return { ok: true, careersUrl: hint, evidence: "queue careersUrl hint" };
  }

  const known = KNOWN_CAREERS_URLS[slug];
  if (known) {
    const ok = await urlLooksLikeCareersSite(known);
    if (ok) {
      return { ok: true, careersUrl: known, evidence: "known careers URL map" };
    }
  }

  const domains = buildDomainCandidates(slug, input.domain);
  const directUrls = buildDirectCareersUrls(domains);

  for (const url of directUrls.slice(0, 24)) {
    const resolved = await resolveUrl(url);
    if (!resolved) continue;
    const looksGood = await urlLooksLikeCareersSite(resolved);
    if (looksGood) {
      return {
        ok: true,
        careersUrl: resolved,
        evidence: `direct careers path probe (${resolved})`,
      };
    }
  }

  for (const domain of domains.slice(0, 4)) {
    const homepage = await fetchHtml(`https://${domain}`);
    if (!homepage) continue;

    const links = extractCareerLinksFromHtml(homepage, `https://${domain}`);
    const best = pickBestCareerLink(links, domain);
    if (!best) continue;

    const resolved = await resolveUrl(best.url);
    if (!resolved) continue;
    const looksGood = await urlLooksLikeCareersSite(resolved);
    if (looksGood) {
      return {
        ok: true,
        careersUrl: resolved,
        evidence: `homepage link "${best.label || best.url}" on ${domain}`,
      };
    }
  }

  return {
    ok: false,
    reason: `Could not resolve careers page for "${input.name}" (${slug}). Add optional careersUrl or domain hint to the queue row.`,
  };
}

export function buildDomainCandidates(slug: string, domainHint?: string): string[] {
  const compact = slug.replace(/-/g, "");
  const parts = slug.split("-").filter(Boolean);

  const roots: string[] = [];
  if (domainHint?.trim()) {
    roots.push(normalizeDomain(domainHint));
  }
  roots.push(`${slug}.com`, `${compact}.com`, `${parts.join("")}.com`);
  if (parts.length > 1) {
    roots.push(`${parts[0]}.com`);
  }

  const withWww = roots.flatMap((root) => [root, `www.${root}`]);
  const careerHosts = roots.flatMap((root) => [`careers.${root}`, `jobs.${root}`]);

  return [...new Set([...careerHosts, ...withWww])];
}

export function buildDirectCareersUrls(domains: string[]): string[] {
  const urls: string[] = [];
  for (const host of domains) {
    if (host.startsWith("careers.") || host.startsWith("jobs.")) {
      urls.push(`https://${host}/`, `https://${host}/us/en/search-results`);
      continue;
    }
    for (const path of CAREERS_PATH_HINTS) {
      urls.push(`https://${host}${path}`, `https://www.${host}${path}`);
    }
    urls.push(`https://${host}/`);
  }
  return [...new Set(urls)];
}

export interface CareerLinkCandidate {
  url: string;
  label: string;
  score: number;
}

export function extractCareerLinksFromHtml(html: string, baseUrl: string): CareerLinkCandidate[] {
  const candidates: CareerLinkCandidate[] = [];
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(html)) !== null) {
    const href = match[1]?.trim();
    if (!href || href.startsWith("#") || href.startsWith("mailto:")) continue;

    let url: string;
    try {
      url = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }

    const host = new URL(url).hostname.toLowerCase();
    if (BLOCKED_LINK_HOSTS.some((blocked) => host.includes(blocked))) continue;

    const label = stripHtml(match[2] ?? "");
    const path = new URL(url).pathname.toLowerCase();
    let score = scoreCareerPath(path);
    if (LINK_TEXT_HINTS.test(label)) score += 4;
    if (host.startsWith("careers.") || host.startsWith("jobs.")) score += 5;
    if (score <= 0) continue;

    candidates.push({ url, label, score });
  }

  return candidates;
}

export function pickBestCareerLink(
  links: CareerLinkCandidate[],
  preferredDomain: string,
): CareerLinkCandidate | null {
  if (links.length === 0) return null;

  const ranked = [...links].sort((a, b) => {
    const scoreDiff = b.score - a.score;
    if (scoreDiff !== 0) return scoreDiff;

    const aHost = safeHostname(a.url);
    const bHost = safeHostname(b.url);
    const aPref = aHost.includes(preferredDomain) ? 1 : 0;
    const bPref = bHost.includes(preferredDomain) ? 1 : 0;
    return bPref - aPref;
  });

  return ranked[0] ?? null;
}

export function scoreCareerPath(path: string): number {
  const normalized = path.toLowerCase();
  if (/(career|jobs?|join|hiring|open-roles|positions|search-results)/.test(normalized)) {
    if (normalized.includes("career")) return 6;
    if (normalized.includes("job")) return 5;
    if (normalized.includes("join")) return 4;
    return 3;
  }
  return 0;
}

function normalizeDomain(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

async function urlLooksLikeCareersSite(url: string): Promise<boolean> {
  const html = await fetchHtml(url);
  if (!html) return false;

  const host = safeHostname(url);
  const path = (() => {
    try {
      return new URL(url).pathname.toLowerCase();
    } catch {
      return "";
    }
  })();

  if (host.startsWith("careers.") || host.startsWith("jobs.")) return true;
  if (scoreCareerPath(path) >= 3) return true;

  const haystack = html.slice(0, 120_000).toLowerCase();
  const signals = [
    "open positions",
    "job openings",
    "search results",
    "view all jobs",
    "apply now",
    "greenhouse",
    "lever.co",
    "ashbyhq.com",
    "myworkdayjobs",
    "icims",
  ];
  return signals.some((signal) => haystack.includes(signal));
}

async function resolveUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "user-agent": SCRAPER_USER_AGENT, accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return null;
    return response.url || url;
  } catch {
    return null;
  }
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": SCRAPER_USER_AGENT, accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return null;
    }
    return await response.text();
  } catch {
    return null;
  }
}
