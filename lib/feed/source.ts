/**
 * Discover feed sources. We consume upstream internship trackers directly —
 * no mirror, no scheduler. Each source exposes a `fetch()` that returns
 * normalized postings; Next's `fetch` cache keeps upstream traffic bounded
 * to one refresh per hour.
 *
 * Adding a new source:
 *   1. Write a `fetch` that returns FeedPosting[] — normalize the upstream
 *      shape inside that function (JSON, markdown, whatever).
 *   2. Append an entry to FEED_SOURCES.
 *   3. Deduplication across sources is handled automatically below
 *      (canonical URL plus same-company/title fingerprints; first source in
 *      FEED_SOURCES wins).
 */

import { unstable_noStore } from "next/cache";
import { resolveDiscoverCutoffDate } from "@/lib/config/discover";
import {
  detectCountriesAcross,
  hasRemoteLocation,
} from "@/lib/feed/location";
import { isTargetEngineeringInternshipRole } from "@/lib/feed/roles";
import { errorMessage, logServerEvent } from "@/lib/observability";
import { isUsOnlyInternship } from "@/lib/postings/us-only";

/** How long (in seconds) to cache a fetched source before re-pulling. */
const FEED_REVALIDATE_SECONDS = 60 * 60; // 1h
const SOURCE_TIMEOUT_MS = 8000;

export type FeedSeason = "Summer" | "Fall";

const ALLOWED_SEASONS: readonly FeedSeason[] = ["Summer", "Fall"];

/** Minimum acceptable term year — used when parsing "Summer 2026" style terms. */
const MIN_TERM_YEAR = 2026;

/** Slim shape handed down to client components. */
export interface FeedPosting {
  id: string;
  interactionIds: string[];
  sourceId: string;
  company: string;
  title: string;
  url: string;
  locations: string[];
  /** ISO 3166-1 alpha-2 codes derived from `locations`. May be empty. */
  countries: string[];
  /** True if any location reads as remote; used for the Remote filter pill. */
  hasRemote: boolean;
  season: FeedSeason;
  /** Unix seconds; rendered as a relative age ("2d ago"). */
  datePosted: number;
  dateUpdated: number;
}

/**
 * Raw shape accepted by JSON parsers. Covers fields from all known upstream
 * schemas so a single interface can travel through fetchJsonSource.
 */
interface RawListing {
  id?: string;
  company_name?: string;
  title?: string;
  url?: string;
  locations?: string[];
  active?: boolean;
  is_visible?: boolean;
  date_posted?: number;
  date_updated?: number;
  // vanshb03: exposes a single `season` string
  season?: string;
  // SimplifyJobs: exposes an array of `terms` like ["Summer 2026", "Fall 2026"]
  terms?: string[];
  // SimplifyJobs: "Software" | "Product" | "AI/ML/Data" | "Other" | ...
  category?: string;
}

interface FeedSource {
  id: string;
  label: string;
  fetch: () => Promise<FeedPosting[]>;
}

/* ------------------------------- helpers -------------------------------- */

function isAllowedSeason(season: string | undefined): season is FeedSeason {
  return (ALLOWED_SEASONS as readonly string[]).includes(season ?? "");
}

/** Pull the first acceptable Summer/Fall season out of a `terms` array. */
function extractSeasonFromTerms(terms: string[] | undefined): FeedSeason | null {
  if (!Array.isArray(terms)) return null;
  for (const term of terms) {
    const match = /^(Summer|Fall)\s+(\d{4})/i.exec(term);
    if (!match) continue;
    const year = parseInt(match[2], 10);
    if (year < MIN_TERM_YEAR) continue;
    const normalized = match[1][0].toUpperCase() + match[1].slice(1).toLowerCase();
    if (isAllowedSeason(normalized)) return normalized;
  }
  return null;
}

function baseValid(row: RawListing): boolean {
  if (!row?.id || !row.company_name || !row.title || !row.url) return false;
  if (row.active === false || row.is_visible === false) return false;
  if (typeof row.date_posted === "number" && row.date_posted < resolveDiscoverCutoffDate().cutoffUnix) {
    return false;
  }
  return true;
}

