import type { FeedPosting, FeedSeason } from "../feed/types.ts";
import { normalizeUrl } from "../url.ts";

export const HOME_NEW_WINDOW_SECONDS = 24 * 60 * 60;
export const HOME_ACTIVITY_WINDOW_SECONDS = 7 * 24 * 60 * 60;

export const HOME_MAX_STARRED_ROWS = 5;
export const HOME_MAX_HOT_COMPANIES = 5;
export const HOME_MAX_INDUSTRY_SPOTLIGHT = 4;
export const HOME_MAX_SEASON_SPOTLIGHT = 4;
export const HOME_MAX_NEW_ROWS = 5;
export const HOME_MAX_SAVED_ROWS = 8;

export interface StarredPostingAlert {
  posting: FeedPosting;
  isNew: boolean;
}

export interface HotCompany {
  slug: string;
  name: string;
  websiteUrl: string | null;
  newCount: number;
}

export interface IndustryActivity {
  industrySlug: string;
  label: string;
  newCount: number;
}

export interface SeasonActivity {
  season: FeedSeason;
  newCount: number;
}

export interface MarketPulse {
  sinceYesterday: number;
  openTotal: number;
  remoteOpen: number;
  dominantSeason: FeedSeason | null;
}

export interface MarketWeekSummary {
  postedCount: number;
  remoteCount: number;
  activeCompanyCount: number;
  topSeason: FeedSeason | null;
  topLocation: { label: string; count: number } | null;
}

export interface HomeBriefing {
  marketPulse: MarketPulse;
  marketWeek: MarketWeekSummary;
  starredPostings: StarredPostingAlert[];
}

export interface CompanyIndustryInfo {
  industrySlug: string;
  industryLabel: string;
}

export interface BuildHomeBriefingInput {
  postings: FeedPosting[];
  nowUnix?: number;
  favoriteSlugs: ReadonlySet<string>;
  dismissedIds: ReadonlySet<string>;
  trackedUrls: ReadonlySet<string>;
}

export function parseCompanySlug(sourceId: string): string | null {
  if (!sourceId.startsWith("company:")) return null;
  const slug = sourceId.slice("company:".length).trim();
  return slug || null;
}

function hasDismissed(dismissedIds: ReadonlySet<string>, posting: FeedPosting): boolean {
  return posting.interactionIds.some((id) => dismissedIds.has(id));
}

function isTracked(trackedUrls: ReadonlySet<string>, posting: FeedPosting): boolean {
  const normalized = normalizeUrl(posting.url);
  return normalized != null && trackedUrls.has(normalized);
}

function isDiscoveredRecently(posting: FeedPosting, cutoffUnix: number): boolean {
  return posting.pathwayNewUnix >= cutoffUnix;
}

function isPostedSince(posting: FeedPosting, cutoffUnix: number): boolean {
  return posting.datePosted >= cutoffUnix;
}

function filterPostedSince(postings: FeedPosting[], cutoffUnix: number): FeedPosting[] {
  return postings.filter((posting) => isPostedSince(posting, cutoffUnix));
}

function dominantSeason(postings: FeedPosting[]): FeedSeason | null {
  if (postings.length === 0) return null;
  const counts = new Map<FeedSeason, number>();
  for (const posting of postings) {
    counts.set(posting.season, (counts.get(posting.season) ?? 0) + 1);
  }
  let best: FeedSeason | null = null;
  let bestCount = 0;
  for (const [season, count] of counts) {
    if (count > bestCount) {
      best = season;
      bestCount = count;
    }
  }
  return best;
}

function primaryLocationLabel(posting: FeedPosting): string | null {
  const raw = posting.locations[0]?.trim();
  if (!raw) return null;
  const city = raw.split(",")[0]?.trim();
  return city || raw;
}

export function buildMarketPulse(
  postings: FeedPosting[],
  nowUnix: number,
): MarketPulse {
  const dayCutoff = nowUnix - HOME_NEW_WINDOW_SECONDS;
  const sinceYesterdayPostings = postings.filter((posting) =>
    isDiscoveredRecently(posting, dayCutoff),
  );

  return {
    sinceYesterday: sinceYesterdayPostings.length,
    openTotal: postings.length,
    remoteOpen: postings.filter((posting) => posting.hasRemote).length,
    dominantSeason: dominantSeason(sinceYesterdayPostings),
  };
}

