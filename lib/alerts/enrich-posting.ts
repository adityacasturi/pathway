import { formatPlacesFromJson } from "../geo/format.ts";
import type { LocationPlaceJson } from "../geo/types.ts";
import { countriesFromLocationField } from "../feed/country-filter.ts";
import { hasRemoteLocation } from "../feed/location.ts";
import { expandLocationSegments } from "../feed/us-locations.ts";
import type { AlertPostingCandidate } from "./types.ts";

export function enrichAlertPostingCandidate(
  posting: Omit<AlertPostingCandidate, "countries" | "hasRemote"> & {
    countries?: string[] | null;
    locationPlaces?: LocationPlaceJson[] | null;
  },
): AlertPostingCandidate {
  const fromPlaces = formatPlacesFromJson(posting.locationPlaces);
  const location = posting.location?.trim() ?? "";
  const displayLocations =
    fromPlaces.length > 0
      ? fromPlaces
      : (() => {
          const segments = location ? expandLocationSegments(location) : [];
          return segments.length > 0 ? segments : location ? [location] : [];
        })();

  const storedCountries =
    posting.locationPlaces && posting.countries
      ? posting.countries.map((code) => code.toUpperCase()).filter(Boolean)
      : [];

  return {
    ...posting,
    countries:
      storedCountries.length > 0
        ? [...new Set(storedCountries)].sort()
        : countriesFromLocationField(location),
    hasRemote:
      posting.locationPlaces?.some((place) => place.remote) ??
      hasRemoteLocation(displayLocations),
  };
}
