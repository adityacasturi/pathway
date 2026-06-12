import {
  isAlertCountryCode,
  isAlertSeason,
  normalizeAlertCountries,
  normalizeAlertSeasons,
  type AlertCountryCode,
  type AlertSeason,
} from "@/lib/config/alert-filters";
import { matchesCountryFilter } from "@/lib/feed/country-filter";
import type { AlertPostingCandidate } from "@/lib/alerts/types";

export interface AlertFilters {
  seasons: AlertSeason[] | null;
  countries: AlertCountryCode[] | null;
  includeRemote: boolean;
}

export interface AlertFilterOverrideJson {
  seasons?: string[] | null;
  countries?: string[] | null;
  include_remote?: boolean;
}

export const DEFAULT_ALERT_FILTERS: AlertFilters = {
  seasons: null,
  countries: null,
  includeRemote: true,
};

export function alertFiltersFromPreferenceRow(row: {
  alert_seasons?: string[] | null;
  alert_countries?: string[] | null;
  alert_include_remote?: boolean | null;
} | null): AlertFilters {
  if (!row) {
    return { ...DEFAULT_ALERT_FILTERS };
  }
  return {
    seasons: normalizeAlertSeasons(row.alert_seasons),
    countries: normalizeAlertCountries(row.alert_countries),
    includeRemote: row.alert_include_remote ?? true,
  };
}

export function parseFilterOverrideJson(
  value: AlertFilterOverrideJson | null | undefined,
): Partial<AlertFilters> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const override: Partial<AlertFilters> = {};

  if ("seasons" in value) {
    override.seasons = normalizeAlertSeasons(value.seasons ?? []);
  }
  if ("countries" in value) {
    override.countries = normalizeAlertCountries(value.countries ?? []);
  }
  if (typeof value.include_remote === "boolean") {
    override.includeRemote = value.include_remote;
  }

  return Object.keys(override).length > 0 ? override : null;
}

export function mergeAlertFilters(
  global: AlertFilters,
  override: Partial<AlertFilters> | null | undefined,
): AlertFilters {
  if (!override) {
    return global;
  }

  return {
    seasons: "seasons" in override ? override.seasons ?? null : global.seasons,
    countries: "countries" in override ? override.countries ?? null : global.countries,
    includeRemote:
      "includeRemote" in override && override.includeRemote !== undefined
        ? override.includeRemote
        : global.includeRemote,
  };
}

export function postingMatchesAlertFilters(
  posting: AlertPostingCandidate,
  filters: AlertFilters,
): boolean {
  // Unknown season is honest missing data: it can match any season filter
  // rather than being silently hidden from every season-filtered alert.
  if (
    filters.seasons?.length &&
    posting.season !== null &&
    !filters.seasons.includes(posting.season as AlertSeason)
  ) {
    return false;
  }

  const countryFilterActive = Boolean(filters.countries?.length);
  if (countryFilterActive) {
    const selected = new Set(filters.countries);
    if (!matchesCountryFilter(posting.countries, selected)) {
      return false;
    }
  }

  if (!filters.includeRemote && posting.hasRemote) {
    if (!countryFilterActive) {
      return false;
    }
    const selected = new Set(filters.countries);
    if (!matchesCountryFilter(posting.countries, selected)) {
      return false;
    }
  }

  return true;
}

export interface AlertFiltersView {
  seasons: AlertSeason[];
  countries: AlertCountryCode[];
  includeRemote: boolean;
}

type ParseResult<T> = { value: T } | { error: string };

function readFilterArray(
  value: unknown,
  label: string,
  options: {
    max: number;
    normalize: (values: readonly string[]) => string[] | null;
    valid: (value: string) => boolean;
  },
): ParseResult<string[] | null> {
  if (value == null) return { value: null };
  if (!Array.isArray(value)) return { error: `Invalid ${label} filter.` };

  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") return { error: `Invalid ${label} filter.` };
    const normalized = label === "country" ? item.trim().toUpperCase() : item;
    if (!options.valid(normalized)) return { error: `Invalid ${label} filter.` };
    seen.add(normalized);
  }
  if (seen.size > options.max) return { error: `Too many ${label} filters.` };

  return { value: options.normalize(value) };
}

export function parseAlertFiltersView(value: unknown): ParseResult<AlertFilters> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Invalid alert filters." };
  }

  const source = value as Record<string, unknown>;
  const seasons = readFilterArray(source.seasons, "season", {
    max: 4,
    normalize: (values) => normalizeAlertSeasons(values) ?? [],
    valid: isAlertSeason,
  });
  if ("error" in seasons) return seasons;

  const countries = readFilterArray(source.countries, "country", {
    max: 32,
    normalize: (values) => normalizeAlertCountries(values) ?? [],
    valid: isAlertCountryCode,
  });
  if ("error" in countries) return countries;

  if (typeof source.includeRemote !== "boolean") {
    return { error: "Invalid remote filter." };
  }

  return {
    value: {
      seasons: seasons.value && seasons.value.length > 0 ? seasons.value as AlertSeason[] : null,
      countries:
        countries.value && countries.value.length > 0 ? countries.value as AlertCountryCode[] : null,
      includeRemote: source.includeRemote,
    },
  };
}

export function parseAlertFilterOverride(
  value: unknown,
): ParseResult<Partial<AlertFilters> | null> {
  if (value == null) return { value: null };
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Invalid alert filters." };
  }

  const source = value as Record<string, unknown>;
  const override: Partial<AlertFilters> = {};

  if ("seasons" in source) {
    const seasons = readFilterArray(source.seasons, "season", {
      max: 4,
      normalize: (values) => normalizeAlertSeasons(values) ?? [],
      valid: isAlertSeason,
    });
    if ("error" in seasons) return seasons;
    override.seasons = seasons.value && seasons.value.length > 0 ? seasons.value as AlertSeason[] : null;
  }

  if ("countries" in source) {
    const countries = readFilterArray(source.countries, "country", {
      max: 32,
      normalize: (values) => normalizeAlertCountries(values) ?? [],
      valid: isAlertCountryCode,
    });
    if ("error" in countries) return countries;
    override.countries =
      countries.value && countries.value.length > 0 ? countries.value as AlertCountryCode[] : null;
  }

  if ("includeRemote" in source) {
    if (typeof source.includeRemote !== "boolean") {
      return { error: "Invalid remote filter." };
    }
    override.includeRemote = source.includeRemote;
  }

  return { value: Object.keys(override).length > 0 ? override : null };
}

export function alertFiltersToView(filters: AlertFilters): AlertFiltersView {
  return {
    seasons: filters.seasons ?? [],
    countries: filters.countries ?? [],
    includeRemote: filters.includeRemote,
  };
}

export function viewToAlertFilters(view: AlertFiltersView): AlertFilters {
  return {
    seasons: view.seasons.length > 0 ? view.seasons : null,
    countries: view.countries.length > 0 ? view.countries : null,
    includeRemote: view.includeRemote,
  };
}

export function filterOverrideToJson(
  override: Partial<AlertFilters> | null,
): AlertFilterOverrideJson | null {
  if (!override) {
    return null;
  }

  const json: AlertFilterOverrideJson = {};
  if ("seasons" in override) {
    json.seasons = override.seasons ?? [];
  }
  if ("countries" in override) {
    json.countries = override.countries ?? [];
  }
  if ("includeRemote" in override && override.includeRemote !== undefined) {
    json.include_remote = override.includeRemote;
  }

  return Object.keys(json).length > 0 ? json : null;
}
