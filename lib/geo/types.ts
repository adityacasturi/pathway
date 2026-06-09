export type CanonicalPlace = {
  city: string | null;
  /** US state / CA province code when known (e.g. NY, CA, ON). */
  region: string | null;
  countryCode: string;
  remote: boolean;
};

export type StructuredPlaceInput = {
  city?: string | null;
  region?: string | null;
  countryCode?: string | null;
  rawLabel?: string | null;
  remote?: boolean;
};

export type LocationConfidence = number;

export type ResolvedPlace = {
  place: CanonicalPlace;
  confidence: LocationConfidence;
  provider: "structured" | "gazetteer" | "parser" | "cache" | "manual";
};

export type ResolvedLocations = {
  places: CanonicalPlace[];
  minConfidence: LocationConfidence;
  display: string | null;
  countries: string[];
};

export type ScrapedLocationContext = {
  companyName?: string | null;
  companySlug?: string | null;
};

export type LocationPlaceJson = {
  city: string | null;
  region: string | null;
  country_code: string;
  remote: boolean;
};
