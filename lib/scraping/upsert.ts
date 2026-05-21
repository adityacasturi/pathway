import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScrapeAdapter, ScrapeSummary } from "./types.ts";

interface ExistingPosting {
  id: string;
  canonical_url: string;
  content_hash: string | null;
}

interface UpsertedPosting {
  id: string;
  canonical_url: string;
}

export async function runScrapeAdapter(
  supabase: SupabaseClient,
  adapter: ScrapeAdapter,
): Promise<ScrapeSummary> {
  const postings = await adapter.fetchPostings();
  const now = new Date().toISOString();
  const companyId = await ensureCompany(supabase, adapter, now);
  const sourceId = await ensureCompanySource(supabase, adapter, companyId, now);
  const existing = await loadExistingPostings(supabase, postings.map((posting) => posting.canonicalUrl));
  const existingByCanonicalUrl = new Map(existing.map((posting) => [posting.canonical_url, posting]));

  const insertRows: Record<string, unknown>[] = [];
  const updateRows: Record<string, unknown>[] = [];
  for (const posting of postings) {
    const previous = existingByCanonicalUrl.get(posting.canonicalUrl);
    const row = cleanUndefined({
      company_id: companyId,
      company_name: posting.companyName,
      role_name: posting.roleName,
      role_name_raw: posting.roleNameRaw,
      posting_url: posting.postingUrl,
      canonical_url: posting.canonicalUrl,
      date_posted: posting.datePosted,
      date_posted_source: posting.datePostedSource,
      season: posting.season,
      season_year: posting.seasonYear,
      season_source: posting.seasonSource,
      locations: posting.locations,
      location_raw: posting.locationRaw,
      countries: posting.countries,
      is_remote: posting.isRemote,
      status: "open",
      first_seen_at: previous ? undefined : now,
      last_seen_at: now,
      last_changed_at:
        previous && previous.content_hash === posting.contentHash
          ? undefined
          : now,
      closed_at: null,
      content_hash: posting.contentHash,
      metadata: posting.metadata ?? {},
    });

    if (previous) updateRows.push(row);
    else insertRows.push(row);
  }

  if (insertRows.length > 0) {
    const { error } = await supabase.from("postings").insert(insertRows);
    if (error) throw error;
  }

  for (const row of updateRows) {
    const canonicalUrl = row.canonical_url as string;
    const update = { ...row };
    delete update.canonical_url;
    delete update.first_seen_at;
    const { error } = await supabase
      .from("postings")
      .update(update)
      .eq("canonical_url", canonicalUrl as string);
    if (error) throw error;
  }

  const upserted = await loadUpsertedPostings(supabase, postings.map((posting) => posting.canonicalUrl));
  const idByCanonicalUrl = new Map(upserted.map((posting) => [posting.canonical_url, posting.id]));

  const observationRows = postings.flatMap((posting) => {
    const postingId = idByCanonicalUrl.get(posting.canonicalUrl);
    if (!postingId) return [];
    return [cleanUndefined({
      posting_id: postingId,
      company_id: companyId,
      company_source_id: sourceId,
      source_type: adapter.source.sourceType,
      external_job_id: posting.externalJobId,
      source_url: adapter.source.sourceUrl,
      observed_url: posting.postingUrl,
      canonical_url: posting.canonicalUrl,
      content_hash: posting.contentHash,
      raw_payload_hash: null,
      first_seen_at: now,
      last_seen_at: now,
      last_successful_scrape_at: now,
      last_changed_at: now,
      metadata: posting.metadata ?? {},
    })];
  });

  if (observationRows.length > 0) {
    const { error } = await supabase
      .from("posting_source_observations")
      .upsert(observationRows, { onConflict: "company_source_id,canonical_url" });
    if (error) throw error;
  }

  const markedStale = await markMissingPostingsStale(
    supabase,
    sourceId,
    postings.map((posting) => posting.canonicalUrl),
    now,
  );
  await markSourceSuccess(supabase, sourceId, now);

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  for (const posting of postings) {
    const previous = existingByCanonicalUrl.get(posting.canonicalUrl);
    if (!previous) inserted += 1;
    else if (previous.content_hash === posting.contentHash) unchanged += 1;
    else updated += 1;
  }

  return {
    company: adapter.source.companyName,
    source: adapter.source.adapterKey,
    found: postings.length,
    inserted,
    updated,
    unchanged,
    markedStale,
  };
}

