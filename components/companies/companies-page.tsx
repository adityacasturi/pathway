"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CompaniesFilterBar,
  type CompanySortDirection,
  type CompanySortKey,
} from "@/components/companies/companies-filter-bar";
import { CompaniesIndustryRail } from "@/components/companies/companies-industry-rail";
import { CompanyInspector } from "@/components/companies/company-inspector";
import { CompaniesRecordList } from "@/components/companies/companies-record-list";
import { PageShell } from "@/components/design-system/page";
import { resolveInteractionSet } from "@/lib/feed/interactions";
import {
  fetchDiscoverCompanyPostings,
  starDiscoverCompany,
  unstarDiscoverCompany,
} from "@/lib/actions/discover";
import type { DiscoverIndustryCatalogItem } from "@/lib/discover/catalog";
import { compareDiscoverCompaniesByOpenings } from "@/lib/discover/industries";
import { isDiscoverPostingVisibleByState } from "@/lib/discover/posting-feed";
import {
  companyMatchesSearch,
  getDiscoverSearchTerms,
  postingMatchesSearch,
} from "@/lib/discover/search";
import type { DiscoverCompanyCard, ScrapedPostingRow } from "@/lib/discover/types";
import { InlineError } from "@/components/ui/inline-error";
import type { FeedSeason } from "@/lib/feed/types";
import {
  buildCountryFilterOptions,
  countriesFromLocationField,
  countCountriesInDataset,
  matchesCountryFilter,
} from "@/lib/feed/country-filter";
import { useFocusSearchShortcut } from "@/lib/ui/focus-search-shortcut";

const INITIAL_VISIBLE_COMPANIES = 40;
const LOAD_COMPANY_BATCH = 40;

type IndustryFilter = "all" | string;

