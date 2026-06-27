import type { AlertCompanyOption, CuratedSectorView } from "@/components/alerts/types";
import type { AlertTypeFilter } from "@/components/alerts/types";
import { ALERT_FEATURED_INDUSTRY_SLUGS } from "@/lib/config/alerts";
import { companyMatchesSearch, getDiscoverSearchTerms } from "@/lib/discover/search";
import { getSearchTerms } from "@/lib/search-terms";

const featuredIndustrySlugRank = new Map<string, number>(
  ALERT_FEATURED_INDUSTRY_SLUGS.map((slug, index) => [slug, index]),
);

function compareCuratedSectorsDefault(a: CuratedSectorView, b: CuratedSectorView): number {
  const groupOrder = a.groupSortOrder - b.groupSortOrder;
  if (groupOrder !== 0) {
    return groupOrder;
  }

  const groupLabel = a.groupLabel.localeCompare(b.groupLabel, undefined, { sensitivity: "base" });
  if (groupLabel !== 0) {
    return groupLabel;
  }

  return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
}

export function sortCuratedSectorsForAddDialog(
  sectors: CuratedSectorView[],
): CuratedSectorView[] {
  return [...sectors].sort((left, right) => {
    const leftRank = featuredIndustrySlugRank.get(left.slug);
    const rightRank = featuredIndustrySlugRank.get(right.slug);

    if (leftRank !== undefined && rightRank !== undefined) {
      return leftRank - rightRank;
    }
    if (leftRank !== undefined) {
      return -1;
    }
    if (rightRank !== undefined) {
      return 1;
    }

    return compareCuratedSectorsDefault(left, right);
  });
}

export function getFeaturedIndustrySectors(
  sectors: CuratedSectorView[],
  followedSectorSlugs: Set<string>,
): CuratedSectorView[] {
  const bySlug = new Map(sectors.map((sector) => [sector.slug, sector]));

  return ALERT_FEATURED_INDUSTRY_SLUGS.map((slug) => bySlug.get(slug))
    .filter((sector): sector is CuratedSectorView => {
      if (!sector) {
        return false;
      }
      return !followedSectorSlugs.has(sector.slug);
    });
}

export function partitionIndustrySectorsForAddDialog(
  sectors: CuratedSectorView[],
  followedSectorSlugs: Set<string>,
): { featured: CuratedSectorView[]; remaining: CuratedSectorView[] } {
  const featured = getFeaturedIndustrySectors(sectors, followedSectorSlugs);
  const featuredSlugs = new Set(featured.map((sector) => sector.slug));
  const remaining = sortCuratedSectorsForAddDialog(
    sectors.filter(
      (sector) => !featuredSlugs.has(sector.slug) && !followedSectorSlugs.has(sector.slug),
    ),
  );

  return { featured, remaining };
}

export function getPopularAddableCompanies(
  companies: AlertCompanyOption[],
  followedCompanyIds: Set<string>,
  popularSlugs: readonly string[],
): AlertCompanyOption[] {
  const bySlug = new Map(companies.map((company) => [company.slug, company]));

  return popularSlugs
    .map((slug) => bySlug.get(slug))
    .filter((company): company is AlertCompanyOption => {
      if (!company) return false;
      return !followedCompanyIds.has(company.id);
    });
}

function sectorMatchesSearch(sector: CuratedSectorView, terms: string[]): boolean {
  if (terms.length === 0) {
    return true;
  }

  const haystack = [
    sector.label,
    sector.description,
    sector.slug,
    ...sector.companies.map((company) => company.name),
  ]
    .join(" ")
    .toLowerCase();

  return terms.every((term) => haystack.includes(term));
}

export function filterSectorsByQuery(
  curatedSectors: CuratedSectorView[],
  query: string,
): CuratedSectorView[] {
  const terms = getSearchTerms(query);
  const filtered = curatedSectors.filter((sector) => sectorMatchesSearch(sector, terms));
  return sortCuratedSectorsForAddDialog(filtered);
}

export function filterAddableCompanies(
  companies: AlertCompanyOption[],
  followedCompanyIds: Set<string>,
  query: string,
  typeFilter: AlertTypeFilter,
): AlertCompanyOption[] {
  if (typeFilter === "sector") {
    return [];
  }

  const terms = getDiscoverSearchTerms(query);
  if (terms.length === 0) {
    return [];
  }

  return companies
    .filter((company) => !followedCompanyIds.has(company.id))
    .filter((company) => companyMatchesSearch(company, terms))
    .slice(0, 10);
}
