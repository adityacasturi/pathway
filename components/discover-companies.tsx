"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, SlidersHorizontal, Star } from "lucide-react";
import { ApplicationDialog } from "@/components/application-dialog";
import { PostingRow } from "@/components/posting-row";
import { createApplication } from "@/lib/actions/applications";
import { savePosting, unsavePosting } from "@/lib/actions/feed";
import {
  buildTrackApplicationFormDataFromScraped,
  feedSeasonToApplicationSeason,
} from "@/lib/feed/build-track-form-data";
import { scrapedPostingToFeedPosting } from "@/lib/discover/posting-feed";
import { normalizeUrl } from "@/lib/url";
import type { ApplicationSeason } from "@/types/application";
import {
  fetchDiscoverCompanyPostings,
  starDiscoverCompany,
  unstarDiscoverCompany,
} from "@/lib/actions/discover";
import type { DiscoverIndustryCatalogItem } from "@/lib/discover/catalog";
import { groupCompaniesByIndustry } from "@/lib/discover/industries";
import {
  companyMatchesSearch,
  getDiscoverSearchTerms,
  postingMatchesSearch,
} from "@/lib/discover/search";
import type { DiscoverCompanyCard, ScrapedPostingRow } from "@/lib/discover/types";
import { CompanyLogo } from "@/components/company-logo";
import type { FeedPosting } from "@/lib/feed/source";
import { SearchInput } from "@/components/search-input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InlineError } from "@/components/ui/inline-error";
import { SkeletonBlock } from "@/components/ui/loading-indicator";
import { FilterChip } from "@/components/ui/filter-chip";
import { FilterSection, SegmentedControl } from "@/components/ui/filter-menu";
import { SEASON_FILTER_OPTIONS, type SeasonFilter } from "@/lib/config/season-filter";
import { getPageLabel } from "@/lib/config/nav";
import { PageHeader, PageMain, PageSection, PageShell } from "@/components/ui/page";
import { useFocusSearchShortcut } from "@/lib/ui/focus-search-shortcut";
import { motionVariants } from "@/lib/ui/motion";

const HIRING_NOW_LIMIT = 10;
const INITIAL_VISIBLE_COMPANIES = 32;
const LOAD_COMPANY_BATCH = 32;
/** ~2 rows of FilterChip pills before "Show all industries". */
const INDUSTRY_FILTER_COLLAPSED_ROWS_PX = 76;
const INDUSTRY_FILTER_COLLAPSE_MIN_OPTIONS = 9;
type IndustryFilter = "all" | string;

interface Props {
  companies: DiscoverCompanyCard[];
  industryCatalog: DiscoverIndustryCatalogItem[];
  initialStarredCompanyIds: string[];
  savedIds: string[];
  trackedUrls: string[];
  quickTrackEnabled?: boolean;
}

interface TrackPrefill {
  company: string;
  role: string;
  posting_url: string;
  location: string;
  season?: ApplicationSeason;
}

function hasAnyInteraction(interactions: Set<string>, interactionIds: string[]): boolean {
  return interactionIds.some((id) => interactions.has(id));
}

function applyInteractionIds(
  current: Set<string>,
  interactionIds: string[],
  next: boolean,
): Set<string> {
  const out = new Set(current);
  for (const id of interactionIds) {
    if (next) out.add(id);
    else out.delete(id);
  }
  return out;
}

function isPostingTracked(
  posting: ScrapedPostingRow,
  trackedUrlSet: Set<string>,
): boolean {
  const key = normalizeUrl(posting.postingUrl) ?? posting.postingUrl;
  return trackedUrlSet.has(key);
}

