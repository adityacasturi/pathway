import type { ScrapedRole, ScrapedSeason } from "./types.ts";

const REPUBLISH_UPDATE_GAP_MS = 24 * 60 * 60 * 1000;
const SEASON_SIGNAL_PATTERNS: Record<ScrapedSeason, RegExp> = {
  Fall: /\b(fall|autumn)\b/i,
  Spring: /\bspring\b/i,
  Summer: /\bsummer\b/i,
  Winter: /\bwinter\b/i,
};

export interface ExistingPostingSnapshot {
  id?: string;
  posting_url?: string | null;
  first_seen_at: string;
  posted_at?: string | null;
  role_name?: string | null;
  season?: ScrapedSeason | string | null;
  status?: string | null;
  last_seen_at?: string | null;
}

export interface PostedAtDecision {
  postedAt: string;
  republished: boolean;
}

export function resolvePostedAt(
  existing: ExistingPostingSnapshot | undefined,
  role: Pick<ScrapedRole, "season" | "atsDates"> & Partial<Pick<ScrapedRole, "roleName" | "description">>,
  now: string,
): PostedAtDecision {
  if (!existing) {
    return { postedAt: now, republished: false };
  }

  const previousPostedAt = normalizeStoredDate(existing.posted_at) ?? normalizeStoredDate(existing.first_seen_at) ?? now;
  const staleCurrentProgramUpdate = resolveStaleCurrentProgramUpdate(role, previousPostedAt);
  if (staleCurrentProgramUpdate) {
    return { postedAt: staleCurrentProgramUpdate, republished: true };
  }

  if (hasSeasonChanged(existing, role)) {
    const atsUpdatedAt = normalizeAtsUpdatedAt(role, previousPostedAt);
    if (atsUpdatedAt) {
      return { postedAt: atsUpdatedAt, republished: true };
    }

    const nowMs = Date.parse(now);
    const previousMs = Date.parse(previousPostedAt);
    if (Number.isFinite(nowMs) && Number.isFinite(previousMs) && nowMs > previousMs) {
      return { postedAt: now, republished: true };
    }
  }

  return { postedAt: previousPostedAt, republished: false };
}

function resolveStaleCurrentProgramUpdate(
  role: Pick<ScrapedRole, "atsDates"> & Partial<Pick<ScrapedRole, "roleName" | "description">>,
  previousPostedAt: string,
): string | null {
  const programYear = extractExplicitProgramYear(role);
  if (!programYear) {
    return null;
  }

  const previousMs = parseTimestampMs(previousPostedAt);
  if (previousMs === null) {
    return null;
  }

  const earliestPlausibleMs = Date.UTC(programYear - 1, 0, 1);
  if (previousMs >= earliestPlausibleMs) {
    return null;
  }

  const updatedMs = parseTimestampMs(role.atsDates?.updatedAt);
  if (updatedMs === null || updatedMs <= previousMs || updatedMs < earliestPlausibleMs) {
    return null;
  }

  return new Date(updatedMs).toISOString();
}

function normalizeStoredDate(value: string | null | undefined): string | null {
  const ms = parseTimestampMs(value);
  return ms === null ? null : new Date(ms).toISOString();
}

function normalizeAtsUpdatedAt(
  role: Pick<ScrapedRole, "atsDates">,
  previousPostedAt: string,
): string | null {
  const updatedMs = parseTimestampMs(role.atsDates?.updatedAt);
  if (updatedMs === null) {
    return null;
  }

  const previousMs = parseTimestampMs(previousPostedAt);
  if (previousMs === null || updatedMs <= previousMs) {
    return null;
  }

  const publishedMs = parseTimestampMs(role.atsDates?.publishedAt);
  if (publishedMs !== null && updatedMs - publishedMs < REPUBLISH_UPDATE_GAP_MS) {
    return null;
  }

  return new Date(updatedMs).toISOString();
}

function hasSeasonChanged(
  existing: ExistingPostingSnapshot,
  role: Pick<ScrapedRole, "season"> & Partial<Pick<ScrapedRole, "roleName" | "description">>,
): boolean {
  const previousSeason = normalizeSeason(existing.season);
  const nextSeason = normalizeSeason(role.season);
  return Boolean(
    previousSeason &&
      nextSeason &&
      previousSeason !== nextSeason &&
      hasExplicitSeasonSignal({ roleName: existing.role_name ?? undefined }, previousSeason) &&
      hasExplicitSeasonSignal(role, nextSeason),
  );
}

function normalizeSeason(value: string | null | undefined): ScrapedSeason | null {
  const trimmed = value?.trim();
  if (
    trimmed === "Summer" ||
    trimmed === "Fall" ||
    trimmed === "Spring" ||
    trimmed === "Winter"
  ) {
    return trimmed;
  }
  return null;
}

function hasExplicitSeasonSignal(
  role: Partial<Pick<ScrapedRole, "roleName" | "description">>,
  season: ScrapedSeason,
): boolean {
  const haystack = [role.roleName, role.description].map((value) => value?.trim()).filter(Boolean).join(" ");
  if (!haystack) {
    return false;
  }
  return SEASON_SIGNAL_PATTERNS[season].test(haystack);
}

function extractExplicitProgramYear(
  role: Partial<Pick<ScrapedRole, "roleName" | "description">>,
): number | null {
  const haystack = [role.roleName, role.description].map((value) => value?.trim()).filter(Boolean).join(" ");
  if (!haystack) {
    return null;
  }

  const match = haystack.match(/\b(?:fall|autumn|spring|summer|winter)\W{0,16}(20\d{2})\b/i)
    ?? haystack.match(/\b(20\d{2})\W{0,16}(?:fall|autumn|spring|summer|winter)\b/i);
  if (!match?.[1]) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  return Number.isFinite(year) ? year : null;
}

function parseTimestampMs(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}
