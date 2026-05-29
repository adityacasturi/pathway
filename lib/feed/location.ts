/**
 * Lightweight, in-process country classifier for raw posting location strings.
 *
 * Upstream trackers expose `locations: string[]` of loosely-structured strings
 * ("San Francisco, CA", "Toronto, ON, Canada", "Remote", "NYC / London / SF").
 * We don't normalize the display form — we only need enough country signal to
 * power a Country filter on Discover, so the resolver runs per fetch (~1/hr)
 * and produces ISO 3166-1 alpha-2 codes.
 *
 * Outputs:
 *   - `detectCountriesAcross(locations)` — ordered, deduped list of ISO
 *     3166-1 alpha-2 codes the strings mention.
 *   - `hasRemoteLocation(locations)` — true if any location reads as remote.
 *     The UI uses this to surface a separate "Remote" pill for postings
 *     that *only* say "Remote" with no country qualifier.
 *
 * Design notes:
 *   - Token-based, no fuzzy matching. Speed matters because this runs over
 *     every location of every posting on every refresh.
 *   - Slash-separated lists fan out into multiple countries so a posting in
 *     "NYC / London" surfaces under both US and GB.
 *   - State/province codes ("MI", "ON") dominate over country aliases so
 *     "Holland, MI" classifies as US, not the Netherlands.
 *   - Country qualifiers attached to remote markers ("Remote in US",
 *     "Remote (UK)", "US Remote") still resolve — we sub-tokenize on
 *     parens / brackets / " in " / " - " and strip work-mode words
 *     before alias lookup.
 *   - Ambiguity rules ("CA" alone, "London" alone) default to the more common
 *     reading in this dataset (California; United Kingdom).
 */

// Country alias map. Keys are normalized (lowercased, punctuation stripped)
// tokens; values are ISO 3166-1 alpha-2 codes. Order doesn't matter.
const COUNTRY_ALIASES: Record<string, string> = {
  // North America
  "us": "US",
  "usa": "US",
  "u s a": "US",
  "u s": "US",
  "united states": "US",
  "united states of america": "US",
  "america": "US",
  "canada": "CA",
  "mexico": "MX",
  // Europe
  "uk": "GB",
  "u k": "GB",
  "united kingdom": "GB",
  "great britain": "GB",
  "britain": "GB",
  "england": "GB",
  "scotland": "GB",
  "wales": "GB",
  "northern ireland": "GB",
  "ireland": "IE",
  "republic of ireland": "IE",
  "germany": "DE",
  "deutschland": "DE",
  "france": "FR",
  "spain": "ES",
  "portugal": "PT",
  "italy": "IT",
  "netherlands": "NL",
  "the netherlands": "NL",
  "holland": "NL",
  "belgium": "BE",
  "luxembourg": "LU",
  "switzerland": "CH",
  "austria": "AT",
  "sweden": "SE",
  "norway": "NO",
  "denmark": "DK",
  "finland": "FI",
  "iceland": "IS",
  "poland": "PL",
  "czechia": "CZ",
  "czech republic": "CZ",
  "hungary": "HU",
  "romania": "RO",
  "greece": "GR",
  "turkey": "TR",
  "ukraine": "UA",
  "estonia": "EE",
  "latvia": "LV",
  "lithuania": "LT",
  // Asia / Pacific
  "india": "IN",
  "bharat": "IN",
  "china": "CN",
  "prc": "CN",
  "hong kong": "HK",
  "hk": "HK",
  "taiwan": "TW",
  "japan": "JP",
  "south korea": "KR",
  "korea": "KR",
  "republic of korea": "KR",
  "singapore": "SG",
  "malaysia": "MY",
  "indonesia": "ID",
  "philippines": "PH",
  "thailand": "TH",
  "vietnam": "VN",
  "australia": "AU",
  "aus": "AU",
  "new zealand": "NZ",
  "nz": "NZ",
  // Middle East & Africa
  "israel": "IL",
  "uae": "AE",
  "united arab emirates": "AE",
  "saudi arabia": "SA",
  "qatar": "QA",
  "egypt": "EG",
  "south africa": "ZA",
  "nigeria": "NG",
  "kenya": "KE",
  // Latin America
  "brazil": "BR",
  "brasil": "BR",
  "argentina": "AR",
  "chile": "CL",
  "colombia": "CO",
  "peru": "PE",
  "uruguay": "UY",
  "costa rica": "CR",
};

// US states + DC. Codes and full names both map to US. The "CA" code is
// resolved contextually below — California in this dataset, not Canada.
const US_STATE_CODES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
]);

