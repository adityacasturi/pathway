/**
 * Posted-date normalization, classification, and upsert merge for scraped_postings.
 */

export type PostedDateSource =
  | "ats_publish"
  | "ats_modified"
  | "page"
  | "sitemap"
  | "relative_parse"
  | "inferred"
  | "unknown";

export type PostedDateConfidence = "high" | "medium" | "low" | "unknown";

export interface ScrapedRoleDates {
  published: string | null;
  modified?: string | null;
  source: PostedDateSource;
  confidence: PostedDateConfidence;
  /** Optional raw ATS string (e.g. Workday "Posted 3 days ago"). */
  raw?: string | null;
}

export interface StoredPostingDateState {
  date_posted: string | null;
  date_modified: string | null;
  date_posted_source: PostedDateSource;
  date_posted_confidence: PostedDateConfidence;
  date_posted_raw: string | null;
}

export type MergedPostingDateState = StoredPostingDateState;

const MIN_POSTED_MS = Date.parse("2015-01-01T00:00:00.000Z");
const FUTURE_SKEW_MS = 5 * 60 * 1000;
const LOW_CONFIDENCE_FIRST_SEEN_SLACK_MS = 7 * 24 * 60 * 60 * 1000;

const SOURCE_RANK: Record<PostedDateSource, number> = {
  ats_publish: 6,
  page: 5,
  relative_parse: 3,
  inferred: 2,
  ats_modified: 1,
  sitemap: 0,
  unknown: -1,
};

const CONFIDENCE_RANK: Record<PostedDateConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
  unknown: 0,
};

export function isPublishSource(source: PostedDateSource): boolean {
  return source === "ats_publish" || source === "page" || source === "relative_parse";
}

export function isModifiedOnlySource(source: PostedDateSource): boolean {
  return source === "ats_modified";
}

export function normalizeIsoTimestamp(
  value: unknown,
  referenceNow: Date = new Date(),
): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const ms = date.getTime();
  if (ms < MIN_POSTED_MS) {
    return null;
  }

  const maxMs = referenceNow.getTime() + FUTURE_SKEW_MS;
  if (ms > maxMs) {
    return null;
  }

  return date.toISOString();
}

export function atsPublishDate(
  published: string | null,
  confidence: PostedDateConfidence = "high",
  raw?: string | null,
): ScrapedRoleDates {
  const normalized = published ? normalizeIsoTimestamp(published) : null;
  if (!normalized) {
    return unknownScrapedDates();
  }
  return {
    published: normalized,
    modified: null,
    source: "ats_publish",
    confidence,
    raw: raw ?? null,
  };
}

export function pagePublishDate(
  published: string | null,
  confidence: PostedDateConfidence = "medium",
): ScrapedRoleDates {
  const normalized = published ? normalizeIsoTimestamp(published) : null;
  if (!normalized) {
    return unknownScrapedDates();
  }
  return {
    published: normalized,
    source: "page",
    confidence,
  };
}

export function relativeParseDate(
  published: string | null,
  raw?: string | null,
  confidence: PostedDateConfidence = "medium",
): ScrapedRoleDates {
  const normalized = published ? normalizeIsoTimestamp(published) : null;
  if (!normalized) {
    return unknownScrapedDates();
  }
  return {
    published: normalized,
    source: "relative_parse",
    confidence,
    raw: raw ?? null,
  };
}

export function atsModifiedOnly(modified: string | null): ScrapedRoleDates {
  const normalized = modified ? normalizeIsoTimestamp(modified) : null;
  return {
    published: null,
    modified: normalized,
    source: "ats_modified",
    confidence: "unknown",
  };
}

/** Parse common ATS / careers date strings (ISO, RFC, "DD-Mon-YYYY", portal timestamps). */
export function parseFlexiblePostedDate(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }

  const trimmed = value.trim();
  const direct = normalizeIsoTimestamp(trimmed);
  if (direct) {
    return direct;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return normalizeIsoTimestamp(parsed);
  }

  return null;
}

/**
 * Sitemap lastmod as a conservative publish estimate (low confidence) when ISO-parseable.
 * Prefer over {@link sitemapScrapedDates} when the feed only exposes lastmod.
 */
export function sitemapLastmodPublishDate(lastmod: string | null | undefined): ScrapedRoleDates {
  const published = parseFlexiblePostedDate(lastmod ?? null);
  if (!published) {
    return sitemapScrapedDates(lastmod ?? null);
  }
  return {
    published,
    modified: published,
    source: "relative_parse",
    confidence: "low",
    raw: lastmod ?? null,
  };
}

/** Sitemap lastmod — never treated as publish in UI. */
export function sitemapScrapedDates(lastmod: string | null): ScrapedRoleDates {
  const normalized = lastmod ? normalizeIsoTimestamp(lastmod) : null;
  return {
    published: null,
    modified: normalized,
    source: "sitemap",
    confidence: "low",
  };
}

