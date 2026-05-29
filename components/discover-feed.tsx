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
import { SkeletonBlock } from "@/components/ui/loading-indicator";
import { motionVariants } from "@/lib/ui/motion";
import { SearchInput } from "@/components/search-input";
import { normalizeUrl } from "@/lib/url";
import { createApplication } from "@/lib/actions/applications";
import {
  dismissPosting,
  refreshFeed,
  savePosting,
  undismissPosting,
  unsavePosting,
} from "@/lib/actions/feed";
import { buildTrackApplicationFormData } from "@/lib/feed/build-track-form-data";
import type { FeedPosting, FeedSeason } from "@/lib/feed/source";
import { SEASON_FILTER_OPTIONS, type SeasonFilter } from "@/lib/config/season-filter";
import { FilterSection, FilterToggle, SegmentedControl } from "@/components/ui/filter-menu";

const SHOW_DISMISSED_STORAGE_KEY = "pathway:discover-show-dismissed";
const HIDE_APPLIED_STORAGE_KEY = "pathway:discover-hide-applied";
const SEASON_STORAGE_KEY = "pathway:discover-season";
const LAST_SEEN_STORAGE_KEY = "pathway:feed-last-seen-at";
const SEARCH_TOKEN_PATTERN = /"[^"]*"|'[^']*'|\S+/g;

const VALID_SEASONS = new Set<SeasonFilter>(SEASON_FILTER_OPTIONS.map((option) => option.value));

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
}

interface Prefill {
  company: string;
  role: string;
  posting_url: string;
  location: string;
  season: FeedSeason;
}

