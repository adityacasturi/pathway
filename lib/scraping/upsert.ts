import type { SupabaseClient } from "@supabase/supabase-js";
import { canonicalPlacesToJson } from "../geo/server.ts";
import { CountryAllowlist } from "./country-allowlist.ts";
import { canonicalizePostingUrl } from "./posting-url.ts";
import {
  isSourceType,
  type CompanySourceConfig,
  type KeptRolePreview,
  type RoleParseResult,
  type ScrapeAdapter,
  type ScrapedRole,
  type SourceScrapeResult,
  type SourceScrapeStatus,
} from "./types.ts";

const KEPT_PREVIEW_LIMIT = 10;
/** PostgREST upsert / `in` filter chunk size for large boards. */
const UPSERT_CHUNK_SIZE = 200;
/** Below this confidence a stored location counts as "low confidence" in run stats. */
const LOW_CONFIDENCE_THRESHOLD = 75;

interface RunScrapeAdapterOptions {
  dryRun?: boolean;
  allowlist?: CountryAllowlist;
}

interface CompanySourceRow {
  id: string;
  source_type: string;
  adapter_key: string;
  source_url: string | null;
  board_token: string | null;
  last_fetched_count: number | null;
  last_kept_count: number | null;
  last_healthy_fetched_count: number | null;
  last_healthy_kept_count: number | null;
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
    const stats = parsed.stats;
    const rows = buildScrapedPostingUpsertRows(
      parsed.roles,
      adapter.source,
      new Date().toISOString(),
      new Map(),
      options.allowlist,
    );

    /**
     * Zero raw roles where the previous run fetched some usually means the
     * careers page moved or the adapter's parse selector broke — surface it
     * instead of letting the source silently go dark.
     */
    const openRows = rows.filter((row) => row.status === "open");
    const existingOpenCount =
      stats.fetched === 0 && rows.length === 0
        ? await countOpenScrapedPostingsForCompany(supabase, adapter.source.companyId)
        : null;
    const status = resolveSourceScrapeStatus({
      stats,
      rowCount: rows.length,
      source: adapter.source,
      existingOpenCount,
    });
    const baseResult = {
      slug,
      status,
      stats,
      keptPreview: buildKeptPreview(openRows),
      unknownLocationCount: rows.filter((row) => row.location === null).length,
      lowConfidenceLocationCount: rows.filter(
        (row) => row.location_confidence !== null && row.location_confidence < LOW_CONFIDENCE_THRESHOLD,
      ).length,
      countryBlockedCount: rows.filter((row) => row.status === "country_blocked").length,
      countryUnknownCount: rows.filter((row) => row.status === "country_unknown").length,
    };

    if (options.dryRun) {
      return { ...baseResult, openCount: openRows.length };
    }

    const suspicious = isSuspiciousScrapeStatus(status);
    const openCount = await upsertScrapedRoles(supabase, adapter, parsed.roles, options.allowlist, {
      closeStale: !suspicious,
    });
    if (suspicious) {
      await markSourceUnhealthy(supabase, adapter.source.id, status, stats.fetched, openRows.length);
    } else {
      const healthyStatus = status === "ok_no_roles" ? "ok_no_roles" : "ok";
      await markSourceHealthy(supabase, adapter.source.id, healthyStatus, stats.fetched, openCount);
    }
    return { ...baseResult, openCount };
  } catch (error) {
    const message = formatScrapeErrorMessage(error);
    if (!options.dryRun) {
      await markSourceFailure(supabase, adapter.source.id, message);
    }
    return { slug, status: "error", openCount: 0, error: message };
  }
}

function formatScrapeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (error && typeof error === "object") {
    const record = error as { message?: unknown; code?: unknown };
    if (typeof record.message === "string" && record.message.trim()) {
      const code = typeof record.code === "string" ? record.code : "";
      return code ? `${record.message} (${code})` : record.message;
    }
  }
  return "Unknown scrape error";
}

interface ScrapedPostingUpsertRow {
  company_id: string;
  company_name: string;
  role_name: string;
  posting_url: string;
  role_type: string;
  season: string | null;
  location: string | null;
  raw_location: string | null;
  location_places: ReturnType<typeof canonicalPlacesToJson>;
  location_confidence: number | null;
  countries: string[];
  source_id: string;
  status: "open" | "country_blocked" | "country_unknown";
  first_seen_at: string;
  last_seen_at: string;
}

interface ExistingPostingState {
  first_seen_at: string;
}

