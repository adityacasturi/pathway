import { access, constants, mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logoDevReferer } from "./upstream.ts";
import {
  APP_LOGO_PX,
  buildLogoDevImageUrl,
  resolveLogoDevTarget,
  type LogoDevImageTarget,
} from "./logo-dev-url.ts";

export interface CompanyLogoDownloadEntry {
  slug: string;
  name: string;
  websiteUrl: string | null;
}

export const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const COMPANY_LOGOS_DIR = path.join(REPO_ROOT, "public/company-logos");
export const STATIC_SLUG_MANIFEST_PATH = path.join(REPO_ROOT, "lib/logo/static-slug-manifest.json");

export type DownloadLogoResult = "ok" | "skipped" | "failed";

export function companyLogoFilePath(slug: string, outDir = COMPANY_LOGOS_DIR): string {
  return path.join(outDir, `${slug}.png`);
}

export async function writeStaticSlugManifest(outDir = COMPANY_LOGOS_DIR): Promise<string[]> {
  await mkdir(outDir, { recursive: true });
  const files = await readdir(outDir);
  const slugs = files
    .filter((name) => name.endsWith(".png"))
    .map((name) => name.slice(0, -".png".length))
    .filter((slug) => slug.length > 0)
    .sort((a, b) => a.localeCompare(b));
  await writeFile(STATIC_SLUG_MANIFEST_PATH, `${JSON.stringify(slugs, null, 2)}\n`, "utf8");
  return slugs;
}

export async function downloadCompanyLogoFile(
  entry: CompanyLogoDownloadEntry,
  token: string,
  options?: {
    size?: number;
    force?: boolean;
    outDir?: string;
  },
): Promise<DownloadLogoResult> {
  const outDir = options?.outDir ?? COMPANY_LOGOS_DIR;
  const outPath = companyLogoFilePath(entry.slug, outDir);
  const size = options?.size ?? APP_LOGO_PX;
  const force = options?.force ?? false;

  if (!force && (await fileExists(outPath))) {
    return "skipped";
  }

  const target = resolveLogoDevTarget(entry.name, entry.websiteUrl);
  const url = buildLogoDevImageUrl(target, token, size);
  if (!url) {
    return "failed";
  }

  const response = await fetch(url, { headers: { Referer: logoDevReferer() } });
  if (!response.ok) {
    return "failed";
  }

  const buf = Buffer.from(await response.arrayBuffer());
  if (buf.length < 32) {
    return "failed";
  }

  await mkdir(outDir, { recursive: true });
  await writeFile(outPath, buf);
  return "ok";
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function downloadCompanyLogoByTarget(
  slug: string,
  target: LogoDevImageTarget,
  token: string,
  options?: { size?: number; force?: boolean; outDir?: string },
): Promise<DownloadLogoResult> {
  const name = target.company ?? target.domain ?? slug;
  return downloadCompanyLogoFile({ slug, name, websiteUrl: null }, token, options);
}
