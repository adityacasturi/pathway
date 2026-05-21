"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatDistanceToNowStrict } from "date-fns";
import { ExternalLink, SlidersHorizontal } from "lucide-react";
import { CompanyLogo } from "@/components/company-logo";
import { SeasonPill } from "@/components/season-pill";
import { SearchInput } from "@/components/search-input";
import { resolveDisplaySeason, type DisplaySeason } from "@/lib/postings/season";
import { safeExternalHref } from "@/lib/url";
import { motionVariants } from "@/lib/ui/motion";
import type { CanonicalPosting } from "@/lib/postings/canonical";

type SeasonFilter = "all" | DisplaySeason;

const SEASON_STORAGE_KEY = "pathway:scout-season";
const SEARCH_TOKEN_PATTERN = /"[^"]*"|'[^']*'|\S+/g;

const SEASON_OPTIONS: { value: SeasonFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "Summer", label: "Summer" },
  { value: "Fall", label: "Fall" },
];

const VALID_SEASONS = new Set<SeasonFilter>(["all", "Summer", "Fall", "Spring", "Winter"]);

function readStoredSeasonFilter(): SeasonFilter {
  if (typeof window === "undefined") return "all";
  const seasonPref = localStorage.getItem(SEASON_STORAGE_KEY);
  if (seasonPref && VALID_SEASONS.has(seasonPref as SeasonFilter)) {
    return seasonPref as SeasonFilter;
  }
  return "all";
}

interface Props {
  postings: CanonicalPosting[];
}

function getSearchTerms(value: string) {
  return (value.match(SEARCH_TOKEN_PATTERN) ?? [])
    .map((term) => term.replace(/^["']|["']$/g, "").trim().toLowerCase())
    .filter(Boolean);
}

export function ScoutPostings({ postings }: Props) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [seasonFilter, setSeasonFilter] = useState<SeasonFilter>(readStoredSeasonFilter);
  const [searchFocused, setSearchFocused] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    localStorage.setItem(SEASON_STORAGE_KEY, seasonFilter);
  }, [seasonFilter]);

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

  function focusCommandBar() {
    const input = searchInputRef.current?.querySelector("input");
    input?.focus();
    input?.select();
  }

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

  const haystacks = useMemo(() => {
    const map = new Map<string, string>();
    for (const posting of postings) {
      map.set(
        posting.id,
        `${posting.companyName} ${posting.roleName} ${posting.locations.join(" ")}`.toLowerCase(),
      );
    }
    return map;
  }, [postings]);

  const searchTerms = useMemo(() => getSearchTerms(deferredQuery), [deferredQuery]);

  const filtered = useMemo(() => {
    const out: CanonicalPosting[] = [];
    for (const posting of postings) {
      const displaySeason = resolveDisplaySeason(posting.season);
      if (seasonFilter !== "all" && displaySeason !== seasonFilter) continue;

      const hay = haystacks.get(posting.id) ?? "";
      if (searchTerms.length && !searchTerms.every((term) => hay.includes(term))) continue;
      out.push(posting);
    }
    return out;
  }, [postings, seasonFilter, haystacks, searchTerms]);

  const activeFilterCount = Number(seasonFilter !== "all");

  return (
    <div className="page-shell min-h-screen bg-background">
      <main className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-16 pt-18 sm:pt-20 lg:pt-24 pb-24">
        <motion.header
          className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          variants={motionVariants.riseIn}
          initial={false}
          animate="visible"
        >
          <h1 className="display-serif text-[2.75rem] text-foreground sm:text-[3.25rem]">
            Scout
          </h1>
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
                          options={SEASON_OPTIONS}
                          onChange={setSeasonFilter}
                        />
                      </FilterSection>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>

        {postings.length > 0 && (
          <div className="mt-5 mb-3 flex items-center justify-end font-mono text-[11px] text-muted-foreground">
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
        )}

        <span className="rule" />

        <section className="min-h-[560px]">
          {postings.length === 0 ? (
            <div className="py-24 text-center">
              <p className="text-[16px] text-muted-foreground">No scraped postings yet.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-24 text-center">
              <p className="text-[16px] text-muted-foreground">Nothing matches the filters.</p>
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--rule)" }}>
              {filtered.map((posting) => (
                <ScoutPostingRow key={posting.id} posting={posting} />
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function ScoutPostingRow({ posting }: { posting: CanonicalPosting }) {
  const postingHref = safeExternalHref(posting.postingUrl);
  const locationLabel = posting.locations.length > 0 ? posting.locations.join(" · ") : "";
  const postedLabel = formatPostedDate(posting.datePosted || posting.firstSeenAt);
  return (
    <li
      data-testid="scout-posting-row"
      data-posting-id={posting.id}
      className="group smooth-surface hover:bg-[color-mix(in_oklab,var(--ink)_3%,transparent)]"
    >
      <div className="grid min-h-[72px] grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-2 py-4 md:grid-cols-[2rem_minmax(0,1fr)_12rem_6rem_auto]">
        <CompanyLogo company={posting.companyName} size={30} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
            <span className="truncate font-medium text-foreground/80">{posting.companyName}</span>
            <SeasonPill season={posting.season} />
            {postedLabel && <span className="md:hidden">· {postedLabel}</span>}
          </div>
          <div className="mt-1 flex items-center gap-2">
            {postingHref ? (
              <a
                href={postingHref}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-[14px] font-medium text-foreground decoration-muted-foreground/40 underline-offset-4 transition-colors duration-150 hover:text-primary"
              >
                {posting.roleName}
              </a>
            ) : (
              <span className="truncate text-[14px] font-medium text-foreground">
                {posting.roleName}
              </span>
            )}
          </div>
        </div>

        <div className="hidden min-w-0 truncate text-[12px] text-muted-foreground md:block">
          {locationLabel}
        </div>

        <div className="hidden text-right label-meta tabular whitespace-nowrap md:block">
          {postedLabel}
        </div>

        <div className="flex shrink-0 items-center justify-end">
          {postingHref && (
            <a
              href={postingHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${posting.roleName}`}
              title="Open posting"
              className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_6%,transparent)] hover:text-foreground"
            >
              <ExternalLink size={14} strokeWidth={1.85} />
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

function formatPostedDate(value: string | null): string {
  if (!value) return "";
  try {
    return formatDistanceToNowStrict(new Date(value), { addSuffix: true }).replace("about ", "");
  } catch {
    return "";
  }
}

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-4 py-4" style={{ borderColor: "var(--rule)" }}>
      <header className="mb-4 flex items-center justify-between">
        <h3 className="font-mono text-[11px] font-medium text-foreground">{title}</h3>
      </header>
      {children}
    </section>
  );
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      className="inline-flex w-full items-center gap-0.5 rounded-lg border p-0.5"
      style={{ borderColor: "var(--rule)" }}
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={
              "flex-1 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors duration-150 " +
              (active
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
