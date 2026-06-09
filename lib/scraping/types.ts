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
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

export function isSourceType(value: string): value is SourceType {
  return (SOURCE_TYPES as readonly string[]).includes(value);
}

export type ScrapedSeason = "Summer" | "Fall" | "Spring" | "Winter";

import type { StructuredPlaceInput } from "../geo/types.ts";

export interface ScrapedRole {
  postingUrl: string;
  roleName: string;
  companyName: string;
  season: ScrapedSeason;
  location: string | null;
  /** Structured adapter inputs preserved for upsert resolution. */
  structuredLocations?: StructuredPlaceInput[];
  locationConfidence?: number;
  /** Truncated plain-text description for search indexing. */
  description?: string | null;
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
}

export interface RoleRejection {
  title: string;
  reason: string;
}

/** Lightweight sample of roles that passed filters (for CLI verbose output). */
export interface KeptRolePreview {
  title: string;
  season: ScrapedSeason;
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

export interface SourceScrapeResult {
  slug: string;
  status: "ok" | "error";
  openCount: number;
  error?: string;
  stats?: RoleParseStats;
  keptPreview?: KeptRolePreview[];
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
