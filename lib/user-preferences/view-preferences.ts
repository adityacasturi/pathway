import type { SeasonFilter } from "@/lib/config/season-filter";
import { SEASON_FILTER_OPTIONS } from "@/lib/config/season-filter";
import { FEED_SEASONS, type FeedSeason } from "@/lib/feed/types";

const VALID_SEASONS = new Set<SeasonFilter>(SEASON_FILTER_OPTIONS.map((o) => o.value));
const VALID_FEED_SEASONS = new Set<FeedSeason>(FEED_SEASONS);

export interface FeedViewPreferences {
  lastSeenUnix: number;
  hideApplied: boolean;
  selectedSeasons: FeedSeason[];
}

export interface ApplicationsViewPreferences {
  hideRejected: boolean;
  hideArchived: boolean;
}

export type FeedViewPreferencesPatch = {
  lastSeenUnix?: number;
  hideApplied?: boolean;
  selectedSeasons?: FeedSeason[];
};

export type ApplicationsViewPreferencesPatch = {
  hideRejected?: boolean;
  hideArchived?: boolean;
};

export type ParsedFeedViewPreferencesPatch = {
  lastSeenAtIso?: string;
  hideApplied?: boolean;
  selectedSeasons?: FeedSeason[];
};

export type ParsedApplicationsViewPreferencesPatch = {
  hideRejected?: boolean;
  hideArchived?: boolean;
};

export const DEFAULT_FEED_VIEW_PREFERENCES: FeedViewPreferences = {
  lastSeenUnix: 0,
  hideApplied: true,
  selectedSeasons: [],
};

export const DEFAULT_APPLICATIONS_VIEW_PREFERENCES: ApplicationsViewPreferences = {
  hideRejected: true,
  hideArchived: true,
};

export function parseSeasonFilter(value: string | null | undefined): SeasonFilter {
  if (value && VALID_SEASONS.has(value as SeasonFilter)) {
    return value as SeasonFilter;
  }
  return "all";
}

export function parseSelectedSeasons(value: string | null | undefined): FeedSeason[] {
  if (!value || value === "all") return [];

  const seasons: FeedSeason[] = [];
  for (const part of value.split(",")) {
    const season = part.trim();
    if (VALID_FEED_SEASONS.has(season as FeedSeason)) {
      seasons.push(season as FeedSeason);
    }
  }
  return seasons;
}

export function serializeSelectedSeasons(seasons: readonly FeedSeason[]): string {
  if (seasons.length === 0) return "all";
  return Array.from(new Set(seasons))
    .sort((a, b) => FEED_SEASONS.indexOf(a) - FEED_SEASONS.indexOf(b))
    .join(",");
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isFeedSeason(value: unknown): value is FeedSeason {
  return typeof value === "string" && VALID_FEED_SEASONS.has(value as FeedSeason);
}

export function parseFeedViewPreferencesPatch(
  value: unknown,
): { patch: ParsedFeedViewPreferencesPatch } | { error: string } {
  if (!isObjectRecord(value)) {
    return { error: "Invalid feed preferences." };
  }

  const patch: ParsedFeedViewPreferencesPatch = {};

  if ("lastSeenUnix" in value) {
    const unix = value.lastSeenUnix;
    if (typeof unix !== "number" || !Number.isFinite(unix) || unix < 0) {
      return { error: "Invalid last-seen timestamp." };
    }
    const lastSeenAt = new Date(Math.floor(unix) * 1000);
    if (Number.isNaN(lastSeenAt.getTime())) {
      return { error: "Invalid last-seen timestamp." };
    }
    patch.lastSeenAtIso = lastSeenAt.toISOString();
  }

  if ("hideApplied" in value) {
    if (typeof value.hideApplied !== "boolean") {
      return { error: "Invalid applied-postings preference." };
    }
    patch.hideApplied = value.hideApplied;
  }

  if ("selectedSeasons" in value) {
    if (!Array.isArray(value.selectedSeasons) || !value.selectedSeasons.every(isFeedSeason)) {
      return { error: "Invalid season filter." };
    }
    patch.selectedSeasons = Array.from(new Set(value.selectedSeasons));
  }

  if (Object.keys(patch).length === 0) {
    return { error: "No valid feed preferences to update." };
  }

  return { patch };
}

export function parseApplicationsViewPreferencesPatch(
  value: unknown,
): { patch: ParsedApplicationsViewPreferencesPatch } | { error: string } {
  if (!isObjectRecord(value)) {
    return { error: "Invalid application preferences." };
  }

  const patch: ParsedApplicationsViewPreferencesPatch = {};

  if ("hideRejected" in value) {
    if (typeof value.hideRejected !== "boolean") {
      return { error: "Invalid rejected-applications preference." };
    }
    patch.hideRejected = value.hideRejected;
  }

  if ("hideArchived" in value) {
    if (typeof value.hideArchived !== "boolean") {
      return { error: "Invalid archived-applications preference." };
    }
    patch.hideArchived = value.hideArchived;
  }

  if (Object.keys(patch).length === 0) {
    return { error: "No valid application preferences to update." };
  }

  return { patch };
}

export function feedViewPreferencesFromRow(row: {
  live_last_seen_at?: string | null;
  live_hide_applied?: boolean | null;
  live_season_filter?: string | null;
} | null): FeedViewPreferences {
  if (!row) return { ...DEFAULT_FEED_VIEW_PREFERENCES };

  const lastSeenUnix = row.live_last_seen_at
    ? Math.floor(new Date(row.live_last_seen_at).getTime() / 1000)
    : 0;

  return {
    lastSeenUnix: Number.isFinite(lastSeenUnix) ? lastSeenUnix : 0,
    hideApplied: row.live_hide_applied ?? DEFAULT_FEED_VIEW_PREFERENCES.hideApplied,
    selectedSeasons: parseSelectedSeasons(row.live_season_filter),
  };
}

export function applicationsViewPreferencesFromRow(row: {
  hide_rejected?: boolean | null;
  hide_archived?: boolean | null;
} | null): ApplicationsViewPreferences {
  if (!row) return { ...DEFAULT_APPLICATIONS_VIEW_PREFERENCES };
  return {
    hideRejected: row.hide_rejected ?? DEFAULT_APPLICATIONS_VIEW_PREFERENCES.hideRejected,
    hideArchived: row.hide_archived ?? DEFAULT_APPLICATIONS_VIEW_PREFERENCES.hideArchived,
  };
}
