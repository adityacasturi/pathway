import type { SupabaseClient } from "@supabase/supabase-js";
import { countriesFromUsLocations, formatUsLocations } from "../feed/us-locations.ts";
import { normalizeScrapedLocationField } from "./location.ts";
import {
  coerceScrapedRoleDates,
  countRoleDateStats,
  mergeScrapedPostingDates,
  type PostedDateConfidence,
  type PostedDateSource,
  type StoredPostingDateState,
} from "./posted-date.ts";
import {
  isSourceType,
  type CompanySourceConfig,
  type KeptRolePreview,
  type ScrapeAdapter,
  type ScrapedRole,
  type ScrapedSeason,
  type SourceScrapeResult,
} from "./types.ts";

const KEPT_PREVIEW_LIMIT = 10;
/** PostgREST upsert / `in` filter chunk size for large boards. */
const UPSERT_CHUNK_SIZE = 200;

interface RunScrapeAdapterOptions {
  dryRun?: boolean;
}

interface CompanySourceRow {
  id: string;
  source_type: string;
  adapter_key: string;
  source_url: string | null;
  board_token: string | null;
  companies: {
    id: string;
    slug: string;
    name: string;
  } | null;
}

export async function runScrapeAdapter(
  supabase: SupabaseClient,
  adapter: ScrapeAdapter,
  options: RunScrapeAdapterOptions = {},
): Promise<SourceScrapeResult> {
  const slug = adapter.source.companySlug;
  try {
    const parsed = await adapter.fetchRoles();
    const dateStats = countRoleDateStats(
      parsed.roles.map((role) => ({
        dates: coerceScrapedRoleDates(role.dates, role.datePosted),
      })),
    );
    const stats = { ...parsed.stats, ...dateStats };
    const keptPreview = buildKeptPreview(parsed.roles);
    if (options.dryRun) {
      return {
        slug,
        status: "ok",
        openCount: parsed.stats.kept,
        stats,
        keptPreview,
      };
    }

    const openCount = await upsertScrapedRoles(supabase, adapter, parsed.roles);
    await markSourceSuccess(supabase, adapter.source.id);
    return { slug, status: "ok", openCount, stats, keptPreview };
  } catch (error) {
    const message = formatScrapeErrorMessage(error);
    await markSourceFailure(supabase, adapter.source.id, message);
    return { slug, status: "error", openCount: 0, error: message };
  }
}

function formatScrapeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (error && typeof error === "object") {
    const record = error as { message?: unknown; code?: unknown; details?: unknown };
    if (typeof record.message === "string" && record.message.trim()) {
      const code = typeof record.code === "string" ? record.code : "";
      return code ? `${record.message} (${code})` : record.message;
    }
  }
  return "Unknown scrape error";
}

function isMissingCountriesColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const record = error as { code?: unknown; message?: unknown };
  return (
    record.code === "PGRST204" &&
    typeof record.message === "string" &&
    record.message.includes("'countries'")
  );
}

function isMissingDateProvenanceColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const record = error as { code?: unknown; message?: unknown };
  if (record.code !== "PGRST204" || typeof record.message !== "string") {
    return false;
  }
  return (
    record.message.includes("'date_posted_source'") ||
    record.message.includes("'date_modified'") ||
    record.message.includes("'date_posted_confidence'") ||
    record.message.includes("'date_posted_raw'")
  );
}

interface ScrapedPostingUpsertRow {
  company_id: string;
  company_name: string;
  role_name: string;
  posting_url: string;
  season: ScrapedSeason;
  location: string | null;
  countries: string[];
  date_posted: string | null;
  date_modified: string | null;
  date_posted_source: PostedDateSource;
  date_posted_confidence: PostedDateConfidence;
  date_posted_raw: string | null;
  status: "open";
  first_seen_at: string;
  last_seen_at: string;
}

interface ExistingPostingState {
  first_seen_at: string;
  dates: StoredPostingDateState;
}

