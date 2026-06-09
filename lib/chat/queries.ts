import { compareEventsChronologically, normalizeApplicationState } from "@/lib/config/application-state";
import { eventLabel } from "@/lib/config/events";
import { loadDiscoverIndustryCatalog } from "@/lib/discover/catalog";
import { loadDiscoverCompanyOpenCounts } from "@/lib/discover/open-counts";
import { parseCompanySlugFromSourceId } from "@/lib/feed/company-slug";
import { loadScrapedFeedPostings } from "@/lib/feed/scraped-postings";
import type { FeedPosting, FeedSeason } from "@/lib/feed/types";
import { loadCompanyIndustryBySlug } from "@/lib/home/company-industry-map";
import { computeStats } from "@/lib/stats/applications";
import type { Application } from "@/types/application";
import type { SupabaseClient } from "@supabase/supabase-js";
import { postingMatchesLocationFilter } from "./location-match.ts";
import {
  companyNameMatches,
  companyTokens,
  resolveIndustrySlugFromQuery,
  sanitizeCompanyFilter,
  sanitizeIndustryFilter,
  sanitizeLocationFilter,
  sanitizePostingKeywords,
} from "./resolution.ts";
import { hasAnyInteraction } from "@/lib/feed/interactions.ts";
import {
  CHAT_RESULT_LIMIT,
  type ChatApplicationDetailResult,
  type ChatApplicationSummary,
  type ChatCompanyCatalogItem,
  type SearchApplicationsInput,
  type SearchPostingsInput,
} from "./types.ts";
import type { Status } from "@/types/application";
import { CHAT_TIME_ZONE } from "./system-prompt.ts";

type CountApplicationsInput = {
  company?: string;
  status?: Status;
  season?: Application["season"];
  datePreset?: "this_month" | "last_month" | "this_year" | "last_year" | "last_30_days";
  month?: string;
  year?: number;
  appliedAfter?: string;
  appliedBefore?: string;
  eventType?: "applied";
  includeArchived?: boolean;
};

export {
  companyNameMatches,
  normalizeCompanyQuery,
  resolveIndustrySlugFromQuery,
  sanitizeCompanyFilter,
  sanitizeLocationFilter,
  sanitizePostingKeywords,
} from "./resolution.ts";

export function getAppliedDate(application: Application): string | null {
  const applied = application.events.find((event) => event.event_type === "applied");
  return applied?.event_date ?? null;
}

export function toChatApplicationSummary(application: Application): ChatApplicationSummary {
  return {
    id: application.id,
    company: application.company,
    role: application.role,
    status: application.status,
    location: application.location,
    season: application.season,
    lastActivityDate: application.last_activity_date,
    appliedDate: getAppliedDate(application),
    postingUrl: application.posting_url,
  };
}

export function applicationMatchesFilters(
  application: Application,
  filters: SearchApplicationsInput,
): boolean {
  const company = sanitizeCompanyFilter(filters.company);

  if (!filters.includeArchived && application.archived_at) {
    return false;
  }
  if (company && !companyNameMatches(application.company, company)) {
    return false;
  }
  if (filters.status && application.status !== filters.status) {
    return false;
  }
  if (filters.season && application.season !== filters.season) {
    return false;
  }
  if (filters.location) {
    const locationHaystack = (application.location ?? "").toLowerCase();
    if (!locationHaystack.includes(filters.location.trim().toLowerCase())) {
      return false;
    }
  }

  if (hasApplicationDateFilter(filters)) {
    const appliedDate = getAppliedDate(application);
    if (!appliedDate) return false;

    if (filters.appliedAfter && appliedDate < filters.appliedAfter) {
      return false;
    }
    if (filters.appliedBefore && appliedDate > filters.appliedBefore) {
      return false;
    }
    if (filters.month && !appliedDate.startsWith(filters.month)) {
      return false;
    }
    if (filters.year) {
      const year = Number.parseInt(appliedDate.slice(0, 4), 10);
      if (year !== filters.year) return false;
    }
  }

  return true;
}

