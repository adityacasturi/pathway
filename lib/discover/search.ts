import { getSearchTerms } from "@/lib/search-terms";

export { getSearchTerms as getDiscoverSearchTerms };

export function companyMatchesSearch(company: { name: string; slug: string }, terms: string[]) {
  if (terms.length === 0) return true;
  const haystack = `${company.name} ${company.slug}`.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

export function postingMatchesSearch(
  posting: { roleName: string; location: string | null },
  terms: string[],
) {
  if (terms.length === 0) return true;
  const haystack = `${posting.roleName} ${posting.location ?? ""}`.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}
