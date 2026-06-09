import type { FeedPosting } from "../feed/types.ts";

export const HOME_ACTIVITY_WINDOW_SECONDS = 7 * 24 * 60 * 60;
export const HOME_HOT_COMPANIES_POOL = 100;

export interface HotCompany {
  slug: string;
  name: string;
  websiteUrl: string | null;
  newCount: number;
}

export function parseCompanySlug(sourceId: string): string | null {
  if (!sourceId.startsWith("company:")) return null;
  const slug = sourceId.slice("company:".length).trim();
  return slug || null;
}

function isPostedSince(posting: FeedPosting, cutoffUnix: number): boolean {
  return posting.datePosted >= cutoffUnix;
}

export function buildHotCompanies(
  postings: FeedPosting[],
  input: {
    nowUnix?: number;
    limit?: number;
    excludeSlugs?: ReadonlySet<string>;
  } = {},
): HotCompany[] {
  const nowUnix = input.nowUnix ?? Math.floor(Date.now() / 1000);
  const weekCutoff = nowUnix - HOME_ACTIVITY_WINDOW_SECONDS;
  const limit = input.limit ?? HOME_HOT_COMPANIES_POOL;
  const excludeSlugs = input.excludeSlugs ?? new Set<string>();

  const counts = new Map<string, { name: string; websiteUrl: string | null; count: number }>();

  for (const posting of postings) {
    if (!isPostedSince(posting, weekCutoff)) continue;
    const slug = parseCompanySlug(posting.sourceId);
    if (!slug || excludeSlugs.has(slug)) continue;

    const existing = counts.get(slug);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(slug, {
        name: posting.company,
        websiteUrl: posting.companyWebsiteUrl,
        count: 1,
      });
    }
  }

  return [...counts.entries()]
    .map(([slug, value]) => ({
      slug,
      name: value.name,
      websiteUrl: value.websiteUrl,
      newCount: value.count,
    }))
    .sort((a, b) => b.newCount - a.newCount || a.name.localeCompare(b.name))
    .slice(0, limit);
}
