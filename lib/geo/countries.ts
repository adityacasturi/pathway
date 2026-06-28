/** ISO 3166-1 alpha-2 resolve + English display names. */

const REGION_DISPLAY = new Intl.DisplayNames(["en"], { type: "region" });

/** Edge cases where Intl.DisplayNames differs from product labels. */
const COUNTRY_DISPLAY_OVERRIDES: Record<string, string> = {
  HK: "Hong Kong",
  TW: "Taiwan",
  US: "United States",
  GB: "United Kingdom",
};

const COUNTRY_CODE_ALIASES: Record<string, string> = {
  us: "US",
  usa: "US",
  "u s": "US",
  "u s a": "US",
  america: "US",
  "united states": "US",
  "united states of america": "US",
  ca: "CA",
  canada: "CA",
  uk: "GB",
  "u k": "GB",
  gb: "GB",
  "great britain": "GB",
  britain: "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  "northern ireland": "GB",
  "united kingdom": "GB",
  ireland: "IE",
  "republic of ireland": "IE",
  deutschland: "DE",
  germany: "DE",
  belgium: "BE",
  czechia: "CZ",
  "czech republic": "CZ",
  egypt: "EG",
  hungary: "HU",
  lithuania: "LT",
  slovakia: "SK",
  serbia: "RS",
  romania: "RO",
  france: "FR",
  spain: "ES",
  españa: "ES",
  italy: "IT",
  italia: "IT",
  netherlands: "NL",
  holland: "NL",
  "the netherlands": "NL",
  switzerland: "CH",
  schweiz: "CH",
  singapore: "SG",
  malaysia: "MY",
  china: "CN",
  prc: "CN",
  "hong kong": "HK",
  hk: "HK",
  taiwan: "TW",
  japan: "JP",
  "south korea": "KR",
  korea: "KR",
  thailand: "TH",
  "saudi arabia": "SA",
  philippines: "PH",
  india: "IN",
  bharat: "IN",
  israel: "IL",
  poland: "PL",
  australia: "AU",
  aus: "AU",
  mexico: "MX",
  argentina: "AR",
  colombia: "CO",
  brazil: "BR",
  brasil: "BR",
};

export const US_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA",
  "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT",
  "VA", "WA", "WV", "WI", "WY", "DC",
]);

export const US_STATE_NAMES: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
  "district of columbia": "DC",
  "washington dc": "DC",
  "washington d c": "DC",
};

export const US_STATE_DISPLAY: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia",
};

export const CA_PROVINCE_CODES = new Set([
  "ON", "QC", "BC", "AB", "MB", "SK", "NS", "NB", "NL", "PE", "YT", "NT", "NU",
]);

export function normalizeGeoKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    // Drop combining marks so "Zürich" and "Zurich" share a key, then map
    // remaining punctuation to spaces.
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** All ISO 3166-1 alpha-2 codes whose English display name resolves via Intl. */
const ISO_COUNTRY_NAME_TO_CODE: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (const a of letters) {
    for (const b of letters) {
      const code = `${a}${b}`;
      try {
        const name = REGION_DISPLAY.of(code);
        if (name && name !== code && name.length > 2) {
          out[normalizeGeoKey(name)] = code;
        }
      } catch {
        // not a valid region code
      }
    }
  }
  return out;
})();

export function countryDisplayName(countryCode: string): string {
  const upper = countryCode.toUpperCase();
  if (COUNTRY_DISPLAY_OVERRIDES[upper]) {
    return COUNTRY_DISPLAY_OVERRIDES[upper];
  }
  try {
    const name = REGION_DISPLAY.of(upper);
    if (name && name !== upper) {
      return name;
    }
  } catch {
    // Intl may reject invalid codes
  }
  return upper;
}

