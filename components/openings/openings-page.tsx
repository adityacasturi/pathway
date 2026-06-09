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
import { ApplicationDialog } from "@/components/application-dialog";
import {
  OpeningsFilterBar,
  type OpeningsSortDirection,
  type OpeningsSortKey,
} from "@/components/openings/openings-filter-bar";
import { OpeningsRecordList } from "@/components/openings/openings-record-list";
import { PostingInspector } from "@/components/openings/posting-inspector";
import { PageShell } from "@/components/design-system/page";
import { useFocusSearchShortcut } from "@/lib/ui/focus-search-shortcut";
import { InlineError } from "@/components/ui/inline-error";
import { normalizeUrl } from "@/lib/url";
import { createApplication } from "@/lib/actions/applications";
import { refreshFeed, savePosting, unsavePosting } from "@/lib/actions/feed";
import {
  buildTrackApplicationFormData,
  feedSeasonToApplicationSeason,
} from "@/lib/feed/build-track-form-data";
import {
  applyInteractionOverride,
  hasAnyInteraction,
  resolveInteractionSet,
} from "@/lib/feed/interactions";
import type { FeedPosting } from "@/lib/feed/source";
import type { ApplicationSeason } from "@/types/application";
import type { FeedSeason } from "@/lib/feed/types";
import { getSearchTerms } from "@/lib/search-terms";
import { updateFeedViewPreferences } from "@/lib/actions/user-preferences";
import {
  clearStoredFeedViewPreferences,
  readStoredFeedViewPreferences,
} from "@/lib/user-preferences/legacy-view-storage";
import {
  serializeSelectedSeasons,
  type FeedViewPreferences,
} from "@/lib/user-preferences/view-preferences";
import {
  buildCountryFilterOptions,
  countCountriesInDataset,
  matchesCountryFilter,
  resolvePostingCountries,
} from "@/lib/feed/country-filter";
import { isFeedPostingVisibleByState } from "@/lib/feed/visibility";

const INITIAL_VISIBLE = 40;
const LOAD_BATCH = 40;
const EMPTY_TRACKED_URL_SET = new Set<string>();

interface Props {
  postings: FeedPosting[];
  savedIds: string[];
  trackedUrls: string[];
  initialQuery?: string;
  initialRecentDays?: number | null;
  initialPostingId?: string;
  quickTrackEnabled?: boolean;
  initialFeedPrefs: FeedViewPreferences;
}

interface Prefill {
  company: string;
  role: string;
  posting_url: string;
  location: string;
  season?: ApplicationSeason;
}

