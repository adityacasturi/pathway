import type { AlertFilters } from "@/lib/alerts/filters";
import type { SectorLogoCompany } from "@/components/sector-logo-stack";

export interface AlertSubscriptionView {
  id: string;
  type: "company" | "sector";
  label: string;
  companyId: string | null;
  companySlug: string | null;
  sectorSlug: string | null;
  feedSlug: string | null;
  websiteUrl: string | null;
  sectorCompanies?: SectorLogoCompany[];
  filterOverride: Partial<AlertFilters> | null;
  paused: boolean;
  cadence?: "instant" | "digest";
}

export interface AlertCompanyOption {
  id: string;
  name: string;
  slug: string;
  websiteUrl: string | null;
  industryLabel: string;
}

export interface CuratedSectorView {
  slug: string;
  label: string;
  description: string;
  groupLabel: string;
  groupSortOrder: number;
  companies: SectorLogoCompany[];
}

export type AlertTypeFilter = "all" | "company" | "sector";
