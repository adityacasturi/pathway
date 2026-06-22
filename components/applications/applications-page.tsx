"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Application } from "@/types/application";
import { type FeedSeason } from "@/lib/feed/types";
import { applicationHasReachedStatus } from "@/lib/applications/pipeline-counts";
import {
  matchesApplicationAttention,
  type ApplicationAttention,
} from "@/lib/applications/attention";
import { STATUSES } from "@/lib/config/events";
import { ApplicationDialog, type CreatedApplicationSummary } from "@/components/application-dialog";
import { ApplicationInspector } from "@/components/applications/application-inspector";
import { ApplicationsFilterBar } from "@/components/applications/applications-filter-bar";
import { ApplicationsRecordList } from "@/components/applications/applications-record-list";
import { PageShell } from "@/components/design-system/page";
import { isTypingTarget, useFocusSearchShortcut } from "@/lib/ui/focus-search-shortcut";
import { getSearchTerms } from "@/lib/search-terms";
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
import {
  buildCountryFilterOptions,
  countriesFromLocationField,
  countCountriesInDataset,
  matchesCountryFilter,
} from "@/lib/feed/country-filter";

type StatusFilter = "all" | (typeof STATUSES)[number];

function parseAttentionFilter(raw: string | null): ApplicationAttention | null {
  if (raw === "no_response" || raw === "active") return raw;
  return null;
}
type SortKey = "company" | "role" | "location" | "season" | "status" | "last_activity";
type SortDirection = "asc" | "desc";

const INITIAL_VISIBLE = 40;
const LOAD_BATCH = 40;

interface Props {
  applications: Application[];
  companyWebsiteByName?: CompanyWebsiteByName;
  companySlugByName?: CompanySlugByName;
  companyLogoAssetByName?: CompanyLogoAssetByName;
  initialViewPrefs: ApplicationsViewPreferences;
}

