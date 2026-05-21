import type { NormalizedScrapedPosting, ScrapeSourceConfig } from "../types.ts";

const SCRAPER_USER_AGENT = "Pathway internship tracker dev scraper (+https://pathway.local)";

export function atsJsonHeaders(): HeadersInit {
  return {
    accept: "application/json",
    "user-agent": SCRAPER_USER_AGENT,
  };
}

export function safeToIsoDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

export function resolveBoardToken(
  source: ScrapeSourceConfig,
  deriveFromSourceUrl: (sourceUrl: string) => string | null,
): string {
  const explicit = normalizeToken(source.boardToken);
  if (explicit) return explicit;

  const fromUrl = normalizeToken(deriveFromSourceUrl(source.sourceUrl));
  if (fromUrl) return fromUrl;

  const fromSlug = normalizeToken(source.companySlug);
  if (fromSlug) return fromSlug;

  throw new Error(`Unable to resolve board token for adapter ${source.adapterKey}`);
}

export function parseLeadingPathToken(sourceUrl: string, hosts?: string[]): string | null {
  try {
    const parsed = new URL(sourceUrl);
    const hostname = parsed.hostname.toLowerCase();
    if (hosts && hosts.length > 0 && !hosts.includes(hostname)) {
      return null;
    }

    const firstSegment = parsed.pathname
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean)[0];
    return firstSegment || null;
  } catch {
    return null;
  }
}

export function dedupePostingsByCanonicalUrl(
  postings: readonly NormalizedScrapedPosting[],
): NormalizedScrapedPosting[] {
  const byCanonicalUrl = new Map<string, NormalizedScrapedPosting>();
  for (const posting of postings) {
    const existing = byCanonicalUrl.get(posting.canonicalUrl);
    if (!existing) {
      byCanonicalUrl.set(posting.canonicalUrl, posting);
      continue;
    }

    if (scorePosting(posting) > scorePosting(existing)) {
      byCanonicalUrl.set(posting.canonicalUrl, posting);
    }
  }
  return Array.from(byCanonicalUrl.values());
}

export function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeToken(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function scorePosting(posting: NormalizedScrapedPosting): number {
  let score = 0;
  score += posting.externalJobId ? 8 : 0;
  score += posting.datePosted ? 4 : 0;
  score += posting.locations.length;
  score += posting.isRemote ? 1 : 0;
  return score;
}
