/**
 * Lowercased & trimmed company slug used in the URL path. logo.dev is
 * case-insensitive at lookup time, but the browser cache is not — normalising
 * here means "Google" and "google" share one cache entry instead of two.
 */
function slugify(company: string): string {
  return company.trim().toLowerCase();
}

export function logoUrl(company: string): string {
  const slug = encodeURIComponent(slugify(company));
  return `/api/logo?company=${slug}&v=2`;
}
