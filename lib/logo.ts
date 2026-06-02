/**
 * Lowercased company key for client-side failed-logo caching (name fallback).
 */
export function normalizeLogoCompany(company: string): string {
  return company.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Hostname from a company website URL for logo.dev domain lookup. */
export function logoDomainFromWebsite(websiteUrl: string | null | undefined): string | null {
  const raw = websiteUrl?.trim();
  if (!raw) return null;

  try {
    const host = new URL(raw.includes("://") ? raw : `https://${raw}`).hostname
      .replace(/^www\./i, "")
      .toLowerCase();
    return host.includes(".") ? host : null;
  } catch {
    return null;
  }
}

export function logoCacheKey(company: string, domain?: string | null): string {
  const host = domain?.trim().toLowerCase();
  if (host) return `domain:${host}`;
  return `name:${normalizeLogoCompany(company)}`;
}

export function logoUrl(company: string, domain?: string | null): string {
  const params = new URLSearchParams({
    company: company.trim(),
    v: "6",
  });
  const host = domain?.trim().toLowerCase().replace(/^www\./, "");
  if (host && host.includes(".")) {
    params.set("domain", host);
  }
  return `/api/logo?${params.toString()}`;
}
