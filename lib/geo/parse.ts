import {
  CA_PROVINCE_CODES,
  normalizeGeoKey,
  normalizeCountryCode,
  parseCountryToken,
  parseRegionToken,
  US_STATE_CODES,
} from "./countries.ts";
import { lookupAlias, lookupCity } from "./gazetteer.ts";
import { sanitizeLocationInput } from "./sanitize.ts";
import type { CanonicalPlace, ResolvedPlace, StructuredPlaceInput } from "./types.ts";
import { scoreFromProvider } from "./confidence.ts";
import { formatCanonicalPlace } from "./format.ts";

const REMOTE_PATTERN = /\bremote\b/i;

function titleCaseWords(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function canonicalCityName(
  token: string,
  region: string | null,
  countryCode: string,
): string | null {
  const alias = lookupAlias(token);
  if (alias?.city) return alias.city;

  const key = normalizeGeoKey(token);
  if (!key || key === "remote") return null;
  if (parseCountryToken(token) || parseRegionToken(token, countryCode)) return null;

  return titleCaseWords(token.trim());
}

export function parseStructuredPlaceInput(input: StructuredPlaceInput): ResolvedPlace | null {
  const remote = Boolean(input.remote);
  const countryCode = input.countryCode?.trim().toUpperCase() ?? null;
  const region = input.region?.trim().toUpperCase() ?? null;
  const city = input.city?.trim() ?? null;

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
        confidence: Math.max(scoreFromProvider("structured", false), fromRaw.confidence),
        provider: "structured",
      };
    }
  }

  if (!city && !region && !countryCode && input.rawLabel) {
    return resolveLocationString(input.rawLabel);
  }

  if (!city && !region && !countryCode) {
    if (!remote) return null;
    return null;
  }

  let resolvedCountry = countryCode;
  if (region && !countryCode) {
    resolvedCountry = US_STATE_CODES.has(region)
      ? "US"
      : CA_PROVINCE_CODES.has(region)
        ? "CA"
        : resolvedCountry;
  }

  const gazetteerHit =
    city &&
    resolvedCountry &&
    lookupCity(city, { countryCode: resolvedCountry, region }) !== null;

  if (!resolvedCountry) {
    return null;
  }

  return {
    place: {
      city: city ? titleCaseWords(city) : null,
      region,
      countryCode: resolvedCountry,
      remote,
    },
    confidence: scoreFromProvider("structured", Boolean(gazetteerHit)),
    provider: "structured",
  };
}

export function parseCanonicalPlace(raw: string): CanonicalPlace | null {
  const resolved = resolveLocationString(raw);
  return resolved?.place ?? null;
}

export function resolveLocationString(raw: string): ResolvedPlace | null {
  return resolveLocationStringInternal(raw, { allowStaleUsStrip: true });
}