function buildPosting(row: RawListing, sourceId: string, season: FeedSeason): FeedPosting | null {
  const id = stablePostingId(row.url as string);
  const upstreamId = row.id as string;
  const locations = Array.isArray(row.locations) ? row.locations : [];
  if (!isUsOnlyInternship(locations)) {
    return null;
  }
  return {
    id,
    interactionIds: Array.from(new Set([id, upstreamId, `${sourceId}:${upstreamId}`])),
    sourceId,
    company: row.company_name as string,
    title: row.title as string,
    url: row.url as string,
    locations,
    countries: detectCountriesAcross(locations),
    hasRemote: hasRemoteLocation(locations),
    season,
    datePosted: typeof row.date_posted === "number" ? row.date_posted : 0,
    dateUpdated:
      typeof row.date_updated === "number"
        ? row.date_updated
        : typeof row.date_posted === "number"
        ? row.date_posted
        : 0,
  };
}

const CACHE_OPTS: RequestInit = {
  next: { revalidate: FEED_REVALIDATE_SECONDS, tags: ["discover-feed"] },
};

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Module-level memo for sources whose raw payload exceeds Next's 2MB fetch
 * cache ceiling (SimplifyJobs' listings.json is ~20MB). For those sources we
 * bypass Next's fetch cache — which would silently fail to store anyway and
 * warn at dev time — and instead keep the small parsed result here with the
 * same TTL semantics. Cleared via clearFeedMemo() from server actions.
 */
interface MemoEntry {
  value: FeedPosting[];
  expiresAt: number;
}
const parsedMemo = new Map<string, MemoEntry>();

export function clearFeedMemo(): void {
  parsedMemo.clear();
}

/* ------------------------------- JSON sources ------------------------------- */

/** vanshb03 schema — one `season` string per row. */
function parseVanshb03(row: RawListing, sourceId: string): FeedPosting | null {
  if (!baseValid(row)) return null;
  if (!isAllowedSeason(row.season)) return null;
  if (!isTargetEngineeringInternshipRole(row.title ?? "", row.season ?? "")) return null;
  return buildPosting(row, sourceId, row.season as FeedSeason);
}

/**
 * SimplifyJobs covers many tracks ("Software", "Product", "AI/ML/Data",
 * "Quant", "Hardware", …) and uses two naming conventions in parallel
 * (legacy short names + newer expanded names). We only want software and
 * quantitative finance roles so this source stays complementary to vanshb03.
 */
const SIMPLIFY_ALLOWED_CATEGORIES = new Set([
  "Software",
  "Software Engineering",
  "Quant",
  "Quantitative Finance",
]);

/** SimplifyJobs schema — `terms` array with "Season Year" strings. */
function parseSimplify(row: RawListing, sourceId: string): FeedPosting | null {
  if (!baseValid(row)) return null;
  if (!SIMPLIFY_ALLOWED_CATEGORIES.has(row.category ?? "")) return null;
  const season = extractSeasonFromTerms(row.terms);
  if (!season) return null;
  if (!isTargetEngineeringInternshipRole(row.title ?? "", row.terms?.join(" ") ?? "")) return null;
  return buildPosting(row, sourceId, season);
}

interface JsonSourceOpts {
  /**
   * Whether to route the HTTP fetch through Next's data cache. Set to false
   * for payloads larger than 2MB (see parsedMemo above) — those get the
   * equivalent TTL via the in-process memo instead.
   */
  useNextCache?: boolean;
}

/** Shared fetcher for JSON-list sources that expose a listings.json. */
async function fetchJsonSource(
  sourceId: string,
  rawUrl: string,
  parseRow: (row: RawListing, sourceId: string) => FeedPosting | null,
  opts: JsonSourceOpts = {},
): Promise<FeedPosting[]> {
  const { useNextCache = true } = opts;

  if (!useNextCache) {
    const now = Date.now();
    const hit = parsedMemo.get(sourceId);
    if (hit && hit.expiresAt > now) return hit.value;
  }

  const init: RequestInit = useNextCache ? CACHE_OPTS : { cache: "no-store" };
  let res: Response;
  try {
    res = await fetchWithTimeout(rawUrl, init);
  } catch (error) {
    logServerEvent({
      level: "warn",
      event: "feed.fetch_failed",
      message: errorMessage(error),
      meta: { sourceId },
    });
    const hit = parsedMemo.get(sourceId);
    if (hit) return hit.value;
    return [];
  }

  if (!res.ok) {
    logServerEvent({
      level: "warn",
      event: "feed.bad_status",
      message: `Feed source returned ${res.status}`,
      meta: { sourceId, status: res.status },
    });
    const hit = parsedMemo.get(sourceId);
    if (hit) return hit.value;
    return [];
  }

  let raw: unknown;
  try {
    raw = await res.json();
  } catch (error) {
    logServerEvent({
      level: "warn",
      event: "feed.parse_failed",
      message: errorMessage(error),
      meta: { sourceId },
    });
    const hit = parsedMemo.get(sourceId);
    if (hit) return hit.value;
    return [];
  }

  if (!Array.isArray(raw)) {
    logServerEvent({
      level: "warn",
      event: "feed.invalid_payload",
      message: "Feed source returned a non-array payload",
      meta: { sourceId },
    });
    const hit = parsedMemo.get(sourceId);
    if (hit) return hit.value;
    return [];
  }

  const postings: FeedPosting[] = [];
  for (const row of raw) {
    const parsed = parseRow(row as RawListing, sourceId);
    if (parsed) postings.push(parsed);
  }

  if (!useNextCache) {
    parsedMemo.set(sourceId, {
      value: postings,
      expiresAt: Date.now() + FEED_REVALIDATE_SECONDS * 1000,
    });
  }

  return postings;
}

/* -------------------------------- sources -------------------------------- */

/**
 * Sources are tried in declaration order. When two sources surface the same
 * posting, the *first* one wins. Keep the higher-quality / more-timely source
 * at the top of the list.
 */
const FEED_SOURCES: readonly FeedSource[] = [
  {
    id: "vanshb03-summer2027",
    label: "vanshb03 / Summer2027-Internships",
    fetch: () =>
      fetchJsonSource(
        "vanshb03-summer2027",
        "https://raw.githubusercontent.com/vanshb03/Summer2027-Internships/dev/.github/scripts/listings.json",
        parseVanshb03,
      ),
  },
  {
    id: "simplifyjobs-summer2026",
    label: "SimplifyJobs / Summer2026-Internships",
    // Raw listings.json is ~20MB which exceeds Next's 2MB fetch-cache limit.
    // Bypass Next's data cache and memoize the *parsed* result instead.
    fetch: () =>
      fetchJsonSource(
        "simplifyjobs-summer2026",
        "https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/.github/scripts/listings.json",
        parseSimplify,
        { useNextCache: false },
      ),
  },
];

/* --------------------------------- fetch --------------------------------- */

/**
 * Canonical-ish URL key used to dedupe postings surfaced by multiple sources.
 * Lowercases host, strips `www.` and trailing slash, drops fragment — enough
 * to collapse near-identical job-board URLs while preserving query params
 * that encode the job ID.
 */
function urlDedupeKey(url: string): string {
  try {
    const u = new URL(url);
    const host = u.host.toLowerCase().replace(/^www\./, "");
    const pathname = u.pathname.replace(/\/+$/, "");
    return `${host}${pathname}${u.search}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

function stableHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function stablePostingId(url: string): string {
  return `job_${stableHash(urlDedupeKey(url))}`;
}

function normalizeDedupeText(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeDedupeTitle(title: string): string {
  return normalizeDedupeText(title)
    .replace(/\bswe\b/g, "software engineer")
    .replace(/\bsoftware engineering internship\b/g, "software engineer intern")
    .replace(/\bsoftware engineering intern\b/g, "software engineer intern")
    .replace(/\binternship\b/g, "intern")
    .replace(/\b(20\d{2})\b/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Cross-source title fingerprint. This deliberately avoids locations and URL
 * hosts because upstream trackers often disagree on both for the same role,
 * but it is only used to merge postings from different source IDs so distinct
 * same-source openings are preserved.
 */
function roleDedupeKey(posting: FeedPosting): string {
  return [
    normalizeDedupeText(posting.company),
    normalizeDedupeTitle(posting.title),
    posting.season,
  ].join("|");
}

function mergePosting(existing: FeedPosting, posting: FeedPosting): FeedPosting {
  const locations = Array.from(new Set([...existing.locations, ...posting.locations]));
  const interactionIds = Array.from(new Set([...existing.interactionIds, ...posting.interactionIds]));
  const countries = Array.from(new Set([...existing.countries, ...posting.countries]));
  return {
    ...existing,
    interactionIds,
    locations,
    countries,
    hasRemote: existing.hasRemote || posting.hasRemote,
    datePosted: Math.max(existing.datePosted, posting.datePosted),
    dateUpdated: Math.max(existing.dateUpdated, posting.dateUpdated),
  };
}

function replacePostingAliases(
  seen: Map<string, FeedPosting>,
  existing: FeedPosting,
  merged: FeedPosting,
): void {
  for (const [aliasKey, aliasPosting] of seen) {
    if (aliasPosting === existing) seen.set(aliasKey, merged);
  }
}

/**
 * Pulls every enabled source in parallel, dedupes across sources, and returns
 * the merged newest-first list.
 *
 * Marked with `unstable_noStore` so Next treats each discover page render as
 * dynamic *at the route level* while the underlying `fetch()` still benefits
 * from time-based revalidation — this avoids the whole page being baked at
 * build time while keeping upstream traffic to once an hour.
 */
export async function fetchFeed(): Promise<FeedPosting[]> {
  unstable_noStore();
  const settled = await Promise.allSettled(
    FEED_SOURCES.map(async (source) => ({
      source,
      postings: await source.fetch(),
    })),
  );
  const batches: FeedPosting[][] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") {
      batches.push(result.value.postings);
    } else {
      logServerEvent({
        level: "warn",
        event: "feed.source_failed",
        message: errorMessage(result.reason),
      });
    }
  }

  // Dedupe by canonical URL and by a conservative company/title/season
  // fingerprint across sources. Iteration is source-order: the first source to
  // surface a posting wins. When a duplicate is found we still roll up dates
  // and locations so age indicators don't go stale if the earlier source falls
  // behind.
  const seen = new Map<string, FeedPosting>();
  const seenByRole = new Map<string, string>();
  for (const batch of batches) {
    for (const posting of batch) {
      const key = urlDedupeKey(posting.url);
      const roleKey = roleDedupeKey(posting);
      const roleUrlKey = seenByRole.get(roleKey);
      const urlExisting = seen.get(key);
      const roleExisting = roleUrlKey ? seen.get(roleUrlKey) : undefined;

      if (urlExisting) {
        const merged = mergePosting(urlExisting, posting);
        replacePostingAliases(seen, urlExisting, merged);
        seen.set(key, merged);
        if (!seenByRole.has(roleKey)) seenByRole.set(roleKey, key);
      } else if (roleExisting && roleExisting.sourceId !== posting.sourceId && roleUrlKey) {
        const merged = mergePosting(roleExisting, posting);
        replacePostingAliases(seen, roleExisting, merged);
        seen.set(roleUrlKey, merged);
        seen.set(key, merged);
        seenByRole.set(roleKey, roleUrlKey);
      } else {
        seen.set(key, posting);
        if (!seenByRole.has(roleKey)) seenByRole.set(roleKey, key);
      }
    }
  }

  const merged = Array.from(new Set(seen.values()));
  merged.sort((a, b) => b.datePosted - a.datePosted);
  return merged;
}