/** Common ISO 3166-1 alpha-3 codes seen in ATS data ("Toronto, CAN"). */
const ALPHA3_COUNTRY_CODES: Record<string, string> = {
  USA: "US",
  CAN: "CA",
  GBR: "GB",
  AUS: "AU",
  DEU: "DE",
  FRA: "FR",
  NLD: "NL",
  CHE: "CH",
  SGP: "SG",
  IND: "IN",
  IRL: "IE",
  JPN: "JP",
  CHN: "CN",
  HKG: "HK",
  ISR: "IL",
  MEX: "MX",
  BRA: "BR",
  POL: "PL",
  ESP: "ES",
  ITA: "IT",
  SWE: "SE",
  NZL: "NZ",
  KOR: "KR",
  TWN: "TW",
};

export function parseCountryToken(token: string): string | null {
  const trimmed = token.trim();
  if (!trimmed) return null;

  const upper = trimmed.toUpperCase();
  if (upper === "US" || upper === "USA") return "US";
  if (upper.length === 3 && ALPHA3_COUNTRY_CODES[upper]) return ALPHA3_COUNTRY_CODES[upper];
  if (/^united states/i.test(trimmed)) return "US";
  if (upper === "UK") return "GB";
  if (/^united kingdom/i.test(trimmed)) return "GB";
  if (/^canada$/i.test(trimmed)) return "CA";
  if (upper.length === 2 && /^[A-Z]{2}$/.test(upper)) {
    if (US_STATE_CODES.has(upper) || CA_PROVINCE_CODES.has(upper)) {
      return null;
    }
    // ISO user-assigned ranges (AA, QM–QZ, XA–XZ, ZZ): Intl names them
    // ("Unknown Region") but they are not countries.
    if (upper === "AA" || upper === "ZZ" || /^Q[M-Z]$/.test(upper) || /^X[A-Z]$/.test(upper)) {
      return null;
    }
    try {
      const name = REGION_DISPLAY.of(upper);
      if (name && name !== upper && name.length > 2) {
        return upper;
      }
    } catch {
      return null;
    }
    return null;
  }

  const key = normalizeGeoKey(trimmed);
  if (COUNTRY_CODE_ALIASES[key]) {
    return COUNTRY_CODE_ALIASES[key];
  }
  // Names that are also US states ("Georgia") are ambiguous — never resolve
  // them to a country from the name alone.
  if (US_STATE_NAMES[key]) {
    return null;
  }
  return ISO_COUNTRY_NAME_TO_CODE[key] ?? null;
}

export function parseRegionToken(token: string, countryCode: string | null): string | null {
  const trimmed = token.trim();
  if (!trimmed) return null;

  const upper = trimmed.toUpperCase();
  if (countryCode === "US" || countryCode === null) {
    if (US_STATE_CODES.has(upper)) return upper;
    const fromName = US_STATE_NAMES[normalizeGeoKey(trimmed)];
    if (fromName) return fromName;
  }
  if (countryCode === "CA" || countryCode === null) {
    if (CA_PROVINCE_CODES.has(upper)) return upper;
  }

  return null;
}

/** Normalize ATS country codes/names to ISO alpha-2 when possible. */
export function normalizeCountryCode(countryCode: string | null | undefined): string | null {
  if (!countryCode?.trim()) {
    return null;
  }

  const value = countryCode.trim();
  const upper = value.toUpperCase();
  if (upper === "US" || upper === "USA") {
    return "US";
  }
  if (/^united states/i.test(value)) {
    return "US";
  }
  if (value.length === 2) {
    return upper;
  }
  return parseCountryToken(value) ?? upper;
}

/** When country is absent, callers may still emit a location string for downstream trim. */
export function isUsCountryCode(countryCode: string | null | undefined): boolean {
  const normalized = normalizeCountryCode(countryCode);
  return normalized === null || normalized === "US";
}

export function countriesFromPlaces(
  places: readonly { countryCode: string; remote: boolean }[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const place of places) {
    const code = normalizeCountryCode(place.countryCode);
    if (!code || seen.has(code)) {
      continue;
    }
    seen.add(code);
    out.push(code);
  }
  return out.sort();
}