function resolveLocationStringInternal(
  raw: string,
  options: { allowStaleUsStrip: boolean },
): ResolvedPlace | null {
  const sanitized = sanitizeLocationInput(raw);
  if (!sanitized) return null;

  const value = sanitized.replace(/\s+/g, " ").trim();
  const normalizedValue = normalizeGeoKey(value);

  if (
    /\bany spacex site\b/.test(normalizedValue) ||
    (/\bflexible\b/.test(normalizedValue) && /\bspacex\b/.test(normalizedValue))
  ) {
    return {
      place: { city: null, region: null, countryCode: "US", remote: false },
      confidence: scoreFromProvider("parser", false),
      provider: "parser",
    };
  }

  if (/^remote\b/i.test(value)) {
    const remainder = value.replace(/^remote\b[,\s-]*/i, "").trim();
    const countryCode =
      (remainder ? parseCountryToken(remainder) : null) ??
      (remainder && parseRegionToken(remainder, "US") ? "US" : null);
    if (!countryCode) {
      return null;
    }
    return {
      place: { city: null, region: null, countryCode, remote: true },
      confidence: scoreFromProvider("parser", false),
      provider: "parser",
    };
  }

  const remote = REMOTE_PATTERN.test(value);
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/^remote$/i.test(part));

  if (parts.length === 0) {
    return null;
  }

  let countryCode: string | null = null;
  for (const part of parts) {
    const c = parseCountryToken(part);
    if (c) countryCode = c;
  }

  let workingParts = [...parts];
  let region: string | null = null;

  const lastToken = workingParts.at(-1) ?? "";
  const trailingRegion = parseRegionToken(lastToken, countryCode);
  const trailingCountry = parseCountryToken(lastToken);
  const trailingIsoCountry =
    !trailingCountry && /^[A-Za-z]{2}$/.test(lastToken)
      ? normalizeCountryCode(lastToken)
      : null;

  if (options.allowStaleUsStrip && trailingCountry === "US" && workingParts.length > 1) {
    const prefix = workingParts.slice(0, -1).join(", ");
    const prefixResolved = resolveLocationStringInternal(prefix, { allowStaleUsStrip: false });
    if (prefixResolved && prefixResolved.place.countryCode !== "US") {
      return prefixResolved;
    }
  }

  if (
    trailingIsoCountry &&
    trailingIsoCountry !== "US" &&
    workingParts.length === 2 &&
    lookupCity(workingParts[0] ?? "", { countryCode: trailingIsoCountry })
  ) {
    countryCode = trailingIsoCountry;
    workingParts = workingParts.slice(0, -1);
  } else if (
    trailingRegion &&
    US_STATE_CODES.has(trailingRegion) &&
    (!trailingCountry || lastToken.toUpperCase() === trailingRegion)
  ) {
    region = trailingRegion;
    countryCode = "US";
    workingParts = workingParts.slice(0, -1);
  } else if (trailingCountry && !(lastToken.toUpperCase() === "CA" && trailingRegion === "CA")) {
    countryCode = trailingCountry;
    workingParts = workingParts.slice(0, -1);
  }

  if (workingParts.length > 0 && !region) {
    const lastPart = workingParts.at(-1) ?? "";
    if (!lookupAlias(lastPart)) {
      const maybeRegion = parseRegionToken(lastPart, countryCode);
      if (maybeRegion) {
        region = maybeRegion;
        workingParts = workingParts.slice(0, -1);
        if (US_STATE_CODES.has(maybeRegion)) {
          countryCode = "US";
        } else if (CA_PROVINCE_CODES.has(maybeRegion)) {
          countryCode = "CA";
        }
      }
    }
  }

  const wholeKey = normalizeGeoKey(workingParts.join(" "));
  const wholeAlias = lookupAlias(wholeKey) ?? lookupAlias(workingParts.join(" "));
  if (wholeAlias && workingParts.length <= 2) {
    const usRegionHint = region && US_STATE_CODES.has(region);
    if (!usRegionHint || wholeAlias.country === "US") {
      return {
        place: {
          city: wholeAlias.city,
          region: wholeAlias.region ?? region,
          countryCode: usRegionHint ? "US" : wholeAlias.country,
          remote,
        },
        confidence: scoreFromProvider("gazetteer", true),
        provider: "gazetteer",
      };
    }
  }

  if (workingParts.length === 0) {
    if (region) {
      countryCode ??= region.length === 2 && US_STATE_CODES.has(region) ? "US" : "CA";
      return {
        place: { city: null, region, countryCode, remote },
        confidence: scoreFromProvider("parser", false),
        provider: "parser",
      };
    }
    const loneAlias = lookupAlias(parts[0] ?? "");
    if (loneAlias) {
      return {
        place: {
          city: loneAlias.city,
          region: loneAlias.region ?? null,
          countryCode: loneAlias.country,
          remote,
        },
        confidence: scoreFromProvider("gazetteer", true),
        provider: "gazetteer",
      };
    }
    if (countryCode && parts.length === 1) {
      return {
        place: { city: null, region: null, countryCode, remote },
        confidence: scoreFromProvider("parser", false),
        provider: "parser",
      };
    }
    return null;
  }

  const cityToken = workingParts.join(", ");
  let alias = lookupAlias(cityToken) ?? lookupAlias(workingParts[0] ?? "");
  if (
    alias &&
    region &&
    US_STATE_CODES.has(region) &&
    alias.country !== "US"
  ) {
    alias = null;
  }
  const city =
    alias?.city ??
    (countryCode || region
      ? canonicalCityName(
          cityToken,
          region,
          countryCode ?? (region && US_STATE_CODES.has(region) ? "US" : "CA"),
        )
      : null);
  if (alias?.region && !region) region = alias.region;
  if (alias?.country) countryCode = alias.country;

  if (!alias && !countryCode && !region && workingParts.length === 1) {
    const gazetteer = lookupCity(workingParts[0] ?? "");
    if (gazetteer) {
      return {
        place: { ...gazetteer, remote },
        confidence: scoreFromProvider("gazetteer", true),
        provider: "gazetteer",
      };
    }
  }

  if (!city && workingParts.length === 1) {
    const gazetteer = lookupCity(workingParts[0] ?? "", {
      countryCode,
      region,
    });
    if (gazetteer) {
      return {
        place: { ...gazetteer, remote },
        confidence: scoreFromProvider("gazetteer", true),
        provider: "gazetteer",
      };
    }
  }

  if (!city && !region) {
    const loneAlias = lookupAlias(parts[0] ?? "");
    if (loneAlias) {
      return {
        place: {
          city: loneAlias.city,
          region: loneAlias.region ?? null,
          countryCode: loneAlias.country,
          remote,
        },
        confidence: scoreFromProvider("gazetteer", true),
        provider: "gazetteer",
      };
    }
    if (parts.length === 1) {
      const loneRegion = parseRegionToken(parts[0] ?? "", null);
      if (loneRegion) {
        countryCode ??= US_STATE_CODES.has(loneRegion) ? "US" : "CA";
        return {
          place: { city: null, region: loneRegion, countryCode, remote },
          confidence: scoreFromProvider("parser", false),
          provider: "parser",
        };
      }
      const gazetteer = lookupCity(parts[0] ?? "", { countryCode });
      if (gazetteer) {
        return {
          place: { ...gazetteer, remote },
          confidence: scoreFromProvider("gazetteer", true),
          provider: "gazetteer",
        };
      }
    }
    return null;
  }

  countryCode ??=
    region && US_STATE_CODES.has(region)
      ? "US"
      : region && CA_PROVINCE_CODES.has(region)
        ? "CA"
        : null;

  if (!countryCode) {
    return null;
  }

  if (city && !region) {
    const gazetteer = lookupCity(city, { countryCode, region });
    if (gazetteer) {
      return {
        place: { ...gazetteer, remote },
        confidence: scoreFromProvider("gazetteer", true),
        provider: "gazetteer",
      };
    }
  }

  return {
    place: { city, region, countryCode, remote },
    confidence: scoreFromProvider("parser", false),
    provider: "parser",
  };
}

export function canonicalizeLocationParts(rawParts: readonly string[]): ResolvedPlace[] {
  const out: ResolvedPlace[] = [];
  const seen = new Set<string>();

  for (const raw of rawParts) {
    const resolved = resolveLocationString(raw);
    if (!resolved) continue;
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

  return out;
}

export function canonicalizeScrapedLocationPart(raw: string): string | null {
  const resolved = resolveLocationString(raw);
  if (!resolved) return null;
  return formatCanonicalPlace(resolved.place);
}
