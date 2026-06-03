"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, SlidersHorizontal } from "lucide-react";
import { Application } from "@/types/application";
import { type SeasonFilter, SEASON_FILTER_OPTIONS } from "@/lib/config/season-filter";
import { applicationHasReachedStatus } from "@/lib/applications/pipeline-counts";
import { STATUSES } from "@/lib/config/events";
import { ApplicationPipelineSummary } from "@/components/application-pipeline-summary";
import { ApplicationsTable } from "@/components/applications-table";
import { ApplicationDialog, type CreatedApplicationSummary } from "@/components/application-dialog";
import { ApplicationDetail } from "@/components/application-detail";
import { FilterSection, FilterToggle, SegmentedControl } from "@/components/ui/filter-menu";
import { PageHeader, PageMain, PageShell } from "@/components/ui/page";
import { getPageLabel } from "@/lib/config/nav";
import { isTypingTarget, useFocusSearchShortcut } from "@/lib/ui/focus-search-shortcut";
import { getSearchTerms } from "@/lib/search-terms";
import { motionVariants } from "@/lib/ui/motion";
import { SearchInput } from "@/components/search-input";
import { updateApplicationArchive } from "@/lib/actions/applications";
import { updateApplicationsViewPreferences } from "@/lib/actions/user-preferences";
import { normalizeApplicationState } from "@/lib/config/application-state";
import {
  clearStoredApplicationsViewPreferences,
  readStoredApplicationsViewPreferences,
} from "@/lib/user-preferences/legacy-view-storage";
import type {
  CompanyLogoAssetByName,
  CompanySlugByName,
  CompanyWebsiteByName,
} from "@/lib/logo/company-website-lookup";
import type { ApplicationsViewPreferences } from "@/lib/user-preferences/view-preferences";

type StatusFilter = "all" | (typeof STATUSES)[number];
type SortKey = "company" | "role" | "status" | "last_activity";
type SortDirection = "asc" | "desc";

const INITIAL_VISIBLE = 40;
const LOAD_BATCH = 40;

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "company", label: "Company" },
  { key: "role", label: "Role" },
  { key: "status", label: "Status" },
  { key: "last_activity", label: "Recent" },
];

interface Props {
  applications: Application[];
  companyWebsiteByName?: CompanyWebsiteByName;
  companySlugByName?: CompanySlugByName;
  companyLogoAssetByName?: CompanyLogoAssetByName;
  initialViewPrefs: ApplicationsViewPreferences;
}

