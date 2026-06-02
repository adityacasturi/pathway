import type { CompanySourceConfig } from "../types.ts";
import type { ByteDanceJob } from "./bytedance.ts";

export type ByteDanceBrandScope = "bytedance" | "tiktok";

export const TIKTOK_CAREERS_ORIGIN = "https://lifeattiktok.com";
export const TIKTOK_DEFAULT_SOURCE_URL = `${TIKTOK_CAREERS_ORIGIN}/early-careers`;

export const BYTEDANCE_DEFAULT_SEARCH_QUERIES = [
  "intern",
  "software engineer intern",
  "engineering intern",
  "research intern",
] as const;

export const TIKTOK_DEFAULT_SEARCH_QUERIES = [
  "TikTok intern",
  "TikTok Shop intern",
  "software engineer intern TikTok",
  "machine learning intern TikTok",
  "recommendation intern",
  "trust and safety intern",
] as const;

/**
 * Roles surfaced on lifeattiktok.com but absent from the supplier search API
 * (verified 2026-06). Fetched via lifeattiktok HTML during TikTok scrapes.
 */
export const TIKTOK_SUPPLIER_SEARCH_GAP_JOB_IDS = ["7534878965941766408"] as const;

export interface ByteDanceBrandBoard {
  scope: ByteDanceBrandScope;
  searchQueries: string[];
  supplementalJobIds: string[];
}

export function resolveByteDanceBrandScope(source: CompanySourceConfig): ByteDanceBrandScope {
  return source.companySlug === "tiktok" ? "tiktok" : "bytedance";
}

export function parseByteDanceBrandBoard(source: CompanySourceConfig): ByteDanceBrandBoard {
  const scope = resolveByteDanceBrandScope(source);
  const raw = source.boardToken?.trim() ?? "";
  const [queryPart, supplementalPart] = raw.includes("|") ? raw.split("|", 2) : [raw, ""];

  const fromToken = queryPart
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const searchQueries =
    fromToken.length > 0 && !fromToken.every((part) => part.length <= 3)
      ? fromToken
      : scope === "tiktok"
        ? [...TIKTOK_DEFAULT_SEARCH_QUERIES]
        : [...BYTEDANCE_DEFAULT_SEARCH_QUERIES];

  const supplementalFromToken = supplementalPart
    .split(",")
    .map((part) => part.trim())
    .filter((id) => /^\d{15,}$/.test(id));

  const supplementalJobIds =
    scope === "tiktok"
      ? [...new Set([...TIKTOK_SUPPLIER_SEARCH_GAP_JOB_IDS, ...supplementalFromToken])]
      : supplementalFromToken;

  return { scope, searchQueries, supplementalJobIds };
}

export function buildScopedPostingUrl(scope: ByteDanceBrandScope, _locale: string, jobId: string): string {
  if (scope === "tiktok") {
    return `${TIKTOK_CAREERS_ORIGIN}/search/${jobId}`;
  }
  return `https://joinbytedance.com/search/${jobId}`;
}

/** TikTok Discover: core TikTok product + TikTok Shop; exclude other ByteDance brands. */
export function isByteDanceTikTokScopedJob(job: ByteDanceJob): boolean {
  const text = [job.title, job.description, job.requirement]
    .map((part) => part?.trim() || "")
    .filter(Boolean)
    .join("\n");

  if (/\bTikTok\b/i.test(text) || /\bTikTok Shop\b/i.test(text)) {
    return true;
  }

  if (/\bE-?Commerce\b/i.test(text) || /\becommerce\b/i.test(text)) {
    return true;
  }

  if (/\bLIVE\b/.test(text) && /\bintern\b/i.test(job.title ?? "")) {
    return true;
  }

  if (/\bPICO\b/i.test(text) && !/\bTikTok\b/i.test(text)) {
    return false;
  }

  if (/\bCapCut\b/i.test(text) && !/\bTikTok\b/i.test(text)) {
    return false;
  }

  if (/\bLark\b/i.test(text) && !/\bTikTok\b/i.test(text)) {
    return false;
  }

  if (/\bGlobal Frontier Tech\b/i.test(text) && !/\bTikTok\b/i.test(text)) {
    return false;
  }

  return false;
}

export function shouldIncludeJobForBrandScope(scope: ByteDanceBrandScope, job: ByteDanceJob): boolean {
  if (scope === "bytedance") {
    return true;
  }
  return isByteDanceTikTokScopedJob(job);
}
