import aliasesJson from "./data/aliases.json" with { type: "json" };
import citiesBundle from "./data/cities.json" with { type: "json" };
import { normalizeGeoKey } from "./countries.ts";
import type { CanonicalPlace } from "./types.ts";

type CityRecord = {
  name: string;
  region: string | null;
  country: string;
  population: number;
  lat?: number;
  lng?: number;
};

type AliasRecord = {
  city: string;
  region?: string;
  country: string;
};

let cityIndex: Map<string, CityRecord[]> | null = null;
let aliasIndex: Map<string, AliasRecord> | null = null;

function loadGazetteer(): void {
  if (cityIndex) return;

  cityIndex = new Map();
  aliasIndex = new Map();

  const aliases = aliasesJson as Record<string, AliasRecord>;
  for (const [key, value] of Object.entries(aliases)) {
    aliasIndex.set(normalizeGeoKey(key), value);
  }

  const cities = (citiesBundle as { cities?: CityRecord[] }).cities ?? [];

  for (const city of cities) {
    const key = normalizeGeoKey(city.name);
    const bucket = cityIndex.get(key) ?? [];
    bucket.push(city);
    cityIndex.set(key, bucket);
  }

  for (const alias of aliasIndex.values()) {
    const key = normalizeGeoKey(alias.city);
    if (!cityIndex.has(key)) {
      cityIndex.set(key, [
        {
          name: alias.city,
          region: alias.region ?? null,
          country: alias.country,
          population: 0,
        },
      ]);
    }
  }
}

export function lookupAlias(token: string): AliasRecord | null {
  loadGazetteer();
  return aliasIndex!.get(normalizeGeoKey(token)) ?? null;
}

export function lookupCity(
  name: string,
  hints: { countryCode?: string | null; region?: string | null } = {},
): CanonicalPlace | null {
  loadGazetteer();

  const alias = lookupAlias(name);
  if (alias) {
    if (hints.countryCode && alias.country !== hints.countryCode.toUpperCase()) {
      // alias country mismatch — fall through to gazetteer
    } else {
      return {
        city: alias.city,
        region: alias.region ?? null,
        countryCode: alias.country,
        remote: false,
      };
    }
  }

  const key = normalizeGeoKey(name);
  const matches = cityIndex!.get(key) ?? [];
  if (matches.length === 0) return null;

  const countryHint = hints.countryCode?.toUpperCase() ?? null;
  const regionHint = hints.region?.toUpperCase() ?? null;

  let filtered = matches;
  if (countryHint) {
    const byCountry = matches.filter((m) => m.country === countryHint);
    if (byCountry.length > 0) filtered = byCountry;
  }
  if (regionHint) {
    const byRegion = filtered.filter((m) => m.region?.toUpperCase() === regionHint);
    if (byRegion.length > 0) filtered = byRegion;
  }

  const best = filtered.sort((a, b) => b.population - a.population)[0];
  if (!best) return null;

  return {
    city: best.name,
    region: best.region,
    countryCode: best.country,
    remote: false,
  };
}

export function gazetteerHasData(): boolean {
  loadGazetteer();
  return (cityIndex?.size ?? 0) > 0;
}

function pickCityRecord(
  name: string,
  hints: { countryCode?: string | null; region?: string | null } = {},
): CityRecord | null {
  loadGazetteer();

  const key = normalizeGeoKey(name);
  const matches = cityIndex!.get(key) ?? [];
  if (matches.length === 0) return null;

  const countryHint = hints.countryCode?.toUpperCase() ?? null;
  const regionHint = hints.region?.toUpperCase() ?? null;

  let filtered = matches;
  if (countryHint) {
    const byCountry = matches.filter((entry) => entry.country === countryHint);
    if (byCountry.length > 0) filtered = byCountry;
  }
  if (regionHint) {
    const byRegion = filtered.filter((entry) => entry.region?.toUpperCase() === regionHint);
    if (byRegion.length > 0) filtered = byRegion;
  }

  return filtered.sort((a, b) => b.population - a.population)[0] ?? null;
}

export function lookupCityCoordinates(
  name: string,
  hints: { countryCode?: string | null; region?: string | null } = {},
): { lat: number; lng: number } | null {
  const record = pickCityRecord(name, hints);
  if (!record || record.lat == null || record.lng == null) return null;
  if (!Number.isFinite(record.lat) || !Number.isFinite(record.lng)) return null;
  if (record.lat === 0 && record.lng === 0) return null;
  return { lat: record.lat, lng: record.lng };
}