async function ensureCompany(
  supabase: SupabaseClient,
  adapter: ScrapeAdapter,
  now: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("companies")
    .upsert({
      slug: adapter.source.companySlug,
      name: adapter.source.companyName,
      careers_url: adapter.source.sourceUrl,
      is_active: true,
      updated_at: now,
    }, { onConflict: "slug" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function ensureCompanySource(
  supabase: SupabaseClient,
  adapter: ScrapeAdapter,
  companyId: string,
  now: string,
): Promise<string> {
  const { data: existing, error: existingError } = await supabase
    .from("company_sources")
    .select("id")
    .eq("company_id", companyId)
    .eq("source_type", adapter.source.sourceType)
    .eq("adapter_key", adapter.source.adapterKey)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.id) return existing.id as string;

  const { data, error } = await supabase
    .from("company_sources")
    .insert({
      company_id: companyId,
      source_type: adapter.source.sourceType,
      adapter_key: adapter.source.adapterKey,
      source_url: adapter.source.sourceUrl,
      board_token: adapter.source.boardToken ?? null,
      scrape_interval_minutes: 180,
      enabled: true,
      updated_at: now,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function loadExistingPostings(
  supabase: SupabaseClient,
  canonicalUrls: string[],
): Promise<ExistingPosting[]> {
  if (canonicalUrls.length === 0) return [];
  const { data, error } = await supabase
    .from("postings")
    .select("id, canonical_url, content_hash")
    .in("canonical_url", canonicalUrls);
  if (error) throw error;
  return (data ?? []) as ExistingPosting[];
}

async function loadUpsertedPostings(
  supabase: SupabaseClient,
  canonicalUrls: string[],
): Promise<UpsertedPosting[]> {
  if (canonicalUrls.length === 0) return [];
  const { data, error } = await supabase
    .from("postings")
    .select("id, canonical_url")
    .in("canonical_url", canonicalUrls);
  if (error) throw error;
  return (data ?? []) as UpsertedPosting[];
}

async function markMissingPostingsStale(
  supabase: SupabaseClient,
  sourceId: string,
  seenCanonicalUrls: string[],
  now: string,
): Promise<number> {
  const { data: observations, error: observationError } = await supabase
    .from("posting_source_observations")
    .select("posting_id, canonical_url")
    .eq("company_source_id", sourceId);
  if (observationError) throw observationError;

  const seen = new Set(seenCanonicalUrls);
  const missingPostingIds = Array.from(
    new Set(
      (observations ?? [])
        .filter((observation) => !seen.has(observation.canonical_url as string))
        .map((observation) => observation.posting_id as string),
    ),
  );
  if (missingPostingIds.length === 0) return 0;

  const { error } = await supabase
    .from("postings")
    .update({ status: "stale", updated_at: now })
    .in("id", missingPostingIds)
    .eq("status", "open");
  if (error) throw error;
  return missingPostingIds.length;
}

async function markSourceSuccess(supabase: SupabaseClient, sourceId: string, now: string) {
  const { error } = await supabase
    .from("company_sources")
    .update({
      last_success_at: now,
      consecutive_failures: 0,
      last_error_code: null,
    })
    .eq("id", sourceId);
  if (error) throw error;
}

function cleanUndefined<T extends Record<string, unknown>>(row: T): T {
  return Object.fromEntries(
    Object.entries(row).filter(([, value]) => value !== undefined),
  ) as T;
}
