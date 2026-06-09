import type { StructuredPlaceInput } from "../geo/types.ts";
import { normalizeCountryCode } from "../geo/countries.ts";
import type { AtsPostalAddress } from "./ats-postal-address.ts";
import type {
  WorkdayJobPostingDetail,
  WorkdayJobPostingSummary,
} from "./adapters/workday.ts";

const WORKDAY_DESCRIPTOR_PATTERN = /^([A-Z]{2})-([A-Z]{2})-([A-Z]+)/i;

export function structuredPlaceFromPostalAddress(
  address: AtsPostalAddress | null | undefined,
  remote = false,
): StructuredPlaceInput | null {
  if (!address) return null;

  const city = address.addressLocality?.trim() || null;
  const region = address.addressRegion?.trim() || null;
  const countryRaw = address.addressCountry?.trim() || null;
  const countryCode = countryRaw ? normalizeCountryCode(countryRaw) : null;

  if (!city && !region && !countryCode) return null;

  return { city, region, countryCode, remote };
}

export function parseWorkdayDescriptor(descriptor: string): StructuredPlaceInput | null {
  const trimmed = descriptor.trim();
  const segment = trimmed.split("~")[0]?.trim() ?? trimmed;
  const match = segment.match(WORKDAY_DESCRIPTOR_PATTERN);
  if (!match) return null;

  const country = match[1]?.toUpperCase() ?? "";
  const region = match[2]?.toUpperCase() ?? "";
  const cityRaw = match[3] ?? "";
  const city = cityRaw.charAt(0) + cityRaw.slice(1).toLowerCase();

  return {
    city,
    region: country === "US" ? region : null,
    countryCode: country,
  };
}

export function parseWorkdayStructuredPlace(
  detail: WorkdayJobPostingDetail | null | undefined,
  summaryLocation: string | undefined,
): StructuredPlaceInput | null {
  const countryCode =
    detail?.jobRequisitionLocation?.country?.alpha2Code?.trim() ||
    detail?.country?.alpha2Code?.trim() ||
    null;

  const primary =
    detail?.location?.trim() ||
    detail?.jobRequisitionLocation?.descriptor?.trim() ||
    summaryLocation?.trim() ||
    "";

  if (!primary) return null;

  const fromDescriptor = parseWorkdayDescriptor(primary);
  if (fromDescriptor) {
    return {
      ...fromDescriptor,
      countryCode: fromDescriptor.countryCode ?? countryCode,
    };
  }

  return {
    rawLabel: primary,
    countryCode: countryCode ? normalizeCountryCode(countryCode) : null,
  };
}

export function collectWorkdayStructuredPlaces(
  detail: WorkdayJobPostingDetail | null | undefined,
  summary: WorkdayJobPostingSummary,
): StructuredPlaceInput[] {
  const out: StructuredPlaceInput[] = [];
  const primary = parseWorkdayStructuredPlace(detail, summary.locationsText);
  if (primary) out.push(primary);

  for (const bullet of summary.bulletFields ?? []) {
    const trimmed = bullet.trim();
    if (!trimmed) continue;
    if (/^locations?:/i.test(trimmed)) {
      const value = trimmed.replace(/^locations?:\s*/i, "").trim();
      if (value) out.push({ rawLabel: value });
      continue;
    }
    if (/,/.test(trimmed) && /\b(US|USA|United States|[A-Z]{2})\b/i.test(trimmed)) {
      out.push({ rawLabel: trimmed });
    }
  }

  return out;
}

export function structuredPlaceFromPrimaryAndCountry(
  primary: string,
  country: string | null | undefined,
): StructuredPlaceInput {
  const trimmed = primary.trim();
  const countryCode = normalizeCountryCode(country);
  if (!trimmed) {
    return { countryCode, rawLabel: null };
  }
  return { rawLabel: trimmed, countryCode };
}
