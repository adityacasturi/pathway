import manifest from "./static-slug-manifest.json" with { type: "json" };

const MANIFEST_LOGO_SLUGS = new Set(manifest as string[]);

export function companyLogoStaticUrl(slug: string): string {
  return `/company-logos/${slug}.png`;
}

/** True when a static PNG should be used (DB key preferred; manifest is build fallback). */
export function companyHasStaticLogo(
  slug: string | null | undefined,
  logoAssetKey?: string | null,
): slug is string {
  const key = logoAssetKey?.trim() || slug?.trim();
  if (!key) return false;

  if (logoAssetKey?.trim()) return true;
  return MANIFEST_LOGO_SLUGS.has(key);
}