async function upsertScrapedRoles(
  supabase: SupabaseClient,
  adapter: ScrapeAdapter,
  roles: ScrapedRole[],
): Promise<number> {
  const now = new Date().toISOString();
  const companyId = adapter.source.companyId;
  const seenUrls = new Set(roles.map((role) => role.postingUrl));

  if (roles.length > 0) {
    const existingByUrl = await loadExistingPostingState(supabase, [...seenUrls]);
    const rows = buildScrapedPostingUpsertRows(
      roles,
      companyId,
      adapter.source.companySlug,
      now,
      existingByUrl,
    );

    for (const chunk of chunkArray(rows, UPSERT_CHUNK_SIZE)) {
      const { error } = await supabase.from("scraped_postings").upsert(chunk, {
        onConflict: "posting_url",
      });
      if (!error) {
        continue;
      }
      if (isMissingCountriesColumnError(error)) {
        const legacyRows = chunk.map(({ countries: _countries, ...row }) => row);
        const retry = await supabase.from("scraped_postings").upsert(legacyRows, {
          onConflict: "posting_url",
        });
        if (retry.error) {
          throw retry.error;
        }
        continue;
      }
      if (isMissingDateProvenanceColumnError(error)) {
        const legacyRows = chunk.map(
          ({
            date_modified: _dm,
            date_posted_source: _dps,
            date_posted_confidence: _dpc,
            date_posted_raw: _dpr,
            ...row
          }) => row,
        );
        const retry = await supabase.from("scraped_postings").upsert(legacyRows, {
          onConflict: "posting_url",
        });
        if (retry.error) {
          throw retry.error;
        }
        continue;
      }
      throw error;
    }
  }

  await closeStaleScrapedPostings(supabase, companyId, seenUrls, now);

  return seenUrls.size;
}

export function buildScrapedPostingUpsertRows(
  roles: ScrapedRole[],
  companyId: string,
  companySlug: string,
  now: string,
  existingByUrl: ReadonlyMap<string, ExistingPostingState>,
): ScrapedPostingUpsertRow[] {
  const nowDate = new Date(now);

  return roles.map((role) => {
    const usFormatted = formatUsLocations(role.location ? [role.location] : []);
    const location = normalizeScrapedLocationField(usFormatted, {
      companyName: role.companyName,
      companySlug,
    });
    const countries = countriesFromUsLocations(
      location ? [location] : usFormatted ? [usFormatted] : [],
    );

    const existing = existingByUrl.get(role.postingUrl);
    const firstSeenAt = existing?.first_seen_at ?? now;
    const incomingDates = coerceScrapedRoleDates(role.dates, role.datePosted);
    const merged = mergeScrapedPostingDates(existing?.dates ?? null, incomingDates, firstSeenAt, nowDate);

    return {
      company_id: companyId,
      company_name: role.companyName,
      role_name: role.roleName,
      posting_url: role.postingUrl,
      season: role.season,
      location,
      countries,
      date_posted: merged.date_posted,
      date_modified: merged.date_modified,
      date_posted_source: merged.date_posted_source,
      date_posted_confidence: merged.date_posted_confidence,
      date_posted_raw: merged.date_posted_raw,
      status: "open" as const,
      first_seen_at: firstSeenAt,
      last_seen_at: now,
    };
  });
}

