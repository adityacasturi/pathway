import type { AlertCompanyOption, CuratedSectorView } from "@/components/alerts/types";
import { companyMatchesSearch, getDiscoverSearchTerms } from "@/lib/discover/search";
import { getSearchTerms } from "@/lib/search-terms";
import type { AlertTypeFilter } from "@/components/alerts/types";

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
  return curatedSectors.filter((sector) => sectorMatchesSearch(sector, terms));
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