export function sortApplications(
  applications: Application[],
  sortBy: SearchApplicationsInput["sortBy"] = "lastActivity",
  sortDirection: SearchApplicationsInput["sortDirection"] = "desc",
): Application[] {
  const list = applications.slice();
  const direction = sortDirection === "asc" ? 1 : -1;

  list.sort((a, b) => {
    if (sortBy === "company") {
      return direction * a.company.localeCompare(b.company);
    }
    if (sortBy === "appliedDate") {
      const aDate = getAppliedDate(a) ?? "";
      const bDate = getAppliedDate(b) ?? "";
      return direction * aDate.localeCompare(bDate);
    }
    return direction * a.last_activity_date.localeCompare(b.last_activity_date);
  });

  return list;
}

export function filterApplications(
  applications: Application[],
  filters: SearchApplicationsInput,
): Application[] {
  return sortApplications(
    applications.filter((application) => applicationMatchesFilters(application, filters)),
    filters.sortBy,
    filters.sortDirection,
  );
}

export function countApplicationsInRange(
  applications: Application[],
  filters: CountApplicationsInput,
): number {
  const searchFilters: SearchApplicationsInput = {
    includeArchived: filters.includeArchived ?? false,
    company: sanitizeCompanyFilter(filters.company),
    status: filters.status,
    season: filters.season,
    appliedAfter: filters.appliedAfter,
    appliedBefore: filters.appliedBefore,
    month: filters.month,
    year: filters.year,
  };
  return filterApplications(applications, searchFilters).length;
}

export function hasApplicationDateFilter(
  filters: Pick<
    SearchApplicationsInput,
    "datePreset" | "month" | "year" | "appliedAfter" | "appliedBefore"
  >,
): boolean {
  return Boolean(
    filters.datePreset ||
      filters.month ||
      filters.year ||
      filters.appliedAfter ||
      filters.appliedBefore,
  );
}

export function withoutApplicationDateFilters<T extends SearchApplicationsInput>(
  filters: T,
): Omit<T, "datePreset" | "month" | "year" | "appliedAfter" | "appliedBefore"> {
  const {
    datePreset: _datePreset,
    month: _month,
    year: _year,
    appliedAfter: _appliedAfter,
    appliedBefore: _appliedBefore,
    ...rest
  } = filters;
  return rest;
}

function postingKeywordsMatch(
  haystack: string,
  keywords: string | undefined,
  industryBySlug: Map<string, { industrySlug: string }>,
  posting: FeedPosting,
): boolean {
  const sanitized = sanitizePostingKeywords(keywords);
  if (!sanitized) return true;

  const keywordIndustry = resolveIndustrySlugFromQuery(sanitized);
  if (keywordIndustry) {
    const slug = parseCompanySlugFromSourceId(posting.sourceId);
    const companyIndustryMatch = Boolean(
      slug && industryBySlug.get(slug)?.industrySlug === keywordIndustry,
    );
    if (companyIndustryMatch) return true;
  }

  const terms = sanitized.split(/\s+/).filter(Boolean);
  return (
    terms.length > 0 &&
    terms.every((term) => {
      if (haystack.includes(term)) return true;
      const slug = parseCompanySlugFromSourceId(posting.sourceId);
      const industrySlug = slug ? industryBySlug.get(slug)?.industrySlug : undefined;
      return industrySlug === term;
    })
  );
}

function postingYearMatches(posting: FeedPosting, year: number | undefined): boolean {
  if (!year) return true;
  const normalizedYear = Math.trunc(year);
  if (normalizedYear < 1900 || normalizedYear > 2200) return false;
  const yearPattern = new RegExp(`(^|\\D)${normalizedYear}(\\D|$)`);
  const haystack = [
    posting.title,
    posting.url,
    ...posting.locations,
  ].join(" ");
  return yearPattern.test(haystack);
}

export type AppliedDatePreset =
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year"
  | "last_30_days";

export type ResolvedAppliedDatePreset = {
  appliedAfter: string;
  appliedBefore: string;
  label: string;
};

function datePartsInTimeZone(date: Date, timeZone: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const value = (type: "year" | "month" | "day") =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
  };
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function monthShortLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function resolveAppliedDatePreset(
  preset: AppliedDatePreset,
  reference = new Date(),
  timeZone = "America/Los_Angeles",
): ResolvedAppliedDatePreset {
  const { year, month } = datePartsInTimeZone(reference, timeZone);

  if (preset === "last_30_days") {
    const range = pastMonthRange(reference);
    return {
      ...range,
      label: "the last 30 days",
    };
  }

  if (preset === "this_year" || preset === "last_year") {
    const targetYear = preset === "this_year" ? year : year - 1;
    return {
      appliedAfter: isoDate(targetYear, 1, 1),
      appliedBefore: isoDate(targetYear, 12, 31),
      label: String(targetYear),
    };
  }

  const targetMonthDate =
    preset === "this_month"
      ? new Date(Date.UTC(year, month - 1, 1))
      : new Date(Date.UTC(year, month - 2, 1));
  const targetYear = targetMonthDate.getUTCFullYear();
  const targetMonth = targetMonthDate.getUTCMonth() + 1;

  return {
    appliedAfter: isoDate(targetYear, targetMonth, 1),
    appliedBefore: isoDate(targetYear, targetMonth, lastDayOfMonth(targetYear, targetMonth)),
    label: monthLabel(targetYear, targetMonth),
  };
}