export function unknownScrapedDates(): ScrapedRoleDates {
  return {
    published: null,
    modified: null,
    source: "unknown",
    confidence: "unknown",
  };
}

/** Prefer publish from ATS; optional modified touch time. */
export function atsPublishWithModified(
  published: string | null,
  modified: string | null | undefined,
  confidence: PostedDateConfidence = "high",
): ScrapedRoleDates {
  const pub = published ? normalizeIsoTimestamp(published) : null;
  const mod = modified ? normalizeIsoTimestamp(modified) : null;
  if (pub) {
    return {
      published: pub,
      modified: mod,
      source: "ats_publish",
      confidence,
    };
  }
  if (mod) {
    return atsModifiedOnly(mod);
  }
  return unknownScrapedDates();
}

const GREENHOUSE_PUBLISH_METADATA =
  /^(first\s*published|published|open\s*date|posting\s*date|start\s*date|date\s*posted|post\s*date)$/i;

function greenhouseMetadataString(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "";
}

export function greenhouseRoleDates(job: {
  first_published?: string;
  updated_at?: string;
  metadata?: Array<{ name?: string; value?: unknown }>;
}): ScrapedRoleDates {
  let published = job.first_published
    ? normalizeIsoTimestamp(job.first_published)
    : null;

  for (const entry of job.metadata ?? []) {
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    const value = greenhouseMetadataString(entry.value);
    if (!name || !value || !GREENHOUSE_PUBLISH_METADATA.test(name)) {
      continue;
    }
    published = earliestIso(published, normalizeIsoTimestamp(value));
  }

  const modified = job.updated_at ? normalizeIsoTimestamp(job.updated_at) : null;
  if (published) {
    return {
      published,
      modified,
      source: "ats_publish",
      confidence: "high",
    };
  }
  if (modified) {
    return atsModifiedOnly(modified);
  }
  return unknownScrapedDates();
}

