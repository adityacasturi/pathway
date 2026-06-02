import type { SeasonFilter } from "@/lib/config/season-filter";
import { SEASON_FILTER_OPTIONS } from "@/lib/config/season-filter";

const VALID_SEASONS = new Set<SeasonFilter>(SEASON_FILTER_OPTIONS.map((o) => o.value));

export interface FeedViewPreferences {
  lastSeenUnix: number;
  showDismissed: boolean;
  hideApplied: boolean;
  seasonFilter: SeasonFilter;
}

export interface ApplicationsViewPreferences {
  hideRejected: boolean;
  hideArchived: boolean;
}

export const DEFAULT_FEED_VIEW_PREFERENCES: FeedViewPreferences = {
  lastSeenUnix: 0,
  showDismissed: false,
  hideApplied: true,
  seasonFilter: "all",
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

export function feedViewPreferencesFromRow(row: {
  live_last_seen_at?: string | null;
  live_show_dismissed?: boolean | null;
  live_hide_applied?: boolean | null;
  live_season_filter?: string | null;
} | null): FeedViewPreferences {
  if (!row) return { ...DEFAULT_FEED_VIEW_PREFERENCES };

  const lastSeenUnix = row.live_last_seen_at
    ? Math.floor(new Date(row.live_last_seen_at).getTime() / 1000)
    : 0;

  return {
    lastSeenUnix: Number.isFinite(lastSeenUnix) ? lastSeenUnix : 0,
    showDismissed: row.live_show_dismissed ?? DEFAULT_FEED_VIEW_PREFERENCES.showDismissed,
    hideApplied: row.live_hide_applied ?? DEFAULT_FEED_VIEW_PREFERENCES.hideApplied,
    seasonFilter: parseSeasonFilter(row.live_season_filter),
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
