/**
 * Product-wide internship geography. When enabled, scrape upserts persist only
 * roles with at least one scoped location and trim multi-location roles to
 * scoped places. Read paths keep the same filter as a defense-in-depth guard.
 */
export const US_ONLY_INTERNSHIPS = true;

export const PRODUCT_SCOPE_COUNTRY_CODES = ["US"] as const;
