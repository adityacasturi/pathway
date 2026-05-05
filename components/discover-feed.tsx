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
import { motion } from "framer-motion";
import { CheckCheck, RefreshCw } from "lucide-react";
import { ApplicationDialog } from "@/components/application-dialog";
import { PostingRow } from "@/components/posting-row";
import { InlineError } from "@/components/ui/inline-error";
import { FilterChip, FilterOption } from "@/components/ui/filter-chip";
import { motionVariants } from "@/lib/ui/motion";
import { SearchInput } from "@/components/search-input";
import { normalizeUrl } from "@/lib/url";
import {
  dismissPosting,
  refreshFeed,
  savePosting,
  undismissPosting,
  unsavePosting,
} from "@/lib/actions/feed";
import type { FeedPosting, FeedSeason } from "@/lib/feed/source";

type SeasonFilter = "all" | FeedSeason;

const SHOW_DISMISSED_STORAGE_KEY = "launchpad:discover-show-dismissed";
const HIDE_APPLIED_STORAGE_KEY = "launchpad:discover-hide-applied";
const LAST_SEEN_STORAGE_KEY = "launchpad:feed-last-seen-at";
const SEARCH_TOKEN_PATTERN = /"[^"]*"|'[^']*'|\S+/g;

const SEASON_FILTER_OPTIONS: FilterOption<SeasonFilter>[] = [
  { value: "all", label: "All" },
  { value: "Summer", label: "Summer" },
  { value: "Fall", label: "Fall" },
];

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
  cutoffDate: string;
  oldestAllowedCutoffDate: string;
  latestAllowedCutoffDate: string;
  initialQuery?: string;
  initialSavedOnly?: boolean;
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

