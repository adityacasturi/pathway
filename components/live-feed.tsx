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
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCheck, RefreshCw, SlidersHorizontal } from "lucide-react";
import { ApplicationDialog } from "@/components/application-dialog";
import { PostingRow } from "@/components/posting-row";
import { InlineError } from "@/components/ui/inline-error";
import { FilterSection, FilterToggle, SegmentedControl } from "@/components/ui/filter-menu";
import { PageHeader, PageMain, PageShell } from "@/components/ui/page";
import { SearchInput } from "@/components/search-input";
import { useFocusSearchShortcut } from "@/lib/ui/focus-search-shortcut";
import { motionVariants } from "@/lib/ui/motion";
import { normalizeUrl } from "@/lib/url";
import { createApplication } from "@/lib/actions/applications";
import {
  dismissPosting,
  refreshFeed,
  savePosting,
  undismissPosting,
  unsavePosting,
} from "@/lib/actions/feed";
import {
  buildTrackApplicationFormData,
  feedSeasonToApplicationSeason,
} from "@/lib/feed/build-track-form-data";
import { applyInteractionIds, hasAnyInteraction } from "@/lib/feed/interactions";
import type { FeedPosting } from "@/lib/feed/source";
import type { ApplicationSeason } from "@/types/application";
import { getPageLabel } from "@/lib/config/nav";
import { SEASON_FILTER_OPTIONS, type SeasonFilter } from "@/lib/config/season-filter";
import { getSearchTerms } from "@/lib/search-terms";
import { updateFeedViewPreferences } from "@/lib/actions/user-preferences";
import type { FeedViewPreferences } from "@/lib/user-preferences/view-preferences";

const SHOW_DISMISSED_STORAGE_KEY = "pathway:live-show-dismissed";
const HIDE_APPLIED_STORAGE_KEY = "pathway:live-hide-applied";
const SEASON_STORAGE_KEY = "pathway:live-season";
const LEGACY_SHOW_DISMISSED_KEY = "pathway:discover-show-dismissed";
const LEGACY_HIDE_APPLIED_KEY = "pathway:discover-hide-applied";
const LEGACY_SEASON_KEY = "pathway:discover-season";
const LAST_SEEN_STORAGE_KEY = "pathway:feed-last-seen-at";

const VALID_SEASONS = new Set<SeasonFilter>(SEASON_FILTER_OPTIONS.map((option) => option.value));

function readStoredFeedPreferences(initialFeedPrefs: FeedViewPreferences): FeedViewPreferences {
  if (typeof window === "undefined") return initialFeedPrefs;

  const storedLastSeen = window.localStorage.getItem(LAST_SEEN_STORAGE_KEY);
  const parsedLastSeen = storedLastSeen ? Number.parseInt(storedLastSeen, 10) : NaN;
  const lastSeenUnix =
    Number.isFinite(parsedLastSeen) && parsedLastSeen > initialFeedPrefs.lastSeenUnix
      ? parsedLastSeen
      : initialFeedPrefs.lastSeenUnix;

  const dismissPref =
    window.localStorage.getItem(SHOW_DISMISSED_STORAGE_KEY) ??
    window.localStorage.getItem(LEGACY_SHOW_DISMISSED_KEY);
  const showDismissed =
    dismissPref === "1" && !initialFeedPrefs.showDismissed
      ? true
      : initialFeedPrefs.showDismissed;

  const hideAppliedPref =
    window.localStorage.getItem(HIDE_APPLIED_STORAGE_KEY) ??
    window.localStorage.getItem(LEGACY_HIDE_APPLIED_KEY);
  const hideApplied =
    hideAppliedPref === "0" && initialFeedPrefs.hideApplied
      ? false
      : hideAppliedPref === "1" && !initialFeedPrefs.hideApplied
        ? true
        : initialFeedPrefs.hideApplied;

  const seasonPref =
    window.localStorage.getItem(SEASON_STORAGE_KEY) ??
    window.localStorage.getItem(LEGACY_SEASON_KEY);
  let seasonFilter = initialFeedPrefs.seasonFilter;
  if (seasonPref && VALID_SEASONS.has(seasonPref as SeasonFilter)) {
    seasonFilter = seasonPref as SeasonFilter;
  } else if (seasonPref?.includes(",")) {
    const first = seasonPref.split(",")[0]?.trim();
    if (first && VALID_SEASONS.has(first as SeasonFilter)) {
      seasonFilter = first as SeasonFilter;
    }
  }

  return { lastSeenUnix, showDismissed, hideApplied, seasonFilter };
}

// Progressive render window. The filter/search still runs over the full list
// (cheap), but we only paint a chunk at a time. The IntersectionObserver
// sentinel bumps the window as the user scrolls, which keeps initial paint
// cost proportional to the viewport instead of the whole feed.
const INITIAL_VISIBLE = 40;
const LOAD_BATCH = 40;

