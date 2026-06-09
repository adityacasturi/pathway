import "server-only";

import { scrapedPostingRowMatchesProductScope } from "@/lib/feed/product-scope";
import { LANDING_TERMINAL_FALLBACK } from "@/lib/landing/terminal-fallback";
import type { LandingTerminalRole, LandingTerminalSnapshot } from "@/lib/landing/terminal-types";
import type { LocationPlaceJson } from "@/lib/geo/types";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export type { LandingTerminalRole, LandingTerminalSnapshot } from "@/lib/landing/terminal-types";

const LANDING_TIME_ZONE = "America/Los_Angeles";
const RECENT_ROLE_LIMIT = 5;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: LANDING_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

interface LandingPostingRow {
  company_name: string;
  role_name: string;
  first_seen_at: string;
  countries: string[] | null;
  location: string | null;
  location_places: LocationPlaceJson[] | null;
}

function formatRoleLine(row: Pick<LandingPostingRow, "company_name" | "role_name" | "first_seen_at">): LandingTerminalRole {
  return {
    timeLabel: timeFormatter.format(new Date(row.first_seen_at)),
    company: truncate(row.company_name, 28),
    role: truncate(row.role_name, 56),
  };
}

async function loadEligibleCompanyIds(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from("companies")
    .select("id, company_sources!inner ( enabled )")
    .eq("is_active", true)
    .eq("company_sources.enabled", true);

  if (error) throw error;
  return ((data ?? []) as { id: string }[]).map((row) => row.id);
}

export async function loadLandingTerminalSnapshot(): Promise<LandingTerminalSnapshot> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return LANDING_TERMINAL_FALLBACK;
  }

  try {
    const supabase = createAdminClient();
    const companyIds = await loadEligibleCompanyIds(supabase);
    if (companyIds.length === 0) {
      return LANDING_TERMINAL_FALLBACK;
    }

    const sevenDaysAgoIso = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();

    const { data, error } = await supabase
      .from("scraped_postings")
      .select("company_name, role_name, first_seen_at, countries, location, location_places")
      .eq("status", "open")
      .gte("first_seen_at", sevenDaysAgoIso)
      .in("company_id", companyIds)
      .order("first_seen_at", { ascending: false });

    if (error) throw error;

    const scopedRows = ((data ?? []) as LandingPostingRow[]).filter((row) =>
      scrapedPostingRowMatchesProductScope(row),
    );
    const recentRoles = scopedRows.slice(0, RECENT_ROLE_LIMIT).map(formatRoleLine);
    if (recentRoles.length === 0) {
      return {
        ...LANDING_TERMINAL_FALLBACK,
        roleCount: scopedRows.length,
        source: "fallback",
      };
    }

    return {
      roleCount: scopedRows.length,
      recentRoles,
      source: "live",
    };
  } catch {
    return LANDING_TERMINAL_FALLBACK;
  }
}