async function upsertScrapedRoles(
  supabase: SupabaseClient,
  adapter: ScrapeAdapter,
  roles: ScrapedRole[],
  allowlist?: CountryAllowlist,
  options: { closeStale?: boolean } = {},
): Promise<number> {
  const now = new Date().toISOString();
  const companyId = adapter.source.companyId;
  const closeStale = options.closeStale !== false;

  if (roles.length === 0) {
    if (closeStale) {
      await closeStaleScrapedPostings(supabase, companyId, new Set(), now);
    }
    return 0;
  }

  const existingByUrl = await loadExistingPostingState(
    supabase,
    roles.map((role) => canonicalizePostingUrl(role.postingUrl)),
  );
  const rows = buildScrapedPostingUpsertRows(roles, adapter.source, now, existingByUrl, allowlist);
  const openCount = rows.filter((row) => row.status === "open").length;
  const seenUrls = new Set(rows.map((row) => row.posting_url));

  for (const chunk of chunkArray(rows, UPSERT_CHUNK_SIZE)) {
    const { error } = await supabase.from("scraped_postings").upsert(chunk, {
      onConflict: "posting_url",
    });
    if (error) {
      throw error;
    }
  }

  if (closeStale) {
    await closeStaleScrapedPostings(supabase, companyId, seenUrls, now);
  }
  return openCount;
}

export function buildScrapedPostingUpsertRows(
  roles: ScrapedRole[],
  source: Pick<CompanySourceConfig, "id" | "companyId">,
  now: string,
  existingByUrl: ReadonlyMap<string, ExistingPostingState>,
  allowlist?: CountryAllowlist,
): ScrapedPostingUpsertRow[] {
  const rows: ScrapedPostingUpsertRow[] = [];
  const seen = new Set<string>();

  for (const role of roles) {
    const postingUrl = canonicalizePostingUrl(role.postingUrl);
    if (seen.has(postingUrl)) {
      continue;
    }
    seen.add(postingUrl);

    const existing = existingByUrl.get(postingUrl);

    const decision = allowlist?.check(role.countries) ?? { allowed: true as const };
    const status: ScrapedPostingUpsertRow["status"] = decision.allowed
      ? "open"
      : decision.reason === "country_unknown"
        ? "country_unknown"
        : "country_blocked";

    rows.push({
      company_id: source.companyId,
      company_name: role.companyName,
      role_name: role.roleName,
      posting_url: postingUrl,
      role_type: role.roleType,
      season: role.season,
      location: role.location,
      raw_location: role.rawLocation,
      location_places: canonicalPlacesToJson(role.places),
      location_confidence: role.locationConfidence,
      countries: role.countries,
      source_id: source.id,
      status,
      first_seen_at: existing?.first_seen_at ?? now,
      last_seen_at: now,
    });
  }

  return rows;
}

