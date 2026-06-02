import manifest from "./static-slug-manifest.json";

const MANIFEST_LOGO_SLUGS = new Set(manifest as string[]);

export function companyLogoStaticUrl(slug: string): string {
  return `/company-logos/${slug}.png`;
}

/** True when a static PNG should be used (DB key preferred; manifest is build fallback). */
export function companyHasStaticLogo(
  slug: string | null | undefined,
  logoAssetKey?: string | null,
): slug is string {
  if (logoAssetKey?.trim()) return true;
  if (!slug?.trim()) return false;
  return MANIFEST_LOGO_SLUGS.has(slug.trim());
}

/** @deprecated Use companyHasStaticLogo */
export function hasStaticCompanyLogo(slug: string | null | undefined): slug is string {
  return companyHasStaticLogo(slug);
}
