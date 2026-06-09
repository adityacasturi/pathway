"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowDownUp, ChevronDown, Compass, ListFilter, PenLine, Plus, Radio } from "lucide-react";
import { SearchInput } from "@/components/search-input";
import { CountryFlag } from "@/components/country-flag";
import { CountryFilterSection } from "@/components/country-filter-section";
import { SeasonDot, SeasonFilterSection } from "@/components/season-filter-section";
import { formatCountryCode } from "@/lib/feed/country-filter";
import { FilterSection, FilterToggle } from "@/components/ui/filter-menu";
import { FilterChip } from "@/components/ui/filter-chip";
import { Button } from "@/components/ui/button";
import { ToolbarButton } from "@/components/ui/toolbar-button";
import { FilterPill } from "@/components/design-system/toolbar";
import { UI_COUNT_BADGE } from "@/lib/ui/selection-styles";
import { SectionStack, Surface } from "@/components/design-system/surface";
import { StatusDot, statusSurfaceStyle } from "@/components/status-badge";
import { countApplicationsByReachedStatus } from "@/lib/applications/pipeline-counts";
import { STATUSES, STATUS_LABELS } from "@/lib/config/events";
import type { FeedSeason } from "@/lib/feed/types";
import type { Application, Status } from "@/types/application";
import { cn } from "@/lib/utils";

const PIPELINE_FILTER_STATUSES = STATUSES.filter((status) => status !== "applied");

type SortKey = "company" | "role" | "location" | "season" | "status" | "last_activity";
type SortDirection = "asc" | "desc";
type StatusFilter = "all" | Status;

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "company", label: "Company" },
  { key: "role", label: "Role" },
  { key: "location", label: "Location" },
  { key: "season", label: "Season" },
  { key: "status", label: "Status" },
  { key: "last_activity", label: "Last updated" },
];

