export interface CuratedAlertSector {
  slug: string;
  label: string;
  description: string;
  groupLabel: string;
  groupSortOrder: number;
  companySlugs: string[];
}

export function isCompanyInCuratedSector(
  sectorSlug: string,
  companySlug: string,
  sectorMembers: Map<string, Set<string>>,
): boolean {
  return sectorMembers.get(sectorSlug)?.has(companySlug) ?? false;
}

export interface SectorCompanyDisplay {
  slug: string;
  name: string;
  websiteUrl: string | null;
}

export function resolveSectorCompanies(
  sector: CuratedAlertSector,
  companiesBySlug: Map<string, SectorCompanyDisplay>,
): SectorCompanyDisplay[] {
  return sector.companySlugs
    .map((slug) => companiesBySlug.get(slug))
    .filter((company): company is SectorCompanyDisplay => Boolean(company));
}
