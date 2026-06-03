import { SEASON_FILTER_OPTIONS, type SeasonFilter } from "@/lib/config/season-filter";
import type {
  ApplicationsViewPreferences,
  FeedViewPreferences,
} from "@/lib/user-preferences/view-preferences";

export interface BrowserStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

const VALID_SEASONS = new Set<SeasonFilter>(SEASON_FILTER_OPTIONS.map((option) => option.value));

const FEED_STORAGE_KEYS = [
  "pathway:feed-last-seen-at",
  "pathway:live-show-dismissed",
  "pathway:live-hide-applied",
  "pathway:live-season",
  "pathway:discover-show-dismissed",
  "pathway:discover-hide-applied",
  "pathway:discover-season",
] as const;

const APPLICATIONS_STORAGE_KEYS = [
  "pathway:hide-rejected",
  "pathway:hide-archived",
] as const;

function readStorageValue(storage: Pick<BrowserStorage, "getItem">, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function removeStorageValue(storage: Pick<BrowserStorage, "removeItem">, key: string) {
  try {
    storage.removeItem(key);
  } catch {
    // Browser storage can throw in private mode or when quota handling is broken.
  }
}

function firstStoredValue(
  storage: Pick<BrowserStorage, "getItem">,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = readStorageValue(storage, key);
    if (value !== null) return value;
  }
  return null;
}

function hasStoredValue(storage: Pick<BrowserStorage, "getItem">, keys: readonly string[]) {
  return keys.some((key) => readStorageValue(storage, key) !== null);
}

export function readStoredFeedViewPreferences(
  storage: Pick<BrowserStorage, "getItem"> | null,
  initialFeedPrefs: FeedViewPreferences,
): { preferences: FeedViewPreferences; hasStoredPreferences: boolean } {
  if (!storage) {
    return { preferences: initialFeedPrefs, hasStoredPreferences: false };
  }

  const storedLastSeen = readStorageValue(storage, "pathway:feed-last-seen-at");
  const parsedLastSeen = storedLastSeen ? Number.parseInt(storedLastSeen, 10) : NaN;
  const lastSeenUnix =
    Number.isFinite(parsedLastSeen) && parsedLastSeen > initialFeedPrefs.lastSeenUnix
      ? parsedLastSeen
      : initialFeedPrefs.lastSeenUnix;

  const dismissPref = firstStoredValue(storage, [
    "pathway:live-show-dismissed",
    "pathway:discover-show-dismissed",
  ]);
  const showDismissed =
    dismissPref === "1" && !initialFeedPrefs.showDismissed
      ? true
      : initialFeedPrefs.showDismissed;

  const hideAppliedPref = firstStoredValue(storage, [
    "pathway:live-hide-applied",
    "pathway:discover-hide-applied",
  ]);
  const hideApplied =
    hideAppliedPref === "0" && initialFeedPrefs.hideApplied
      ? false
      : hideAppliedPref === "1" && !initialFeedPrefs.hideApplied
        ? true
        : initialFeedPrefs.hideApplied;

  const seasonPref = firstStoredValue(storage, [
    "pathway:live-season",
    "pathway:discover-season",
  ]);
  let seasonFilter = initialFeedPrefs.seasonFilter;
  if (seasonPref && VALID_SEASONS.has(seasonPref as SeasonFilter)) {
    seasonFilter = seasonPref as SeasonFilter;
  } else if (seasonPref?.includes(",")) {
    const first = seasonPref.split(",")[0]?.trim();
    if (first && VALID_SEASONS.has(first as SeasonFilter)) {
      seasonFilter = first as SeasonFilter;
    }
  }

  return {
    preferences: { lastSeenUnix, showDismissed, hideApplied, seasonFilter },
    hasStoredPreferences: hasStoredValue(storage, FEED_STORAGE_KEYS),
  };
}

export function readStoredApplicationsViewPreferences(
  storage: Pick<BrowserStorage, "getItem"> | null,
  initialViewPrefs: ApplicationsViewPreferences,
): { preferences: ApplicationsViewPreferences; hasStoredPreferences: boolean } {
  if (!storage) {
    return { preferences: initialViewPrefs, hasStoredPreferences: false };
  }

  const storedRejected = readStorageValue(storage, "pathway:hide-rejected");
  const storedArchived = readStorageValue(storage, "pathway:hide-archived");

  return {
    preferences: {
      hideRejected:
        storedRejected === "false" && initialViewPrefs.hideRejected
          ? false
          : initialViewPrefs.hideRejected,
      hideArchived:
        storedArchived === "false" && initialViewPrefs.hideArchived
          ? false
          : initialViewPrefs.hideArchived,
    },
    hasStoredPreferences: hasStoredValue(storage, APPLICATIONS_STORAGE_KEYS),
  };
}

export function clearStoredFeedViewPreferences(
  storage: Pick<BrowserStorage, "removeItem"> | null,
) {
  if (!storage) return;
  FEED_STORAGE_KEYS.forEach((key) => removeStorageValue(storage, key));
}

export function clearStoredApplicationsViewPreferences(
  storage: Pick<BrowserStorage, "removeItem"> | null,
) {
  if (!storage) return;
  APPLICATIONS_STORAGE_KEYS.forEach((key) => removeStorageValue(storage, key));
}