export function Dashboard({
  applications: initialApplications,
  companyWebsiteByName = {},
  companySlugByName = {},
  companyLogoAssetByName = {},
  initialViewPrefs,
}: Props) {
  const [applicationState, setApplicationState] = useState({
    source: initialApplications,
    items: initialApplications,
  });
  const applications =
    applicationState.source === initialApplications ? applicationState.items : initialApplications;
  const setApplications = (
    update: Application[] | ((current: Application[]) => Application[]),
  ) => {
    setApplicationState((current) => {
      const currentItems =
        current.source === initialApplications ? current.items : initialApplications;
      return {
        source: initialApplications,
        items: typeof update === "function" ? update(currentItems) : update,
      };
    });
  };

  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const searchParams = useSearchParams();
  const initialStatusFilter: StatusFilter = (() => {
    const raw = searchParams.get("status");
    if (!raw) return "all";
    return (STATUSES as readonly string[]).includes(raw) ? (raw as StatusFilter) : "all";
  })();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatusFilter);
  const [seasonFilter, setSeasonFilter] = useState<SeasonFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [storedInitialViewPrefs] = useState(() =>
    readStoredApplicationsViewPreferences(
      typeof window === "undefined" ? null : window.localStorage,
      initialViewPrefs,
    ),
  );
  const [hideRejected, setHideRejected] = useState(
    storedInitialViewPrefs.preferences.hideRejected,
  );
  const [hideArchived, setHideArchived] = useState(
    storedInitialViewPrefs.preferences.hideArchived,
  );
  const archivedIds = useMemo(
    () => new Set(applications.filter((app) => app.archived_at).map((app) => app.id)),
    [applications],
  );
  const [searchFocused, setSearchFocused] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const listResetKey = `${query}|${statusFilter}|${seasonFilter}|${hideRejected}|${hideArchived}|${sortKey ?? ""}|${sortDirection}`;
  const [visibleState, setVisibleState] = useState({
    key: listResetKey,
    count: INITIAL_VISIBLE,
  });
  const effectiveVisibleCount =
    visibleState.key === listResetKey ? visibleState.count : INITIAL_VISIBLE;

  const searchInputRef = useRef<HTMLDivElement | null>(null);
  const filtersRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const patch: { hideRejected?: boolean; hideArchived?: boolean } = {};
    if (storedInitialViewPrefs.preferences.hideRejected !== initialViewPrefs.hideRejected) {
      patch.hideRejected = storedInitialViewPrefs.preferences.hideRejected;
    }
    if (storedInitialViewPrefs.preferences.hideArchived !== initialViewPrefs.hideArchived) {
      patch.hideArchived = storedInitialViewPrefs.preferences.hideArchived;
    }

    if (Object.keys(patch).length > 0) {
      void updateApplicationsViewPreferences(patch).then((result) => {
        if (!result?.error) {
          clearStoredApplicationsViewPreferences(window.localStorage);
        }
      });
    } else if (storedInitialViewPrefs.hasStoredPreferences) {
      clearStoredApplicationsViewPreferences(window.localStorage);
    }
  }, [initialViewPrefs.hideArchived, initialViewPrefs.hideRejected, storedInitialViewPrefs]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void updateApplicationsViewPreferences({ hideRejected, hideArchived });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [hideArchived, hideRejected]);

  const detail = detailId ? (applications.find((app) => app.id === detailId) ?? null) : null;

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!filtersRef.current?.contains(event.target as Node)) {
        setFiltersOpen(false);
      }
    }
    if (!filtersOpen) return;
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [filtersOpen]);

  const detailOpenRef = useRef(false);
  const dialogOpenRef = useRef(false);
  useEffect(() => {
    detailOpenRef.current = detail !== null;
  }, [detail]);
  useEffect(() => {
    dialogOpenRef.current = dialogOpen;
  }, [dialogOpen]);

  async function setApplicationArchived(applicationId: string, archived: boolean) {
    const previous = applications;
    const archivedAt = archived ? new Date().toISOString() : null;
    setApplications((current) =>
      current.map((application) =>
        application.id === applicationId
          ? { ...application, archived_at: archivedAt }
          : application,
      ),
    );

    const result = await updateApplicationArchive(applicationId, archived);
    if (result?.error) {
      setApplications(previous);
    }
  }

  useFocusSearchShortcut(searchInputRef, {
    enabled: () => !detailOpenRef.current && !dialogOpenRef.current,
  });

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      if (detailOpenRef.current || dialogOpenRef.current) return;
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        setDialogOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const searchTerms = useMemo(() => getSearchTerms(query), [query]);

  const filtered = useMemo(() => {
    return applications.filter((application) => {
      const isRejected = applicationHasReachedStatus(application, "rejected");
      const isArchived = archivedIds.has(application.id);

      if (hideArchived && isArchived) return false;
      if (hideRejected && statusFilter !== "rejected" && isRejected) {
        return false;
      }
      if (statusFilter !== "all" && !applicationHasReachedStatus(application, statusFilter)) {
        return false;
      }
      if (seasonFilter !== "all" && application.season !== seasonFilter) return false;

      const haystack = [
        application.company.toLowerCase(),
        application.role.toLowerCase(),
        (application.location ?? "").toLowerCase(),
      ].join(" ");

      if (searchTerms.length && !searchTerms.every((term) => haystack.includes(term))) return false;

      return true;
    });
  }, [
    applications,
    hideRejected,
    hideArchived,
    statusFilter,
    seasonFilter,
    archivedIds,
    searchTerms,
  ]);

  const sorted = useMemo(() => {
    const activeSortKey = sortKey ?? "last_activity";
    const activeSortDirection = sortKey ? sortDirection : "desc";

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (activeSortKey) {
        case "company":
          comparison = a.company.localeCompare(b.company);
          break;
        case "role":
          comparison = a.role.localeCompare(b.role);
          break;
        case "status":
          comparison = STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status);
          break;
        case "last_activity":
          comparison = a.last_activity_date.localeCompare(b.last_activity_date);
          break;
      }
      return activeSortDirection === "asc" ? comparison : -comparison;
    });
  }, [filtered, sortKey, sortDirection]);

  useEffect(() => {
    if (effectiveVisibleCount >= sorted.length) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleState({
            key: listResetKey,
            count: Math.min(effectiveVisibleCount + LOAD_BATCH, sorted.length),
          });
        }
      },
      { rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [effectiveVisibleCount, listResetKey, sorted.length]);

  const visibleApplications = useMemo(
    () => sorted.slice(0, effectiveVisibleCount),
    [sorted, effectiveVisibleCount],
  );

  const activeFilterCount =
    Number(seasonFilter !== "all") +
    Number(hideRejected) +
    Number(hideArchived) +
    Number(sortKey !== null);

  function handleSortChange(nextKey: SortKey) {
    if (sortKey !== nextKey) {
      setSortKey(nextKey);
      setSortDirection("asc");
      return;
    }
    if (sortDirection === "asc") {
      setSortDirection("desc");
      return;
    }
    setSortKey(null);
    setSortDirection("asc");
  }

  function handleApplicationCreated(created: CreatedApplicationSummary) {
    const now = new Date().toISOString();
    const application = normalizeApplicationState({
      id: created.id,
      user_id: "",
      company: created.company,
      role: created.role,
      posting_url: created.postingUrl,
      location: created.location,
      season: created.season,
      status: "applied",
      archived_at: null,
      created_at: now,
      last_activity_date: created.dateApplied,
      events: [created.appliedEvent],
    });
    setApplications((current) => [application, ...current]);
  }

  return (
    <PageShell>
      <PageMain width="xl">
        <motion.div variants={motionVariants.riseIn} initial={false} animate="visible">
          <PageHeader
            title={getPageLabel("/applications")}
            actions={
              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-[13px] font-medium text-foreground transition-colors hover:border-[color:var(--rule-strong)]"
              >
                <Plus size={14} strokeWidth={2} />
                Add application
              </button>
            }
          />
        </motion.div>

        <motion.div
          className="mb-8"
          variants={motionVariants.fadeIn}
          initial={false}
          animate="visible"
        >
          <ApplicationPipelineSummary
            applications={applications}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
          />
        </motion.div>

        <motion.div
          className={`relative mb-6 ${searchFocused ? "z-[200]" : "z-20"}`}
          variants={motionVariants.fadeIn}
          initial={false}
          animate="visible"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative z-[210] min-w-0 flex-1">
              <SearchInput
                ref={searchInputRef}
                value={query}
                onChange={setQuery}
                placeholder="Search company, role, or location…"
                onFocusChange={setSearchFocused}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div ref={filtersRef} className="relative">
                <button
                  type="button"
                  onClick={() => setFiltersOpen((open) => !open)}
                  aria-expanded={filtersOpen}
                  className="inline-flex h-12 items-center gap-2 rounded-xl border bg-background/80 px-4 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground aria-expanded:text-foreground"
                  style={{
                    borderColor:
                      activeFilterCount > 0 || filtersOpen ? "var(--rule-strong)" : "var(--rule)",
                  }}
                >
                  <SlidersHorizontal size={15} strokeWidth={1.75} />
                  Filters
                  {activeFilterCount > 0 ? (
                    <span className="inline-flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                      {activeFilterCount}
                    </span>
                  ) : null}
                </button>
                <AnimatePresence>
                  {filtersOpen ? (
                    <motion.div
                      variants={motionVariants.menu}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="absolute right-0 top-[calc(100%+8px)] z-[90] w-[320px] origin-top-right rounded-xl border bg-popover shadow-[0_24px_48px_-28px_color-mix(in_oklab,var(--ink)_55%,transparent)]"
                      style={{ borderColor: "var(--rule-strong)" }}
                    >
                      <FilterSection title="Sort">
                        <div className="flex flex-wrap gap-2">
                          {SORT_OPTIONS.map((option) => {
                            const active = (sortKey ?? "last_activity") === option.key;
                            return (
                              <button
                                key={option.key}
                                type="button"
                                onClick={() => handleSortChange(option.key)}
                                className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                                  active
                                    ? "border-foreground/20 bg-foreground/10 text-foreground"
                                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                {option.label}
                                {active && sortKey ? (
                                  <span className="ml-1 font-mono text-[10px] opacity-70">
                                    {sortDirection === "asc" ? "↑" : "↓"}
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      </FilterSection>
                      <FilterSection title="Season">
                        <SegmentedControl
                          value={seasonFilter}
                          options={SEASON_FILTER_OPTIONS}
                          onChange={setSeasonFilter}
                        />
                      </FilterSection>
                      <FilterSection title="Visibility">
                        <FilterToggle
                          label="Hide rejected"
                          checked={hideRejected}
                          onChange={setHideRejected}
                        />
                        <FilterToggle
                          label="Hide archived"
                          checked={hideArchived}
                          onChange={setHideArchived}
                        />
                      </FilterSection>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>

        <ApplicationsTable
          applications={visibleApplications}
          companyWebsiteByName={companyWebsiteByName}
          companySlugByName={companySlugByName}
          companyLogoAssetByName={companyLogoAssetByName}
          hasActiveFilters={Boolean(query || statusFilter !== "all" || seasonFilter !== "all")}
          searchQuery={query}
          onOpen={(application) => setDetailId(application.id)}
          archivedIds={archivedIds}
          onArchiveChange={setApplicationArchived}
        />
        {effectiveVisibleCount < sorted.length ? (
          <div ref={sentinelRef} className="h-10" aria-hidden="true" />
        ) : null}
      </PageMain>

      <ApplicationDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={handleApplicationCreated}
      />
      <ApplicationDetail
        application={detail}
        companyWebsiteByName={companyWebsiteByName}
        companySlugByName={companySlugByName}
        companyLogoAssetByName={companyLogoAssetByName}
        onClose={() => setDetailId(null)}
      />
    </PageShell>
  );
}