export function buildApplicationMonthlyCounts(
  applications: Application[],
  year: number,
  includeArchived = false,
): { key: string; label: string; count: number }[] {
  const counts = new Map<string, number>();

  for (const application of applications) {
    if (!includeArchived && application.archived_at) continue;
    const appliedDate = getAppliedDate(application);
    if (!appliedDate?.startsWith(`${year}-`)) continue;
    const key = appliedDate.slice(0, 7);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    return {
      key,
      label: monthShortLabel(year, month),
      count: counts.get(key) ?? 0,
    };
  });
}

function companyGroupKey(company: string): string {
  return companyTokens(company).join(" ");
}

export function buildTopApplicationCompanies(
  applications: Application[],
  limit = 8,
  includeArchived = false,
): { company: string; count: number }[] {
  const groups = new Map<string, { company: string; count: number }>();

  for (const application of applications) {
    if (!includeArchived && application.archived_at) continue;
    const key = companyGroupKey(application.company);
    if (!key) continue;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(key, { company: application.company, count: 1 });
    }
  }

  return [...groups.values()]
    .sort((a, b) => {
      const byCount = b.count - a.count;
      if (byCount !== 0) return byCount;
      return a.company.localeCompare(b.company);
    })
    .slice(0, limit);
}

export function postingMatchesChatFilters(
  posting: FeedPosting,
  industryBySlug: Map<string, { industrySlug: string }>,
  filters: SearchPostingsInput,
): boolean {
  const company = sanitizeCompanyFilter(filters.company);

  if (filters.companySlug) {
    const slug = parseCompanySlugFromSourceId(posting.sourceId);
    if (slug !== filters.companySlug) {
      return false;
    }
  } else if (filters.companySlugs?.length) {
    const slug = parseCompanySlugFromSourceId(posting.sourceId);
    if (!slug || !filters.companySlugs.includes(slug)) {
      return false;
    }
  } else if (company && !companyNameMatches(posting.company, company)) {
    return false;
  }
  if (filters.season && posting.season !== filters.season) {
    return false;
  }
  if (!postingYearMatches(posting, filters.year)) {
    return false;
  }
  if (filters.remoteOnly && !posting.hasRemote) {
    return false;
  }
  if (filters.location && !postingMatchesLocationFilter(posting, filters.location)) {
    return false;
  }
  if (filters.industry) {
    const slug = parseCompanySlugFromSourceId(posting.sourceId);
    const industrySlug = slug ? industryBySlug.get(slug)?.industrySlug : undefined;
    if (industrySlug !== filters.industry) {
      return false;
    }
  }
  if (filters.keywords) {
    const haystack = `${posting.company} ${posting.title} ${posting.locations.join(" ")}`.toLowerCase();
    if (!postingKeywordsMatch(haystack, filters.keywords, industryBySlug, posting)) {
      return false;
    }
  }
  if (filters.remoteOnly === false && posting.hasRemote && filters.location) {
    // location filter already applied
  }
  return true;
}

export function hasPostingSearchFilters(filters: SearchPostingsInput): boolean {
  if (sanitizeCompanyFilter(filters.company)) return true;
  if (filters.companySlug?.trim()) return true;
  if (filters.companySlugs?.length) return true;
  if (sanitizeLocationFilter(filters.location)) return true;
  if (filters.industry?.trim()) return true;
  if (filters.season) return true;
  if (filters.year) return true;
  if (filters.remoteOnly) return true;
  if (sanitizePostingKeywords(filters.keywords)) return true;
  return false;
}

