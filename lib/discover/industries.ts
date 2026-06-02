import type { DiscoverIndustryCatalogItem } from "@/lib/discover/catalog";

export interface DiscoverIndustrySection<TCompany> {
  industry: string;
  label: string;
  description: string;
  companies: TCompany[];
}

/** Open companies first (by openCount desc), then closed A–Z. */
export function compareDiscoverCompaniesByOpenings<
  TCompany extends { name: string; openCount: number },
>(a: TCompany, b: TCompany): number {
  const aOpen = a.openCount > 0;
  const bOpen = b.openCount > 0;

  if (aOpen !== bOpen) {
    return aOpen ? -1 : 1;
  }

  if (aOpen && bOpen) {
    const byCount = b.openCount - a.openCount;
    if (byCount !== 0) {
      return byCount;
    }
    return a.name.localeCompare(b.name);
  }

  return a.name.localeCompare(b.name);
}

export function groupCompaniesByIndustry<
  TCompany extends {
    industry: string;
    name: string;
    openCount: number;
  },
>(
  companies: TCompany[],
  catalog: DiscoverIndustryCatalogItem[],
): DiscoverIndustrySection<TCompany>[] {
  const buckets = new Map<string, TCompany[]>();

  for (const item of catalog) {
    buckets.set(item.slug, []);
  }

  for (const company of companies) {
    const bucket = buckets.get(company.industry) ?? [];
    bucket.push(company);
    buckets.set(company.industry, bucket);
  }

  return catalog.flatMap((item) => {
    const sectionCompanies = (buckets.get(item.slug) ?? [])
      .slice()
      .sort(compareDiscoverCompaniesByOpenings);
    if (sectionCompanies.length === 0) {
      return [];
    }
    return [
      {
        industry: item.slug,
        label: item.label,
        description: item.description,
        companies: sectionCompanies,
      },
    ];
  });
}