function getSearchTerms(value: string) {
  return (value.match(SEARCH_TOKEN_PATTERN) ?? [])
    .map((term) => term.replace(/^["']|["']$/g, "").trim().toLowerCase())
    .filter(Boolean);
}

function hasAnyInteraction(interactions: Set<string>, posting: FeedPosting): boolean {
  return posting.interactionIds.some((id) => interactions.has(id));
}

function applyInteractionIds(
  current: Set<string>,
  posting: FeedPosting,
  next: boolean,
): Set<string> {
  const out = new Set(current);
  for (const id of posting.interactionIds) {
    if (next) out.add(id);
    else out.delete(id);
  }
  return out;
}

export function DiscoverFeed({
  postings,
  dismissedIds,
  savedIds,
  trackedUrls,
  initialQuery = "",
  initialSavedOnly = false,
  quickTrackEnabled = false,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  // Typing stays snappy because the filter runs against the deferred value,
  // letting React keep the input responsive while it catches up on the list.
  const deferredQuery = useDeferredValue(query);
  const [seasonFilter, setSeasonFilter] = useState<SeasonFilter>("all");
  const [showDismissed, setShowDismissed] = useState(false);
  const [showSavedOnly, setShowSavedOnly] = useState(initialSavedOnly);
  const [hideApplied, setHideApplied] = useState(true);
  const [preferencesReady, setPreferencesReady] = useState(false);
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
  const [lastSeen, setLastSeen] = useState<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(LAST_SEEN_STORAGE_KEY);
    const parsed = stored ? Number.parseInt(stored, 10) : NaN;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLastSeen(Number.isFinite(parsed) ? parsed : 0);

    const dismissPref = localStorage.getItem(SHOW_DISMISSED_STORAGE_KEY);
    if (dismissPref === "1") {
      setShowDismissed(true);
    }

    const hideAppliedPref = localStorage.getItem(HIDE_APPLIED_STORAGE_KEY);
    if (hideAppliedPref !== null) setHideApplied(hideAppliedPref === "1");

    const seasonPref = localStorage.getItem(SEASON_STORAGE_KEY);
    if (seasonPref && VALID_SEASONS.has(seasonPref as SeasonFilter)) {
      setSeasonFilter(seasonPref as SeasonFilter);
    }

    setPreferencesReady(true);

    return () => {
      localStorage.setItem(LAST_SEEN_STORAGE_KEY, String(Math.floor(Date.now() / 1000)));
    };
  }, []);

  useEffect(() => {
    if (!preferencesReady) return;
    localStorage.setItem(SHOW_DISMISSED_STORAGE_KEY, showDismissed ? "1" : "0");
  }, [preferencesReady, showDismissed]);

  useEffect(() => {
    if (!preferencesReady) return;
    localStorage.setItem(HIDE_APPLIED_STORAGE_KEY, hideApplied ? "1" : "0");
  }, [preferencesReady, hideApplied]);

  useEffect(() => {
    if (!preferencesReady) return;
    localStorage.setItem(SEASON_STORAGE_KEY, seasonFilter);
  }, [preferencesReady, seasonFilter]);

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

  function focusCommandBar() {
    const input = searchInputRef.current?.querySelector("input");
    input?.focus();
    input?.select();
  }

  const onToggleDismiss = useCallback(
    (posting: FeedPosting, next: boolean) => {
      const id = posting.id;
      setActionError(null);
      setDismissedSet((prev) => applyInteractionIds(prev, posting, next));
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
          setDismissedSet((prev) => applyInteractionIds(prev, posting, !next));
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
      setSavedSet((prev) => applyInteractionIds(prev, posting, next));
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
          setSavedSet((prev) => applyInteractionIds(prev, posting, !next));
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

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
    }
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        focusCommandBar();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      if (event.key === "/") {
        event.preventDefault();
        focusCommandBar();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const searchTerms = useMemo(() => getSearchTerms(deferredQuery), [deferredQuery]);

  const filtered = useMemo(() => {
    const out: FeedPosting[] = [];
    for (const p of postings) {
      if (seasonFilter !== "all" && p.season !== seasonFilter) continue;
      const isDismissed = hasAnyInteraction(dismissedSet, p);
      if (!showDismissed && isDismissed) continue;
      if (showSavedOnly && !hasAnyInteraction(savedSet, p)) continue;
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
      lastSeen != null && lastSeen > 0 && p.datePosted > lastSeen,
    [lastSeen],
  );

  const newCount = useMemo(() => {
    if (lastSeen == null) return 0;
    let count = 0;
    for (const p of postings) {
      if (p.datePosted > lastSeen && !hasAnyInteraction(dismissedSet, p)) count++;
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

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!preferencesReady) return;
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
  }, [preferencesReady, visibleCount, filtered.length]);

  const visiblePostings = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );

  const activeFilterCount =
    Number(seasonFilter !== "all") +
    Number(showSavedOnly) +
    Number(hideApplied) +
    Number(showDismissed);

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

      setDialogPrefill({
        company: posting.company,
        role: posting.title,
        posting_url: posting.url,
        location: posting.locations.join(" · "),
        season: posting.season,
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
    localStorage.setItem(LAST_SEEN_STORAGE_KEY, String(now));
  }, []);

  return (
    <div className="page-shell min-h-screen bg-background">
      <main className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-16 pt-20 sm:pt-21 lg:pt-26 pb-24">
        <motion.header
          className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          variants={motionVariants.riseIn}
          initial={false}
          animate="visible"
        >
          <h1 className="display-serif text-[2.75rem] text-foreground sm:text-[3.25rem]">
            Discover
          </h1>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {newCount > 0 && (
              <button
                type="button"
                onClick={markAllSeen}
                aria-label={`Mark all ${newCount} new postings as seen`}
                title="Mark all new as seen"
                className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12px] text-muted-foreground transition-colors duration-150 hover:text-foreground"
                style={{ borderColor: "var(--rule)" }}
              >
                <CheckCheck size={13} strokeWidth={1.75} />
                <span className="hidden sm:inline">Mark all seen</span>
              </button>
            )}
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label="Refresh feed"
              title="Refresh feed"
              className="group inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[12px] text-muted-foreground transition-colors duration-150 hover:text-foreground disabled:opacity-60 disabled:cursor-wait"
              style={{ borderColor: "var(--rule)" }}
            >
              <RefreshCw size={13} strokeWidth={1.75} className={isRefreshing ? "animate-spin" : "transition-transform duration-300 group-hover:rotate-180"} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </motion.header>

        <motion.div
          className={`relative mb-8 ${searchFocused ? "z-[200]" : "z-20"}`}
          variants={motionVariants.fadeIn}
          initial={false}
          animate="visible"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div ref={searchInputRef} className="relative z-[210] flex-1">
              <SearchInput
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
                  style={{ borderColor: activeFilterCount > 0 || filtersOpen ? "var(--rule-strong)" : "var(--rule)" }}
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
          {actionError && (
            <div className="mt-4">
              <InlineError
                message={actionError}
                onRetry={() => setActionError(null)}
              />
            </div>
          )}
        </motion.div>

        {preferencesReady && (
          <div className="mt-5 mb-3 flex items-center justify-end font-mono text-[11px] text-muted-foreground">
            {filtered.length === postings.length ? (
              <span>{postings.length.toLocaleString()} postings</span>
            ) : (
              <span>
                <span className="text-foreground">
                  {filtered.length.toLocaleString()}
                </span>
                <span className="text-muted-foreground/70">
                  {" "}
                  of {postings.length.toLocaleString()} postings
                </span>
              </span>
            )}
          </div>
        )}

        <span className="rule" />

        <section className="min-h-[560px]">
          {!preferencesReady ? (
            <div
              className="space-y-2 py-4"
              aria-label="Loading feed preferences"
            >
              {Array.from({ length: 8 }).map((_, index) => (
                <SkeletonBlock key={index} className="h-[68px] w-full rounded-md" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-24 text-center">
              <p className="text-[16px] text-muted-foreground">
                Nothing matches the filters.
              </p>
            </div>
          ) : (
            <>
              <ul
                className="divide-y"
                style={{ borderColor: "var(--rule)" }}
              >
                {visiblePostings.map((posting) => (
                  <PostingRow
                    key={posting.id}
                    posting={posting}
                    dismissed={hasAnyInteraction(dismissedSet, posting)}
                    saved={hasAnyInteraction(savedSet, posting)}
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
              {visibleCount < filtered.length && (
                <div ref={sentinelRef} className="h-10" aria-hidden="true" />
              )}
            </>
          )}
        </section>
      </main>

      <ApplicationDialog
        open={dialogPrefill !== null}
        onClose={() => setDialogPrefill(null)}
        initialValues={dialogPrefill ?? undefined}
        onCreated={onApplicationCreated}
      />
    </div>
  );
}
