import { formatDistanceToNowStrict } from "date-fns";
import type { PostedDateConfidence, PostedDateSource } from "../scraping/posted-date.ts";
import { isPublishSource } from "../scraping/posted-date.ts";

export type PostedDisplayKind = "posted" | "added" | "none";

export interface PostedDisplay {
  kind: PostedDisplayKind;
  unixSeconds: number;
  confidence: PostedDateConfidence;
}

export interface PostedDateRowFields {
  date_posted: string | null;
  date_posted_source: PostedDateSource;
  date_posted_confidence: PostedDateConfidence;
  first_seen_at: string;
}

/** Parse an ISO timestamp to whole Unix seconds, returning 0 when invalid. */
export function toUnixSeconds(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

function showPostedLabel(
  source: PostedDateSource,
  confidence: PostedDateConfidence,
  datePostedUnix: number,
): boolean {
  if (datePostedUnix <= 0) {
    return false;
  }
  if (!isPublishSource(source)) {
    return false;
  }
  return confidence === "high" || confidence === "medium";
}

export function resolvePathwayNewUnix(row: { first_seen_at: string }): number {
  return toUnixSeconds(row.first_seen_at);
}

/** Sort order — publish date when credible, else first_seen_at. */
export function resolveEffectivePostedUnix(row: PostedDateRowFields): number {
  const postedUnix = toUnixSeconds(row.date_posted);
  if (showPostedLabel(row.date_posted_source, row.date_posted_confidence, postedUnix)) {
    return postedUnix;
  }
  return toUnixSeconds(row.first_seen_at);
}

export function resolvePostedDisplay(row: PostedDateRowFields): PostedDisplay {
  const postedUnix = toUnixSeconds(row.date_posted);
  if (showPostedLabel(row.date_posted_source, row.date_posted_confidence, postedUnix)) {
    return {
      kind: "posted",
      unixSeconds: postedUnix,
      confidence: row.date_posted_confidence,
    };
  }

  const addedUnix = toUnixSeconds(row.first_seen_at);
  if (addedUnix > 0) {
    return {
      kind: "added",
      unixSeconds: addedUnix,
      confidence: "unknown",
    };
  }

  return { kind: "none", unixSeconds: 0, confidence: "unknown" };
}

export function formatPostedDisplayLabel(kind: PostedDisplayKind): string {
  switch (kind) {
    case "posted":
      return "Posted";
    case "added":
      return "Discovered";
    default:
      return "";
  }
}

/** User-facing relative time for listing rows (no Posted/Discovered prefix). */
export function formatPostingRelativeTime(display: PostedDisplay): string {
  if (display.kind === "none" || display.unixSeconds <= 0) {
    return "";
  }
  try {
    return formatDistanceToNowStrict(new Date(display.unixSeconds * 1000), {
      addSuffix: true,
    }).replace("about ", "");
  } catch {
    return "";
  }
}
