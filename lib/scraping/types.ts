export const SOURCE_TYPES = [
  "greenhouse",
  "ashby",
  "lever",
  "workday",
  "microsoft",
  "google",
  "jane_street",
  "hudson_river_trading",
  "apple",
  "citadel",
  "two_sigma",
  "amazon",
  "meta",
  "qualcomm",
  "uber",
  "salesforce",
  "de_shaw",
  "tesla",
  "amd",
  "bytedance",
  "atlassian",
  "tower_research",
  "sig",
  "rivian",
  "five_rings",
  "jpmorgan_chase",
  "bloomberg",
  "goldman_sachs",
  "oracle",
  "morgan_stanley",
  "linkedin",
  "intuit",
  "shopify",
  "netflix",
  "ibm",
  "coinbase",
  "citigroup",
  "millennium",
  "lockheed_martin",
  "workable",
  "hiringthing",
  "surge",
  "smartrecruiters",
  "github",
  "splunk",
  "slack",
  "jobvite",
  "juniper_networks",
  "vmware",
  "sap",
  "teradata",
  "seagate",
  "l3harris",
  "arm",
  "valve",
  "bae_systems",
  "chewy",
  "electronic_arts",
  "etsy",
  "peak6",
  "wayfair",
  "general_dynamics",
  "sakana_ai",
  "replicate",
  "luma_ai",
  "modular",
  "breezy",
  "weights_biases",
  "one_x_technologies",
  "synopsys",
  "x_corp",
  "pinpoint",
  "rippling",
  "clearcompany",
  "icims",
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

export function isSourceType(value: string): value is SourceType {
  return (SOURCE_TYPES as readonly string[]).includes(value);
}

export type ScrapedSeason = "Summer" | "Fall" | "Spring" | "Winter";

import type { CanonicalPlace } from "../geo/types.ts";
import type { ScrapeRoleType } from "./classify-role.ts";

export interface AtsPostingDates {
  publishedAt?: string | null;
  updatedAt?: string | null;
}

/**
 * A fully normalized posting, ready for persistence. Construct only via
 * `buildScrapedRole()` so location resolution, season inference, and role
 * typing happen exactly once on the shared path.
 */
export interface ScrapedRole {
  postingUrl: string;
  roleName: string;
  companyName: string;
  roleType: ScrapeRoleType;
  /** Defaults to Summer when no season is stated anywhere. */
  season: ScrapedSeason | null;
  /** Clean display string from resolved places; null when location is unknown. */
  location: string | null;
  /** Canonical resolved places; empty when the location could not be parsed confidently. */
  places: CanonicalPlace[];
  /** Original ATS location strings, always preserved for debugging/fallback. */
  rawLocation: string | null;
  /** Min confidence across resolved places; null when nothing resolved. */
  locationConfidence: number | null;
  /** ISO country codes from resolved places. */
  countries: string[];
  /** Truncated plain-text description for classification/search. */
  description?: string | null;
  /** Raw ATS timestamps used to infer user-facing posted/reposted time. */
  atsDates?: AtsPostingDates;
}

export interface CompanySourceConfig {
  id: string;
  companyId: string;
  companySlug: string;
  companyName: string;
  sourceType: SourceType;
  adapterKey: string;
  sourceUrl: string;
  boardToken: string | null;
  /** Raw role count from the previous successful run; powers suspicious-zero detection. */
  lastFetchedCount?: number | null;
  /** Relevant open role count from the previous successful run. */
  lastKeptCount?: number | null;
  /** Raw role count from the last trusted healthy run; not overwritten by suspicious/error runs. */
  lastHealthyFetchedCount?: number | null;
  /** Relevant open role count from the last trusted healthy run. */
  lastHealthyKeptCount?: number | null;
}

export interface RoleRejection {
  title: string;
  reason: string;
}

/** Lightweight sample of roles that passed filters (for CLI verbose output). */
export interface KeptRolePreview {
  title: string;
  season: ScrapedSeason | null;
  location: string | null;
}

export interface RoleParseStats {
  fetched: number;
  kept: number;
  rejected: RoleRejection[];
}

export interface RoleParseResult {
  roles: ScrapedRole[];
  stats: RoleParseStats;
}

export interface ScrapeAdapter {
  source: CompanySourceConfig;
  fetchRoles(): Promise<RoleParseResult>;
}

/**
 * Per-source outcome. `ok` always means the fetch and parse succeeded;
 * the more specific statuses make silent failures visible:
 *
 * - `ok`               — roles found and persisted
 * - `ok_no_roles`      — fetch/parse fine, source genuinely has no relevant roles
 * - `suspicious_zero`  — fetch/parse fine but zero raw roles where the last
 *                        run had some: the careers page likely changed
 * - `suspicious_drop`  — raw fetched count fell sharply from the healthy baseline
 * - `suspicious_filter` — raw fetch still works, but all relevant roles disappeared
 * - `error`            — fetch or parse failed
 */
export type SourceScrapeStatus =
  | "ok"
  | "ok_no_roles"
  | "suspicious_zero"
  | "suspicious_drop"
  | "suspicious_filter"
  | "error";

export interface SourceScrapeResult {
  slug: string;
  status: SourceScrapeStatus;
  openCount: number;
  error?: string;
  stats?: RoleParseStats;
  keptPreview?: KeptRolePreview[];
  /** Roles persisted with no resolvable location (honest unknowns). */
  unknownLocationCount?: number;
  /** Roles persisted with parser-level (low) location confidence. */
  lowConfidenceLocationCount?: number;
  /** Roles written as country_blocked (country resolved, not in allowlist). */
  countryBlockedCount?: number;
  /** Roles written as country_unknown (no country resolved). */
  countryUnknownCount?: number;
  durationMs?: number;
}

export type ScrapeProgressEvent =
  | { type: "start"; total: number; filterSlug?: string; dryRun?: boolean }
  | {
      type: "begin";
      index: number;
      total: number;
      slug: string;
      companyName: string;
      sourceType: SourceType;
    }
  | { type: "done"; index: number; total: number; result: SourceScrapeResult; durationMs: number };

export type ScrapeProgressHandler = (event: ScrapeProgressEvent) => void;