export function DiscoverCompanies({
  companies,
  industryCatalog,
  initialStarredCompanyIds,
  savedIds,
  trackedUrls,
  quickTrackEnabled = false,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [industryFilter, setIndustryFilter] = useState<IndustryFilter>("all");
  const [industryFiltersExpanded, setIndustryFiltersExpanded] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [postingsByCompanyId, setPostingsByCompanyId] = useState<
    Record<string, ScrapedPostingRow[]>
  >({});
  const [loadingCompanyId, setLoadingCompanyId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [starredIds, setStarredIds] = useState(
    () => new Set(initialStarredCompanyIds),
  );
  const [starPendingId, setStarPendingId] = useState<string | null>(null);
  const [starError, setStarError] = useState<string | null>(null);
  const [savedSet, setSavedSet] = useState<Set<string>>(() => new Set(savedIds));
  const [pendingSavedIds, setPendingSavedIds] = useState<Set<string>>(() => new Set());
  const [trackedUrlOverrides, setTrackedUrlOverrides] = useState<Set<string>>(() => new Set());
  const [trackPendingId, setTrackPendingId] = useState<string | null>(null);
  const [dialogPrefill, setDialogPrefill] = useState<TrackPrefill | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [postingQuery, setPostingQuery] = useState("");
  const deferredPostingQuery = useDeferredValue(postingQuery);
  const [postingSeasonFilter, setPostingSeasonFilter] = useState<SeasonFilter>("all");
  const [postingFiltersOpen, setPostingFiltersOpen] = useState(false);
  const postingFiltersRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLDivElement | null>(null);
  const companyDialogOpenRef = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSavedSet(new Set(savedIds));
  }, [savedIds]);

  const trackedUrlSet = useMemo(
    () => new Set([...trackedUrls, ...trackedUrlOverrides]),
    [trackedUrls, trackedUrlOverrides],
  );

  const selected = useMemo(
    () => companies.find((company) => company.slug === selectedSlug) ?? null,
    [companies, selectedSlug],
  );

  const selectedPostingsRaw = selected ? (postingsByCompanyId[selected.id] ?? null) : null;

  const selectedPostingsUntracked = useMemo(() => {
    if (!selectedPostingsRaw) return null;
    return selectedPostingsRaw.filter((posting) => !isPostingTracked(posting, trackedUrlSet));
  }, [selectedPostingsRaw, trackedUrlSet]);

  const postingSearchTerms = useMemo(
    () => getDiscoverSearchTerms(deferredPostingQuery),
    [deferredPostingQuery],
  );

  const selectedPostings = useMemo(() => {
    if (!selectedPostingsUntracked) return null;
    return selectedPostingsUntracked.filter((posting) => {
      if (postingSeasonFilter !== "all" && posting.season !== postingSeasonFilter) {
        return false;
      }
      return postingMatchesSearch(posting, postingSearchTerms);
    });
  }, [selectedPostingsUntracked, postingSeasonFilter, postingSearchTerms]);

  const postingActiveFilterCount = postingSeasonFilter !== "all" ? 1 : 0;

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!postingFiltersRef.current?.contains(event.target as Node)) {
        setPostingFiltersOpen(false);
      }
    }

    if (!postingFiltersOpen) return;
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [postingFiltersOpen]);

  const onApplicationCreated = useCallback((application: { postingUrl: string | null }) => {
    const normalized = normalizeUrl(application.postingUrl);
    if (!normalized) return;
    setTrackedUrlOverrides((prev) => {
      const next = new Set(prev);
      next.add(normalized);
      return next;
    });
  }, []);

  const onToggleSaved = useCallback((posting: FeedPosting, next: boolean) => {
    const id = posting.id;
    setActionError(null);
    setSavedSet((prev) => applyInteractionIds(prev, posting.interactionIds, next));
    setPendingSavedIds((prev) => {
      const out = new Set(prev);
      out.add(id);
      return out;
    });
    void (async () => {
      const result = next
        ? await savePosting(posting.interactionIds)
        : await unsavePosting(posting.interactionIds);
      if (result?.error) {
        setActionError(result.error);
        setSavedSet((prev) => applyInteractionIds(prev, posting.interactionIds, !next));
      }
      setPendingSavedIds((prev) => {
        if (!prev.has(id)) return prev;
        const out = new Set(prev);
        out.delete(id);
        return out;
      });
    })();
  }, []);

  const openTrack = useCallback(
    async (posting: FeedPosting) => {
      if (!selected) return;

      const scraped = selectedPostingsRaw?.find((row) => row.feedId === posting.id);
      if (!scraped) return;

      if (quickTrackEnabled) {
        setTrackPendingId(posting.id);
        setActionError(null);
        const result = await createApplication(
          buildTrackApplicationFormDataFromScraped(scraped, selected.name),
        );
        setTrackPendingId(null);
        if ("error" in result) {
          setActionError(result.error ?? "Unable to add application.");
          return;
        }
        onApplicationCreated({ postingUrl: scraped.postingUrl });
        router.refresh();
        return;
      }

      const applicationSeason = feedSeasonToApplicationSeason(posting.season);
      setDialogPrefill({
        company: selected.name,
        role: scraped.roleName,
        posting_url: scraped.postingUrl,
        location: scraped.location ?? "",
        ...(applicationSeason ? { season: applicationSeason } : {}),
      });
    },
    [quickTrackEnabled, onApplicationCreated, router, selected, selectedPostingsRaw],
  );

  useEffect(() => {
    companyDialogOpenRef.current = selected !== null;
  }, [selected]);

  useFocusSearchShortcut(searchInputRef, {
    enabled: () => !companyDialogOpenRef.current,
  });

  const searchTerms = useMemo(() => getDiscoverSearchTerms(deferredQuery), [deferredQuery]);

  const searchableCount = useMemo(
    () => companies.filter((company) => companyMatchesSearch(company, searchTerms)).length,
    [companies, searchTerms],
  );

  const industryFilterOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const company of companies) {
      if (!companyMatchesSearch(company, searchTerms)) {
        continue;
      }
      counts.set(company.industry, (counts.get(company.industry) ?? 0) + 1);
    }
    const sortOrderBySlug = new Map(
      industryCatalog.map((item) => [item.slug, item.sortOrder]),
    );
    return industryCatalog
      .filter((item) => (counts.get(item.slug) ?? 0) > 0)
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

  const resolvedIndustryFilter: IndustryFilter =
    industryFilter !== "all" &&
    !industryFilterOptions.some((option) => option.industry === industryFilter)
      ? "all"
      : industryFilter;

  if (resolvedIndustryFilter !== industryFilter) {
    setIndustryFilter(resolvedIndustryFilter);
  }

  const filtered = useMemo(() => {
    return companies.filter((company) => {
      if (resolvedIndustryFilter !== "all" && company.industry !== resolvedIndustryFilter) {
        return false;
      }
      return companyMatchesSearch(company, searchTerms);
    });
  }, [companies, resolvedIndustryFilter, searchTerms]);

  const starredCompanies = useMemo(() => {
    return filtered
      .filter((company) => starredIds.has(company.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered, starredIds]);

  const industrySections = useMemo(
    () => groupCompaniesByIndustry(filtered, industryCatalog),
    [filtered, industryCatalog],
  );

  const showCategoryFilter = industryFilterOptions.length > 1;
  const canCollapseIndustryFilters =
    industryFilterOptions.length >= INDUSTRY_FILTER_COLLAPSE_MIN_OPTIONS;
  const industryFiltersExpandedEffective = canCollapseIndustryFilters
    ? industryFiltersExpanded
    : false;
  const industryFiltersCollapsed =
    canCollapseIndustryFilters && !industryFiltersExpandedEffective;

  const hiringNow = useMemo(
    () =>
      [...companies]
        .filter((company) => company.openCount > 0)
        .sort(
          (a, b) =>
            b.openCount - a.openCount || a.name.localeCompare(b.name),
        )
        .slice(0, HIRING_NOW_LIMIT),
    [companies],
  );

  const useProgressiveReveal =
    resolvedIndustryFilter === "all" &&
    searchTerms.length === 0 &&
    filtered.length > INITIAL_VISIBLE_COMPANIES;

  const listedCompanies = useMemo(
    () => industrySections.flatMap((section) => section.companies),
    [industrySections],
  );

  const companyListResetKey = `${resolvedIndustryFilter}|${deferredQuery}`;
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COMPANIES);
  const [visibleListKey, setVisibleListKey] = useState(companyListResetKey);
  if (companyListResetKey !== visibleListKey) {
    setVisibleListKey(companyListResetKey);
    setVisibleCount(INITIAL_VISIBLE_COMPANIES);
  }

  const visibleCompanyIds = useMemo(() => {
    if (!useProgressiveReveal) {
      return null;
    }
    return new Set(listedCompanies.slice(0, visibleCount).map((company) => company.id));
  }, [useProgressiveReveal, listedCompanies, visibleCount]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!useProgressiveReveal || visibleCount >= listedCompanies.length) {
      return;
    }

    const el = sentinelRef.current;
    if (!el) {
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((count) => Math.min(count + LOAD_COMPANY_BATCH, listedCompanies.length));
        }
      },
      { rootMargin: "800px 0px" },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [useProgressiveReveal, visibleCount, listedCompanies.length]);

  const resetPostingFilters = useCallback(() => {
    setPostingQuery("");
    setPostingSeasonFilter("all");
    setPostingFiltersOpen(false);
  }, []);

  const openCompany = useCallback(
    (company: DiscoverCompanyCard) => {
      setSelectedSlug(company.slug);
      setLoadError(null);
      resetPostingFilters();

      if (postingsByCompanyId[company.id]) {
        return;
      }

      setLoadingCompanyId(company.id);
      void (async () => {
        const companyId = company.id;
        const result = await fetchDiscoverCompanyPostings(companyId);
        setLoadingCompanyId((current) => (current === companyId ? null : current));
        if ("error" in result) {
          setLoadError(result.error);
          return;
        }
        setPostingsByCompanyId((prev) => ({ ...prev, [companyId]: result.postings }));
      })();
    },
    [postingsByCompanyId, resetPostingFilters],
  );

  const closeDialog = useCallback(
    (open: boolean) => {
      if (!open) {
        setSelectedSlug(null);
        setLoadError(null);
        resetPostingFilters();
      }
    },
    [resetPostingFilters],
  );

  const toggleStar = useCallback((company: DiscoverCompanyCard) => {
    const wasStarred = starredIds.has(company.id);
    setStarError(null);
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (wasStarred) {
        next.delete(company.id);
      } else {
        next.add(company.id);
      }
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
          if (wasStarred) {
            next.add(company.id);
          } else {
            next.delete(company.id);
          }
          return next;
        });
        setStarError(result.error);
      }
    })();
  }, [starredIds]);

  const renderCompanyCard = useCallback(
    (company: DiscoverCompanyCard, lazyLogo: boolean) => (
      <CompanyCard
        company={company}
        lazyLogo={lazyLogo}
        starred={starredIds.has(company.id)}
        starPending={starPendingId === company.id}
        onToggleStar={() => toggleStar(company)}
        onOpen={() => openCompany(company)}
      />
    ),
    [openCompany, starPendingId, starredIds, toggleStar],
  );

  return (
    <PageShell>
      <PageMain width="xl">
        <PageHeader title={getPageLabel("/discover")} />

        <div className="mb-8">
          <SearchInput
            ref={searchInputRef}
            value={query}
            onChange={setQuery}
            placeholder="Search companies…"
          />
        </div>

        {showCategoryFilter ? (
          <div className="mb-10">
            <div
              id="discover-industry-filters"
              className="flex flex-wrap gap-2 overflow-hidden"
              style={
                industryFiltersCollapsed
                  ? { maxHeight: INDUSTRY_FILTER_COLLAPSED_ROWS_PX }
                  : undefined
              }
            >
              <FilterChip
                active={resolvedIndustryFilter === "all"}
                label="All"
                count={searchableCount}
                onClick={() => setIndustryFilter("all")}
              />
              {industryFilterOptions.map((option) => (
                <FilterChip
                  key={option.industry}
                  active={resolvedIndustryFilter === option.industry}
                  label={option.label}
                  count={option.count}
                  onClick={() => {
                    setIndustryFilter(option.industry);
                    setIndustryFiltersExpanded(true);
                  }}
                />
              ))}
            </div>
            {canCollapseIndustryFilters ? (
              <button
                type="button"
                aria-expanded={industryFiltersExpandedEffective}
                aria-controls="discover-industry-filters"
                className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setIndustryFiltersExpanded((expanded) => !expanded)}
              >
                {industryFiltersExpandedEffective
                  ? "Show fewer industries"
                  : `Show all industries (${industryFilterOptions.length})`}
                <ChevronDown
                  size={14}
                  strokeWidth={1.75}
                  aria-hidden
                  className={`shrink-0 transition-transform duration-150 ${industryFiltersExpandedEffective ? "rotate-180" : ""}`}
                />
              </button>
            ) : null}
          </div>
        ) : null}

        {starError || actionError ? (
          <div className="mb-6 space-y-3">
            {starError ? <InlineError message={starError} /> : null}
            {actionError ? <InlineError message={actionError} /> : null}
          </div>
        ) : null}

        {starredCompanies.length > 0 ? (
          <PageSection rule={false} className="mb-12">
            <SectionHeading
              title="Starred"
              description="Your favorite companies, saved across devices."
            />
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {starredCompanies.map((company) => (
                <li key={company.id}>
                  {renderCompanyCard(company, false)}
                </li>
              ))}
            </ul>
          </PageSection>
        ) : null}

        {hiringNow.length > 0 && resolvedIndustryFilter === "all" && searchTerms.length === 0 ? (
          <PageSection rule={false} className="mb-12">
            <SectionHeading
              title="Hiring now"
              description="Companies with the most openings on Pathway right now."
            />
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {hiringNow.map((company) => (
                <li key={company.id}>
                  {renderCompanyCard(company, true)}
                </li>
              ))}
            </ul>
          </PageSection>
        ) : null}

        {filtered.length === 0 ? (
          <p className="py-16 text-center text-[15px] text-muted-foreground">
            No companies match your filters.
          </p>
        ) : (
          <div className="space-y-14">
            {industrySections.map((section) => {
              const sectionCompanies = visibleCompanyIds
                ? section.companies.filter((company) => visibleCompanyIds.has(company.id))
                : section.companies;

              if (sectionCompanies.length === 0) {
                return null;
              }

              return (
                <section
                  key={section.industry}
                  aria-labelledby={`discover-industry-${section.industry}`}
                >
                  <div className="mb-6">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2
                        id={`discover-industry-${section.industry}`}
                        className="text-[17px] font-medium text-foreground"
                      >
                        {section.label}
                      </h2>
                      <span className="label-meta tabular-nums text-muted-foreground">
                        {section.companies.length}{" "}
                        {section.companies.length === 1 ? "company" : "companies"}
                      </span>
                    </div>
                    <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
                      {section.description}
                    </p>
                  </div>
                  <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {sectionCompanies.map((company) => (
                      <li key={company.id}>
                        {renderCompanyCard(company, true)}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
            {useProgressiveReveal && visibleCount < listedCompanies.length ? (
              <div ref={sentinelRef} className="h-px" aria-hidden />
            ) : null}
          </div>
        )}
      </PageMain>

      <Dialog open={selected !== null} onOpenChange={closeDialog}>
        {selected ? (
          <DialogContent className="flex max-h-[min(85vh,720px)] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
            <div className="shrink-0 border-b border-border/80 px-6 pb-5 pt-5">
              <DialogHeader className="pb-0">
                <DialogTitle className="flex items-center gap-4">
                  <CompanyLogo company={selected.name} websiteUrl={selected.websiteUrl} size={44} />
                  <span className="display-serif text-[1.75rem] leading-tight text-foreground">
                    {selected.name}
                  </span>
                </DialogTitle>
              </DialogHeader>

              <CompanyDialogMeta company={selected} />
            </div>

            {selectedPostingsUntracked && selectedPostingsUntracked.length > 0 ? (
              <div className="shrink-0 border-b border-border/80 px-6 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <SearchInput
                      value={postingQuery}
                      onChange={setPostingQuery}
                      placeholder="Search role or location…"
                    />
                  </div>
                  <div ref={postingFiltersRef} className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setPostingFiltersOpen((open) => !open)}
                      aria-expanded={postingFiltersOpen}
                      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border bg-background/80 px-4 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground aria-expanded:text-foreground sm:w-auto"
                      style={{
                        borderColor:
                          postingActiveFilterCount > 0 || postingFiltersOpen
                            ? "var(--rule-strong)"
                            : "var(--rule)",
                      }}
                    >
                      <SlidersHorizontal size={15} strokeWidth={1.75} />
                      Filters
                      {postingActiveFilterCount > 0 ? (
                        <span className="inline-flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                          {postingActiveFilterCount}
                        </span>
                      ) : null}
                    </button>
                    <AnimatePresence>
                      {postingFiltersOpen ? (
                        <motion.div
                          variants={motionVariants.menu}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          className="absolute right-0 top-[calc(100%+8px)] z-[90] w-[min(100vw-3rem,20rem)] origin-top-right rounded-xl border bg-popover shadow-[0_24px_48px_-28px_color-mix(in_oklab,var(--ink)_55%,transparent)] sm:w-80"
                          style={{ borderColor: "var(--rule-strong)" }}
                        >
                          <FilterSection title="Season">
                            <SegmentedControl
                              value={postingSeasonFilter}
                              options={SEASON_FILTER_OPTIONS}
                              onChange={setPostingSeasonFilter}
                            />
                          </FilterSection>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            ) : null}

            {loadError ? (
              <div className="px-6 py-6">
                <InlineError message={loadError} />
              </div>
            ) : loadingCompanyId === selected.id && selectedPostings === null ? (
              <div className="divide-y divide-border/80 px-6 pt-5 pb-2" aria-label="Loading listings">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="py-5">
                    <SkeletonBlock className="h-12 w-full rounded-md" />
                  </div>
                ))}
              </div>
            ) : (selectedPostings?.length ?? 0) === 0 ? (
              <p className="px-6 py-10 text-center text-[15px] text-muted-foreground">
                {selectedPostingsUntracked && selectedPostingsUntracked.length > 0
                  ? "No roles match your search or filters."
                  : selectedPostingsRaw && selectedPostingsRaw.length > 0
                    ? "All current openings are already in your pipeline."
                    : selected.lastSuccessAt
                      ? "No openings right now."
                      : "Coming soon."}
              </p>
            ) : (
              <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 pt-5 pb-6">
                {selectedPostings?.map((posting) => {
                  const feedPosting = scrapedPostingToFeedPosting(
                    posting,
                    selected.name,
                    selected.websiteUrl,
                  );
                  return (
                    <PostingRow
                      key={posting.id}
                      density="comfortable"
                      posting={feedPosting}
                      dismissed={false}
                      saved={hasAnyInteraction(savedSet, posting.interactionIds)}
                      tracked={false}
                      isNew={false}
                      savePending={pendingSavedIds.has(posting.feedId)}
                      trackPending={trackPendingId === posting.feedId}
                      onTrack={openTrack}
                      onToggleSaved={onToggleSaved}
                    />
                  );
                })}
              </ul>
            )}
          </DialogContent>
        ) : null}
      </Dialog>

      <ApplicationDialog
        open={dialogPrefill !== null}
        onClose={() => setDialogPrefill(null)}
        initialValues={dialogPrefill ?? undefined}
        onCreated={onApplicationCreated}
      />
    </PageShell>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-[17px] font-medium text-foreground">{title}</h2>
      <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function CompanyCard({
  company,
  onOpen,
  onToggleStar,
  starred,
  starPending = false,
  lazyLogo = false,
}: {
  company: DiscoverCompanyCard;
  onOpen: () => void;
  onToggleStar: () => void;
  starred: boolean;
  starPending?: boolean;
  lazyLogo?: boolean;
}) {
  const isHiring = company.openCount > 0;
  const statusLabel = formatOpeningCount(company.openCount);

  return (
    <div className="flex h-[76px] w-full items-stretch gap-1 rounded-lg border border-border bg-card transition-colors hover:bg-muted/30">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 p-4 pr-2 text-left"
        aria-label={`${company.name} on Companies`}
      >
        <CompanyLogo
          company={company.name}
          websiteUrl={company.websiteUrl}
          size={36}
          lazy={lazyLogo}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium leading-snug text-foreground">
            {company.name}
          </p>
          <p
            className={
              "label-meta mt-1 flex min-w-0 items-center gap-1 overflow-visible tabular-nums " +
              (isHiring ? "text-foreground" : "text-muted-foreground")
            }
          >
            <CompanyHiringStatusDot open={isHiring} />
            <span className="min-w-0 truncate">{statusLabel}</span>
          </p>
        </div>
      </button>
      <button
        type="button"
        onClick={onToggleStar}
        disabled={starPending}
        aria-label={starred ? `Unstar ${company.name}` : `Star ${company.name}`}
        title={starred ? "Unstar" : "Star"}
        className={
          "inline-flex w-11 shrink-0 items-center justify-center rounded-r-lg leading-none smooth-surface disabled:cursor-not-allowed disabled:opacity-50 " +
          (starred
            ? "text-foreground/30 hover:bg-[color-mix(in_oklab,var(--ink)_6%,transparent)]"
            : "text-muted-foreground/60 hover:text-foreground hover:bg-[color-mix(in_oklab,var(--ink)_6%,transparent)]")
        }
      >
        <Star
          size={16}
          strokeWidth={1.85}
          fill={starred ? "currentColor" : "none"}
          aria-hidden
        />
      </button>
    </div>
  );
}

const HIRING_OPEN_COLOR = "oklch(0.62 0.14 145)";
const HIRING_CLOSED_COLOR = "var(--destructive)";

function hiringStatusDotStyle(color: string): React.CSSProperties {
  return {
    backgroundColor: color,
    boxShadow: [
      `0 0 0 1px color-mix(in oklab, ${color} 30%, transparent)`,
      `0 0 8px color-mix(in oklab, ${color} 45%, transparent)`,
    ].join(", "),
  };
}

function CompanyHiringStatusDot({ open }: { open: boolean }) {
  const color = open ? HIRING_OPEN_COLOR : HIRING_CLOSED_COLOR;

  return (
    <span className="inline-flex shrink-0 items-center justify-center px-1 py-0.5" aria-hidden>
      <span className="block size-1.5 rounded-full" style={hiringStatusDotStyle(color)} />
    </span>
  );
}

function formatOpeningCount(count: number): string {
  if (count <= 0) {
    return "No open roles";
  }
  return count === 1 ? "1 opening" : `${count} openings`;
}

function CompanyDialogMeta({ company }: { company: DiscoverCompanyCard }) {
  const health = getCompanyHealth(company);
  const roleLabel = formatOpeningCount(company.openCount);

  return (
    <div className="label-meta mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 tabular">
      <span className="text-foreground">{roleLabel}</span>
      <span className="meta-dot" aria-hidden />
      <span>{company.industryLabel}</span>
      {health.kind === "ok" ? (
        <>
          <span className="meta-dot" aria-hidden />
          <span>Updated {health.label}</span>
        </>
      ) : null}
      {health.kind === "pending" ? (
        <>
          <span className="meta-dot" aria-hidden />
          <span>Coming soon</span>
        </>
      ) : null}
    </div>
  );
}

function getCompanyHealth(company: DiscoverCompanyCard): {
  kind: "ok" | "failed" | "pending";
  label: string;
} {
  if (!company.lastSuccessAt) {
    if (company.lastFailureAt) {
      return { kind: "failed", label: "" };
    }
    return { kind: "pending", label: "" };
  }

  const label = formatDistanceToNow(new Date(company.lastSuccessAt), { addSuffix: true });
  const successAt = new Date(company.lastSuccessAt).getTime();

  if (!company.lastFailureAt) {
    return { kind: "ok", label };
  }

  const failureAt = new Date(company.lastFailureAt).getTime();
  if (failureAt > successAt) {
    return { kind: "failed", label };
  }

  return { kind: "ok", label };
}
