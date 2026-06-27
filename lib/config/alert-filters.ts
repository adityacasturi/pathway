import type { FeedSeason } from "../feed/types.ts";

export const ALERT_SEASONS = ["Summer", "Fall", "Spring", "Winter"] as const;
export type AlertSeason = (typeof ALERT_SEASONS)[number];

export const ALERT_COUNTRY_CODES = [
  "US",
  "CA",
  "GB",
  "IE",
  "DE",
  "FR",
  "NL",
  "CH",
  "SE",
  "NO",
  "DK",
  "FI",
  "PL",
  "ES",
  "IT",
  "PT",
  "BE",
  "AT",
  "IL",
  "IN",
  "CN",
  "HK",
  "TW",
  "JP",
  "KR",
  "SG",
  "AU",
  "NZ",
  "MX",
  "BR",
  "AE",
] as const;

export type AlertCountryCode = (typeof ALERT_COUNTRY_CODES)[number];

const ALERT_SEASON_SET = new Set<string>(ALERT_SEASONS);
const ALERT_COUNTRY_SET = new Set<string>(ALERT_COUNTRY_CODES);

export function isAlertSeason(value: string): value is AlertSeason {
  return ALERT_SEASON_SET.has(value);
}

export function isAlertCountryCode(value: string): value is AlertCountryCode {
  return ALERT_COUNTRY_SET.has(value);
}

export function normalizeAlertSeasons(values: readonly string[] | null | undefined): AlertSeason[] | null {
  if (!values?.length) {
    return null;
  }
  const out: AlertSeason[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    if (!isAlertSeason(raw) || seen.has(raw)) {
      continue;
    }
    seen.add(raw);
    out.push(raw);
  }
  return out.length > 0 ? out : null;
}

export function normalizeAlertCountries(
  values: readonly string[] | null | undefined,
): AlertCountryCode[] | null {
  if (!values?.length) {
    return null;
  }
  const out: AlertCountryCode[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const code = raw.trim().toUpperCase();
    if (!isAlertCountryCode(code) || seen.has(code)) {
      continue;
    }
    seen.add(code);
    out.push(code);
  }
  return out.length > 0 ? out : null;
}

export function feedSeasonToAlertSeason(season: FeedSeason): AlertSeason {
  return season;
}
