import { normalizeCountryCode } from "./location.ts";

export interface AtsPostalAddress {
  addressLocality?: string;
  addressRegion?: string;
  addressCountry?: string;
}

/** Human-readable label from ATS postalAddress blocks (Ashby, etc.). */
export function formatAtsPostalAddress(address: AtsPostalAddress | null | undefined): string | null {
  if (!address) {
    return null;
  }

  const locality = address.addressLocality?.trim() || "";
  const region = address.addressRegion?.trim() || "";
  const country = address.addressCountry?.trim() || "";

  const parts = [locality, region, country].filter(Boolean);
  if (parts.length === 0) {
    return null;
  }

  return parts.join(", ");
}

/** When country is present and not US, returns null; otherwise a display label. */
export function formatUsAtsPostalAddress(
  address: AtsPostalAddress | null | undefined,
): string | null {
  const label = formatAtsPostalAddress(address);
  if (!label) {
    return null;
  }

  const countryCode = normalizeCountryCode(address?.addressCountry);
  if (countryCode && countryCode !== "US") {
    return null;
  }

  return label;
}
