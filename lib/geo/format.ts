import { countryDisplayName, US_STATE_DISPLAY } from "./countries.ts";
import type { CanonicalPlace, LocationPlaceJson } from "./types.ts";

const CITY_STATE_COUNTRIES = new Set(["SG", "HK", "MC", "VA"]);

export function formatCanonicalPlace(place: CanonicalPlace): string {
  const country = countryDisplayName(place.countryCode);

  if (place.remote && !place.city && !place.region) {
    return `Remote, ${country}`;
  }
  if (place.remote && place.city) {
    return `Remote, ${place.city}, ${country}`;
  }
  if (place.city && place.region) {
    return `${place.city}, ${place.region}, ${country}`;
  }
  if (place.city) {
    if (CITY_STATE_COUNTRIES.has(place.countryCode) || place.city === country) {
      return place.city;
    }
    return `${place.city}, ${country}`;
  }
  if (place.region) {
    const regionLabel =
      place.countryCode === "US"
        ? (US_STATE_DISPLAY[place.region] ?? place.region)
        : place.region;
    return `${regionLabel}, ${country}`;
  }

  return country;
}

export function canonicalPlacesToField(places: readonly CanonicalPlace[]): string | null {
  if (places.length === 0) return null;
  return places.map((place) => formatCanonicalPlace(place)).join(" · ");
}

export function canonicalPlacesToJson(places: readonly CanonicalPlace[]): LocationPlaceJson[] {
  return places.map((place) => ({
    city: place.city,
    region: place.region,
    country_code: place.countryCode,
    remote: place.remote,
  }));
}

export function placesFromJson(
  rows: readonly LocationPlaceJson[] | null | undefined,
): CanonicalPlace[] {
  if (!rows?.length) return [];
  return rows.map((row) => ({
    city: row.city,
    region: row.region,
    countryCode: row.country_code,
    remote: row.remote,
  }));
}

export function formatPlacesFromJson(
  rows: readonly LocationPlaceJson[] | null | undefined,
): string[] {
  return placesFromJson(rows).map((place) => formatCanonicalPlace(place));
}
