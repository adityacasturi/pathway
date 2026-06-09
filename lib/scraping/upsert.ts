import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canonicalPlacesToField,
  canonicalPlacesToJson,
  countriesFromPlaces,
  resolveScrapedLocations,
} from "../geo/server.ts";
import type { LocationInput, ResolvedLocations } from "../geo/server.ts";
import {
  PRODUCT_SCOPE_COUNTRY_CODES,
  US_ONLY_INTERNSHIPS,
} from "../config/product-scope.ts";
import { splitScrapedLocationInput } from "./location.ts";
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
const PRODUCT_SCOPE_COUNTRIES = new Set<string>(PRODUCT_SCOPE_COUNTRY_CODES);

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
    const stats = parsed.stats;
    const previewRows = buildScrapedPostingUpsertRows(
      parsed.roles,
      adapter.source.companyId,
      adapter.source.companySlug,
      new Date().toISOString(),
      new Map(),
    );
    const keptPreview = buildKeptPreview(previewRows);
    if (options.dryRun) {
      return {
        slug,
        status: "ok",
        openCount: previewRows.length,
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

function isMissingLocationConfidenceColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const record = error as { code?: unknown; message?: unknown };
  return (
    record.code === "PGRST204" &&
    typeof record.message === "string" &&
    record.message.includes("'location_confidence'")
  );
}

function isMissingLocationPlacesColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const record = error as { code?: unknown; message?: unknown };
  return (
    record.code === "PGRST204" &&
    typeof record.message === "string" &&
    record.message.includes("'location_places'")
  );
}

interface ScrapedPostingUpsertRow {
  company_id: string;
  company_name: string;
  role_name: string;
  posting_url: string;
  season: ScrapedSeason;
  location: string | null;
  location_places: ReturnType<typeof canonicalPlacesToJson>;
  location_confidence: number | null;
  countries: string[];
  status: "open";
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
): Promise<number> {
  const now = new Date().toISOString();
  const companyId = adapter.source.companyId;

  if (roles.length > 0) {
    const existingByUrl = await loadExistingPostingState(
      supabase,
      roles.map((role) => role.postingUrl),
    );
    const rows = buildScrapedPostingUpsertRows(
      roles,
      companyId,
      adapter.source.companySlug,
      now,
      existingByUrl,
    );
    const seenUrls = new Set(rows.map((row) => row.posting_url));

    for (const chunk of chunkArray(rows, UPSERT_CHUNK_SIZE)) {
      const { error } = await supabase.from("scraped_postings").upsert(chunk, {
        onConflict: "posting_url",
      });
      if (!error) {
        continue;
      }
      if (
        isMissingCountriesColumnError(error) ||
        isMissingLocationPlacesColumnError(error) ||
        isMissingLocationConfidenceColumnError(error)
      ) {
        const legacyRows = chunk.map(
          ({
            countries: _countries,
            location_places: _places,
            location_confidence: _confidence,
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

    await closeStaleScrapedPostings(supabase, companyId, seenUrls, now);
    return seenUrls.size;
  }

  await closeStaleScrapedPostings(supabase, companyId, new Set(), now);
  return 0;
}

export function buildScrapedPostingUpsertRows(
  roles: ScrapedRole[],
  companyId: string,
  companySlug: string,
  now: string,
  existingByUrl: ReadonlyMap<string, ExistingPostingState>,
): ScrapedPostingUpsertRow[] {
  const rows: ScrapedPostingUpsertRow[] = [];

  for (const role of roles) {
    const context = {
      companyName: role.companyName,
      companySlug,
    };
    const inputs: LocationInput[] = [
      ...(role.structuredLocations ?? []),
      ...(role.location ? splitScrapedLocationInput(role.location) : []),
    ];
    const resolved =
      inputs.length > 0
        ? resolveScrapedLocations(inputs, context)
        : { places: [], minConfidence: 0, display: null, countries: [] as string[] };
    const scoped = filterResolvedLocationsToProductScope(resolved);
    if (!scoped) {
      continue;
    }

    const location = scoped.display;
    const location_places = canonicalPlacesToJson(scoped.places);
    const countries = scoped.countries;
    const location_confidence =
      scoped.places.length > 0 ? scoped.minConfidence : role.locationConfidence ?? null;

    const existing = existingByUrl.get(role.postingUrl);
    const firstSeenAt = existing?.first_seen_at ?? now;

    rows.push({
      company_id: companyId,
      company_name: role.companyName,
      role_name: role.roleName,
      posting_url: role.postingUrl,
      season: role.season,
      location,
      location_places,
      location_confidence,
      countries,
      status: "open" as const,
      first_seen_at: firstSeenAt,
      last_seen_at: now,
    });
  }

  return rows;
}

function filterResolvedLocationsToProductScope(
  resolved: ResolvedLocations,
): ResolvedLocations | null {
  if (!US_ONLY_INTERNSHIPS) {
    return resolved;
  }

  const places = resolved.places.filter((place) =>
    PRODUCT_SCOPE_COUNTRIES.has(place.countryCode.toUpperCase()),
  );
  if (places.length === 0) {
    return null;
  }

  return {
    places,
    minConfidence: resolved.minConfidence,
    display: canonicalPlacesToField(places),
    countries: countriesFromPlaces(places),
  };
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

function buildKeptPreview(rows: ScrapedPostingUpsertRow[]): KeptRolePreview[] | undefined {
  if (rows.length === 0) {
    return undefined;
  }
  return rows.slice(0, KEPT_PREVIEW_LIMIT).map((row) => ({
    title: row.role_name,
    season: row.season,
    location: row.location,
  }));
}

export type { CompanySourceRow };
