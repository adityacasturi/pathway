import type {
  ApplicationsViewPreferences,
  FeedViewPreferences,
} from "@/lib/user-preferences/view-preferences";
import { parseSelectedSeasons } from "@/lib/user-preferences/view-preferences";

export interface BrowserStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

const FEED_STORAGE_KEYS = [
  "pathway:live-hide-applied",
  "pathway:live-season",
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
  const selectedSeasons = seasonPref
    ? parseSelectedSeasons(seasonPref)
    : initialFeedPrefs.selectedSeasons;

  return {
    preferences: { hideApplied, selectedSeasons },
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