export function filterPostings(
  postings: FeedPosting[],
  industryBySlug: Map<string, { industrySlug: string }>,
  filters: SearchPostingsInput,
): FeedPosting[] {
  return postings
    .filter((posting) => postingMatchesChatFilters(posting, industryBySlug, filters))
    .sort((a, b) => {
      const byPosted = b.datePosted - a.datePosted;
      if (byPosted !== 0) return byPosted;
      return b.pathwayNewUnix - a.pathwayNewUnix;
    });
}

export async function loadUserApplications(
  supabase: SupabaseClient,
  userId: string,
): Promise<Application[]> {
  const { data, error } = await supabase
    .from("applications")
    .select("*, application_events(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) =>
    normalizeApplicationState({
      ...row,
      events: row.application_events ?? [],
      last_activity_date: row.created_at.slice(0, 10),
    }),
  );
}

export async function loadApplicationById(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string,
): Promise<Application | null> {
  const { data, error } = await supabase
    .from("applications")
    .select("*, application_events(*)")
    .eq("id", applicationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return normalizeApplicationState({
    ...data,
    events: data.application_events ?? [],
    last_activity_date: data.created_at.slice(0, 10),
  });
}

export function resolveApplicationSearchFilters(
  filters: SearchApplicationsInput,
  reference = new Date(),
  timeZone = CHAT_TIME_ZONE,
): Omit<SearchApplicationsInput, "datePreset"> {
  const { datePreset, ...rest } = filters;
  if (!datePreset) return rest;

  const resolved = resolveAppliedDatePreset(datePreset, reference, timeZone);
  return {
    ...rest,
    appliedAfter: resolved.appliedAfter,
    appliedBefore: resolved.appliedBefore,
  };
}

export function toChatApplicationDetail(application: Application): ChatApplicationDetailResult {
  const events = [...application.events]
    .filter((event) => event.event_type !== "note")
    .sort(compareEventsChronologically)
    .map((event) => ({
      id: event.id,
      eventType: event.event_type,
      label: eventLabel(event),
      eventDate: event.event_date,
      notes: event.notes,
    }));

  return {
    presentation: "application_detail",
    application: toChatApplicationSummary(application),
    events,
    applicationsHref: "/applications",
  };
}

export async function resolveApplicationForChat(
  supabase: SupabaseClient,
  userId: string,
  input: { company?: string; applicationId?: string },
): Promise<
  | { kind: "found"; application: Application }
  | { kind: "multiple"; applications: ChatApplicationSummary[] }
  | { kind: "none" }
> {
  if (input.applicationId) {
    const application = await loadApplicationById(supabase, userId, input.applicationId);
    return application ? { kind: "found", application } : { kind: "none" };
  }

  const company = sanitizeCompanyFilter(input.company);
  if (!company) return { kind: "none" };

  const all = await loadUserApplications(supabase, userId);
  const matches = all.filter(
    (application) => !application.archived_at && companyNameMatches(application.company, company),
  );

  if (matches.length === 0) return { kind: "none" };
  if (matches.length === 1) return { kind: "found", application: matches[0]! };

  return {
    kind: "multiple",
    applications: matches.map(toChatApplicationSummary),
  };
}

export async function loadSavedPostingsForChat(
  supabase: SupabaseClient,
  userId: string,
  limit = CHAT_RESULT_LIMIT,
): Promise<{ postings: FeedPosting[]; totalCount: number; truncated: boolean }> {
  const [postings, interactionsRes] = await Promise.all([
    loadScrapedFeedPostings(supabase),
    supabase
      .from("feed_interactions")
      .select("posting_id, created_at")
      .eq("user_id", userId)
      .eq("kind", "saved"),
  ]);

  if (interactionsRes.error) throw interactionsRes.error;

  const savedAtById = new Map<string, string>();
  for (const row of interactionsRes.data ?? []) {
    const postingId = String((row as { posting_id: string }).posting_id);
    const createdAt = String((row as { created_at: string }).created_at);
    const existing = savedAtById.get(postingId);
    if (!existing || createdAt > existing) {
      savedAtById.set(postingId, createdAt);
    }
  }

  const savedIds = new Set(savedAtById.keys());
  function latestSavedAt(posting: FeedPosting): number {
    let latest = 0;
    for (const id of posting.interactionIds) {
      const savedAt = savedAtById.get(id);
      if (savedAt) latest = Math.max(latest, Date.parse(savedAt));
    }
    return latest;
  }

  const saved = postings
    .filter((posting) => hasAnyInteraction(savedIds, posting.interactionIds))
    .sort((left, right) => latestSavedAt(right) - latestSavedAt(left));

  const cappedLimit = Math.min(limit, CHAT_RESULT_LIMIT);
  const truncated = saved.length > cappedLimit;

  return {
    postings: saved.slice(0, cappedLimit),
    totalCount: saved.length,
    truncated,
  };
}

export async function searchApplicationsForChat(
  supabase: SupabaseClient,
  userId: string,
  filters: SearchApplicationsInput,
): Promise<{ applications: ChatApplicationSummary[]; totalCount: number; truncated: boolean }> {
  const all = await loadUserApplications(supabase, userId);
  const filtered = filterApplications(all, resolveApplicationSearchFilters(filters));
  const limit = Math.min(filters.limit ?? CHAT_RESULT_LIMIT, CHAT_RESULT_LIMIT);
  const truncated = filtered.length > limit;

  return {
    applications: filtered.slice(0, limit).map(toChatApplicationSummary),
    totalCount: filtered.length,
    truncated,
  };
}

export async function loadCompanyCatalogForChat(
  supabase: SupabaseClient,
): Promise<ChatCompanyCatalogItem[]> {
  const [companiesRes, openCounts, industryCatalog] = await Promise.all([
    supabase
      .from("companies")
      .select("id, slug, name, website_url, industry")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    loadDiscoverCompanyOpenCounts(supabase),
    loadDiscoverIndustryCatalog(supabase),
  ]);

  if (companiesRes.error) throw companiesRes.error;

  const labelByIndustry = new Map(industryCatalog.map((item) => [item.slug, item.label]));

  return ((companiesRes.data ?? []) as Array<{
    id: string;
    slug: string;
    name: string;
    website_url: string | null;
    industry: string | null;
  }>).map((company) => ({
    slug: company.slug,
    name: company.name,
    industrySlug: company.industry?.trim() || null,
    industryLabel: company.industry?.trim()
      ? (labelByIndustry.get(company.industry.trim()) ?? company.industry.trim())
      : null,
    openCount: openCounts.get(company.id) ?? 0,
    websiteUrl: company.website_url,
  }));
}

function rankCatalogMatches(
  catalog: ChatCompanyCatalogItem[],
  query: string,
  normalizedQuery: string,
  limit: number,
): ChatCompanyCatalogItem[] {
  return catalog
    .filter(
      (company) =>
        companyNameMatches(company.name, query) ||
        companyNameMatches(company.slug.replace(/-/g, " "), query),
    )
    .sort((left, right) => {
      const leftExact = companyTokens(left.name).join(" ") === normalizedQuery ? 1 : 0;
      const rightExact = companyTokens(right.name).join(" ") === normalizedQuery ? 1 : 0;
      if (rightExact !== leftExact) return rightExact - leftExact;
      return right.openCount - left.openCount || left.name.localeCompare(right.name);
    })
    .slice(0, limit);
}

export function resolveCompaniesFromCatalog(
  catalog: ChatCompanyCatalogItem[],
  query: string,
  limit = 8,
): ChatCompanyCatalogItem[] {
  const normalizedQuery = sanitizeCompanyFilter(query);
  if (!normalizedQuery) return [];

  const directMatches = rankCatalogMatches(catalog, query, normalizedQuery, limit);
  if (directMatches.length > 0) {
    return directMatches;
  }

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const token = tokens[index]!;
    const tokenMatches = rankCatalogMatches(catalog, token, token, limit);
    if (tokenMatches.length > 0) {
      return tokenMatches;
    }
  }

  return [];
}

