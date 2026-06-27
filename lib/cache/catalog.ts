import { unstable_cache } from "next/cache";
import { loadCuratedAlertSectors } from "@/lib/alerts/load-curated-sectors";
import { loadDiscoverIndustryCatalog } from "@/lib/discover/catalog";
import { loadDiscoverCompanies } from "@/lib/discover/companies";
import { loadScrapedFeedPostings } from "@/lib/feed/scraped-postings";
import {
  companyLogoLookupRecordsFromLookups,
  loadCompanyWebsiteLookups,
  type CompanyLogoLookupRecords,
} from "@/lib/logo/company-website-lookup";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DiscoverCompanyCard } from "@/lib/discover/types";
import type { DiscoverIndustryCatalogItem } from "@/lib/discover/catalog";
import type { CuratedAlertSector } from "@/lib/alerts/curated-sectors";
import type { FeedPosting } from "@/lib/feed/types";
import { CACHE_TAGS, CATALOG_REVALIDATE_SECONDS } from "@/lib/cache/tags";

const catalogRevalidate = { revalidate: CATALOG_REVALIDATE_SECONDS };

export function getCachedDiscoverIndustryCatalog(): Promise<DiscoverIndustryCatalogItem[]> {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();
      return loadDiscoverIndustryCatalog(supabase);
    },
    ["discover-industry-catalog"],
    { ...catalogRevalidate, tags: [CACHE_TAGS.industries] },
  )();
}

export function getCachedDiscoverCompanies(): Promise<DiscoverCompanyCard[]> {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();
      const industryCatalog = await getCachedDiscoverIndustryCatalog();
      return loadDiscoverCompanies(supabase, industryCatalog);
    },
    ["discover-companies"],
    { ...catalogRevalidate, tags: [CACHE_TAGS.companies, CACHE_TAGS.industries] },
  )();
}

export function getCachedFeedPostings(): Promise<FeedPosting[]> {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();
      return loadScrapedFeedPostings(supabase);
    },
    ["feed-postings"],
    { ...catalogRevalidate, tags: [CACHE_TAGS.feed, CACHE_TAGS.companies] },
  )();
}

export function getCachedCompanyWebsiteLookups(): Promise<CompanyLogoLookupRecords> {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();
      const lookups = await loadCompanyWebsiteLookups(supabase);
      return companyLogoLookupRecordsFromLookups(lookups);
    },
    ["company-website-lookups"],
    { ...catalogRevalidate, tags: [CACHE_TAGS.companyLookups, CACHE_TAGS.companies] },
  )();
}

export function getCachedCuratedAlertSectors(): Promise<CuratedAlertSector[]> {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();
      return loadCuratedAlertSectors(supabase);
    },
    ["curated-alert-sectors"],
    { ...catalogRevalidate, tags: [CACHE_TAGS.curatedSectors] },
  )();
}