const US_STATE_NAMES = new Set([
  "alabama","alaska","arizona","arkansas","california","colorado","connecticut",
  "delaware","florida","georgia","hawaii","idaho","illinois","indiana","iowa",
  "kansas","kentucky","louisiana","maine","maryland","massachusetts","michigan",
  "minnesota","mississippi","missouri","montana","nebraska","nevada",
  "new hampshire","new jersey","new mexico","new york","north carolina",
  "north dakota","ohio","oklahoma","oregon","pennsylvania","rhode island",
  "south carolina","south dakota","tennessee","texas","utah","vermont",
  "virginia","washington","west virginia","wisconsin","wyoming",
  "district of columbia","washington dc","washington d c",
]);

// Canadian provinces / territories. Codes overlap with no US state codes.
const CA_PROVINCE_CODES = new Set([
  "ON","QC","BC","AB","MB","SK","NS","NB","NL","PE","YT","NT","NU",
]);
const CA_PROVINCE_NAMES = new Set([
  "ontario","quebec","british columbia","alberta","manitoba","saskatchewan",
  "nova scotia","new brunswick","newfoundland","newfoundland and labrador",
  "prince edward island","yukon","northwest territories","nunavut",
]);

// City shorthand → country. Only entries where the country is unambiguous from
// the city alone. Defends against postings that omit the state/country.
const CITY_COUNTRY_HINTS: Record<string, string> = {
  // US
  "sf": "US",
  "san fran": "US",
  "san francisco": "US",
  "nyc": "US",
  "new york": "US",
  "new york city": "US",
  "la": "US",
  "los angeles": "US",
  "dc": "US",
  "washington dc": "US",
  "boston": "US",
  "chicago": "US",
  "atlanta": "US",
  "seattle": "US",
  "philadelphia": "US",
  "philly": "US",
  "san diego": "US",
  "phoenix": "US",
  "austin": "US",
  "denver": "US",
  "miami": "US",
  "dallas": "US",
  "houston": "US",
  "portland": "US",
  "minneapolis": "US",
  "detroit": "US",
  "pittsburgh": "US",
  "raleigh": "US",
  "nashville": "US",
  "salt lake city": "US",
  // Canada
  "toronto": "CA",
  "vancouver": "CA",
  "montreal": "CA",
  "ottawa": "CA",
  "calgary": "CA",
  "edmonton": "CA",
  "waterloo": "CA",
  "mississauga": "CA",
  "kitchener": "CA",
  "burnaby": "CA",
  // UK
  "london": "GB",
  "manchester": "GB",
  "edinburgh": "GB",
  "cambridge": "GB",
  "oxford": "GB",
  // Ireland
  "dublin": "IE",
  // India
  "bangalore": "IN",
  "bengaluru": "IN",
  "hyderabad": "IN",
  "mumbai": "IN",
  "pune": "IN",
  "delhi": "IN",
  "new delhi": "IN",
  "gurgaon": "IN",
  "gurugram": "IN",
  "noida": "IN",
  "chennai": "IN",
  // Germany / EU
  "berlin": "DE",
  "munich": "DE",
  "hamburg": "DE",
  "frankfurt": "DE",
  "amsterdam": "NL",
  "rotterdam": "NL",
  "paris": "FR",
  "zurich": "CH",
  "geneva": "CH",
  "stockholm": "SE",
  "copenhagen": "DK",
  "warsaw": "PL",
  "madrid": "ES",
  "barcelona": "ES",
  "lisbon": "PT",
  // APAC
  "singapore": "SG",
  "tokyo": "JP",
  "osaka": "JP",
  "seoul": "KR",
  "taipei": "TW",
  "shanghai": "CN",
  "beijing": "CN",
  "shenzhen": "CN",
  "sydney": "AU",
  "melbourne": "AU",
  "brisbane": "AU",
  "auckland": "NZ",
  // Middle East / LatAm
  "tel aviv": "IL",
  "dubai": "AE",
  "abu dhabi": "AE",
  "sao paulo": "BR",
  "rio de janeiro": "BR",
  "buenos aires": "AR",
};

