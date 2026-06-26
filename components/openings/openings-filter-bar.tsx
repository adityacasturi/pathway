"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownUp, Bookmark, ListFilter, RefreshCw } from "lucide-react";
import { SearchInput } from "@/components/search-input";
import { CountryFlag } from "@/components/country-flag";
import { CountryFilterSection } from "@/components/country-filter-section";
import { SeasonDot, SeasonFilterSection } from "@/components/season-filter-section";
import { formatCountryCode } from "@/lib/feed/country-filter";
import { ToolbarButton } from "@/components/ui/toolbar-button";
import { FilterPill } from "@/components/design-system/toolbar";
import { UI_TOOLBAR_FILTER_COUNT } from "@/lib/ui/selection-styles";
import { SectionStack, Surface } from "@/components/design-system/surface";
import type { FeedSeason } from "@/lib/feed/types";
import { cn } from "@/lib/utils";

type SortKey = "company" | "role" | "location" | "season" | "posted";
type SortDirection = "asc" | "desc";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "company", label: "Company" },
  { key: "role", label: "Role" },
  { key: "posted", label: "Posted" },
];

export function OpeningsFilterBar({
  searchRef,
  query,
  onQueryChange,
  searchFocused,
  onSearchFocusChange,
  activeFilterCount,
  selectedSeasons,
  onToggleSeason,
  onClearSeasons,
  seasonCounts,
  sortKey,
  sortDirection,
  onSortChange,
  countryFilterOptions,
  selectedCountries,
  onToggleCountry,
  onClearCountries,
  showSavedOnly,
  onShowSavedOnlyChange,
  isRefreshing,
  onRefresh,
}: {
  searchRef: React.RefObject<HTMLDivElement | null>;
  query: string;
  onQueryChange: (value: string) => void;
  searchFocused: boolean;
  onSearchFocusChange: (focused: boolean) => void;
  activeFilterCount: number;
  selectedSeasons: Set<FeedSeason>;
  onToggleSeason: (season: FeedSeason) => void;
  onClearSeasons: () => void;
  seasonCounts?: Partial<Record<FeedSeason, number>>;
  sortKey: SortKey | null;
  sortDirection: SortDirection;
  onSortChange: (key: SortKey) => void;
  countryFilterOptions: ReturnType<typeof import("@/lib/feed/country-filter").buildCountryFilterOptions>;
  selectedCountries: Set<string>;
  onToggleCountry: (code: string) => void;
  onClearCountries: () => void;
  showSavedOnly: boolean;
  onShowSavedOnlyChange: (value: boolean) => void;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement | null>(null);
  const filterRef = useRef<HTMLDivElement | null>(null);
  const mobileFilterPanelRef = useRef<HTMLDivElement | null>(null);
  const activeSort = sortKey ?? "posted";

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!sortRef.current?.contains(event.target as Node)) {
        setSortOpen(false);
      }
      if (!filterRef.current?.contains(event.target as Node)) {
        if (!mobileFilterPanelRef.current?.contains(event.target as Node)) {
          setFilterOpen(false);
        }
      }
    }
    if (!sortOpen && !filterOpen) return;
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [sortOpen, filterOpen]);

  const hasActiveChips =
    selectedSeasons.size > 0 ||
    selectedCountries.size > 0 ||
    query.trim().length > 0 ||
    showSavedOnly;

  return (
    <div className={cn("relative shrink-0 bg-card", searchFocused && "z-30")}>
      <div className="flex flex-col gap-2.5 border-b border-border px-5 py-3 md:flex-row md:flex-wrap md:items-center md:px-4">
        <div className="w-full min-w-[10rem] md:flex-1 [&_input]:h-8 [&_input]:rounded-md [&_input]:text-sm">
          <SearchInput
            ref={searchRef}
            value={query}
            onChange={onQueryChange}
            placeholder="Search company, role, location…"
            onFocusChange={onSearchFocusChange}
          />
        </div>

        <div className="relative grid w-full grid-cols-4 gap-2 md:flex md:w-auto md:shrink-0 md:items-center">
          <ToolbarButton
            active={showSavedOnly}
            onClick={() => onShowSavedOnlyChange(!showSavedOnly)}
            className="w-full justify-center gap-1.5 px-2 md:w-auto md:justify-start md:px-2.5"
          >
            <Bookmark
              size={14}
              strokeWidth={1.75}
              className={cn("opacity-80", showSavedOnly && "fill-current")}
            />
            Saved
          </ToolbarButton>

          <div ref={sortRef} className="relative min-w-0">
            <ToolbarButton
              active={sortOpen || sortKey !== null}
              aria-expanded={sortOpen}
              className="w-full justify-center gap-1.5 px-2 md:w-auto md:justify-start md:px-2.5"
              onClick={() => {
                setSortOpen((open) => !open);
                setFilterOpen(false);
              }}
            >
              <ArrowDownUp size={14} strokeWidth={1.75} className="opacity-80" />
              Sort
            </ToolbarButton>
            {sortOpen ? (
              <OpeningsSortMenu
                activeSort={activeSort}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSortChange={onSortChange}
                onClose={() => setSortOpen(false)}
                className="absolute left-0 top-full z-40 mt-1.5 w-52 shadow-sm md:left-auto md:right-0"
              />
            ) : null}
          </div>

          <div ref={filterRef} className="relative min-w-0">
            <ToolbarButton
              active={filterOpen || activeFilterCount > 0}
              aria-expanded={filterOpen}
              className="w-full justify-center gap-1.5 px-2 md:w-auto md:justify-start md:px-2.5"
              onClick={() => {
                setFilterOpen((open) => !open);
                setSortOpen(false);
              }}
            >
              <ListFilter size={14} strokeWidth={1.75} className="opacity-80" />
              Filter
              {activeFilterCount > 0 ? (
                <span className={UI_TOOLBAR_FILTER_COUNT}>{activeFilterCount}</span>
              ) : null}
            </ToolbarButton>
            {filterOpen ? (
              <OpeningsFilterPanel
                selectedSeasons={selectedSeasons}
                onToggleSeason={onToggleSeason}
                onClearSeasons={onClearSeasons}
                seasonCounts={seasonCounts}
                countryFilterOptions={countryFilterOptions}
                selectedCountries={selectedCountries}
                onToggleCountry={onToggleCountry}
                onClearCountries={onClearCountries}
                className="absolute right-0 top-full z-40 mt-1.5 hidden w-[min(22rem,calc(100vw-2.5rem))] shadow-sm md:block"
              />
            ) : null}
          </div>

          <div className="min-w-0">
            <ToolbarButton
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label="Refresh openings"
              aria-busy={isRefreshing}
              title="Refresh"
              className="h-8 w-full justify-center px-2 md:w-auto md:justify-start md:gap-1.5 md:px-2.5"
            >
              <RefreshCw
                size={14}
                strokeWidth={1.75}
                className={cn("shrink-0 opacity-80", isRefreshing && "animate-spin")}
                aria-hidden
              />
              <span className="hidden md:inline">Refresh</span>
            </ToolbarButton>
          </div>

          {filterOpen ? (
            <div
              ref={mobileFilterPanelRef}
              className="absolute right-0 top-full z-40 mt-1.5 w-[min(22rem,calc(100vw-2rem))] md:hidden"
            >
              <OpeningsFilterPanel
                selectedSeasons={selectedSeasons}
                onToggleSeason={onToggleSeason}
                onClearSeasons={onClearSeasons}
                seasonCounts={seasonCounts}
                countryFilterOptions={countryFilterOptions}
                selectedCountries={selectedCountries}
                onToggleCountry={onToggleCountry}
                onClearCountries={onClearCountries}
                className="shadow-sm"
              />
            </div>
          ) : null}
        </div>
      </div>

      {hasActiveChips ? (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-5 py-2 md:px-4">
          {query.trim() ? (
            <FilterPill active onClick={() => onQueryChange("")}>
              Search: {query.trim()}
              <span aria-hidden>×</span>
            </FilterPill>
          ) : null}
          {[...selectedSeasons].map((season) => (
            <FilterPill key={season} active onClick={() => onToggleSeason(season)}>
              <SeasonDot season={season} />
              {season}
              <span aria-hidden>×</span>
            </FilterPill>
          ))}
          {[...selectedCountries].map((code) => (
            <FilterPill key={code} active onClick={() => onToggleCountry(code)}>
              <CountryFlag code={code} size="sm" />
              {formatCountryCode(code)}
              <span aria-hidden>×</span>
            </FilterPill>
          ))}
          {!showSavedOnly ? null : (
            <FilterPill active onClick={() => onShowSavedOnlyChange(false)}>
              Saved only
              <span aria-hidden>×</span>
            </FilterPill>
          )}
          <button
            type="button"
            onClick={() => {
              onQueryChange("");
              onClearSeasons();
              onClearCountries();
              onShowSavedOnlyChange(false);
            }}
            className="px-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Clear all
          </button>
        </div>
      ) : null}
    </div>
  );
}

