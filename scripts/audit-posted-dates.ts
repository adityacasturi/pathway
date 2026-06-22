import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

loadDotEnvLocal();

type PostingRow = {
  id: string;
  role_name: string;
  posting_url: string;
  first_seen_at: string;
  posted_at: string | null;
  last_seen_at: string | null;
  season: string | null;
  companies: { name: string; slug: string } | null;
};

type GreenhouseAuditRow = {
  id: string;
  company: string;
  role: string;
  url: string;
  firstSeenAt: string;
  postedAt: string | null;
  firstPublished: string | null;
  updatedAt: string | null;
  title: string | null;
  hasCurrentSeasonSignal: boolean;
  updateDeltaDays: number | null;
  recommendedPostedAt: string | null;
  reason: string;
};

const supabase = createClient(
  requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
  requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const rows = await loadOpenPostings();
const greenhouseRows = rows.filter((row) => parseGreenhousePosting(row.posting_url));
const audits: GreenhouseAuditRow[] = [];

for (const row of greenhouseRows) {
  const parsed = parseGreenhousePosting(row.posting_url);
  if (!parsed) continue;

  const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${parsed.boardToken}/jobs/${parsed.jobId}`;
  const result = await fetch(apiUrl, { headers: { accept: "application/json" } });
  if (!result.ok) {
    audits.push({
      id: row.id,
      company: row.companies?.name ?? "Unknown",
      role: row.role_name,
      url: row.posting_url,
      firstSeenAt: row.first_seen_at,
      postedAt: row.posted_at,
      firstPublished: null,
      updatedAt: null,
      title: null,
      hasCurrentSeasonSignal: hasCurrentSeasonSignal(row.role_name),
      updateDeltaDays: null,
      recommendedPostedAt: null,
      reason: `greenhouse_api_${result.status}`,
    });
    continue;
  }

  const job = (await result.json()) as {
    title?: string | null;
    content?: string | null;
    first_published?: string | null;
    updated_at?: string | null;
  };

  const title = job.title?.trim() || row.role_name;
  const haystack = `${title} ${stripHtml(job.content ?? "")}`;
  const hasSignal = hasCurrentSeasonSignal(haystack);
  const programYear = extractExplicitProgramYear(haystack);
  const firstPublished = normalizeIso(job.first_published);
  const updatedAt = normalizeIso(job.updated_at);
  const updateDeltaDays = dateDiffDays(firstPublished, updatedAt);
  const dbPosted = normalizeIso(row.posted_at);
  const earliestPlausible = programYear ? new Date(Date.UTC(programYear - 1, 0, 1)).toISOString() : null;

  let recommendedPostedAt: string | null = null;
  let reason = "ok";

  if (
    hasSignal &&
    earliestPlausible &&
    firstPublished &&
    updatedAt &&
    firstPublished < earliestPlausible &&
    updatedAt >= earliestPlausible &&
    (!dbPosted || dbPosted < updatedAt)
  ) {
    recommendedPostedAt = updatedAt;
    reason = "current_season_greenhouse_reused_job_updated";
  }

  audits.push({
    id: row.id,
    company: row.companies?.name ?? "Unknown",
    role: row.role_name,
    url: row.posting_url,
    firstSeenAt: row.first_seen_at,
    postedAt: row.posted_at,
    firstPublished,
    updatedAt,
    title,
    hasCurrentSeasonSignal: hasSignal,
    updateDeltaDays,
    recommendedPostedAt,
    reason,
  });
}

const candidates = audits.filter((row) => row.recommendedPostedAt);
console.log(JSON.stringify({
  openRows: rows.length,
  greenhouseRows: greenhouseRows.length,
  candidates: candidates.length,
  candidateRows: candidates,
}, null, 2));

async function loadOpenPostings(): Promise<PostingRow[]> {
  const results: PostingRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("scraped_postings")
      .select("id, role_name, posting_url, first_seen_at, posted_at, last_seen_at, season, companies(name, slug)")
      .eq("status", "open")
      .order("company_id")
      .range(from, from + 999);

    if (error) throw error;
    results.push(...((data ?? []) as unknown as PostingRow[]));
    if ((data ?? []).length < 1000) break;
  }
  return results;
}

function parseGreenhousePosting(url: string): { boardToken: string; jobId: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  const parts = parsed.pathname.split("/").filter(Boolean);
  const jobId = parts.at(-1)?.match(/\d+/)?.[0] ?? parsed.searchParams.get("gh_jid") ?? "";
  if (!jobId) return null;

  if (host === "boards.greenhouse.io" && parts.length >= 3 && parts[1] === "jobs") {
    return { boardToken: parts[0], jobId };
  }
  if (host === "job-boards.greenhouse.io" && parts.length >= 3 && parts[1] === "jobs") {
    return { boardToken: parts[0], jobId };
  }
  return null;
}

function hasCurrentSeasonSignal(value: string): boolean {
  return /\b(fall|spring|winter|summer)\s*(2026|2027)\b/i.test(value) || /\b2027\b/i.test(value);
}

function extractExplicitProgramYear(value: string): number | null {
  const match = value.match(/\b(?:fall|autumn|spring|summer|winter)\W{0,16}(20\d{2})\b/i)
    ?? value.match(/\b(20\d{2})\W{0,16}(?:fall|autumn|spring|summer|winter)\b/i);
  if (!match?.[1]) {
    return null;
  }
  const year = Number.parseInt(match[1], 10);
  return Number.isFinite(year) ? year : null;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function normalizeIso(value: string | null | undefined): string | null {
  const ms = Date.parse(value ?? "");
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function dateDiffDays(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const diff = Date.parse(b) - Date.parse(a);
  return Number.isFinite(diff) ? Math.floor(diff / 86_400_000) : null;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function loadDotEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    process.env[key] ??= value;
  }
}
