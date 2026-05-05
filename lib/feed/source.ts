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
 *      (canonical-URL key, first source in FEED_SOURCES wins).
 */

import { unstable_noStore } from "next/cache";
import { resolveDiscoverCutoffDate } from "@/lib/config/discover";

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
  sourceId: string;
  company: string;
  title: string;
  url: string;
  locations: string[];
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

export interface FeedSource {
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

function buildPosting(row: RawListing, sourceId: string, season: FeedSeason): FeedPosting {
  return {
    id: row.id as string,
    sourceId,
    company: row.company_name as string,
    title: row.title as string,
    url: row.url as string,
    locations: Array.isArray(row.locations) ? row.locations : [],
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
  return buildPosting(row, sourceId, row.season as FeedSeason);
}

/**
 * SimplifyJobs covers many tracks ("Software", "Product", "AI/ML/Data",
 * "Quant", "Hardware", …) and uses two naming conventions in parallel
 * (legacy short names + newer expanded names). We only want software and
 * quantitative finance roles so this source stays complementary to
 * vanshb03 (SWE) and the Northwestern quant feed.
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
    console.error(`[feed] ${sourceId} fetch failed:`, error);
    const hit = parsedMemo.get(sourceId);
    if (hit) return hit.value;
    return [];
  }

  if (!res.ok) {
    console.error(`[feed] ${sourceId} fetch failed: ${res.status}`);
    const hit = parsedMemo.get(sourceId);
    if (hit) return hit.value;
    return [];
  }

  let raw: unknown;
  try {
    raw = await res.json();
  } catch (error) {
    console.error(`[feed] ${sourceId} JSON parse failed:`, error);
    const hit = parsedMemo.get(sourceId);
    if (hit) return hit.value;
    return [];
  }

  if (!Array.isArray(raw)) {
    console.error(`[feed] ${sourceId} returned a non-array payload`);
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

/* ------------------------- Northwestern Fintech (markdown) ------------------------- */

const NWFT_SOURCE_ID = "northwesternfintech-quant";
const NWFT_README_URL =
  "https://raw.githubusercontent.com/northwesternfintech/2027QuantInternships/main/README.md";
const NWFT_REPO_META_URL =
  "https://api.github.com/repos/northwesternfintech/2027QuantInternships";

/**
 * Sections we don't want to treat as companies (the README is autogenerated
 * but these two are hand-written intro blocks at the top).
 */
const NWFT_NON_COMPANY_SECTIONS = new Set(["contributing", "using this repository"]);

/**
 * Parse the repo's top-level README.md (autogenerated from the YAML files in
 * /data). Format per company:
 *
 *   ## Aquatic
 *   **Website**: [Aquatic](...)
 *   **Locations**: Chicago
 *   **Notes**: ...
 *
 *   |Role|Links|
 *   |----|-----|
 *   |SWE|[✅ ](https://...)|
 *   |QR|[✅ ](https://...)|
 *
 * Most company sections have empty tables (no posted roles yet); we skip
 * those and emit one posting per real table row.
 */
function parseNwftReadme(markdown: string, datePosted: number): FeedPosting[] {
  const postings: FeedPosting[] = [];
  // First chunk before the first "## " is the intro; drop it.
  const sections = markdown.split(/\n## /).slice(1);

  for (const section of sections) {
    const nameMatch = /^([^\n]*)\n/.exec(section);
    const company = nameMatch ? nameMatch[1].trim() : "";
    if (!company) continue;
    if (NWFT_NON_COMPANY_SECTIONS.has(company.toLowerCase())) continue;

    const locMatch = /\*\*Locations\*\*:\s*([^\n]+)/i.exec(section);
    const rawLoc = locMatch ? locMatch[1].trim() : "";
    const locations = rawLoc
      ? rawLoc
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    // Each table data row: |Role|[label](url)|
    const rowRe = /^\|\s*([^|\n]+?)\s*\|\s*\[[^\]]*\]\(([^)\s]+)\)\s*\|/gm;
    let m: RegExpExecArray | null;
    while ((m = rowRe.exec(section)) !== null) {
      const roleType = m[1].trim();
      const url = m[2].trim();
      if (!/^https?:\/\//i.test(url)) continue;
      if (roleType.toLowerCase() === "role") continue; // header row
      if (/^-+$/.test(roleType)) continue; // separator row

      postings.push({
        // Stable id: source + url is enough since the url is unique per role.
        id: `${NWFT_SOURCE_ID}:${url}`,
        sourceId: NWFT_SOURCE_ID,
        company,
        title: `${roleType} Intern`,
        url,
        locations,
        season: "Summer", // repo is Summer 2027 quant cycle
        datePosted,
        dateUpdated: datePosted,
      });
    }
  }
  return postings;
}

/**
 * This repo has no per-posting dates. We anchor `datePosted` to the repo's
 * last push time (one extra GitHub API call per revalidation) so these
 * postings participate sensibly in sort order, the "NEW" badge, and the
 * date-range filters. If the meta fetch fails we fall back to 0 (postings
 * still show under "All time" but get filtered out by date-range pills).
 */
async function fetchNorthwesternQuant(): Promise<FeedPosting[]> {
  let readmeRes: Response;
  let metaRes: Response | null = null;
  try {
    const [readme, meta] = await Promise.all([
      fetchWithTimeout(NWFT_README_URL, CACHE_OPTS),
      fetchWithTimeout(NWFT_REPO_META_URL, {
        ...CACHE_OPTS,
        headers: { Accept: "application/vnd.github+json" },
      }),
    ]);
    readmeRes = readme;
    metaRes = meta;
  } catch (error) {
    console.error(`[feed] ${NWFT_SOURCE_ID} fetch failed:`, error);
    return [];
  }

  if (!readmeRes.ok) {
    console.error(`[feed] ${NWFT_SOURCE_ID} README fetch failed: ${readmeRes.status}`);
    return [];
  }

  let datePosted = 0;
  if (metaRes?.ok) {
    try {
      const meta = (await metaRes.json()) as { pushed_at?: string };
      if (meta.pushed_at) {
        const t = Math.floor(new Date(meta.pushed_at).getTime() / 1000);
        if (Number.isFinite(t)) datePosted = t;
      }
    } catch {
      // fall through with datePosted = 0
    }
  }

  const markdown = await readmeRes.text();
  return parseNwftReadme(markdown, datePosted);
}

/* -------------------------------- sources -------------------------------- */

/**
 * Sources are tried in declaration order. When two sources surface the same
 * posting (matched by canonical URL), the *first* one wins. Keep the higher-
 * quality / more-timely source at the top of the list.
 */
export const FEED_SOURCES: readonly FeedSource[] = [
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
  {
    id: NWFT_SOURCE_ID,
    label: "northwesternfintech / 2027QuantInternships",
    fetch: fetchNorthwesternQuant,
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
      console.error("[feed] source failed:", result.reason);
    }
  }

  // Dedupe by canonical URL. Iteration is source-order: the first source to
  // surface a URL wins. When a duplicate is found we still roll up the most
  // recent `dateUpdated` so age indicators don't go stale if the earlier
  // source falls behind.
  const seen = new Map<string, FeedPosting>();
  for (const batch of batches) {
    for (const posting of batch) {
      const key = urlDedupeKey(posting.url);
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, posting);
      } else if (posting.dateUpdated > existing.dateUpdated) {
        seen.set(key, { ...existing, dateUpdated: posting.dateUpdated });
      }
    }
  }

  const merged = Array.from(seen.values());
  merged.sort((a, b) => b.datePosted - a.datePosted);
  return merged;
}