export async function resolveCompaniesForChat(
  supabase: SupabaseClient,
  query: string,
  limit = 8,
): Promise<ChatCompanyCatalogItem[]> {
  const catalog = await loadCompanyCatalogForChat(supabase);
  return resolveCompaniesFromCatalog(catalog, query, limit);
}

function normalizePostingSearchFilters(filters: SearchPostingsInput): SearchPostingsInput {
  const keywords =
    sanitizePostingKeywords(filters.keywords) ??
    sanitizePostingKeywords(filters.query);
  return {
    ...filters,
    company: sanitizeCompanyFilter(filters.company),
    location: sanitizeLocationFilter(filters.location),
    industry: sanitizeIndustryFilter(filters.industry),
    query: undefined,
    keywords,
  };
}

async function preparePostingSearchFilters(
  supabase: SupabaseClient,
  filters: SearchPostingsInput,
): Promise<SearchPostingsInput> {
  const normalized = normalizePostingSearchFilters(filters);

  if (normalized.companySlug || normalized.companySlugs?.length || !normalized.company) {
    return normalized;
  }

  const matches = await resolveCompaniesForChat(supabase, normalized.company, 5);
  if (matches.length === 1) {
    return {
      ...normalized,
      company: undefined,
      companySlug: matches[0]!.slug,
    };
  }

  if (matches.length > 1) {
    return {
      ...normalized,
      company: undefined,
      companySlugs: matches.map((match) => match.slug),
    };
  }

  return normalized;
}