async function loadExistingPostingState(
  supabase: SupabaseClient,
  postingUrls: string[],
): Promise<Map<string, ExistingPostingState>> {
  const byUrl = new Map<string, ExistingPostingState>();

  for (const chunk of chunkArray(postingUrls, UPSERT_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("scraped_postings")
      .select(
        "posting_url, first_seen_at, date_posted, date_modified, date_posted_source, date_posted_confidence, date_posted_raw",
      )
      .in("posting_url", chunk);

    if (error) {
      if (isMissingDateProvenanceColumnError(error)) {
        const { data: legacyData, error: legacyError } = await supabase
          .from("scraped_postings")
          .select("posting_url, first_seen_at, date_posted")
          .in("posting_url", chunk);
        if (legacyError) {
          throw legacyError;
        }
        for (const row of legacyData ?? []) {
          if (!row.posting_url || !row.first_seen_at) {
            continue;
          }
          byUrl.set(row.posting_url, {
            first_seen_at: row.first_seen_at,
            dates: {
              date_posted: row.date_posted,
              date_modified: null,
              date_posted_source: "unknown",
              date_posted_confidence: "unknown",
              date_posted_raw: null,
            },
          });
        }
        continue;
      }
      throw error;
    }

    for (const row of data ?? []) {
      if (!row.posting_url || !row.first_seen_at) {
        continue;
      }
      byUrl.set(row.posting_url, {
        first_seen_at: row.first_seen_at,
        dates: {
          date_posted: row.date_posted,
          date_modified: row.date_modified ?? null,
          date_posted_source: (row.date_posted_source ?? "unknown") as PostedDateSource,
          date_posted_confidence: (row.date_posted_confidence ?? "unknown") as PostedDateConfidence,
          date_posted_raw: row.date_posted_raw ?? null,
        },
      });
    }
  }

  return byUrl;
}

async function closeStaleScrapedPostings(
  supabase: SupabaseClient,
  companyId: string,
  seenUrls: ReadonlySet<string>,
  now: string,
): Promise<void> {
  const { data: openRows, error: openError } = await supabase
    .from("scraped_postings")
    .select("id, posting_url")
    .eq("company_id", companyId)
    .eq("status", "open");

  if (openError) {
    throw openError;
  }

  const toClose = (openRows ?? []).filter((row) => !seenUrls.has(row.posting_url));
  if (toClose.length === 0) {
    return;
  }

  for (const idChunk of chunkArray(
    toClose.map((row) => row.id),
    UPSERT_CHUNK_SIZE,
  )) {
    const { error: closeError } = await supabase
      .from("scraped_postings")
      .update({ status: "closed", last_seen_at: now })
      .in("id", idChunk);
    if (closeError) {
      throw closeError;
    }
  }
}

function chunkArray<T>(items: readonly T[], size: number): T[][] {
  if (items.length === 0) {
    return [];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function markSourceSuccess(supabase: SupabaseClient, sourceId: string) {
  const { error } = await supabase
    .from("company_sources")
    .update({
      last_success_at: new Date().toISOString(),
      consecutive_failures: 0,
      last_error_code: null,
    })
    .eq("id", sourceId);
  if (error) throw error;
}

async function markSourceFailure(supabase: SupabaseClient, sourceId: string, message: string) {
  const { data, error: readError } = await supabase
    .from("company_sources")
    .select("consecutive_failures")
    .eq("id", sourceId)
    .maybeSingle();

  if (readError) {
    throw readError;
  }

  const failures = (data?.consecutive_failures ?? 0) + 1;
  const { error } = await supabase
    .from("company_sources")
    .update({
      last_failure_at: new Date().toISOString(),
      consecutive_failures: failures,
      last_error_code: message.slice(0, 500),
    })
    .eq("id", sourceId);
  if (error) throw error;
}

export function mapCompanySourceRow(row: CompanySourceRow): CompanySourceConfig | null {
  const company = row.companies;
  if (!company || !isSourceType(row.source_type)) {
    return null;
  }

  return {
    id: row.id,
    companyId: company.id,
    companySlug: company.slug,
    companyName: company.name,
    sourceType: row.source_type,
    adapterKey: row.adapter_key,
    sourceUrl: row.source_url ?? "",
    boardToken: row.board_token,
  };
}

function buildKeptPreview(roles: ScrapedRole[]): KeptRolePreview[] | undefined {
  if (roles.length === 0) {
    return undefined;
  }
  return roles.slice(0, KEPT_PREVIEW_LIMIT).map((role) => ({
    title: role.roleName,
    season: role.season,
    location: role.location,
  }));
}

export type { CompanySourceRow };