function sortCompanies(
  companies: DiscoverCompanyCard[],
  sortKey: CompanySortKey | null,
  sortDirection: CompanySortDirection,
): DiscoverCompanyCard[] {
  const list = companies.slice();

  if (!sortKey || sortKey === "openings") {
    list.sort(compareDiscoverCompaniesByOpenings);
    if (sortKey && sortDirection === "asc") {
      list.reverse();
    }
    return list;
  }

  if (sortKey === "name") {
    list.sort((a, b) => {
      const cmp = a.name.localeCompare(b.name);
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return list;
  }

  list.sort((a, b) => {
    const aTime = a.lastSuccessAt ? new Date(a.lastSuccessAt).getTime() : 0;
    const bTime = b.lastSuccessAt ? new Date(b.lastSuccessAt).getTime() : 0;
    const cmp = aTime - bTime;
    return sortDirection === "asc" ? cmp : -cmp;
  });
  return list;
}

function pinStarredCompanies(
  companies: DiscoverCompanyCard[],
  starredIds: Set<string>,
): DiscoverCompanyCard[] {
  if (starredIds.size === 0) return companies;

  const starred: DiscoverCompanyCard[] = [];
  const rest: DiscoverCompanyCard[] = [];
  for (const company of companies) {
    if (starredIds.has(company.id)) starred.push(company);
    else rest.push(company);
  }
  return [...starred, ...rest];
}

export interface CompaniesPageProps {
  companies: DiscoverCompanyCard[];
  industryCatalog: DiscoverIndustryCatalogItem[];
  initialStarredCompanyIds: string[];
  dismissedIds: string[];
  trackedUrls: string[];
}

export function CompaniesPage({
  companies,
  industryCatalog,
  initialStarredCompanyIds,
  dismissedIds,
  trackedUrls,
}: CompaniesPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkSlug = searchParams.get("company");
  const deepLinkIndustry = searchParams.get("industry");
  const deepLinkHandledRef = useRef<string | null>(null);
  const [isRefreshing, startRefresh] = useTransition();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [searchFocused, setSearchFocused] = useState(false);
  const [industryFilter, setIndustryFilter] = useState<IndustryFilter>("all");
  const [sortKey, setSortKey] = useState<CompanySortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<CompanySortDirection>("desc");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [postingsByCompanyId, setPostingsByCompanyId] = useState<
    Record<string, ScrapedPostingRow[]>
  >({});
  const [loadingCompanyId, setLoadingCompanyId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [starredIds, setStarredIds] = useState(() => new Set(initialStarredCompanyIds));
  const [starPendingId, setStarPendingId] = useState<string | null>(null);
  const [starError, setStarError] = useState<string | null>(null);
  const [dismissedOverrides] = useState<Map<string, boolean>>(() => new Map());
  const [postingQuery, setPostingQuery] = useState("");
  const deferredPostingQuery = useDeferredValue(postingQuery);
  const [selectedPostingSeasons, setSelectedPostingSeasons] = useState<Set<FeedSeason>>(
    () => new Set(),
  );
  const [selectedPostingCountries, setSelectedPostingCountries] = useState<Set<string>>(
    () => new Set(),
  );
  const searchInputRef = useRef<HTMLDivElement | null>(null);
  const inspectorOpenRef = useRef(false);

  const dismissedSet = useMemo(
    () => resolveInteractionSet(dismissedIds, dismissedOverrides),
    [dismissedIds, dismissedOverrides],
  );

  const trackedUrlSet = useMemo(() => new Set(trackedUrls), [trackedUrls]);

  const selected = useMemo(
    () => companies.find((company) => company.slug === selectedSlug) ?? null,
    [companies, selectedSlug],
  );

  const selectedPostingsRaw = selected ? (postingsByCompanyId[selected.id] ?? null) : null;

  const selectedPostingsAvailable = useMemo(() => {
    if (!selectedPostingsRaw) return null;
    return selectedPostingsRaw.filter((posting) =>
      isDiscoverPostingVisibleByState(posting, {
        trackedUrls: trackedUrlSet,
        dismissedIds: dismissedSet,
        showDismissed: false,
      }),
    );
  }, [dismissedSet, selectedPostingsRaw, trackedUrlSet]);

  const postingSearchTerms = useMemo(
    () => getDiscoverSearchTerms(deferredPostingQuery),
    [deferredPostingQuery],
  );

  const postingCountriesById = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const posting of selectedPostingsAvailable ?? []) {
      map.set(posting.id, countriesFromLocationField(posting.location));
    }
    return map;
  }, [selectedPostingsAvailable]);

  const postingCountryFilterOptions = useMemo(() => {
    if (!selectedPostingsAvailable) return [];
    const items = selectedPostingsAvailable.map((posting) => ({
      countries: postingCountriesById.get(posting.id) ?? [],
    }));
    return buildCountryFilterOptions(countCountriesInDataset(items));
  }, [selectedPostingsAvailable, postingCountriesById]);

  const postingSeasonCounts = useMemo(() => {
    const counts: Partial<Record<FeedSeason, number>> = {};
    for (const posting of selectedPostingsAvailable ?? []) {
      if (!posting.season) continue;
      counts[posting.season] = (counts[posting.season] ?? 0) + 1;
    }
    return counts;
  }, [selectedPostingsAvailable]);

  const selectedPostings = useMemo(() => {
    if (!selectedPostingsAvailable) return null;
    return selectedPostingsAvailable.filter((posting) => {
      if (
        selectedPostingSeasons.size > 0 &&
        posting.season &&
        !selectedPostingSeasons.has(posting.season)
      ) {
        return false;
      }
      if (
        !matchesCountryFilter(
          postingCountriesById.get(posting.id) ?? [],
          selectedPostingCountries,
        )
      ) {
        return false;
      }
      return postingMatchesSearch(posting, postingSearchTerms);
    });
  }, [
    selectedPostingsAvailable,
    selectedPostingSeasons,
    selectedPostingCountries,
    postingCountriesById,
    postingSearchTerms,
  ]);

  useEffect(() => {
    inspectorOpenRef.current = selected !== null;
  }, [selected]);

  useFocusSearchShortcut(searchInputRef, {
    enabled: () => !inspectorOpenRef.current,
  });

  const searchTerms = useMemo(() => getDiscoverSearchTerms(deferredQuery), [deferredQuery]);

  const searchableCount = useMemo(
    () => companies.filter((company) => companyMatchesSearch(company, searchTerms)).length,
    [companies, searchTerms],
  );

  const industryFilterOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const company of companies) {
      if (!companyMatchesSearch(company, searchTerms)) continue;
      counts.set(company.industry, (counts.get(company.industry) ?? 0) + 1);
    }
    const sortOrderBySlug = new Map(
      industryCatalog.map((item) => [item.slug, item.sortOrder]),
    );
    return industryCatalog
      .map((item) => ({
        industry: item.slug,
        label: item.label,
        count: counts.get(item.slug) ?? 0,
      }))
      .sort(
        (a, b) =>
          b.count - a.count ||
          (sortOrderBySlug.get(a.industry) ?? 0) - (sortOrderBySlug.get(b.industry) ?? 0) ||
          a.label.localeCompare(b.label),
      );
  }, [companies, industryCatalog, searchTerms]);

  const resolvedIndustryFilter = useMemo((): IndustryFilter => {
    const fromDeepLink =
      industryFilter === "all" &&
      deepLinkIndustry &&
      industryFilterOptions.some((option) => option.industry === deepLinkIndustry)
        ? deepLinkIndustry
        : industryFilter;
    return fromDeepLink !== "all" &&
      !industryFilterOptions.some((option) => option.industry === fromDeepLink)
      ? "all"
      : fromDeepLink;
  }, [deepLinkIndustry, industryFilter, industryFilterOptions]);

  const filtered = useMemo(() => {
    return companies.filter((company) => {
      if (resolvedIndustryFilter !== "all" && company.industry !== resolvedIndustryFilter) {
        return false;
      }
      return companyMatchesSearch(company, searchTerms);
    });
  }, [companies, resolvedIndustryFilter, searchTerms]);

  const sorted = useMemo(
    () => sortCompanies(filtered, sortKey, sortDirection),
    [filtered, sortKey, sortDirection],
  );

  const listedCompanies = useMemo(
    () => pinStarredCompanies(sorted, starredIds),
    [sorted, starredIds],
  );

  const showCategoryFilter = industryCatalog.length > 1;

  const useProgressiveReveal = listedCompanies.length > INITIAL_VISIBLE_COMPANIES;

  const companyListResetKey = `${resolvedIndustryFilter}|${deferredQuery}|${sortKey}|${sortDirection}`;
  const [visibleState, setVisibleState] = useState({
    key: companyListResetKey,
    count: INITIAL_VISIBLE_COMPANIES,
  });
  const effectiveVisibleCount =
    visibleState.key === companyListResetKey
      ? visibleState.count
      : INITIAL_VISIBLE_COMPANIES;

  const visibleCompanies = useMemo(() => {
    if (!useProgressiveReveal) return listedCompanies;
    return listedCompanies.slice(0, effectiveVisibleCount);
  }, [useProgressiveReveal, listedCompanies, effectiveVisibleCount]);

  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const desktopLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const mobileLoadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!useProgressiveReveal || effectiveVisibleCount >= listedCompanies.length) return;

    const sentinel = [desktopLoadMoreRef.current, mobileLoadMoreRef.current].find(
      (el) => el !== null && el.getClientRects().length > 0,
    );
    if (!sentinel) return;

    const scrollRoot = listScrollRef.current;
    const root =
      scrollRoot && scrollRoot.getClientRects().length > 0 ? scrollRoot : null;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleState({
            key: companyListResetKey,
            count: Math.min(effectiveVisibleCount + LOAD_COMPANY_BATCH, listedCompanies.length),
          });
        }
      },
      { root, rootMargin: root ? "200px 0px" : "800px 0px" },
    );

    io.observe(sentinel);
    return () => io.disconnect();
  }, [useProgressiveReveal, effectiveVisibleCount, companyListResetKey, listedCompanies.length]);

  const resetPostingFilters = useCallback(() => {
    setPostingQuery("");
    setSelectedPostingSeasons(new Set());
    setSelectedPostingCountries(new Set());
  }, []);

  const openPostingInOpenings = useCallback(
    (posting: ScrapedPostingRow) => {
      router.push(`/openings?posting=${encodeURIComponent(posting.feedId)}`);
    },
    [router],
  );

  const openCompany = useCallback(
    (company: DiscoverCompanyCard) => {
      let opening = true;
      setSelectedSlug((current) => {
        if (current === company.slug) {
          opening = false;
          return null;
        }
        return company.slug;
      });

      if (!opening) {
        setLoadError(null);
        resetPostingFilters();
        return;
      }

      setLoadError(null);
      resetPostingFilters();

      if (postingsByCompanyId[company.id]) return;

      setLoadingCompanyId(company.id);
      void (async () => {
        const companyId = company.id;
        const result = await fetchDiscoverCompanyPostings(companyId);
        setLoadingCompanyId((current) => (current === companyId ? null : current));
        if ("error" in result) {
          setLoadError(result.error);
          toast.error("Could not load openings", { description: result.error });
          return;
        }
        setPostingsByCompanyId((prev) => ({ ...prev, [companyId]: result.postings }));
      })();
    },
    [postingsByCompanyId, resetPostingFilters],
  );

  useEffect(() => {
    if (!deepLinkSlug || deepLinkHandledRef.current === deepLinkSlug) return;
    const company = companies.find((item) => item.slug === deepLinkSlug);
    if (!company) return;
    deepLinkHandledRef.current = deepLinkSlug;
    const timer = window.setTimeout(() => openCompany(company), 0);
    return () => window.clearTimeout(timer);
  }, [companies, deepLinkSlug, openCompany]);

  const closeInspector = useCallback(() => {
    setSelectedSlug(null);
    setLoadError(null);
    resetPostingFilters();
  }, [resetPostingFilters]);

  const handleSortChange = useCallback((nextKey: CompanySortKey) => {
    if (sortKey !== nextKey) {
      setSortKey(nextKey);
      setSortDirection(nextKey === "name" ? "asc" : "desc");
      return;
    }
    if (sortDirection === "asc") {
      setSortDirection("desc");
      return;
    }
    setSortKey(null);
    setSortDirection("desc");
  }, [sortKey, sortDirection]);

  const toggleStar = useCallback(
    (company: DiscoverCompanyCard) => {
      const wasStarred = starredIds.has(company.id);
      setStarError(null);
      setStarredIds((prev) => {
        const next = new Set(prev);
        if (wasStarred) next.delete(company.id);
        else next.add(company.id);
        return next;
      });
      setStarPendingId(company.id);

      void (async () => {
        const result = wasStarred
          ? await unstarDiscoverCompany(company.id)
          : await starDiscoverCompany(company.id);
        setStarPendingId((current) => (current === company.id ? null : current));
        if ("error" in result) {
          setStarredIds((prev) => {
            const next = new Set(prev);
            if (wasStarred) next.add(company.id);
            else next.delete(company.id);
            return next;
          });
          setStarError(result.error);
          toast.error(wasStarred ? "Could not unstar company" : "Could not star company", {
            description: result.error,
          });
          return;
        }
        toast.success(wasStarred ? "Company removed from starred" : "Company starred");
      })();
    },
    [starredIds],
  );

  const hasMoreRows = useProgressiveReveal && effectiveVisibleCount < listedCompanies.length;

  const onRefresh = useCallback(() => {
    startRefresh(() => {
      router.refresh();
      toast.success("Companies refreshed");
    });
  }, [router]);

  return (
    <PageShell className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1">
        <CompaniesIndustryRail
          industryFilter={resolvedIndustryFilter}
          onIndustryFilterChange={setIndustryFilter}
          searchableCount={searchableCount}
          industryOptions={industryFilterOptions}
          showIndustryFilter={showCategoryFilter}
        />

        <section className="relative flex min-w-0 flex-1 flex-col bg-card">
          <CompaniesFilterBar
            searchRef={searchInputRef}
            query={query}
            onQueryChange={setQuery}
            searchFocused={searchFocused}
            onSearchFocusChange={setSearchFocused}
            searchableCount={searchableCount}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSortChange={handleSortChange}
            industryFilter={resolvedIndustryFilter}
            onIndustryFilterChange={setIndustryFilter}
            industryOptions={industryFilterOptions}
            showIndustryFilter={showCategoryFilter}
            isRefreshing={isRefreshing}
            onRefresh={onRefresh}
          />

          {starError ? (
            <div className="border-b border-border px-5 py-2">
              <InlineError message={starError} />
            </div>
          ) : null}

          <div className="relative flex min-h-0 flex-1 flex-col">
            {selected ? (
              <div
                role="presentation"
                className="ds-overlay-enter absolute inset-0 z-10 hidden bg-background/20 backdrop-blur-[3px] xl:block"
                onClick={closeInspector}
              />
            ) : null}

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <CompaniesRecordList
                companies={visibleCompanies}
                totalCount={filtered.length}
                selectedSlug={selectedSlug}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSortChange={handleSortChange}
                listScrollRef={listScrollRef}
                desktopLoadMoreRef={desktopLoadMoreRef}
                mobileLoadMoreRef={mobileLoadMoreRef}
                hasMoreRows={hasMoreRows}
                onOpen={openCompany}
                starredIds={starredIds}
                starPendingId={starPendingId}
                onToggleStar={toggleStar}
              />
            </div>

            {selected ? (
              <aside className="ds-drawer-enter absolute inset-y-0 right-0 z-20 hidden w-[var(--app-company-inspector-width)] border-l border-border/80 shadow-[-16px_0_48px_-20px_color-mix(in_oklab,var(--ink)_22%,transparent)] xl:block">
                <CompanyInspector
                  variant="panel"
                  company={selected}
                  postings={selectedPostings}
                  postingsRaw={selectedPostingsRaw}
                  postingsAvailable={selectedPostingsAvailable}
                  loading={loadingCompanyId === selected.id}
                  loadError={loadError}
                  postingQuery={postingQuery}
                  onPostingQueryChange={setPostingQuery}
                  selectedPostingSeasons={selectedPostingSeasons}
                  onTogglePostingSeason={(season) => {
                    setSelectedPostingSeasons((prev) => {
                      const next = new Set(prev);
                      if (next.has(season)) next.delete(season);
                      else next.add(season);
                      return next;
                    });
                  }}
                  onClearPostingSeasons={() => setSelectedPostingSeasons(new Set())}
                  postingSeasonCounts={postingSeasonCounts}
                  countryFilterOptions={postingCountryFilterOptions}
                  selectedPostingCountries={selectedPostingCountries}
                  onTogglePostingCountry={(code) => {
                    setSelectedPostingCountries((prev) => {
                      const next = new Set(prev);
                      if (next.has(code)) next.delete(code);
                      else next.add(code);
                      return next;
                    });
                  }}
                  onClearPostingCountries={() => setSelectedPostingCountries(new Set())}
                  onOpenPosting={openPostingInOpenings}
                  onClose={closeInspector}
                  className="h-full"
                />
              </aside>
            ) : null}
          </div>
        </section>
      </div>

      {selected ? (
        <CompanyInspector
          variant="overlay"
          company={selected}
          postings={selectedPostings}
          postingsRaw={selectedPostingsRaw}
          postingsAvailable={selectedPostingsAvailable}
          loading={loadingCompanyId === selected.id}
          loadError={loadError}
          postingQuery={postingQuery}
          onPostingQueryChange={setPostingQuery}
          selectedPostingSeasons={selectedPostingSeasons}
          onTogglePostingSeason={(season) => {
            setSelectedPostingSeasons((prev) => {
              const next = new Set(prev);
              if (next.has(season)) next.delete(season);
              else next.add(season);
              return next;
            });
          }}
          onClearPostingSeasons={() => setSelectedPostingSeasons(new Set())}
          postingSeasonCounts={postingSeasonCounts}
          countryFilterOptions={postingCountryFilterOptions}
          selectedPostingCountries={selectedPostingCountries}
          onTogglePostingCountry={(code) => {
            setSelectedPostingCountries((prev) => {
              const next = new Set(prev);
              if (next.has(code)) next.delete(code);
              else next.add(code);
              return next;
            });
          }}
          onClearPostingCountries={() => setSelectedPostingCountries(new Set())}
          onOpenPosting={openPostingInOpenings}
          onClose={closeInspector}
        />
      ) : null}
    </PageShell>
  );
}
