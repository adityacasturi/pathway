import {
  CA_PROVINCE_CODES,
  normalizeGeoKey,
  parseCountryToken,
  parseRegionToken,
  US_STATE_CODES,
  US_STATE_NAMES,
} from "./countries.ts";
import { lookupAlias, lookupCity } from "./gazetteer.ts";
import { sanitizeLocationInput } from "./sanitize.ts";
import type { CanonicalPlace, ResolvedPlace, StructuredPlaceInput } from "./types.ts";
import { scoreFromProvider } from "./confidence.ts";
import { formatCanonicalPlace } from "./format.ts";

const REMOTE_TOKEN_PATTERN = /^remote$/i;
const REMOTE_PREFIX_PATTERN = /^remote\b[\s,–-]*/i;
const REMOTE_ANYWHERE_PATTERN = /\bremote\b/i;

/**
 * Two-letter tokens that are both a US state code and an ISO country code
 * (IL = Illinois/Israel, IN = Indiana/India, DE = Delaware/Germany, …).
 * These must never be interpreted without corroboration.
 */
const AMBIGUOUS_STATE_COUNTRY_CODES = new Set(
  [...US_STATE_CODES].filter((code) => {
    try {
      const name = new Intl.DisplayNames(["en"], { type: "region" }).of(code);
      return Boolean(name && name !== code && name.length > 2);
    } catch {
      return false;
    }
  }),
);

/**
 * Same collision for Canadian provinces: NL = Newfoundland/Netherlands,
 * SK = Saskatchewan/Slovakia, PE = PEI/Peru, … ("Amsterdam, NH, NL" must
 * resolve to the Netherlands, not a Canadian province).
 */
const AMBIGUOUS_PROVINCE_COUNTRY_CODES = new Set(
  [...CA_PROVINCE_CODES].filter((code) => {
    try {
      const name = new Intl.DisplayNames(["en"], { type: "region" }).of(code);
      return Boolean(name && name !== code && name.length > 2);
    } catch {
      return false;
    }
  }),
);