function normalizeToken(token: string): string {
  return token
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Work-mode words we strip before re-trying alias lookups so "US Remote" /
// "Remote US" / "Hybrid SF" resolve correctly.
const WORK_MODE_WORDS = /\b(remote|wfh|virtual|onsite|on-site|hybrid|in-office|in office|in-person|in person)\b/gi;

/**
 * Resolve country codes from a single segment ("San Francisco, CA",
 * "Toronto, ON, Canada", "Remote in US", "Remote (UK)").
 *
 * The resolution order is critical because tokens can be ambiguous between
 * country and US/CA region — "Holland, MI" is a city in Michigan, not the
 * Netherlands, so an explicit US-state code in any sub-token must dominate
 * over country aliases that happen to share a name with a US city.
 *
 * Segments are sub-tokenized on commas, parens, brackets, " in ", " - " so
 * "Remote (US)" / "Remote in US" / "Remote - US" all surface the US token.
 */
function classifySegment(segment: string): string[] {
  const trimmed = segment.trim();
  if (!trimmed) return [];

  // Ashby / enterprise boards: US-CA-Menlo Park, US-WA-Bellevue
  const hyphenParts = trimmed.split("-").map((part) => part.trim()).filter(Boolean);
  if (hyphenParts.length >= 2) {
    const countryToken = hyphenParts[0].replace(/[^A-Za-z]/g, "").toUpperCase();
    if (countryToken === "US" || countryToken === "USA") {
      const stateToken = hyphenParts[1].replace(/[^A-Za-z]/g, "").toUpperCase();
      if (stateToken.length === 2 && US_STATE_CODES.has(stateToken)) {
        return ["US"];
      }
      return ["US"];
    }
  }

  const subTokens = trimmed
    .split(/,|\s+in\s+|\s+-\s+|[()[\]]/i)
    .map((t) => t.trim())
    .filter(Boolean);
  if (subTokens.length === 0) return [];

  // Pass 1: 2-letter US state / CA province code in *any* sub-token. This
  // wins outright — "Holland, MI" and "Berlin, NH" are US, not NL/DE; and
  // "London, ON" is Canada, not the UK.
  for (const raw of subTokens) {
    const upper = raw.replace(/[^A-Za-z]/g, "").toUpperCase();
    if (upper.length === 2) {
      if (US_STATE_CODES.has(upper)) return ["US"];
      if (CA_PROVINCE_CODES.has(upper)) return ["CA"];
    }
  }

  // Pass 2: explicit country alias on any sub-token, either as-is or with
  // work-mode words ("remote", "hybrid", etc.) stripped — the strip pass is
  // what lets "US Remote" or "Remote US" resolve to US without requiring
  // the upstream feed to use commas.
  const found = new Set<string>();
  for (const raw of subTokens) {
    const normalized = normalizeToken(raw);
    if (!normalized) continue;
    const direct = COUNTRY_ALIASES[normalized];
    if (direct) {
      found.add(direct);
      continue;
    }
    const stripped = normalizeToken(raw.replace(WORK_MODE_WORDS, ""));
    if (stripped && stripped !== normalized) {
      const aliasAfterStrip = COUNTRY_ALIASES[stripped];
      if (aliasAfterStrip) found.add(aliasAfterStrip);
    }
  }
  if (found.size > 0) return Array.from(found);

  // Pass 3: US state / CA province full names. A segment with "Texas" or
  // "Ontario" is unambiguously US/CA.
  for (const raw of subTokens) {
    const normalized = normalizeToken(raw);
    if (US_STATE_NAMES.has(normalized)) return ["US"];
    if (CA_PROVINCE_NAMES.has(normalized)) return ["CA"];
  }

  // Pass 4: unambiguous city hints — only reached when no country, state,
  // or province token was found.
  for (const raw of subTokens) {
    const normalized = normalizeToken(raw);
    const hint = CITY_COUNTRY_HINTS[normalized];
    if (hint) return [hint];
  }

  return [];
}

const REMOTE_PATTERN = /\b(remote|wfh|virtual|anywhere|worldwide|work\s+from\s+home)\b/i;

/**
 * True if any of the given location strings mentions remote work.
 * Used by the filter UI to bucket "Remote"-only postings together.
 */
export function hasRemoteLocation(locations: readonly string[]): boolean {
  for (const loc of locations) {
    if (REMOTE_PATTERN.test(loc)) return true;
  }
  return false;
}

/**
 * Returns an ordered, deduped list of ISO 3166-1 alpha-2 country codes
 * inferred from the raw location string. Empty when nothing matches.
 *
 * Multi-location strings (slash- or pipe-separated) fan out so each segment
 * contributes independently.
 */
function detectCountries(raw: string): string[] {
  if (!raw) return [];

  // Split on slashes, pipes, semicolons, or " or " between segments. We do
  // NOT split on commas at this level — commas separate city/state/country
  // *within* a single location.
  const segments = raw
    .split(/\s*[/|;]\s*|\s+or\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length === 0) return [];

  const out = new Set<string>();
  for (const segment of segments) {
    for (const code of classifySegment(segment)) {
      out.add(code);
    }
  }
  return Array.from(out);
}

/**
 * Aggregate `detectCountries` across an array of raw locations. Convenience
 * for the feed pipeline so callers don't need to flat-map themselves.
 */
export function detectCountriesAcross(locations: readonly string[]): string[] {
  const out = new Set<string>();
  for (const loc of locations) {
    for (const code of detectCountries(loc)) out.add(code);
  }
  return Array.from(out);
}