function parseTime(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function earliestIso(a: string | null, b: string | null): string | null {
  const aMs = parseTime(a);
  const bMs = parseTime(b);
  if (aMs === null) return b;
  if (bMs === null) return a;
  return aMs <= bMs ? a : b;
}

function latestIso(a: string | null, b: string | null): string | null {
  const aMs = parseTime(a);
  const bMs = parseTime(b);
  if (aMs === null) return b;
  if (bMs === null) return a;
  return aMs >= bMs ? a : b;
}

function betterSource(existing: PostedDateSource, incoming: PostedDateSource): PostedDateSource {
  return SOURCE_RANK[incoming] > SOURCE_RANK[existing] ? incoming : existing;
}

function betterConfidence(
  existing: PostedDateConfidence,
  incoming: PostedDateConfidence,
): PostedDateConfidence {
  return CONFIDENCE_RANK[incoming] > CONFIDENCE_RANK[existing] ? incoming : existing;
}

function incomingCanSetPublish(incoming: ScrapedRoleDates): boolean {
  return isPublishSource(incoming.source) && incoming.published !== null;
}

function incomingCanReplacePublish(
  existing: StoredPostingDateState,
  incoming: ScrapedRoleDates,
): boolean {
  if (!incomingCanSetPublish(incoming)) {
    return false;
  }
  if (existing.date_posted === null) {
    return true;
  }
  if (existing.date_posted_source === "unknown") {
    return true;
  }
  if (SOURCE_RANK[incoming.source] > SOURCE_RANK[existing.date_posted_source]) {
    return true;
  }
  if (
    incoming.source === existing.date_posted_source &&
    CONFIDENCE_RANK[incoming.confidence] > CONFIDENCE_RANK[existing.date_posted_confidence]
  ) {
    return true;
  }
  return false;
}

function applyLowConfidenceCap(
  published: string | null,
  source: PostedDateSource,
  confidence: PostedDateConfidence,
  firstSeenAt: string,
  now: Date,
): { published: string | null; source: PostedDateSource; confidence: PostedDateConfidence } {
  if (!published) {
    return { published, source, confidence };
  }

  const pubMs = parseTime(published);
  const seenMs = parseTime(firstSeenAt);
  if (pubMs === null || seenMs === null) {
    return { published, source, confidence };
  }

  if (
    confidence === "low" &&
    pubMs > seenMs + LOW_CONFIDENCE_FIRST_SEEN_SLACK_MS
  ) {
    return {
      published: normalizeIsoTimestamp(firstSeenAt, now),
      source: "inferred",
      confidence: "low",
    };
  }

  const nowMs = now.getTime();
  if (pubMs > nowMs + FUTURE_SKEW_MS) {
    return { published: null, source: "unknown", confidence: "unknown" };
  }

  return { published, source, confidence };
}

export function mergeScrapedPostingDates(
  existing: StoredPostingDateState | null,
  incoming: ScrapedRoleDates,
  firstSeenAt: string,
  now: Date = new Date(),
): MergedPostingDateState {
  const base: StoredPostingDateState = existing ?? {
    date_posted: null,
    date_modified: null,
    date_posted_source: "unknown",
    date_posted_confidence: "unknown",
    date_posted_raw: null,
  };

  let date_posted = base.date_posted;
  let date_posted_source = base.date_posted_source;
  let date_posted_confidence = base.date_posted_confidence;
  let date_posted_raw = base.date_posted_raw;
  let date_modified = base.date_modified;

  const incomingPublished = incoming.published
    ? normalizeIsoTimestamp(incoming.published, now)
    : null;
  const incomingModified = incoming.modified
    ? normalizeIsoTimestamp(incoming.modified, now)
    : null;

  if (incomingModified) {
    date_modified = latestIso(date_modified, incomingModified);
  }

  if (isModifiedOnlySource(incoming.source)) {
    // Touch modified only; preserve publish fields.
  } else if (incoming.source === "sitemap") {
    if (incomingPublished && date_posted === null) {
      // Store sitemap time only when we have no publish estimate (still not shown as Posted).
      date_posted = incomingPublished;
      date_posted_source = "sitemap";
      date_posted_confidence = "low";
    }
    if (incoming.raw) {
      date_posted_raw = incoming.raw;
    }
  } else if (incomingCanSetPublish(incoming) && incomingPublished) {
    if (incomingCanReplacePublish(base, incoming)) {
      date_posted = incomingPublished;
      date_posted_source = incoming.source;
      date_posted_confidence = incoming.confidence;
      date_posted_raw = incoming.raw ?? date_posted_raw;
    } else if (date_posted !== null) {
      date_posted = earliestIso(date_posted, incomingPublished);
      date_posted_source = betterSource(date_posted_source, incoming.source);
      date_posted_confidence = betterConfidence(date_posted_confidence, incoming.confidence);
      if (incoming.raw) {
        date_posted_raw = incoming.raw;
      }
    }
  } else if (incoming.source === "unknown" && incomingPublished === null) {
    // Preserve existing.
  }

  const capped = applyLowConfidenceCap(
    date_posted,
    date_posted_source,
    date_posted_confidence,
    firstSeenAt,
    now,
  );
  date_posted = capped.published;
  date_posted_source = capped.source;
  date_posted_confidence = capped.confidence;

  if (date_posted_source === "sitemap" || date_posted_source === "ats_modified") {
    // Never keep a publish display for non-publish sources (clear conflated legacy rows on merge).
    if (!isPublishSource(incoming.source) || incoming.published === null) {
      if (date_posted_source === "ats_modified" || date_posted_source === "sitemap") {
        date_posted = null;
        date_posted_confidence = "unknown";
      }
    }
  }

  // After backfill, ats_modified/sitemap may still have date_posted set — clear for display merge output.
  if (date_posted_source === "ats_modified" || date_posted_source === "sitemap") {
    date_posted = null;
    date_posted_confidence = date_posted_source === "sitemap" ? "low" : "unknown";
  }

  return {
    date_posted,
    date_modified,
    date_posted_source,
    date_posted_confidence,
    date_posted_raw,
  };
}

/** Normalize legacy adapter output during migration. */
export function coerceScrapedRoleDates(
  dates: ScrapedRoleDates | undefined,
  legacyDatePosted: string | null | undefined,
): ScrapedRoleDates {
  if (dates) {
    return dates;
  }
  if (legacyDatePosted) {
    const published = normalizeIsoTimestamp(legacyDatePosted);
    if (published) {
      return {
        published,
        source: "ats_publish",
        confidence: "low",
      };
    }
  }
  return unknownScrapedDates();
}

/** Published ISO from a scraped role (structured dates preferred). */
export function scrapedRolePublishedIso(
  role: { dates?: ScrapedRoleDates; datePosted: string | null },
): string | null {
  return role.dates?.published ?? role.datePosted;
}

export function countRoleDateStats(roles: { dates: ScrapedRoleDates }[]): {
  datesPublishCount: number;
  datesModifiedOnlyCount: number;
  datesUnknownCount: number;
} {
  let datesPublishCount = 0;
  let datesModifiedOnlyCount = 0;
  let datesUnknownCount = 0;

  for (const role of roles) {
    const { dates } = role;
    if (isPublishSource(dates.source) && dates.published) {
      datesPublishCount++;
    } else if (isModifiedOnlySource(dates.source) || (dates.modified && !dates.published)) {
      datesModifiedOnlyCount++;
    } else {
      datesUnknownCount++;
    }
  }

  return { datesPublishCount, datesModifiedOnlyCount, datesUnknownCount };
}
