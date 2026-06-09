/**
 * Server/scrape-only geo resolution (gazetteer-backed). Do not import from client components.
 */
export type {
  CanonicalPlace,
  LocationConfidence,
  LocationPlaceJson,
  ResolvedLocations,
  ResolvedPlace,
  ScrapedLocationContext,
  StructuredPlaceInput,
} from "./types.ts";

export {
  countryDisplayName,
  countriesFromPlaces,
  normalizeCountryCode,
  isUsCountryCode,
  parseCountryToken,
  parseRegionToken,
  US_STATE_CODES,
  CA_PROVINCE_CODES,
} from "./countries.ts";

export {
  formatCanonicalPlace,
  canonicalPlacesToField,
  canonicalPlacesToJson,
  placesFromJson,
  formatPlacesFromJson,
} from "./format.ts";

export { sanitizeLocationInput, splitLocationInput, collapseRepeatedCommaParts } from "./sanitize.ts";

export {
  parseCanonicalPlace,
  parseStructuredPlaceInput,
  resolveLocationString,
  canonicalizeLocationParts,
  canonicalizeScrapedLocationPart,
} from "./parse.ts";

export {
  resolveScrapedLocations,
  resolveScrapedLocationField,
  formatScrapedLocation,
  normalizeScrapedLocations,
  normalizeScrapedLocationPart,
  isInvalidScrapedLocationToken,
  looksLikeGeographicLocation,
  isStructuredPlaceInput,
  type LocationInput,
} from "./resolve.ts";

export { lookupCity, lookupAlias, gazetteerHasData } from "./gazetteer.ts";