export function ApplicationsPage({
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
  const initialAttentionFilter = parseAttentionFilter(searchParams.get("attention"));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatusFilter);
  const [attentionFilter] = useState<ApplicationAttention | null>(initialAttentionFilter);
  const [selectedSeasons, setSelectedSeasons] = useState<Set<FeedSeason>>(() => new Set());
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
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(() => new Set());
  const listResetKey = `${query}|${statusFilter}|${attentionFilter ?? ""}|${[...selectedSeasons].sort().join(",")}|${hideRejected}|${hideArchived}|${[...selectedCountries].sort().join(",")}|${sortKey ?? ""}|${sortDirection}`;
  const [visibleState, setVisibleState] = useState({
    key: listResetKey,
    count: INITIAL_VISIBLE,
  });
  const effectiveVisibleCount =
    visibleState.key === listResetKey ? visibleState.count : INITIAL_VISIBLE;

  const searchInputRef = useRef<HTMLDivElement | null>(null);
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
      toast.error(archived ? "Archive failed" : "Unarchive failed", {
        description: result.error,
      });
      return;
    }
    toast.success(archived ? "Application archived" : "Application restored");
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
    function onCreateApplication() {
      setDialogOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pathway:create-application", onCreateApplication);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pathway:create-application", onCreateApplication);
    };
  }, []);

  const searchTerms = useMemo(() => getSearchTerms(query), [query]);

  const applicationCountriesById = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const application of applications) {
      map.set(application.id, countriesFromLocationField(application.location));
    }
    return map;
  }, [applications]);

  const countryFilterOptions = useMemo(() => {
    const items = applications.map((application) => ({
      countries: applicationCountriesById.get(application.id) ?? [],
    }));
    return buildCountryFilterOptions(countCountriesInDataset(items));
  }, [applications, applicationCountriesById]);

  const onToggleCountry = (code: string) => {
    setSelectedCountries((prev) => {
      const out = new Set(prev);
      if (out.has(code)) {
        out.delete(code);
      } else {
        out.add(code);
      }
      return out;
    });
  };

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
      if (attentionFilter && !matchesApplicationAttention(application, attentionFilter)) {
        return false;
      }
      if (
        selectedSeasons.size > 0 &&
        (!application.season || !selectedSeasons.has(application.season))
      ) {
        return false;
      }
      if (
        !matchesCountryFilter(
          applicationCountriesById.get(application.id) ?? [],
          selectedCountries,
        )
      ) {
        return false;
      }

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
    attentionFilter,
    selectedSeasons,
    archivedIds,
    searchTerms,
    applicationCountriesById,
    selectedCountries,
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
        case "location":
          comparison = (a.location ?? "").localeCompare(b.location ?? "");
          break;
        case "season":
          comparison = (a.season ?? "").localeCompare(b.season ?? "");
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

  const hasApplications = applications.length > 0;
  const activeFilterCount =
    Number(statusFilter !== "all") +
    selectedSeasons.size +
    Number(hasApplications && hideRejected) +
    Number(hasApplications && hideArchived) +
    selectedCountries.size;

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
    setDetailId(application.id);
    toast.success("Application added");
  }

  return (
    <PageShell className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1">
        <section className="relative flex min-w-0 flex-1 flex-col bg-card">
          <ApplicationsFilterBar
            searchRef={searchInputRef}
            query={query}
            onQueryChange={setQuery}
            searchFocused={searchFocused}
            onSearchFocusChange={setSearchFocused}
            activeFilterCount={activeFilterCount}
            selectedSeasons={selectedSeasons}
            onToggleSeason={(season) => {
              setSelectedSeasons((prev) => {
                const next = new Set(prev);
                if (next.has(season)) next.delete(season);
                else next.add(season);
                return next;
              });
            }}
            onClearSeasons={() => setSelectedSeasons(new Set())}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSortChange={handleSortChange}
            hideRejected={hideRejected}
            onHideRejectedChange={setHideRejected}
            hideArchived={hideArchived}
            onHideArchivedChange={setHideArchived}
            countryFilterOptions={countryFilterOptions}
            selectedCountries={selectedCountries}
            onToggleCountry={onToggleCountry}
            onClearCountries={() => setSelectedCountries(new Set())}
            hasApplications={hasApplications}
            applications={applications}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            onAddApplication={() => setDialogOpen(true)}
          />

          <div className="relative flex h-full min-h-0 flex-1 flex-col">
            {detail ? (
              <div
                role="presentation"
                className="ds-overlay-enter absolute inset-0 z-10 hidden bg-background/20 backdrop-blur-[3px] xl:block"
                onClick={() => setDetailId(null)}
              />
            ) : null}

            <ApplicationsRecordList
              applications={visibleApplications}
              totalCount={filtered.length}
              companyWebsiteByName={companyWebsiteByName}
              companySlugByName={companySlugByName}
              companyLogoAssetByName={companyLogoAssetByName}
              hasActiveFilters={Boolean(
                query ||
                  statusFilter !== "all" ||
                  selectedSeasons.size > 0 ||
                  selectedCountries.size > 0,
              )}
              searchQuery={query}
              onCreateApplication={() => setDialogOpen(true)}
              onOpen={(application) =>
                setDetailId((current) => (current === application.id ? null : application.id))
              }
              selectedId={detailId}
              archivedIds={archivedIds}
              loadMoreRef={sentinelRef}
              hasMoreRows={effectiveVisibleCount < sorted.length}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSortChange={handleSortChange}
            />

            {detail ? (
              <aside className="ds-drawer-enter absolute inset-y-0 right-0 z-20 hidden w-[var(--app-inspector-width)] border-l border-border/80 shadow-[-16px_0_48px_-20px_color-mix(in_oklab,var(--ink)_22%,transparent)] xl:block">
                <ApplicationInspector
                  variant="panel"
                  application={detail}
                  companyWebsiteByName={companyWebsiteByName}
                  companySlugByName={companySlugByName}
                  companyLogoAssetByName={companyLogoAssetByName}
                  archived={archivedIds.has(detail.id)}
                  onArchiveChange={(archived) => void setApplicationArchived(detail.id, archived)}
                  onDeleted={() => setDetailId(null)}
                  onClose={() => setDetailId(null)}
                  className="h-full"
                />
              </aside>
            ) : null}
          </div>
        </section>
      </div>

      <ApplicationDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={handleApplicationCreated}
      />

      {detail ? (
        <ApplicationInspector
          variant="overlay"
          application={detail}
          companyWebsiteByName={companyWebsiteByName}
          companySlugByName={companySlugByName}
          companyLogoAssetByName={companyLogoAssetByName}
          archived={archivedIds.has(detail.id)}
          onArchiveChange={(archived) => void setApplicationArchived(detail.id, archived)}
          onDeleted={() => setDetailId(null)}
          onClose={() => setDetailId(null)}
        />
      ) : null}
    </PageShell>
  );
}
