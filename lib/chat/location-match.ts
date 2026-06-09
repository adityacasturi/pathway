import { formatCanonicalPlace, resolveLocationString } from "@/lib/geo/server.ts";
import type { CanonicalPlace } from "@/lib/geo/types.ts";
import type { FeedPosting } from "@/lib/feed/types.ts";

function normalizeCity(city: string | null | undefined): string | null {
  return city?.trim().toLowerCase() ?? null;
}

export function resolveFilterPlace(locationFilter: string | undefined): CanonicalPlace | null {
  const trimmed = locationFilter?.trim();
  if (!trimmed) return null;
  return resolveLocationString(trimmed)?.place ?? null;
}

export function formatResolvedLocationFilter(
  locationFilter: string | undefined,
): string | undefined {
  const place = resolveFilterPlace(locationFilter);
  if (!place) return undefined;
  return formatCanonicalPlace(place);
}

function postingCanonicalPlaces(posting: FeedPosting): CanonicalPlace[] {
  if (posting.canonicalPlaces.length > 0) {
    return posting.canonicalPlaces;
  }

  const resolved: CanonicalPlace[] = [];
  for (const location of posting.locations) {
    const place = resolveLocationString(location)?.place;
    if (place) resolved.push(place);
  }
  return resolved;
}

function placeMatchesFilter(postingPlace: CanonicalPlace, filterPlace: CanonicalPlace): boolean {
  if (filterPlace.remote && !filterPlace.city && !filterPlace.region) {
    return postingPlace.remote;
  }

  const filterCity = normalizeCity(filterPlace.city);
  const filterRegion = filterPlace.region?.toUpperCase() ?? null;

  if (filterCity) {
    return normalizeCity(postingPlace.city) === filterCity;
  }

  if (filterRegion) {
    return postingPlace.region?.toUpperCase() === filterRegion;
  }

  if (!filterPlace.city && !filterPlace.region) {
    return postingPlace.countryCode === filterPlace.countryCode;
  }

  return false;
}

export function postingMatchesLocationFilter(
  posting: FeedPosting,
  locationFilter: string | undefined,
): boolean {
  const filterPlace = resolveFilterPlace(locationFilter);
  if (!filterPlace) return true;

  const places = postingCanonicalPlaces(posting);
  if (places.length === 0) return false;

  return places.some((place) => placeMatchesFilter(place, filterPlace));
}
