import type { AlertFilters } from "@/lib/alerts/filters";
import type { SectorLogoCompany } from "@/components/sector-logo-stack";

export interface AlertSubscriptionView {
  id: string;
  type: "company" | "sector";
  label: string;
  companyId: string | null;
  companySlug: string | null;
  sectorSlug: string | null;
  websiteUrl: string | null;
  sectorCompanies?: SectorLogoCompany[];
  filterOverride: Partial<AlertFilters> | null;
  paused: boolean;
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
  companies: SectorLogoCompany[];
}

/** @deprecated Use AlertSubscriptionView */
export interface SectorAlertView {
  id: string;
  slug: string;
  filterOverride: Partial<AlertFilters> | null;
}

/** @deprecated Use AlertSubscriptionView */
export interface CompanyAlertView {
  id: string;
  companyId: string;
  companySlug: string | null;
  name: string;
  websiteUrl: string | null;
  filterOverride: Partial<AlertFilters> | null;
}

export type AlertTypeFilter = "all" | "company" | "sector";