export function buildMarketWeekSummary(
  postings: FeedPosting[],
  nowUnix: number,
): MarketWeekSummary {
  const weekCutoff = nowUnix - HOME_ACTIVITY_WINDOW_SECONDS;
  const weekPostings = filterPostedSince(postings, weekCutoff);

  const companySlugs = new Set<string>();
  const locationCounts = new Map<string, number>();

  for (const posting of weekPostings) {
    const slug = parseCompanySlug(posting.sourceId);
    if (slug) companySlugs.add(slug);

    const location = primaryLocationLabel(posting);
    if (location) {
      locationCounts.set(location, (locationCounts.get(location) ?? 0) + 1);
    }
  }

  let topLocation: MarketWeekSummary["topLocation"] = null;
  for (const [label, count] of locationCounts) {
    if (!topLocation || count > topLocation.count) {
      topLocation = { label, count };
    }
  }

  return {
    postedCount: weekPostings.length,
    remoteCount: weekPostings.filter((posting) => posting.hasRemote).length,
    activeCompanyCount: companySlugs.size,
    topSeason: dominantSeason(weekPostings),
    topLocation,
  };
}

export function buildStarredPostings(
  postings: FeedPosting[],
  input: Pick<
    BuildHomeBriefingInput,
    "nowUnix" | "favoriteSlugs" | "dismissedIds" | "trackedUrls"
  >,
): StarredPostingAlert[] {
  const nowUnix = input.nowUnix ?? Math.floor(Date.now() / 1000);
  const dayCutoff = nowUnix - HOME_NEW_WINDOW_SECONDS;

  const candidates: StarredPostingAlert[] = [];

  for (const posting of postings) {
    if (hasDismissed(input.dismissedIds, posting)) continue;
    if (isTracked(input.trackedUrls, posting)) continue;

    const slug = parseCompanySlug(posting.sourceId);
    if (slug == null || !input.favoriteSlugs.has(slug)) continue;

    candidates.push({
      posting,
      isNew: isDiscoveredRecently(posting, dayCutoff),
    });
  }

  candidates.sort((a, b) => b.posting.pathwayNewUnix - a.posting.pathwayNewUnix);

  const seen = new Set<string>();
  const alerts: StarredPostingAlert[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.posting.id)) continue;
    seen.add(candidate.posting.id);
    alerts.push(candidate);
    if (alerts.length >= HOME_MAX_STARRED_ROWS) break;
  }

  return alerts;
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
  const limit = input.limit ?? HOME_MAX_HOT_COMPANIES;
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

export function buildIndustrySpotlight(
  postings: FeedPosting[],
  industryBySlug: ReadonlyMap<string, CompanyIndustryInfo>,
  input: { nowUnix?: number; limit?: number } = {},
): IndustryActivity[] {
  const nowUnix = input.nowUnix ?? Math.floor(Date.now() / 1000);
  const weekCutoff = nowUnix - HOME_ACTIVITY_WINDOW_SECONDS;
  const limit = input.limit ?? HOME_MAX_INDUSTRY_SPOTLIGHT;

  const counts = new Map<string, { label: string; count: number }>();

  for (const posting of postings) {
    if (!isPostedSince(posting, weekCutoff)) continue;
    const slug = parseCompanySlug(posting.sourceId);
    if (!slug) continue;
    const industry = industryBySlug.get(slug);
    if (!industry) continue;

    const existing = counts.get(industry.industrySlug);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(industry.industrySlug, {
        label: industry.industryLabel,
        count: 1,
      });
    }
  }

  return [...counts.entries()]
    .map(([industrySlug, value]) => ({
      industrySlug,
      label: value.label,
      newCount: value.count,
    }))
    .sort((a, b) => b.newCount - a.newCount || a.label.localeCompare(b.label))
    .slice(0, limit);
}

export function buildSeasonSpotlight(
  postings: FeedPosting[],
  input: { nowUnix?: number; limit?: number } = {},
): SeasonActivity[] {
  const nowUnix = input.nowUnix ?? Math.floor(Date.now() / 1000);
  const weekCutoff = nowUnix - HOME_ACTIVITY_WINDOW_SECONDS;
  const limit = input.limit ?? HOME_MAX_SEASON_SPOTLIGHT;

  const counts = new Map<FeedSeason, number>();

  for (const posting of postings) {
    if (!isPostedSince(posting, weekCutoff)) continue;
    counts.set(posting.season, (counts.get(posting.season) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([season, newCount]) => ({ season, newCount }))
    .sort((a, b) => b.newCount - a.newCount || a.season.localeCompare(b.season))
    .slice(0, limit);
}

export function buildHomeBriefing(input: BuildHomeBriefingInput): HomeBriefing {
  const nowUnix = input.nowUnix ?? Math.floor(Date.now() / 1000);

  return {
    marketPulse: buildMarketPulse(input.postings, nowUnix),
    marketWeek: buildMarketWeekSummary(input.postings, nowUnix),
    starredPostings: buildStarredPostings(input.postings, input),
  };
}