function titleCaseWords(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function isFullUsStateName(token: string): boolean {
  return Boolean(US_STATE_NAMES[normalizeGeoKey(token)]);
}

/** Resolve a token as an ISO country code only when it cannot be a US state / CA province. */
function unambiguousCountry(token: string): string | null {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (upper.length === 2 && (US_STATE_CODES.has(upper) || CA_PROVINCE_CODES.has(upper))) {
    return null;
  }
  return parseCountryToken(trimmed);
}

/** Two-letter token that could be either a US state / CA province or an ISO country. */
function ambiguousStateOrCountry(token: string): string | null {
  const upper = token.trim().toUpperCase();
  if (
    /^[A-Z]{2}$/.test(upper) &&
    (AMBIGUOUS_STATE_COUNTRY_CODES.has(upper) || AMBIGUOUS_PROVINCE_COUNTRY_CODES.has(upper))
  ) {
    return upper;
  }
  return null;
}

interface TokenParse {
  tokens: string[];
  remote: boolean;
}

function tokenizeLocation(raw: string): TokenParse | null {
  const sanitized = sanitizeLocationInput(raw);
  if (!sanitized) return null;

  const value = sanitized.replace(/\s+/g, " ").trim();
  let remote = REMOTE_ANYWHERE_PATTERN.test(value);

  let working = value;
  if (REMOTE_PREFIX_PATTERN.test(working)) {
    remote = true;
    working = working.replace(REMOTE_PREFIX_PATTERN, "").trim();
  }

  const tokens = working
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => {
      if (REMOTE_TOKEN_PATTERN.test(part)) {
        remote = true;
        return false;
      }
      return true;
    })
    .map((part) => part.replace(/\s*\bremote\b\s*/gi, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return { tokens, remote };
}

/**
 * Gazetteer records carry GeoNames admin codes ("05", "ENG") for every
 * country; only US states and CA provinces are meaningful in our display
 * format, so anything else is dropped rather than shown as a cryptic code.
 */
function displayRegion(region: string | null, countryCode: string): string | null {
  if (!region) return null;
  const upper = region.toUpperCase();
  if (countryCode === "US" && US_STATE_CODES.has(upper)) return upper;
  if (countryCode === "CA" && CA_PROVINCE_CODES.has(upper)) return upper;
  return null;
}

function resolvedPlace(
  place: CanonicalPlace,
  provider: ResolvedPlace["provider"],
  gazetteerHit: boolean,
): ResolvedPlace {
  return {
    place: { ...place, region: displayRegion(place.region, place.countryCode) },
    provider,
    confidence: scoreFromProvider(provider, gazetteerHit),
  };
}

function gazetteerPlace(place: CanonicalPlace, remote: boolean): ResolvedPlace {
  return resolvedPlace({ ...place, remote }, "gazetteer", true);
}

/**
 * Resolve an ambiguous trailing two-letter token (state-or-country) using the
 * preceding city token as corroboration. Returns null when neither
 * interpretation is corroborated — never guesses the United States.
 */
function resolveAmbiguousTail(
  cityTokens: string[],
  code: string,
  remote: boolean,
): ResolvedPlace | null {
  // The city may be one token or several ("ר"ג, Tel Aviv, IL"); try the
  // joined string first, then each token from the right.
  const candidates = [cityTokens.join(", "), ...[...cityTokens].reverse()].filter(Boolean);

  for (const cityToken of candidates) {
    const asUsState = US_STATE_CODES.has(code)
      ? lookupCity(cityToken, { countryCode: "US", region: code })
      : null;
    const asCaProvince = CA_PROVINCE_CODES.has(code)
      ? lookupCity(cityToken, { countryCode: "CA", region: code })
      : null;
    const asCountry = lookupCity(cityToken, { countryCode: code });

    const usHit = asUsState?.countryCode === "US" && asUsState.region === code;
    const caHit = asCaProvince?.countryCode === "CA" && asCaProvince.region === code;
    const countryHit = asCountry?.countryCode === code;

    // The country reading wins ties: a gazetteer city inside that country is
    // stronger evidence than a same-named city in the state/province.
    if (countryHit) return gazetteerPlace(asCountry!, remote);
    if (usHit) return gazetteerPlace(asUsState!, remote);
    if (caHit) return gazetteerPlace(asCaProvince!, remote);
  }

  // "City, XX, NL" with a middle two-letter admin code follows the standard
  // ATS city-region-country convention; a province reading would leave the
  // middle token meaningless ("Middenmeer, NH, NL" is the Netherlands, not
  // Newfoundland). City stays as written — convention, not a guess.
  const middle = cityTokens.at(-1) ?? "";
  if (cityTokens.length >= 2 && /^[A-Za-z]{2}$/.test(middle.trim())) {
    const city = cityTokens.slice(0, -1).join(", ");
    return resolvedPlace(
      { city: titleCaseWords(city), region: null, countryCode: code, remote },
      "parser",
      false,
    );
  }

  // Neither interpretation corroborated: honest unknown, never guess the US.
  return null;
}

/** Resolve remaining tokens as a city once country (and maybe region) are known. */
function resolveCityWithContext(
  cityTokens: string[],
  region: string | null,
  countryCode: string,
  remote: boolean,
): ResolvedPlace {
  const cityToken = cityTokens.join(", ");

  const alias = lookupAlias(cityToken) ?? (cityTokens[0] ? lookupAlias(cityTokens[0]) : null);

  // Legacy ATS rows often have a stale ", United States" appended to foreign
  // locations ("Bangalore, United States", "Lithuania, United States"). When
  // the remaining token is itself a country, a US state name, or a city known
  // only elsewhere, trust that over the trailing claim instead of inventing
  // a US place. Alias hits ("New York") take precedence.
  if (!region && cityToken && !(alias && alias.country === countryCode)) {
    const usStateName = US_STATE_NAMES[normalizeGeoKey(cityToken)];
    if (countryCode === "US" && usStateName) {
      return resolvedPlace(
        { city: null, region: usStateName, countryCode, remote },
        "parser",
        false,
      );
    }
    const tokenCountry = unambiguousCountry(cityToken);
    if (tokenCountry && tokenCountry !== countryCode) {
      return resolvedPlace(
        { city: null, region: null, countryCode: tokenCountry, remote },
        "parser",
        false,
      );
    }
  }
  if (alias && alias.country === countryCode) {
    return gazetteerPlace(
      { city: alias.city, region: alias.region ?? region, countryCode: alias.country, remote: false },
      remote,
    );
  }

  const gazetteer = cityToken ? lookupCity(cityToken, { countryCode, region }) : null;
  if (gazetteer && gazetteer.countryCode === countryCode) {
    return gazetteerPlace({ ...gazetteer, region: gazetteer.region ?? region }, remote);
  }

  if (countryCode === "US") {
    // Stale-US strip: the city exists only outside the claimed country.
    if (alias) {
      return gazetteerPlace(
        { city: alias.city, region: alias.region ?? null, countryCode: alias.country, remote: false },
        remote,
      );
    }
    if (gazetteer) {
      return gazetteerPlace(gazetteer, remote);
    }
  }

  return resolvedPlace(
    {
      city: cityToken ? titleCaseWords(cityToken) : null,
      region,
      countryCode,
      remote,
    },
    "parser",
    false,
  );
}

/**
 * When a comma list has no country/region structure, it may be a list of
 * well-known cities ("London, NY, Miami"). Resolve each token independently;
 * only succeed when every token is independently recognizable.
 */
function resolveCityList(tokens: string[], remote: boolean): ResolvedPlace[] {
  const out: ResolvedPlace[] = [];
  if (tokens.length > 1 && tokens.every(isFullUsStateName)) {
    return tokens.map((token) =>
      resolvedPlace(
        {
          city: null,
          region: US_STATE_NAMES[normalizeGeoKey(token)] ?? null,
          countryCode: "US",
          remote,
        },
        "parser",
        false,
      ),
    );
  }

  for (const token of tokens) {
    const alias = lookupAlias(token);
    if (alias) {
      out.push(
        gazetteerPlace(
          { city: alias.city, region: alias.region ?? null, countryCode: alias.country, remote: false },
          remote,
        ),
      );
      continue;
    }
    const gazetteer = lookupCity(token);
    if (gazetteer) {
      out.push(gazetteerPlace(gazetteer, remote));
      continue;
    }
    // An unambiguous US state token inside a city list ("London, NY, Miami")
    // stands for a state-level place; ambiguous codes (IL, IN, …) do not.
    const upper = token.trim().toUpperCase();
    const stateCode = parseRegionToken(token, "US");
    if (stateCode && !ambiguousStateOrCountry(upper) && US_STATE_CODES.has(stateCode)) {
      out.push(
        resolvedPlace({ city: null, region: stateCode, countryCode: "US", remote }, "parser", false),
      );
      continue;
    }
    return [];
  }
  return out;
}

/**
 * Parse one location string into zero or more canonical places.
 *
 * Honesty rules:
 * - A country is only assigned when the string contains an unambiguous country
 *   token, a corroborated ambiguous token, or a gazetteer city hit.
 * - Ambiguous state-vs-country tokens (IL, IN, DE, CA, …) require a gazetteer
 *   corroboration; otherwise the string resolves to no places at all.
 * - Unknown countries are never defaulted to the United States.
 */
export function resolveLocationCandidates(raw: string): ResolvedPlace[] {
  const parsed = tokenizeLocation(raw);
  if (!parsed) return [];
  const { remote } = parsed;
  const tokens = [...parsed.tokens];

  if (tokens.length === 0) {
    // Pure "Remote" with no geography: honest unknown, no invented country.
    return [];
  }

  // Whole-string alias ("NYC", "Greater Seattle Area" style entries).
  const wholeAlias = lookupAlias(tokens.join(" ")) ?? lookupAlias(tokens.join(", "));
  if (wholeAlias && tokens.length <= 2) {
    return [
      gazetteerPlace(
        {
          city: wholeAlias.city,
          region: wholeAlias.region ?? null,
          countryCode: wholeAlias.country,
          remote: false,
        },
        remote,
      ),
    ];
  }

  // 1. Unambiguous country anywhere in the list (prefer the last occurrence).
  let countryCode: string | null = null;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const code = unambiguousCountry(tokens[i] ?? "");
    if (code) {
      countryCode = code;
      tokens.splice(i, 1);
      break;
    }
  }

  // 2. Region token (US state / CA province) once a country is known or implied.
  let region: string | null = null;
  if (countryCode === null || countryCode === "US" || countryCode === "CA") {
    for (let i = tokens.length - 1; i >= 0; i--) {
      const token = tokens[i] ?? "";
      // Two-letter tokens that could also be a country are handled in step 3.
      if (countryCode === null && ambiguousStateOrCountry(token) && !isFullUsStateName(token)) {
        continue;
      }
      const maybeRegion = parseRegionToken(token, countryCode);
      if (!maybeRegion) continue;
      if (lookupAlias(token)) continue; // "LA" stays Los Angeles, not Louisiana
      // Without an explicit country, a bare region token only anchors a place
      // when it has exactly one neighbor ("Austin, TX"). Longer lists
      // ("London, NY, Miami") are treated as city lists instead.
      if (countryCode === null && tokens.length > 2) {
        continue;
      }
      region = maybeRegion;
      tokens.splice(i, 1);
      if (countryCode === null) {
        countryCode = US_STATE_CODES.has(maybeRegion) ? "US" : "CA";
      }
      break;
    }
  }

  // 3. Ambiguous trailing token (IL/IN/DE/…): corroborate, never guess.
  if (countryCode === null && region === null && tokens.length >= 2) {
    const tail = tokens.at(-1) ?? "";
    const ambiguous = ambiguousStateOrCountry(tail);
    if (ambiguous) {
      const resolved = resolveAmbiguousTail(tokens.slice(0, -1), ambiguous, remote);
      return resolved ? [resolved] : [];
    }
  }

  if (countryCode === null && region === null) {
    // 4. No structure: single known city, or a list of known cities.
    if (tokens.length === 1) {
      const single = resolveCityList(tokens, remote);
      return single;
    }
    const list = resolveCityList(tokens, remote);
    return list;
  }

  if (tokens.length === 0) {
    if (region) {
      return [
        resolvedPlace(
          { city: null, region, countryCode: countryCode ?? (US_STATE_CODES.has(region) ? "US" : "CA"), remote },
          "parser",
          false,
        ),
      ];
    }
    if (countryCode) {
      return [resolvedPlace({ city: null, region: null, countryCode, remote }, "parser", false)];
    }
    return [];
  }

  if (countryCode === null && region !== null) {
    countryCode = US_STATE_CODES.has(region) ? "US" : "CA";
  }
  if (countryCode === null) return [];

  // 5. Region may appear before the city in country-first strings
  //    ("ca, santa clara, US"): detect it among the remaining tokens.
  if (!region && (countryCode === "US" || countryCode === "CA")) {
    for (let i = 0; i < tokens.length; i++) {
      const maybeRegion = parseRegionToken(tokens[i] ?? "", countryCode);
      if (maybeRegion && tokens.length > 1 && !lookupAlias(tokens[i] ?? "")) {
        region = maybeRegion;
        tokens.splice(i, 1);
        break;
      }
    }
  }

  return [resolveCityWithContext(tokens, region, countryCode, remote)];
}

/** Single best place for one location string, or null when unparseable. */
export function resolveLocationString(raw: string): ResolvedPlace | null {
  return resolveLocationCandidates(raw)[0] ?? null;
}

export function parseCanonicalPlace(raw: string): CanonicalPlace | null {
  return resolveLocationString(raw)?.place ?? null;
}

export function parseStructuredPlaceInput(input: StructuredPlaceInput): ResolvedPlace | null {
  const remote = Boolean(input.remote);
  const countryCode = input.countryCode?.trim().toUpperCase() || null;
  const region = input.region?.trim().toUpperCase() || null;
  const city = input.city?.trim() || null;

  if (input.rawLabel?.trim()) {
    const fromRaw = resolveLocationString(input.rawLabel);
    if (fromRaw) {
      return {
        place: {
          city: city ? titleCaseWords(city) : fromRaw.place.city,
          region: region ?? fromRaw.place.region,
          countryCode: countryCode ?? fromRaw.place.countryCode,
          remote: remote || fromRaw.place.remote,
        },
        confidence: countryCode
          ? Math.max(scoreFromProvider("structured", false), fromRaw.confidence)
          : fromRaw.confidence,
        provider: countryCode ? "structured" : fromRaw.provider,
      };
    }
    if (!city && !countryCode) {
      return null;
    }
  }

  if (!city && !region && !countryCode) {
    return null;
  }

  let resolvedCountry = countryCode;
  if (region && !resolvedCountry) {
    // Structured region fields are adapter-provided, so the US/CA inference is safe.
    resolvedCountry = US_STATE_CODES.has(region) ? "US" : CA_PROVINCE_CODES.has(region) ? "CA" : null;
  }
  if (!resolvedCountry && city) {
    const gazetteer = lookupCity(city, { region });
    if (gazetteer) {
      return resolvedPlace({ ...gazetteer, remote }, "gazetteer", true);
    }
    return null;
  }
  if (!resolvedCountry) return null;

  const gazetteerHit = Boolean(
    city && lookupCity(city, { countryCode: resolvedCountry, region }),
  );

  return resolvedPlace(
    {
      city: city ? titleCaseWords(city) : null,
      region,
      countryCode: resolvedCountry,
      remote,
    },
    "structured",
    gazetteerHit,
  );
}

export function canonicalizeLocationParts(rawParts: readonly string[]): ResolvedPlace[] {
  const out: ResolvedPlace[] = [];
  const seen = new Set<string>();

  for (const raw of rawParts) {
    for (const resolved of resolveLocationCandidates(raw)) {
      const key = [
        resolved.place.city ?? "",
        resolved.place.region ?? "",
        resolved.place.countryCode,
        resolved.place.remote ? "1" : "0",
      ].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(resolved);
    }
  }

  return out;
}

export function canonicalizeScrapedLocationPart(raw: string): string | null {
  const resolved = resolveLocationString(raw);
  if (!resolved) return null;
  return formatCanonicalPlace(resolved.place);
}