export function OpeningsPage({
  postings,
  savedIds,
  trackedUrls,
  initialQuery = "",
  initialRecentDays = null,
  initialPostingId,
  quickTrackEnabled = false,
  initialFeedPrefs,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filterNowUnix] = useState(() => Math.floor(Date.now() / 1000));
  const trackedUrlsKey = trackedUrls.join("\0");
  const [query, setQuery] = useState(initialQuery);
  const deferredQuery = useDeferredValue(query);
  const [storedInitialFeedPrefs] = useState(() =>
    readStoredFeedViewPreferences(
      typeof window === "undefined" ? null : window.localStorage,
      initialFeedPrefs,
    ),
  );
  const [selectedSeasons, setSelectedSeasons] = useState<Set<FeedSeason>>(
    () => new Set(storedInitialFeedPrefs.preferences.selectedSeasons),
  );
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [selectedPostingId, setSelectedPostingId] = useState<string | null>(null);
  const [dialogPrefill, setDialogPrefill] = useState<Prefill | null>(null);
  const [trackPendingId, setTrackPendingId] = useState<string | null>(null);
  const [trackedUrlOverrideState, setTrackedUrlOverrideState] = useState<{
    key: string;
    urls: Set<string>;
  }>(() => ({ key: trackedUrlsKey, urls: new Set() }));
  const trackedUrlOverrides = useMemo(() => {
    if (trackedUrlOverrideState.key === trackedUrlsKey) {
      return trackedUrlOverrideState.urls;
    }
    return EMPTY_TRACKED_URL_SET;
  }, [trackedUrlOverrideState, trackedUrlsKey]);
  const [isRefreshing, startRefresh] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(() => new Set());
  const [recentDays] = useState<number | null>(initialRecentDays);
  const [sortKey, setSortKey] = useState<OpeningsSortKey | null>(
    initialRecentDays != null ? "posted" : null,
  );
  const [sortDirection, setSortDirection] = useState<OpeningsSortDirection>(
    initialRecentDays != null ? "desc" : "asc",
  );

  const onRefresh = useCallback(() => {
    startRefresh(async () => {
      setActionError(null);
      const result = await refreshFeed();
      if (result?.error) {
        setActionError(result.error);
        toast.error("Refresh failed", { description: result.error });
        return;
      }
      router.refresh();
      toast.success("Openings refreshed");
    });
  }, [router]);

  const [lastSeen, setLastSeen] = useState<number | null>(
    storedInitialFeedPrefs.preferences.lastSeenUnix,
  );
  const persistedSelectedSeasonsKey = useRef(
    serializeSelectedSeasons(storedInitialFeedPrefs.preferences.selectedSeasons),
  );

  useEffect(() => {
    const patch: {
      lastSeenUnix?: number;
      selectedSeasons?: FeedSeason[];
    } = {};

    if (storedInitialFeedPrefs.preferences.lastSeenUnix > initialFeedPrefs.lastSeenUnix) {
      patch.lastSeenUnix = storedInitialFeedPrefs.preferences.lastSeenUnix;
    }
    const storedSeasons = storedInitialFeedPrefs.preferences.selectedSeasons;
    const initialSeasons = initialFeedPrefs.selectedSeasons;
    if (
      storedSeasons.length !== initialSeasons.length ||
      storedSeasons.some((season, index) => season !== initialSeasons[index])
    ) {
      patch.selectedSeasons = storedSeasons;
    }

    if (Object.keys(patch).length > 0) {
      void updateFeedViewPreferences(patch).then((result) => {
        if (!result?.error) {
          clearStoredFeedViewPreferences(window.localStorage);
        }
      });
    } else if (storedInitialFeedPrefs.hasStoredPreferences) {
      clearStoredFeedViewPreferences(window.localStorage);
    }
  }, [initialFeedPrefs.lastSeenUnix, initialFeedPrefs.selectedSeasons, storedInitialFeedPrefs]);

  useEffect(() => {
    return () => {
      const unix = Math.floor(Date.now() / 1000);
      void updateFeedViewPreferences({ lastSeenUnix: unix });
    };
  }, []);

  useEffect(() => {
    const nextKey = serializeSelectedSeasons([...selectedSeasons]);
    if (nextKey === persistedSelectedSeasonsKey.current) return;

    const timer = window.setTimeout(() => {
      void updateFeedViewPreferences({
        selectedSeasons: [...selectedSeasons],
      }).then((result) => {
        if (!result?.error) {
          persistedSelectedSeasonsKey.current = nextKey;
        }
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [selectedSeasons]);

  const [savedOverrides, setSavedOverrides] = useState<Map<string, boolean>>(() => new Map());
  const savedSet = useMemo(
    () => resolveInteractionSet(savedIds, savedOverrides),
    [savedIds, savedOverrides],
  );

  const [pendingSavedIds, setPendingSavedIds] = useState<Set<string>>(() => new Set());
  const searchInputRef = useRef<HTMLDivElement | null>(null);
  const dialogOpenRef = useRef(false);

  const onToggleSaved = useCallback((posting: FeedPosting, next: boolean) => {
    const id = posting.id;
    setActionError(null);
    setSavedOverrides((prev) =>
      applyInteractionOverride(prev, posting.interactionIds, next),
    );
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
        toast.error(next ? "Save failed" : "Unsave failed", { description: result.error });
        setSavedOverrides((prev) =>
          applyInteractionOverride(prev, posting.interactionIds, !next),
        );
      }
      setPendingSavedIds((prev) => {
        if (!prev.has(id)) return prev;
        const out = new Set(prev);
        out.delete(id);
        return out;
      });
    })();
  }, []);

  const trackedIdSet = useMemo(() => {
    const urls = new Set([...trackedUrls, ...trackedUrlOverrides]);
    const ids = new Set<string>();
    for (const p of postings) {
      const key = normalizeUrl(p.url) ?? p.url;
      if (urls.has(key)) ids.add(p.id);
    }
    return ids;
  }, [postings, trackedUrls, trackedUrlOverrides]);

  const visibilityState = useMemo(
    () => ({
      trackedIds: trackedIdSet,
      savedIds: savedSet,
      showSavedOnly,
    }),
    [savedSet, showSavedOnly, trackedIdSet],
  );

  const haystacks = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of postings) {
      map.set(p.id, `${p.company} ${p.title} ${p.locations.join(" ")}`.toLowerCase());
    }
    return map;
  }, [postings]);

  const searchTerms = useMemo(() => getSearchTerms(deferredQuery), [deferredQuery]);

  const postingCountriesById = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of postings) {
      map.set(p.id, resolvePostingCountries(p.countries, p.locations));
    }
    return map;
  }, [postings]);

  const countryFilterOptions = useMemo(() => {
    const items = postings.map((p) => ({
      countries: postingCountriesById.get(p.id) ?? [],
    }));
    return buildCountryFilterOptions(countCountriesInDataset(items));
  }, [postings, postingCountriesById]);

  const seasonCounts = useMemo(() => {
    const counts: Partial<Record<FeedSeason, number>> = {};
    for (const posting of postings) {
      if (!isFeedPostingVisibleByState(posting, visibilityState)) continue;
      counts[posting.season] = (counts[posting.season] ?? 0) + 1;
    }
    return counts;
  }, [postings, visibilityState]);

  const onToggleSeason = useCallback((season: FeedSeason) => {
    setSelectedSeasons((prev) => {
      const out = new Set(prev);
      if (out.has(season)) out.delete(season);
      else out.add(season);
      return out;
    });
  }, []);

  const onToggleCountry = useCallback((code: string) => {
    setSelectedCountries((prev) => {
      const out = new Set(prev);
      if (out.has(code)) out.delete(code);
      else out.add(code);
      return out;
    });
  }, []);

  const filtered = useMemo(() => {
    const out: FeedPosting[] = [];
    for (const p of postings) {
      if (selectedSeasons.size > 0 && !selectedSeasons.has(p.season)) continue;
      if (!isFeedPostingVisibleByState(p, visibilityState)) continue;
      if (!matchesCountryFilter(postingCountriesById.get(p.id) ?? [], selectedCountries)) {
        continue;
      }
      if (recentDays != null) {
        const ageDays = Math.floor((filterNowUnix - p.datePosted) / 86_400);
        if (ageDays > recentDays) continue;
      }
      const hay = haystacks.get(p.id) ?? "";
      if (searchTerms.length && !searchTerms.every((term) => hay.includes(term))) continue;
      out.push(p);
    }
    return out;
  }, [
    postings,
    selectedSeasons,
    visibilityState,
    haystacks,
    searchTerms,
    postingCountriesById,
    selectedCountries,
    recentDays,
    filterNowUnix,
  ]);

  const isPostingNew = useCallback(
    (p: FeedPosting): boolean =>
      lastSeen != null && lastSeen > 0 && p.pathwayNewUnix > lastSeen,
    [lastSeen],
  );

  const newCount = useMemo(() => {
    if (lastSeen == null) return 0;
    let count = 0;
    for (const p of postings) {
      if (p.pathwayNewUnix > lastSeen && isFeedPostingVisibleByState(p, visibilityState)) {
        count++;
      }
    }
    return count;
  }, [postings, lastSeen, visibilityState]);

  const listResetKey = `${deferredQuery}|${[...selectedSeasons].sort().join(",")}|${[...selectedCountries].sort().join(",")}|${showSavedOnly}|${recentDays ?? ""}|${sortKey ?? ""}|${sortDirection}`;
  const [visibleState, setVisibleState] = useState({
    key: listResetKey,
    count: INITIAL_VISIBLE,
  });
  const effectiveVisibleCount =
    visibleState.key === listResetKey ? visibleState.count : INITIAL_VISIBLE;

  const activeFilterCount =
    selectedSeasons.size + selectedCountries.size + (showSavedOnly ? 1 : 0) + (recentDays != null ? 1 : 0);

  const sorted = useMemo(() => {
    const activeSortKey = sortKey ?? "posted";
    const activeSortDirection = sortKey ? sortDirection : "desc";

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (activeSortKey) {
        case "company":
          comparison = a.company.localeCompare(b.company);
          break;
        case "role":
          comparison = a.title.localeCompare(b.title);
          break;
        case "location":
          comparison = a.locations.join(" ").localeCompare(b.locations.join(" "));
          break;
        case "season":
          comparison = a.season.localeCompare(b.season);
          break;
        case "posted":
          comparison = a.datePosted - b.datePosted;
          break;
      }
      return activeSortDirection === "asc" ? comparison : -comparison;
    });
  }, [filtered, sortKey, sortDirection]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
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

  const visiblePostings = useMemo(
    () => sorted.slice(0, effectiveVisibleCount),
    [sorted, effectiveVisibleCount],
  );

  // Resolve from the full feed so the inspector stays open after unsave (or other
  // filter changes) even when the row drops out of the visible list.
  const resolvedSelectedPostingId = useMemo(() => {
    if (selectedPostingId) return selectedPostingId;
    if (initialPostingId && postings.some((posting) => posting.id === initialPostingId)) {
      return initialPostingId;
    }
    return null;
  }, [initialPostingId, postings, selectedPostingId]);

  const selectedPosting = useMemo(
    () => postings.find((posting) => posting.id === resolvedSelectedPostingId) ?? null,
    [postings, resolvedSelectedPostingId],
  );

  useEffect(() => {
    if (!resolvedSelectedPostingId) return;
    const row = document.querySelector(`[data-posting-id="${resolvedSelectedPostingId}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [resolvedSelectedPostingId, visiblePostings.length]);

  useEffect(() => {
    dialogOpenRef.current = dialogPrefill !== null;
  }, [dialogPrefill]);

  useFocusSearchShortcut(searchInputRef, {
    enabled: () => !dialogOpenRef.current,
  });

  function handleSortChange(nextKey: OpeningsSortKey) {
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

  const onApplicationCreated = useCallback(
    (application: { postingUrl: string | null }) => {
      const normalized = normalizeUrl(application.postingUrl);
      if (!normalized) return;
      setTrackedUrlOverrideState((prev) => {
        const urls = prev.key === trackedUrlsKey ? prev.urls : new Set<string>();
        const next = new Set(urls);
        next.add(normalized);
        return { key: trackedUrlsKey, urls: next };
      });
    },
    [trackedUrlsKey],
  );

  const openTrack = useCallback(
    async (posting: FeedPosting) => {
      if (quickTrackEnabled) {
        setTrackPendingId(posting.id);
        setActionError(null);
        const result = await createApplication(buildTrackApplicationFormData(posting));
        setTrackPendingId(null);
        if ("error" in result) {
          setActionError(result.error ?? "Unable to add application.");
          toast.error("Unable to track role", {
            description: result.error ?? "Please try again.",
          });
          return;
        }
        onApplicationCreated({ postingUrl: posting.url });
        router.refresh();
        toast.success("Added to Applications");
        return;
      }

      const applicationSeason = feedSeasonToApplicationSeason(posting.season);
      setDialogPrefill({
        company: posting.company,
        role: posting.title,
        posting_url: posting.url,
        location: posting.locations.join(" · "),
        ...(applicationSeason ? { season: applicationSeason } : {}),
      });
    },
    [quickTrackEnabled, onApplicationCreated, router],
  );

  const markAllSeen = useCallback(() => {
    const now = Math.floor(Date.now() / 1000);
    setLastSeen(now);
    void updateFeedViewPreferences({ lastSeenUnix: now });
    toast.success("New postings marked seen");
  }, []);

  const openPosting = useCallback((posting: FeedPosting) => {
    setSelectedPostingId((current) => (current === posting.id ? null : posting.id));
  }, []);

  const closeInspector = useCallback(() => {
    setSelectedPostingId(null);
    if (!searchParams.has("posting")) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("posting");
    const query = params.toString();
    router.replace(query ? `/openings?${query}` : "/openings", { scroll: false });
  }, [router, searchParams]);

  const selectedSaved = selectedPosting
    ? hasAnyInteraction(savedSet, selectedPosting.interactionIds)
    : false;
  const selectedTracked = selectedPosting ? trackedIdSet.has(selectedPosting.id) : false;

  return (
    <PageShell className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1">
        <section className="relative flex min-w-0 flex-1 flex-col bg-card">
          <OpeningsFilterBar
            searchRef={searchInputRef}
            query={query}
            onQueryChange={setQuery}
            searchFocused={searchFocused}
            onSearchFocusChange={setSearchFocused}
            activeFilterCount={activeFilterCount}
            selectedSeasons={selectedSeasons}
            onToggleSeason={onToggleSeason}
            onClearSeasons={() => setSelectedSeasons(new Set())}
            seasonCounts={seasonCounts}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSortChange={handleSortChange}
            countryFilterOptions={countryFilterOptions}
            selectedCountries={selectedCountries}
            onToggleCountry={onToggleCountry}
            onClearCountries={() => setSelectedCountries(new Set())}
            showSavedOnly={showSavedOnly}
            onShowSavedOnlyChange={setShowSavedOnly}
            newCount={newCount}
            onMarkAllSeen={markAllSeen}
            isRefreshing={isRefreshing}
            onRefresh={onRefresh}
          />

          {actionError ? (
            <div className="border-b border-border px-5 py-2">
              <InlineError message={actionError} onRetry={() => setActionError(null)} />
            </div>
          ) : null}

          <div className="relative flex min-h-0 flex-1 flex-col">
            {selectedPosting ? (
              <div
                role="presentation"
                className="absolute inset-0 z-10 hidden bg-background/20 backdrop-blur-[3px] xl:block"
                onClick={closeInspector}
              />
            ) : null}

            <OpeningsRecordList
              postings={visiblePostings}
              totalCount={filtered.length}
              hasActiveFilters={Boolean(
                query || selectedSeasons.size > 0 || selectedCountries.size > 0 || showSavedOnly,
              )}
              searchQuery={query}
              loadMoreRef={sentinelRef}
              hasMoreRows={effectiveVisibleCount < sorted.length}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSortChange={handleSortChange}
              isPostingNew={isPostingNew}
              trackedIdSet={trackedIdSet}
              selectedId={selectedPosting?.id ?? null}
              onOpen={openPosting}
            />

            {selectedPosting ? (
              <aside className="absolute inset-y-0 right-0 z-20 hidden w-[var(--app-inspector-width)] border-l border-border/80 shadow-[-16px_0_48px_-20px_color-mix(in_oklab,var(--ink)_22%,transparent)] xl:block">
                <PostingInspector
                  variant="panel"
                  posting={selectedPosting}
                  saved={selectedSaved}
                  tracked={selectedTracked}
                  trackPending={trackPendingId === selectedPosting.id}
                  savePending={pendingSavedIds.has(selectedPosting.id)}
                  onTrack={() => void openTrack(selectedPosting)}
                  onToggleSaved={() => onToggleSaved(selectedPosting, !selectedSaved)}
                  onClose={closeInspector}
                  className="h-full"
                />
              </aside>
            ) : null}
          </div>
        </section>
      </div>

      {selectedPosting ? (
        <PostingInspector
          variant="overlay"
          posting={selectedPosting}
          saved={selectedSaved}
          tracked={selectedTracked}
          trackPending={trackPendingId === selectedPosting.id}
          savePending={pendingSavedIds.has(selectedPosting.id)}
          onTrack={() => void openTrack(selectedPosting)}
          onToggleSaved={() => onToggleSaved(selectedPosting, !selectedSaved)}
          onClose={closeInspector}
        />
      ) : null}

      <ApplicationDialog
        open={dialogPrefill !== null}
        onClose={() => setDialogPrefill(null)}
        initialValues={dialogPrefill ?? undefined}
        onCreated={onApplicationCreated}
      />
    </PageShell>
  );
}
