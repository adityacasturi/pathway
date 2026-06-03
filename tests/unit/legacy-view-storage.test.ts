import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearStoredApplicationsViewPreferences,
  clearStoredFeedViewPreferences,
  readStoredApplicationsViewPreferences,
  readStoredFeedViewPreferences,
} from "../../lib/user-preferences/legacy-view-storage.ts";
import type {
  ApplicationsViewPreferences,
  FeedViewPreferences,
} from "../../lib/user-preferences/view-preferences.ts";

class MemoryStorage {
  values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

const feedDefaults: FeedViewPreferences = {
  lastSeenUnix: 100,
  showDismissed: false,
  hideApplied: true,
  seasonFilter: "all",
};

const applicationDefaults: ApplicationsViewPreferences = {
  hideRejected: true,
  hideArchived: true,
};

describe("readStoredFeedViewPreferences", () => {
  it("imports legacy Live and Discover filter keys once", () => {
    const storage = new MemoryStorage();
    storage.values.set("pathway:feed-last-seen-at", "200");
    storage.values.set("pathway:discover-show-dismissed", "1");
    storage.values.set("pathway:discover-hide-applied", "0");
    storage.values.set("pathway:discover-season", "Fall,Summer");

    const result = readStoredFeedViewPreferences(storage, feedDefaults);

    assert.equal(result.hasStoredPreferences, true);
    assert.deepEqual(result.preferences, {
      lastSeenUnix: 200,
      showDismissed: true,
      hideApplied: false,
      seasonFilter: "Fall",
    });
  });

  it("does not let older or invalid values override persisted defaults", () => {
    const storage = new MemoryStorage();
    storage.values.set("pathway:feed-last-seen-at", "50");
    storage.values.set("pathway:live-season", "Invalid");

    const result = readStoredFeedViewPreferences(storage, feedDefaults);

    assert.equal(result.hasStoredPreferences, true);
    assert.deepEqual(result.preferences, feedDefaults);
  });
});

describe("clearStoredFeedViewPreferences", () => {
  it("removes current and legacy feed keys", () => {
    const storage = new MemoryStorage();
    storage.values.set("pathway:live-show-dismissed", "1");
    storage.values.set("pathway:discover-show-dismissed", "1");
    storage.values.set("pathway:feed-last-seen-at", "200");

    clearStoredFeedViewPreferences(storage);

    assert.equal(storage.values.size, 0);
  });
});

describe("readStoredApplicationsViewPreferences", () => {
  it("imports legacy application hidden-row keys", () => {
    const storage = new MemoryStorage();
    storage.values.set("pathway:hide-rejected", "false");
    storage.values.set("pathway:hide-archived", "false");

    const result = readStoredApplicationsViewPreferences(storage, applicationDefaults);

    assert.equal(result.hasStoredPreferences, true);
    assert.deepEqual(result.preferences, {
      hideRejected: false,
      hideArchived: false,
    });
  });
});

describe("clearStoredApplicationsViewPreferences", () => {
  it("removes legacy application keys", () => {
    const storage = new MemoryStorage();
    storage.values.set("pathway:hide-rejected", "false");
    storage.values.set("pathway:hide-archived", "false");

    clearStoredApplicationsViewPreferences(storage);

    assert.equal(storage.values.size, 0);
  });
});
