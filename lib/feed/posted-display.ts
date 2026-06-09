import { formatDistanceToNowStrict } from "date-fns";

export type PostedDisplayKind = "posted" | "added" | "none";

export interface PostedDisplay {
  kind: PostedDisplayKind;
  unixSeconds: number;
}

export interface PostedDateRowFields {
  first_seen_at: string;
}

/** Parse an ISO timestamp to whole Unix seconds, returning 0 when invalid. */
export function toUnixSeconds(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

export function resolvePathwayNewUnix(row: { first_seen_at: string }): number {
  return toUnixSeconds(row.first_seen_at);
}

/** Sort order — always `first_seen_at` (Pathway first-scrape time). */
export function resolveEffectivePostedUnix(row: PostedDateRowFields): number {
  return toUnixSeconds(row.first_seen_at);
}

export function resolvePostedDisplay(row: PostedDateRowFields): PostedDisplay {
  const firstSeenUnix = toUnixSeconds(row.first_seen_at);
  if (firstSeenUnix > 0) {
    return {
      kind: "added",
      unixSeconds: firstSeenUnix,
    };
  }

  return { kind: "none", unixSeconds: 0 };
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
