import {
  PRODUCT_SCOPE_COUNTRY_CODES,
  US_ONLY_INTERNSHIPS,
} from "../config/product-scope.ts";
import { formatPlacesFromJson } from "../geo/format.ts";
import type { LocationPlaceJson } from "../geo/types.ts";
import {
  countriesFromLocationField,
  matchesCountryFilter,
  resolvePostingCountries,
} from "./country-filter.ts";
import { detectCountriesAcross } from "./location.ts";
import { expandLocationSegments } from "./us-locations.ts";

const PRODUCT_SCOPE = new Set<string>(PRODUCT_SCOPE_COUNTRY_CODES);

export function isProductScopeActive(): boolean {
  return US_ONLY_INTERNSHIPS;
}

export function postingMatchesProductScope(
  countries: readonly string[],
  locations: readonly string[],
): boolean {
  if (!US_ONLY_INTERNSHIPS) {
    return true;
  }
  return matchesCountryFilter(resolvePostingCountries(countries, locations), PRODUCT_SCOPE);
}

export function feedPostingMatchesProductScope(posting: {
  countries: readonly string[];
  locations: readonly string[];
}): boolean {
  return postingMatchesProductScope(posting.countries, posting.locations);
}

export function locationFieldMatchesProductScope(location: string | null | undefined): boolean {
  if (!US_ONLY_INTERNSHIPS) {
    return true;
  }
  return matchesCountryFilter(countriesFromLocationField(location), PRODUCT_SCOPE);
}

function resolveLocationsFromRow(row: {
  location?: string | null;
  location_places?: LocationPlaceJson[] | null;
}): string[] {
  const fromPlaces = formatPlacesFromJson(row.location_places);
  const rawLocation = row.location?.trim() ?? "";
  if (fromPlaces.length > 0) {
    return fromPlaces;
  }
  if (!rawLocation) {
    return [];
  }
  const segments = expandLocationSegments(rawLocation);
  return segments.length > 0 ? segments : [rawLocation];
}

export function scrapedPostingRowMatchesProductScope(row: {
  countries?: string[] | null;
  location?: string | null;
  location_places?: LocationPlaceJson[] | null;
}): boolean {
  if (!US_ONLY_INTERNSHIPS) {
    return true;
  }
  const locations = resolveLocationsFromRow(row);
  const storedCountries = (row.countries ?? []).map((code) => code.toUpperCase()).filter(Boolean);
  const countries =
    storedCountries.length > 0 ? storedCountries : detectCountriesAcross(locations);
  return postingMatchesProductScope(countries, locations);
}