interface Props {
  postings: FeedPosting[];
  dismissedIds: string[];
  savedIds: string[];
  trackedUrls: string[];
  initialQuery?: string;
  initialSavedOnly?: boolean;
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

export function LiveFeed({
  postings,
  dismissedIds,
  savedIds,
  trackedUrls,
  initialQuery = "",
  initialSavedOnly = false,
  quickTrackEnabled = false,
  initialFeedPrefs,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  // Typing stays snappy because the filter runs against the deferred value,
  // letting React keep the input responsive while it catches up on the list.
  const deferredQuery = useDeferredValue(query);
  const [storedInitialFeedPrefs] = useState(() => readStoredFeedPreferences(initialFeedPrefs));
  const [seasonFilter, setSeasonFilter] = useState<SeasonFilter>(storedInitialFeedPrefs.seasonFilter);
  const [showDismissed, setShowDismissed] = useState(storedInitialFeedPrefs.showDismissed);
  const [showSavedOnly, setShowSavedOnly] = useState(initialSavedOnly);
  const [hideApplied, setHideApplied] = useState(storedInitialFeedPrefs.hideApplied);
  const [dialogPrefill, setDialogPrefill] = useState<Prefill | null>(null);
  const [trackPendingId, setTrackPendingId] = useState<string | null>(null);
  const [trackedUrlOverrides, setTrackedUrlOverrides] = useState<Set<string>>(() => new Set());
  const [isRefreshing, startRefresh] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement | null>(null);

  const onRefresh = useCallback(() => {
    startRefresh(async () => {
      setActionError(null);
      const result = await refreshFeed();
      if (result?.error) {
        setActionError(result.error);
        return;
      }
      router.refresh();
    });
  }, [router]);

  // The timestamp (unix seconds) of the user's previous visit; anything newer
  // is a candidate for the NEW badge. We capture this once on mount and keep
  // it frozen for the whole session, then stamp the current time into
  // localStorage on unmount so the next visit has the right baseline.
  const [lastSeen, setLastSeen] = useState<number | null>(storedInitialFeedPrefs.lastSeenUnix);

  useEffect(() => {
    const patch: {
      lastSeenUnix?: number;
      showDismissed?: boolean;
      hideApplied?: boolean;
      seasonFilter?: SeasonFilter;
    } = {};

    if (storedInitialFeedPrefs.lastSeenUnix > initialFeedPrefs.lastSeenUnix) {
      patch.lastSeenUnix = storedInitialFeedPrefs.lastSeenUnix;
    }
    if (storedInitialFeedPrefs.showDismissed !== initialFeedPrefs.showDismissed) {
      patch.showDismissed = storedInitialFeedPrefs.showDismissed;
    }
    if (storedInitialFeedPrefs.hideApplied !== initialFeedPrefs.hideApplied) {
      patch.hideApplied = storedInitialFeedPrefs.hideApplied;
    }
    if (storedInitialFeedPrefs.seasonFilter !== initialFeedPrefs.seasonFilter) {
      patch.seasonFilter = storedInitialFeedPrefs.seasonFilter;
    }

    if (Object.keys(patch).length > 0) {
      void updateFeedViewPreferences(patch);
    }

    return () => {
      const unix = Math.floor(Date.now() / 1000);
      void updateFeedViewPreferences({ lastSeenUnix: unix });
    };
  }, [initialFeedPrefs.hideApplied, initialFeedPrefs.lastSeenUnix, initialFeedPrefs.seasonFilter, initialFeedPrefs.showDismissed, storedInitialFeedPrefs]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void updateFeedViewPreferences({ showDismissed, hideApplied, seasonFilter });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [hideApplied, seasonFilter, showDismissed]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowSavedOnly(initialSavedOnly);
  }, [initialSavedOnly]);

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

  // Dismissed state lives here (not on each row) so we can update
  // optimistically without round-tripping through the server. Re-syncs if
  // the server ever ships a new list (manual refresh click).
  const [dismissedSet, setDismissedSet] = useState<Set<string>>(() => new Set(dismissedIds));
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissedSet(new Set(dismissedIds));
  }, [dismissedIds]);

  const [savedSet, setSavedSet] = useState<Set<string>>(() => new Set(savedIds));
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSavedSet(new Set(savedIds));
  }, [savedIds]);

  // Per-posting pending flag while a dismiss/restore server call is flying.
  // Stored as a Set rather than boolean so rapid toggles across different
  // rows don't stomp on each other's pending state.
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [pendingSavedIds, setPendingSavedIds] = useState<Set<string>>(() => new Set());
  const searchInputRef = useRef<HTMLDivElement | null>(null);

  useFocusSearchShortcut(searchInputRef);

  const onToggleDismiss = useCallback(
    (posting: FeedPosting, next: boolean) => {
      const id = posting.id;
      setActionError(null);
      setDismissedSet((prev) => applyInteractionIds(prev, posting.interactionIds, next));
      setPendingIds((prev) => {
        const out = new Set(prev);
        out.add(id);
        return out;
      });
      // Fire-and-forget; we already updated local state optimistically, and
      // the server action has no revalidatePath so the payload is tiny.
      (async () => {
        const result = next
          ? await dismissPosting(posting.interactionIds)
          : await undismissPosting(posting.interactionIds);
        if (result?.error) {
          setActionError(result.error);
          setDismissedSet((prev) => applyInteractionIds(prev, posting.interactionIds, !next));
        }
        setPendingIds((prev) => {
          if (!prev.has(id)) return prev;
          const out = new Set(prev);
          out.delete(id);
          return out;
        });
      })();
    },
    [],
  );

  const onToggleSaved = useCallback(
    (posting: FeedPosting, next: boolean) => {
      const id = posting.id;
      setActionError(null);
      setSavedSet((prev) => applyInteractionIds(prev, posting.interactionIds, next));
      setPendingSavedIds((prev) => {
        const out = new Set(prev);
        out.add(id);
        return out;
      });
      (async () => {
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
    },
    [],
  );

  // Precompute "which posting IDs are tracked" by normalizing URLs once, up
  // front. This lets each row's tracked check be a primitive boolean instead
  // of `trackedSet.has(normalizeUrl(url))` per render per row.
  const trackedIdSet = useMemo(() => {
    const urls = new Set([...trackedUrls, ...trackedUrlOverrides]);
    const ids = new Set<string>();
    for (const p of postings) {
      const key = normalizeUrl(p.url) ?? p.url;
      if (urls.has(key)) ids.add(p.id);
    }
    return ids;
  }, [postings, trackedUrls, trackedUrlOverrides]);

  // Precompute a single lowercase search haystack per posting so typing
  // doesn't re-concatenate strings on every keystroke * every row.
  const haystacks = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of postings) {
      map.set(
        p.id,
        `${p.company} ${p.title} ${p.locations.join(" ")}`.toLowerCase(),
      );
    }
    return map;
  }, [postings]);

  const searchTerms = useMemo(() => getSearchTerms(deferredQuery), [deferredQuery]);

  const filtered = useMemo(() => {
    const out: FeedPosting[] = [];
    for (const p of postings) {
      if (seasonFilter !== "all" && p.season !== seasonFilter) continue;
      const isDismissed = hasAnyInteraction(dismissedSet, p.interactionIds);
      if (!showDismissed && isDismissed) continue;
      if (showSavedOnly && !hasAnyInteraction(savedSet, p.interactionIds)) continue;
      if (hideApplied && trackedIdSet.has(p.id)) continue;

      const hay = haystacks.get(p.id) ?? "";
      if (searchTerms.length && !searchTerms.every((term) => hay.includes(term))) continue;
      out.push(p);
    }
    return out;
  }, [
    postings,
    seasonFilter,
    showDismissed,
    showSavedOnly,
    hideApplied,
    dismissedSet,
    savedSet,
    trackedIdSet,
    haystacks,
    searchTerms,
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
      if (p.pathwayNewUnix > lastSeen && !hasAnyInteraction(dismissedSet, p.interactionIds)) {
        count++;
      }
    }
    return count;
  }, [postings, lastSeen, dismissedSet]);

  // Progressive reveal. Reset to the initial window whenever the *set* of
  // visible postings changes shape (filter/search), so the user never has to
  // scroll to page back into existing results.
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisibleCount(INITIAL_VISIBLE);
  }, [
    deferredQuery,
    seasonFilter,
    showDismissed,
    showSavedOnly,
    hideApplied,
  ]);

  const activeFilterCount =
    Number(seasonFilter !== "all") +
    Number(showSavedOnly) +
    Number(hideApplied) +
    Number(showDismissed);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (visibleCount >= filtered.length) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((c) => Math.min(c + LOAD_BATCH, filtered.length));
        }
      },
      // Pre-load the next batch well before the user reaches the bottom so
      // scrolling feels continuous.
      { rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visibleCount, filtered.length]);

  const visiblePostings = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );

  const onApplicationCreated = useCallback((application: { postingUrl: string | null }) => {
    const normalized = normalizeUrl(application.postingUrl);
    if (!normalized) return;
    setTrackedUrlOverrides((prev) => {
      const next = new Set(prev);
      next.add(normalized);
      return next;
    });
  }, []);

  const openTrack = useCallback(
    async (posting: FeedPosting) => {
      if (quickTrackEnabled) {
        setTrackPendingId(posting.id);
        setActionError(null);
        const result = await createApplication(buildTrackApplicationFormData(posting));
        setTrackPendingId(null);
        if ("error" in result) {
          setActionError(result.error ?? "Unable to add application.");
          return;
        }
        onApplicationCreated({ postingUrl: posting.url });
        router.refresh();
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

  // "Mark all seen" simply pushes the lastSeen baseline forward to now,
  // which is what would happen on next visit anyway. Persist immediately so
  // a refresh or navigation won't bring the badges back.
  const markAllSeen = useCallback(() => {
    const now = Math.floor(Date.now() / 1000);
    setLastSeen(now);
    void updateFeedViewPreferences({ lastSeenUnix: now });
  }, []);

  const headerActions = (
    <>
      {newCount > 0 ? (
        <button
          type="button"
          onClick={markAllSeen}
          aria-label={`Mark all ${newCount} new postings as seen`}
          title="Mark all new as seen"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <CheckCheck size={14} strokeWidth={1.75} />
          <span className="hidden sm:inline">Mark all seen</span>
        </button>
      ) : null}
      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        aria-label="Refresh feed"
        title="Refresh feed"
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-wait disabled:opacity-60"
      >
        <RefreshCw
          size={14}
          strokeWidth={1.75}
          className={isRefreshing ? "animate-spin" : undefined}
        />
        <span className="hidden sm:inline">Refresh</span>
      </button>
    </>
  );

  return (
    <PageShell>
      <PageMain width="xl">
        <PageHeader title={getPageLabel("/live")} actions={headerActions} />

        <motion.div
          className={`relative mb-8 ${searchFocused ? "z-[200]" : "z-20"}`}
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
                  {activeFilterCount > 0 && (
                    <span className="inline-flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                <AnimatePresence>
                  {filtersOpen && (
                    <motion.div
                      variants={motionVariants.menu}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="absolute right-0 top-[calc(100%+8px)] z-[90] w-[320px] origin-top-right rounded-xl border bg-popover shadow-[0_24px_48px_-28px_color-mix(in_oklab,var(--ink)_55%,transparent)]"
                      style={{ borderColor: "var(--rule-strong)" }}
                    >
                      <FilterSection title="Season">
                        <SegmentedControl
                          value={seasonFilter}
                          options={SEASON_FILTER_OPTIONS}
                          onChange={setSeasonFilter}
                        />
                      </FilterSection>

                      <FilterSection title="Visibility">
                        <FilterToggle
                          label="Saved only"
                          checked={showSavedOnly}
                          onChange={setShowSavedOnly}
                        />
                        <FilterToggle
                          label="Hide applied"
                          checked={hideApplied}
                          onChange={setHideApplied}
                        />
                        <FilterToggle
                          label="Show dismissed"
                          checked={showDismissed}
                          onChange={setShowDismissed}
                        />
                      </FilterSection>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
          {actionError ? (
            <div className="mt-4">
              <InlineError message={actionError} onRetry={() => setActionError(null)} />
            </div>
          ) : null}
        </motion.div>

        <div className="mb-3 flex items-center justify-end font-mono text-[11px] text-muted-foreground">
          {filtered.length === postings.length ? (
            <span>{postings.length.toLocaleString()} postings</span>
          ) : (
            <span>
              <span className="text-foreground">{filtered.length.toLocaleString()}</span>
              <span className="text-muted-foreground/70">
                {" "}
                of {postings.length.toLocaleString()} postings
              </span>
            </span>
          )}
        </div>

        <section className="mt-2 min-h-[560px]">
          {filtered.length === 0 ? (
            <p className="py-16 text-center text-[15px] text-muted-foreground">
              Nothing matches the filters.
            </p>
          ) : (
            <>
              <ul className="flex flex-col gap-3">
                {visiblePostings.map((posting) => (
                  <PostingRow
                    key={posting.id}
                    density="comfortable"
                    posting={posting}
                    dismissed={hasAnyInteraction(dismissedSet, posting.interactionIds)}
                    saved={hasAnyInteraction(savedSet, posting.interactionIds)}
                    tracked={trackedIdSet.has(posting.id)}
                    isNew={isPostingNew(posting)}
                    pending={pendingIds.has(posting.id)}
                    savePending={pendingSavedIds.has(posting.id)}
                    trackPending={trackPendingId === posting.id}
                    onTrack={openTrack}
                    onToggleSaved={onToggleSaved}
                    onToggleDismiss={onToggleDismiss}
                  />
                ))}
              </ul>
              {visibleCount < filtered.length ? (
                <div ref={sentinelRef} className="h-px" aria-hidden />
              ) : null}
            </>
          )}
        </section>
      </PageMain>

      <ApplicationDialog
        open={dialogPrefill !== null}
        onClose={() => setDialogPrefill(null)}
        initialValues={dialogPrefill ?? undefined}
        onCreated={onApplicationCreated}
      />
    </PageShell>
  );
}