function OpeningsSortMenu({
  activeSort,
  sortKey,
  sortDirection,
  onSortChange,
  onClose,
  className,
}: {
  activeSort: SortKey;
  sortKey: SortKey | null;
  sortDirection: SortDirection;
  onSortChange: (key: SortKey) => void;
  onClose: () => void;
  className?: string;
}) {
  return (
    <Surface padding="p-2" className={className}>
      <ul className="space-y-0.5">
        {SORT_OPTIONS.map((option) => {
          const active = activeSort === option.key;
          return (
            <li key={option.key}>
              <button
                type="button"
                onClick={() => {
                  onSortChange(option.key);
                  onClose();
                }}
                className={cn(
                  "flex h-9 w-full items-center justify-between rounded-md px-2.5 text-sm transition-colors",
                  active
                    ? "bg-muted font-medium text-foreground"
                    : "text-foreground/80 hover:bg-muted/50",
                )}
              >
                <span>{option.label}</span>
                {active && sortKey ? (
                  <span className="text-xs text-muted-foreground">
                    {sortDirection === "asc" ? "↑" : "↓"}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </Surface>
  );
}

function OpeningsFilterPanel({
  selectedSeasons,
  onToggleSeason,
  onClearSeasons,
  seasonCounts,
  countryFilterOptions,
  selectedCountries,
  onToggleCountry,
  onClearCountries,
  className,
}: {
  selectedSeasons: Set<FeedSeason>;
  onToggleSeason: (season: FeedSeason) => void;
  onClearSeasons: () => void;
  seasonCounts?: Partial<Record<FeedSeason, number>>;
  countryFilterOptions: ReturnType<typeof import("@/lib/feed/country-filter").buildCountryFilterOptions>;
  selectedCountries: Set<string>;
  onToggleCountry: (code: string) => void;
  onClearCountries: () => void;
  className?: string;
}) {
  return (
    <SectionStack className={className}>
      <SeasonFilterSection
        compact
        selected={selectedSeasons}
        onToggle={onToggleSeason}
        onClear={onClearSeasons}
        counts={seasonCounts}
        chipClassName="h-7 px-2.5 text-[12px]"
      />
      <CountryFilterSection
        compact
        showFlags
        options={countryFilterOptions}
        selected={selectedCountries}
        onToggle={onToggleCountry}
        onClear={onClearCountries}
        chipClassName="h-7 px-2.5 text-[12px]"
      />
    </SectionStack>
  );
}

export type { SortKey as OpeningsSortKey, SortDirection as OpeningsSortDirection };
