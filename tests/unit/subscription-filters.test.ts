import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_ALERT_FILTERS, type AlertFilters } from "../../lib/alerts/filters.ts";
import {
  isSubscriptionFieldCustomized,
  isSubscriptionFiltersCustomized,
  resolveSubscriptionFieldOverride,
  subscriptionFieldValuesMatchDefault,
} from "../../lib/alerts/subscription-filters.ts";

const globalWithSeasons: AlertFilters = {
  ...DEFAULT_ALERT_FILTERS,
  seasons: ["Summer", "Winter"],
};

const globalWithCountries: AlertFilters = {
  ...DEFAULT_ALERT_FILTERS,
  countries: ["US", "CA"],
};

test("subscriptionFieldValuesMatchDefault compares against global view values", () => {
  assert.equal(
    subscriptionFieldValuesMatchDefault(globalWithSeasons, "seasons", ["Winter", "Summer"]),
    true,
  );
  assert.equal(
    subscriptionFieldValuesMatchDefault(globalWithSeasons, "seasons", ["Summer"]),
    false,
  );
  assert.equal(
    subscriptionFieldValuesMatchDefault(globalWithCountries, "countries", ["US", "CA"]),
    true,
  );
});

test("resolveSubscriptionFieldOverride clears field when values match defaults", () => {
  assert.deepEqual(
    resolveSubscriptionFieldOverride(
      { seasons: ["Summer"] },
      globalWithSeasons,
      { field: "seasons", values: ["Summer", "Winter"] },
    ),
    null,
  );
  assert.deepEqual(
    resolveSubscriptionFieldOverride(
      { seasons: ["Summer"], countries: ["IE"] },
      globalWithSeasons,
      { field: "seasons", values: ["Summer", "Winter"] },
    ),
    { countries: ["IE"] },
  );
});

test("resolveSubscriptionFieldOverride keeps override when values differ from defaults", () => {
  assert.deepEqual(
    resolveSubscriptionFieldOverride(
      null,
      globalWithSeasons,
      { field: "seasons", values: ["Summer"] },
    ),
    { seasons: ["Summer"] },
  );
});

test("isSubscriptionFieldCustomized is false when override matches global defaults", () => {
  assert.equal(
    isSubscriptionFieldCustomized(
      { seasons: ["Summer", "Winter"] },
      globalWithSeasons,
      "seasons",
    ),
    false,
  );
  assert.equal(
    isSubscriptionFieldCustomized({ seasons: ["Summer"] }, globalWithSeasons, "seasons"),
    true,
  );
});

test("isSubscriptionFiltersCustomized is true when any field differs from defaults", () => {
  assert.equal(isSubscriptionFiltersCustomized(null, globalWithSeasons), false);
  assert.equal(
    isSubscriptionFiltersCustomized({ seasons: ["Summer"] }, globalWithSeasons),
    true,
  );
  assert.equal(
    isSubscriptionFiltersCustomized({ countries: ["IE"] }, globalWithCountries),
    true,
  );
  assert.equal(
    isSubscriptionFiltersCustomized(
      { seasons: ["Summer", "Winter"] },
      globalWithSeasons,
    ),
    false,
  );
});
