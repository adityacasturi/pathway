import { formatPlacesFromJson } from "@/lib/geo/format.ts";
import type { LocationPlaceJson } from "@/lib/geo/types.ts";
import { countriesFromLocationField } from "@/lib/feed/country-filter";
import { hasRemoteLocation } from "@/lib/feed/location";
import { expandLocationSegments } from "@/lib/feed/us-locations";
import type { AlertPostingCandidate } from "@/lib/alerts/types";

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
