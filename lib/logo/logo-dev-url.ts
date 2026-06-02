import { logoDomainFromWebsite } from "../logo.ts";

export const APP_LOGO_PX = 128;
export const LANDING_LOGO_PX = 512;

export type LogoDevImageTarget = {
  domain?: string | null;
  company?: string | null;
};

export function resolveLogoDevTarget(
  name: string,
  websiteUrl: string | null | undefined,
): LogoDevImageTarget {
  const domain = logoDomainFromWebsite(websiteUrl);
  if (domain) {
    return { domain };
  }
  const company = name.trim();
  return company ? { company } : {};
}

export function buildLogoDevImageUrl(
  target: LogoDevImageTarget,
  token: string,
  size: number,
): string | null {
  const params = `token=${encodeURIComponent(token)}&size=${size}&format=png`;
  if (target.domain) {
    return `https://img.logo.dev/${encodeURIComponent(target.domain)}?${params}`;
  }
  if (target.company) {
    return `https://img.logo.dev/name/${encodeURIComponent(target.company)}?${params}`;
  }
  return null;
}