async function loadExistingPostingState(
  supabase: SupabaseClient,
  postingUrls: string[],
): Promise<Map<string, ExistingPostingState>> {
  const byUrl = new Map<string, ExistingPostingState>();

  for (const chunk of chunkArray(postingUrls, UPSERT_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("scraped_postings")
      .select("posting_url, first_seen_at")
      .in("posting_url", chunk);

    if (error) {
      throw error;
    }

    for (const row of data ?? []) {
      if (!row.posting_url || !row.first_seen_at) {
        continue;
      }
      byUrl.set(row.posting_url, {
        first_seen_at: row.first_seen_at,
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
): Promise<string[]> {
  // Page through all open rows: PostgREST caps unpaged selects at 1000, which
  // would silently leave stale postings open for large boards.
  const openRows: Array<{ id: string; posting_url: string }> = [];
  for (let from = 0; ; from += UPSERT_CHUNK_SIZE) {
    const { data, error: openError } = await supabase
      .from("scraped_postings")
      .select("id, posting_url")
      .eq("company_id", companyId)
      .eq("status", "open")
      .order("id")
      .range(from, from + UPSERT_CHUNK_SIZE - 1);

    if (openError) {
      throw openError;
    }
    openRows.push(...(data ?? []));
    if ((data ?? []).length < UPSERT_CHUNK_SIZE) {
      break;
    }
  }

  const toClose = openRows.filter((row) => !seenUrls.has(row.posting_url));
  if (toClose.length === 0) {
    return [];
  }

  const closedIds: string[] = [];

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
    closedIds.push(...idChunk);
  }

  return closedIds;
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

function resolveSourceScrapeStatus(input: {
  stats: RoleParseResult["stats"];
  rowCount: number;
  source: CompanySourceConfig;
  existingOpenCount: number | null;
}): SourceScrapeResult["status"] {
  const baselineFetched = positiveBaseline(
    input.source.lastHealthyFetchedCount,
    input.source.lastFetchedCount,
  );
  const baselineKept = positiveBaseline(
    input.source.lastHealthyKeptCount,
    input.source.lastKeptCount,
  );

  if (input.stats.fetched === 0) {
    if ((baselineFetched ?? 0) > 0 || (input.existingOpenCount ?? 0) > 0) {
      return "suspicious_zero";
    }
    return "ok_no_roles";
  }

  if (
    baselineFetched !== null &&
    baselineFetched >= 10 &&
    input.stats.fetched < Math.max(3, Math.floor(baselineFetched * 0.3))
  ) {
    return "suspicious_drop";
  }

  if (input.rowCount === 0) {
    if ((baselineKept ?? 0) > 0 && input.stats.fetched >= 10) {
      return "suspicious_filter";
    }
    return "ok_no_roles";
  }

  return "ok";
}

function positiveBaseline(primary: number | null | undefined, fallback: number | null | undefined): number | null {
  if (typeof primary === "number" && primary > 0) {
    return primary;
  }
  if (typeof fallback === "number" && fallback > 0) {
    return fallback;
  }
  return null;
}

type SuspiciousScrapeStatus = Extract<
  SourceScrapeStatus,
  "suspicious_zero" | "suspicious_drop" | "suspicious_filter"
>;

function isSuspiciousScrapeStatus(status: SourceScrapeResult["status"]): status is SuspiciousScrapeStatus {
  return status === "suspicious_zero" || status === "suspicious_drop" || status === "suspicious_filter";
}

async function countOpenScrapedPostingsForCompany(
  supabase: SupabaseClient,
  companyId: string,
): Promise<number | null> {
  if (!supabase) {
    return null;
  }

  const { count, error } = await supabase
    .from("scraped_postings")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("status", "open");
  if (error) {
    throw error;
  }
  return count ?? 0;
}

async function markSourceHealthy(
  supabase: SupabaseClient,
  sourceId: string,
  status: Extract<SourceScrapeStatus, "ok" | "ok_no_roles">,
  fetchedCount: number,
  keptCount: number,
) {
  const { error } = await supabase
    .from("company_sources")
    .update({
      last_success_at: new Date().toISOString(),
      consecutive_failures: 0,
      consecutive_unhealthy_runs: 0,
      last_error_code: null,
      last_fetched_count: fetchedCount,
      last_kept_count: keptCount,
      last_healthy_at: new Date().toISOString(),
      last_healthy_fetched_count: fetchedCount,
      last_healthy_kept_count: keptCount,
      last_attempted_at: new Date().toISOString(),
      last_attempted_fetched_count: fetchedCount,
      last_attempted_kept_count: keptCount,
      scrape_health_status: status,
    })
    .eq("id", sourceId);
  if (error) throw error;
}

async function markSourceUnhealthy(
  supabase: SupabaseClient,
  sourceId: string,
  status: SuspiciousScrapeStatus,
  fetchedCount: number,
  keptCount: number,
) {
  const { data, error: readError } = await supabase
    .from("company_sources")
    .select("consecutive_unhealthy_runs")
    .eq("id", sourceId)
    .maybeSingle();

  if (readError) {
    throw readError;
  }

  const unhealthyRuns = (data?.consecutive_unhealthy_runs ?? 0) + 1;
  const { error } = await supabase
    .from("company_sources")
    .update({
      consecutive_unhealthy_runs: unhealthyRuns,
      last_attempted_at: new Date().toISOString(),
      last_attempted_fetched_count: fetchedCount,
      last_attempted_kept_count: keptCount,
      scrape_health_status: status,
      last_error_code: status,
    })
    .eq("id", sourceId);
  if (error) throw error;
}

async function markSourceFailure(supabase: SupabaseClient, sourceId: string, message: string) {
  const { data, error: readError } = await supabase
    .from("company_sources")
    .select("consecutive_failures, consecutive_unhealthy_runs")
    .eq("id", sourceId)
    .maybeSingle();

  if (readError) {
    throw readError;
  }

  const failures = (data?.consecutive_failures ?? 0) + 1;
  const unhealthyRuns = (data?.consecutive_unhealthy_runs ?? 0) + 1;
  const { error } = await supabase
    .from("company_sources")
    .update({
      last_failure_at: new Date().toISOString(),
      consecutive_failures: failures,
      consecutive_unhealthy_runs: unhealthyRuns,
      last_attempted_at: new Date().toISOString(),
      scrape_health_status: "error",
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
    lastFetchedCount: row.last_fetched_count,
    lastKeptCount: row.last_kept_count,
    lastHealthyFetchedCount: row.last_healthy_fetched_count,
    lastHealthyKeptCount: row.last_healthy_kept_count,
  };
}

function buildKeptPreview(rows: ScrapedPostingUpsertRow[]): KeptRolePreview[] | undefined {
  if (rows.length === 0) {
    return undefined;
  }
  return rows.slice(0, KEPT_PREVIEW_LIMIT).map((row) => ({
    title: row.role_name,
    season: isScrapedSeason(row.season) ? row.season : null,
    location: row.location ?? row.raw_location,
  }));
}

function isScrapedSeason(value: string | null): value is "Summer" | "Fall" | "Spring" | "Winter" {
  return value === "Summer" || value === "Fall" || value === "Spring" || value === "Winter";
}

export type { CompanySourceRow };
