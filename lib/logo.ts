/**
 * Lowercased company key for client-side failed-logo caching.
 */
export function normalizeLogoCompany(company: string): string {
  return company.trim().toLowerCase().replace(/\s+/g, " ");
}

export function logoUrl(company: string): string {
  return `/api/logo?company=${encodeURIComponent(company.trim())}&v=4`;
}
