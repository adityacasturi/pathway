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

/** @deprecated Use {@link formatAtsPostalAddress}; kept for adapter call sites. */
export function formatUsAtsPostalAddress(
  address: AtsPostalAddress | null | undefined,
): string | null {
  return formatAtsPostalAddress(address);
}
