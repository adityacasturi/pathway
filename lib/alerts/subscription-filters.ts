import type { AlertCountryCode, AlertSeason } from "@/lib/config/alert-filters";
import { alertFiltersToView, mergeAlertFilters, type AlertFilters } from "@/lib/alerts/filters";

export type AlertMatchField = "seasons" | "countries";

function sortedArrayEqual<T extends string>(left: readonly T[], right: readonly T[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

export function subscriptionFieldValuesMatchDefault(
  globalFilters: AlertFilters,
  field: AlertMatchField,
  values: readonly AlertSeason[] | readonly AlertCountryCode[],
): boolean {
  const globalView = alertFiltersToView(globalFilters);
  if (field === "seasons") {
    return sortedArrayEqual(values, globalView.seasons);
  }
  return sortedArrayEqual(values, globalView.countries);
}

export function hasSubscriptionOverrideField(
  filterOverride: Partial<AlertFilters> | null,
  field: AlertMatchField,
): boolean {
  return filterOverride != null && field in filterOverride;
}

export function isSubscriptionFieldCustomized(
  filterOverride: Partial<AlertFilters> | null,
  globalFilters: AlertFilters,
  field: AlertMatchField,
): boolean {
  if (!hasSubscriptionOverrideField(filterOverride, field)) {
    return false;
  }

  const globalView = alertFiltersToView(globalFilters);
  const effectiveView = alertFiltersToView(mergeAlertFilters(globalFilters, filterOverride));

  if (field === "seasons") {
    return !sortedArrayEqual(effectiveView.seasons, globalView.seasons);
  }
  return !sortedArrayEqual(effectiveView.countries, globalView.countries);
}

export function buildSubscriptionFilterOverride(
  current: Partial<AlertFilters> | null,
  update: { field: AlertMatchField; values: readonly AlertSeason[] | readonly AlertCountryCode[] },
): Partial<AlertFilters> | null {
  const next: Partial<AlertFilters> = { ...(current ?? {}) };

  if (update.values.length === 0) {
    delete next[update.field];
  } else if (update.field === "seasons") {
    next.seasons = [...update.values] as AlertSeason[];
  } else {
    next.countries = [...update.values] as AlertCountryCode[];
  }

  return Object.keys(next).length > 0 ? next : null;
}

export function resolveSubscriptionFieldOverride(
  current: Partial<AlertFilters> | null,
  globalFilters: AlertFilters,
  update: { field: AlertMatchField; values: readonly AlertSeason[] | readonly AlertCountryCode[] },
): Partial<AlertFilters> | null {
  if (subscriptionFieldValuesMatchDefault(globalFilters, update.field, update.values)) {
    return clearSubscriptionOverrideField(current, update.field);
  }

  return buildSubscriptionFilterOverride(current, update);
}

export function clearSubscriptionOverrideField(
  current: Partial<AlertFilters> | null,
  field: AlertMatchField,
): Partial<AlertFilters> | null {
  if (!current || !(field in current)) {
    return current;
  }

  const next: Partial<AlertFilters> = { ...current };
  delete next[field];
  return Object.keys(next).length > 0 ? next : null;
}