export function ApplicationsFilterBar({
  searchRef,
  query,
  onQueryChange,
  searchFocused,
  onSearchFocusChange,
  activeFilterCount,
  selectedSeasons,
  onToggleSeason,
  onClearSeasons,
  sortKey,
  sortDirection,
  onSortChange,
  hideRejected,
  onHideRejectedChange,
  hideArchived,
  onHideArchivedChange,
  countryFilterOptions,
  selectedCountries,
  onToggleCountry,
  onClearCountries,
  hasApplications,
  applications,
  statusFilter,
  onStatusFilterChange,
  onAddApplication,
}: {
  searchRef: React.RefObject<HTMLDivElement | null>;
  query: string;
  onQueryChange: (value: string) => void;
  searchFocused: boolean;
  onSearchFocusChange: (focused: boolean) => void;
  activeFilterCount: number;
  selectedSeasons: ReadonlySet<FeedSeason>;
  onToggleSeason: (season: FeedSeason) => void;
  onClearSeasons: () => void;
  sortKey: SortKey | null;
  sortDirection: SortDirection;
  onSortChange: (key: SortKey) => void;
  hideRejected: boolean;
  onHideRejectedChange: (value: boolean) => void;
  hideArchived: boolean;
  onHideArchivedChange: (value: boolean) => void;
  countryFilterOptions: ReturnType<typeof import("@/lib/feed/country-filter").buildCountryFilterOptions>;
  selectedCountries: Set<string>;
  onToggleCountry: (code: string) => void;
  onClearCountries: () => void;
  hasApplications: boolean;
  applications: Application[];
  statusFilter: StatusFilter;
  onStatusFilterChange: (status: StatusFilter) => void;
  onAddApplication: () => void;
}) {
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement | null>(null);
  const filterRef = useRef<HTMLDivElement | null>(null);
  const addRef = useRef<HTMLDivElement | null>(null);
  const activeSort = sortKey ?? "last_activity";
  const statusCounts = useMemo(
    () => countApplicationsByReachedStatus(applications),
    [applications],
  );
  const seasonCounts = useMemo(() => {
    const counts: Partial<Record<FeedSeason, number>> = {};
    for (const application of applications) {
      if (!application.season) continue;
      counts[application.season] = (counts[application.season] ?? 0) + 1;
    }
    return counts;
  }, [applications]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!sortRef.current?.contains(event.target as Node)) {
        setSortOpen(false);
      }
      if (!filterRef.current?.contains(event.target as Node)) {
        setFilterOpen(false);
      }
      if (!addRef.current?.contains(event.target as Node)) {
        setAddOpen(false);
      }
    }
    if (!sortOpen && !filterOpen && !addOpen) return;
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [sortOpen, filterOpen, addOpen]);

  const hasActiveChips =
    statusFilter !== "all" ||
    selectedSeasons.size > 0 ||
    selectedCountries.size > 0 ||
    query.trim().length > 0;

  return (
    <div className={cn("relative shrink-0 bg-card", searchFocused && "z-30")}>
      <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-5 py-3 md:px-4">
        <div ref={addRef} className="relative">
          <Button
            type="button"
            size="sm"
            aria-expanded={addOpen}
            aria-haspopup="menu"
            className="h-8 shrink-0 gap-1 rounded-md px-2.5 text-sm"
            onClick={() => {
              setAddOpen((open) => !open);
              setSortOpen(false);
              setFilterOpen(false);
            }}
          >
            <Plus size={14} strokeWidth={2} aria-hidden />
            Add
            <ChevronDown
              size={14}
              strokeWidth={2}
              className={cn("opacity-80 transition-transform", addOpen && "rotate-180")}
              aria-hidden
            />
          </Button>
          {addOpen ? (
            <Surface
              padding="p-1.5"
              className="absolute left-0 top-full z-40 mt-1.5 w-56 shadow-sm"
            >
              <ul role="menu" aria-label="Add application" className="space-y-0.5">
                <AddMenuItem
                  icon={<PenLine size={15} strokeWidth={1.75} aria-hidden />}
                  label="Add manually"
                  hint="Enter company and role"
                  onClick={() => {
                    onAddApplication();
                    setAddOpen(false);
                  }}
                />
                <AddMenuItem
                  icon={<Radio size={15} strokeWidth={1.75} aria-hidden />}
                  label="Browse openings"
                  hint="Track from live roles"
                  href="/openings"
                  onNavigate={() => setAddOpen(false)}
                />
                <AddMenuItem
                  icon={<Compass size={15} strokeWidth={1.75} aria-hidden />}
                  label="Browse companies"
                  hint="Pick a company first"
                  href="/companies"
                  onNavigate={() => setAddOpen(false)}
                />
              </ul>
            </Surface>
          ) : null}
        </div>

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
              <Surface
                padding="p-2"
                className="absolute right-0 top-full z-40 mt-1.5 w-52 shadow-sm"
              >
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
                <FilterSection title="Pipeline stage" compact>
                  <div className="flex flex-wrap gap-2">
                    <PipelineStageChip
                      status="applied"
                      count={statusCounts.applied}
                      active={statusFilter === "all" || statusFilter === "applied"}
                      onClick={() => onStatusFilterChange("all")}
                    />
                    {PIPELINE_FILTER_STATUSES.map((status) => (
                      <PipelineStageChip
                        key={status}
                        status={status}
                        count={statusCounts[status]}
                        active={statusFilter === status}
                        onClick={() =>
                          onStatusFilterChange(statusFilter === status ? "all" : status)
                        }
                      />
                    ))}
                  </div>
                </FilterSection>
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
                {hasApplications ? (
                  <FilterSection title="Visibility" compact>
                    <div className="space-y-1">
                      <FilterToggle
                        label="Hide rejected"
                        checked={hideRejected}
                        onChange={onHideRejectedChange}
                        compact
                      />
                      <FilterToggle
                        label="Hide archived"
                        checked={hideArchived}
                        onChange={onHideArchivedChange}
                        compact
                      />
                    </div>
                  </FilterSection>
                ) : null}
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
          {statusFilter !== "all" ? (
            <FilterPill active onClick={() => onStatusFilterChange("all")}>
              <StatusDot status={statusFilter} size={6} />
              {STATUS_LABELS[statusFilter]}
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
          <button
            type="button"
            onClick={() => {
              onQueryChange("");
              onStatusFilterChange("all");
              onClearSeasons();
              onClearCountries();
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

function PipelineStageChip({
  status,
  count,
  active,
  onClick,
}: {
  status: Status;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <FilterChip
      prefix={<StatusDot status={status} size={6} />}
      label={STATUS_LABELS[status]}
      count={count}
      active={active}
      onClick={onClick}
      className="h-7 px-2.5 text-[12px]"
      style={active ? statusSurfaceStyle(status) : undefined}
    />
  );
}

function AddMenuItem({
  icon,
  label,
  hint,
  onClick,
  href,
  onNavigate,
}: {
  icon: ReactNode;
  label: string;
  hint: string;
  onClick?: () => void;
  href?: string;
  onNavigate?: () => void;
}) {
  const className =
    "flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-muted/50";

  const content = (
    <>
      <span className="mt-0.5 text-foreground/70">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </>
  );

  if (href) {
    return (
      <li role="none">
        <Link role="menuitem" href={href} className={className} onClick={onNavigate}>
          {content}
        </Link>
      </li>
    );
  }

  return (
    <li role="none">
      <button type="button" role="menuitem" className={className} onClick={onClick}>
        {content}
      </button>
    </li>
  );
}