export function DiscoverFeed({
  postings,
  dismissedIds,
  savedIds,
  trackedUrls,
  cutoffDate,
  oldestAllowedCutoffDate,
  latestAllowedCutoffDate,
  initialQuery = "",
  initialSavedOnly = false,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  // Typing stays snappy because the filter runs against the deferred value,
  // letting React keep the input responsive while it catches up on the list.
  const deferredQuery = useDeferredValue(query);
  const [seasonFilter, setSeasonFilter] = useState<SeasonFilter>("all");
  const [showDismissed, setShowDismissed] = useState(false);
  const [showSavedOnly, setShowSavedOnly] = useState(initialSavedOnly);
  const [hideApplied, setHideApplied] = useState(false);
  const [dialogPrefill, setDialogPrefill] = useState<Prefill | null>(null);
  const [trackedUrlOverrides, setTrackedUrlOverrides] = useState<Set<string>>(() => new Set());
  const [isRefreshing, startRefresh] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);

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
    if (hideAppliedPref === "1") {
      setHideApplied(true);
    }

    return () => {
      localStorage.setItem(LAST_SEEN_STORAGE_KEY, String(Math.floor(Date.now() / 1000)));
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(SHOW_DISMISSED_STORAGE_KEY, showDismissed ? "1" : "0");
  }, [showDismissed]);

  useEffect(() => {
    localStorage.setItem(HIDE_APPLIED_STORAGE_KEY, hideApplied ? "1" : "0");
  }, [hideApplied]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowSavedOnly(initialSavedOnly);
  }, [initialSavedOnly]);

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
      setDismissedSet((prev) => {
        const out = new Set(prev);
        if (next) out.add(id);
        else out.delete(id);
        return out;
      });
      setPendingIds((prev) => {
        const out = new Set(prev);
        out.add(id);
        return out;
      });
      // Fire-and-forget; we already updated local state optimistically, and
      // the server action has no revalidatePath so the payload is tiny.
      (async () => {
        const result = next ? await dismissPosting(id) : await undismissPosting(id);
        if (result?.error) {
          setActionError(result.error);
          setDismissedSet((prev) => {
            const out = new Set(prev);
            if (next) out.delete(id);
            else out.add(id);
            return out;
          });
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
      setSavedSet((prev) => {
        const out = new Set(prev);
        if (next) out.add(id);
        else out.delete(id);
        return out;
      });
      setPendingSavedIds((prev) => {
        const out = new Set(prev);
        out.add(id);
        return out;
      });
      (async () => {
        const result = next ? await savePosting(id) : await unsavePosting(id);
        if (result?.error) {
          setActionError(result.error);
          setSavedSet((prev) => {
            const out = new Set(prev);
            if (next) out.delete(id);
            else out.add(id);
            return out;
          });
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
      const isDismissed = dismissedSet.has(p.id);
      if (!showDismissed && isDismissed) continue;
      if (showSavedOnly && !savedSet.has(p.id)) continue;
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
      if (p.datePosted > lastSeen && !dismissedSet.has(p.id)) count++;
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
  }, [deferredQuery, seasonFilter, showDismissed, showSavedOnly, hideApplied]);

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

  const visible = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );

  const openTrack = useCallback((posting: FeedPosting) => {
    setDialogPrefill({
      company: posting.company,
      role: posting.title,
      posting_url: posting.url,
      location: posting.locations.join(" · "),
      season: posting.season,
    });
  }, []);

  const onApplicationCreated = useCallback((application: { postingUrl: string | null }) => {
    const normalized = normalizeUrl(application.postingUrl);
    if (!normalized) return;
    setTrackedUrlOverrides((prev) => {
      const next = new Set(prev);
      next.add(normalized);
      return next;
    });
  }, []);

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
      <main className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-16 pt-24 sm:pt-28 lg:pt-32 pb-24">
        <motion.header
          className="masthead mb-12"
          variants={motionVariants.riseIn}
          initial="hidden"
          animate="visible"
        >
          <div className="flex items-baseline justify-between pb-4">
            <span className="label-micro">Discover / Live feed</span>
            <span className="label-meta hidden sm:inline tabular">
              {postings.length} listings
              {newCount > 0 && ` · ${newCount} new`}
              {` · since ${formatCompactDate(cutoffDate)}`}
            </span>
          </div>
          <span className="rule-strong" />
          <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <h1 className="display-serif text-[4.5rem] sm:text-[5.25rem] lg:text-[6rem] text-foreground">
                Discover
              </h1>
              <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
                {postings.length} open internships since {formatCompactDate(cutoffDate)}. Refreshed daily, sourced from the open web.
              </p>
            </div>
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
          </div>
        </motion.header>

        <motion.div
          className={`relative mb-8 ${searchFocused ? "z-[200]" : "z-20"}`}
          variants={motionVariants.fadeIn}
          initial="hidden"
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
              <FilterChip
                label="Season"
                value={seasonFilter}
                onChange={setSeasonFilter}
                defaultValue="all"
                options={SEASON_FILTER_OPTIONS}
              />
              <label className="inline-flex cursor-pointer select-none items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] text-muted-foreground transition-colors duration-150 hover:text-foreground"
                style={{ borderColor: showSavedOnly ? "var(--rule-strong)" : "var(--rule)" }}
              >
                <input
                  type="checkbox"
                  checked={showSavedOnly}
                  onChange={(e) => setShowSavedOnly(e.target.checked)}
                  className="size-3 rounded-[2px] accent-foreground cursor-pointer"
                />
                Saved only
              </label>
              <label className="inline-flex cursor-pointer select-none items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] text-muted-foreground transition-colors duration-150 hover:text-foreground"
                style={{ borderColor: hideApplied ? "var(--rule-strong)" : "var(--rule)" }}
              >
                <input
                  type="checkbox"
                  checked={hideApplied}
                  onChange={(e) => setHideApplied(e.target.checked)}
                  className="size-3 rounded-[2px] accent-foreground cursor-pointer"
                />
                Hide applied
              </label>
              <label className="inline-flex cursor-pointer select-none items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] text-muted-foreground transition-colors duration-150 hover:text-foreground"
                style={{ borderColor: showDismissed ? "var(--rule-strong)" : "var(--rule)" }}
              >
                <input
                  type="checkbox"
                  checked={showDismissed}
                  onChange={(e) => setShowDismissed(e.target.checked)}
                  className="size-3 rounded-[2px] accent-foreground cursor-pointer"
                />
                Show dismissed
              </label>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-2 label-meta">
            <span><span className="text-foreground tabular">{filtered.length}</span> matching</span>
            <span className="opacity-50">·</span>
            <span><span className="text-foreground tabular">{savedSet.size}</span> saved</span>
            <span className="opacity-50">·</span>
            <span><span className="text-foreground tabular">{trackedIdSet.size}</span> tracked</span>
            <span className="opacity-50">·</span>
            <span><span className="text-foreground tabular">{newCount}</span> new</span>
            <span className="opacity-50">·</span>
            <span title={`Allowed range: ${oldestAllowedCutoffDate} to ${latestAllowedCutoffDate}`}>
              since <span className="text-foreground tabular">{formatCompactDate(cutoffDate)}</span>
            </span>
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

        <span className="rule" />

        {filtered.length === 0 ? (
          <motion.div
            variants={motionVariants.fadeIn}
            initial="hidden"
            animate="visible"
            className="py-24 text-center"
          >
            <p className="text-[16px] text-muted-foreground">
              Nothing matches the filters.
            </p>
          </motion.div>
        ) : (
          <>
            <ul className="divide-y" style={{ borderColor: "var(--rule)" }}>
              {visible.map((posting) => (
                <PostingRow
                  key={posting.id}
                  posting={posting}
                  dismissed={dismissedSet.has(posting.id)}
                  saved={savedSet.has(posting.id)}
                  tracked={trackedIdSet.has(posting.id)}
                  isNew={isPostingNew(posting)}
                  pending={pendingIds.has(posting.id)}
                  savePending={pendingSavedIds.has(posting.id)}
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

function formatCompactDate(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}