export async function countPostingsForChat(
  supabase: SupabaseClient,
  filters: SearchPostingsInput,
): Promise<number> {
  const result = await searchPostingsForChat(supabase, { ...filters, limit: CHAT_RESULT_LIMIT });
  return result.totalCount;
}

export async function searchPostingsForChat(
  supabase: SupabaseClient,
  filters: SearchPostingsInput,
): Promise<{
  postings: FeedPosting[];
  totalCount: number;
  truncated: boolean;
  filters: SearchPostingsInput;
}> {
  const requestedFilters = normalizePostingSearchFilters(filters);
  if (!hasPostingSearchFilters(requestedFilters)) {
    return { postings: [], totalCount: 0, truncated: false, filters: requestedFilters };
  }

  const normalizedFilters = await preparePostingSearchFilters(supabase, requestedFilters);
  const [postings, industryBySlug] = await Promise.all([
    loadScrapedFeedPostings(supabase),
    loadCompanyIndustryBySlug(supabase),
  ]);

  const industryMap = new Map(
    [...industryBySlug.entries()].map(([slug, info]) => [slug, { industrySlug: info.industrySlug }]),
  );

  const filtered = filterPostings(postings, industryMap, normalizedFilters);
  const limit = Math.min(normalizedFilters.limit ?? CHAT_RESULT_LIMIT, CHAT_RESULT_LIMIT);
  const truncated = filtered.length > limit;

  return {
    postings: filtered.slice(0, limit),
    totalCount: filtered.length,
    truncated,
    filters: normalizedFilters,
  };
}

export async function getRecentPostingsForChat(
  supabase: SupabaseClient,
  filters: Pick<SearchPostingsInput, "location" | "industry" | "season" | "limit">,
): Promise<{ postings: FeedPosting[]; totalCount: number; truncated: boolean }> {
  const [postings, industryBySlug] = await Promise.all([
    loadScrapedFeedPostings(supabase),
    loadCompanyIndustryBySlug(supabase),
  ]);

  const industryMap = new Map(
    [...industryBySlug.entries()].map(([slug, info]) => [slug, { industrySlug: info.industrySlug }]),
  );

  const filtered = filterPostings(postings, industryMap, filters);
  const limit = Math.min(filters.limit ?? CHAT_RESULT_LIMIT, CHAT_RESULT_LIMIT);
  const truncated = filtered.length > limit;

  return {
    postings: filtered.slice(0, limit),
    totalCount: filtered.length,
    truncated,
  };
}

export function getPipelineStatsForChat(applications: Application[]) {
  const active = applications.filter((application) => !application.archived_at);
  const stats = computeStats(applications);
  return {
    stageCounts: stats.stageCounts,
    activeCount: active.length,
    archivedCount: stats.archivedCount,
    monthlyCounts: stats.monthlyCounts,
  };
}

export async function getApplicationStatsForChat(supabase: SupabaseClient, userId: string) {
  const applications = await loadUserApplications(supabase, userId);
  return getPipelineStatsForChat(applications);
}

export function monthBounds(month: string): { start: string; end: string } {
  const [year, mon] = month.split("-").map(Number);
  const start = `${month}-01`;
  const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const end = `${month}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export function pastMonthRange(reference = new Date()): { appliedAfter: string; appliedBefore: string } {
  const end = reference.toISOString().slice(0, 10);
  const startDate = new Date(reference);
  startDate.setUTCDate(startDate.getUTCDate() - 30);
  return {
    appliedAfter: startDate.toISOString().slice(0, 10),
    appliedBefore: end,
  };
}

export function isFeedSeason(value: string): value is FeedSeason {
  return ["Summer", "Fall", "Spring", "Winter"].includes(value);
}
