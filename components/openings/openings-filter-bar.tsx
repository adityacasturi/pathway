"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownUp, Bookmark, CheckCheck, ListFilter, RefreshCw } from "lucide-react";
import { SearchInput } from "@/components/search-input";
import { CountryFlag } from "@/components/country-flag";
import { CountryFilterSection } from "@/components/country-filter-section";
import { SeasonDot, SeasonFilterSection } from "@/components/season-filter-section";
import { formatCountryCode } from "@/lib/feed/country-filter";
import { Button } from "@/components/ui/button";
import { ToolbarButton } from "@/components/ui/toolbar-button";
import { FilterPill } from "@/components/design-system/toolbar";
import { UI_COUNT_BADGE } from "@/lib/ui/selection-styles";
import { SectionStack, Surface } from "@/components/design-system/surface";
import type { FeedSeason } from "@/lib/feed/types";
import { cn } from "@/lib/utils";

type SortKey = "company" | "role" | "location" | "season" | "posted";
type SortDirection = "asc" | "desc";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "company", label: "Company" },
  { key: "role", label: "Role" },
  { key: "location", label: "Location" },
  { key: "season", label: "Season" },
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
  newCount,
  onMarkAllSeen,
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
  newCount: number;
  onMarkAllSeen: () => void;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement | null>(null);
  const filterRef = useRef<HTMLDivElement | null>(null);
  const activeSort = sortKey ?? "posted";

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!sortRef.current?.contains(event.target as Node)) {
        setSortOpen(false);
      }
      if (!filterRef.current?.contains(event.target as Node)) {
        setFilterOpen(false);
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
      <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-5 py-3 md:px-4">
        <Button
          type="button"
          size="sm"
          className="h-8 shrink-0 gap-1.5 rounded-md px-3 text-sm"
          disabled={isRefreshing}
          onClick={onRefresh}
        >
          <RefreshCw
            size={14}
            strokeWidth={2}
            className={isRefreshing ? "animate-spin" : undefined}
          />
          Refresh
        </Button>

        <div className="min-w-[10rem] flex-1 [&_input]:h-8 [&_input]:rounded-md [&_input]:text-sm">
          <SearchInput
            ref={searchRef}
            value={query}
            onChange={onQueryChange}
            placeholder="Search company, role, location…"
            onFocusChange={onSearchFocusChange}
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {newCount > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-md px-2.5 text-sm"
              onClick={onMarkAllSeen}
            >
              <CheckCheck size={14} strokeWidth={1.75} />
              Mark seen
            </Button>
          ) : null}

          <ToolbarButton
            active={showSavedOnly}
            onClick={() => onShowSavedOnlyChange(!showSavedOnly)}
          >
            <Bookmark
              size={14}
              strokeWidth={1.75}
              className={cn("opacity-80", showSavedOnly && "fill-current")}
            />
            Saved
          </ToolbarButton>

          <div ref={sortRef} className="relative">
            <ToolbarButton
              active={sortOpen || sortKey !== null}
              aria-expanded={sortOpen}
              onClick={() => {
                setSortOpen((open) => !open);
                setFilterOpen(false);
              }}
            >
              <ArrowDownUp size={14} strokeWidth={1.75} className="opacity-80" />
              Sort
            </ToolbarButton>
            {sortOpen ? (
              <Surface padding="p-2" className="absolute right-0 top-full z-40 mt-1.5 w-52 shadow-sm">
                <ul className="space-y-0.5">
                  {SORT_OPTIONS.map((option) => {
                    const active = activeSort === option.key;
                    return (
                      <li key={option.key}>
                        <button
                          type="button"
                          onClick={() => {
                            onSortChange(option.key);
                            setSortOpen(false);
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
            ) : null}
          </div>

          <div ref={filterRef} className="relative">
            <ToolbarButton
              active={filterOpen || activeFilterCount > 0}
              aria-expanded={filterOpen}
              onClick={() => {
                setFilterOpen((open) => !open);
                setSortOpen(false);
              }}
            >
              <ListFilter size={14} strokeWidth={1.75} className="opacity-80" />
              Filter
              {activeFilterCount > 0 ? (
                <span className={UI_COUNT_BADGE}>{activeFilterCount}</span>
              ) : null}
            </ToolbarButton>
            {filterOpen ? (
              <SectionStack className="absolute right-0 top-full z-40 mt-1.5 w-[min(22rem,calc(100vw-2.5rem))] shadow-sm">
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
            ) : null}
          </div>
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

export type { SortKey as OpeningsSortKey, SortDirection as OpeningsSortDirection };
