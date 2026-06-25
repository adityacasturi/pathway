"use client";

import { useEffect, useRef, useState } from "react";
import { ListFilter, Plus, Settings2 } from "lucide-react";
import {
  AlertDefaultsActiveRail,
  AlertFiltersEditor,
  countActiveAlertFiltersView,
  hasActiveAlertFiltersView,
} from "@/components/alert-filters-editor";
import { AlertsDailyBriefingToolbarButton } from "@/components/alerts/alerts-daily-briefing-toolbar-button";
import type { AlertTypeFilter } from "@/components/alerts/types";
import { FilterPill } from "@/components/design-system/toolbar";
import { SectionStack } from "@/components/design-system/surface";
import { SearchInput } from "@/components/search-input";
import { Button } from "@/components/ui/button";
import { FilterSection } from "@/components/ui/filter-menu";
import { ToolbarButton } from "@/components/ui/toolbar-button";
import type { AlertFiltersView } from "@/lib/alerts/filters";
import { UI_COUNT_BADGE } from "@/lib/ui/selection-styles";
import { cn } from "@/lib/utils";

const TYPE_FILTER_LABELS: Record<AlertTypeFilter, string> = {
  all: "All",
  company: "Companies",
  sector: "Bundles",
};

export function AlertsFilterBar({
  searchRef,
  query,
  onQueryChange,
  searchFocused,
  onSearchFocusChange,
  typeFilter,
  onTypeFilterChange,
  companyCount,
  sectorCount,
  totalCount,
  globalFilters,
  onGlobalFiltersChange,
  globalFiltersPending,
  briefingEnabled,
  onOpenAddPanel,
}: {
  searchRef: React.RefObject<HTMLDivElement | null>;
  query: string;
  onQueryChange: (value: string) => void;
  searchFocused: boolean;
  onSearchFocusChange: (focused: boolean) => void;
  typeFilter: AlertTypeFilter;
  onTypeFilterChange: (value: AlertTypeFilter) => void;
  companyCount: number;
  sectorCount: number;
  totalCount: number;
  globalFilters: AlertFiltersView;
  onGlobalFiltersChange: (next: AlertFiltersView) => void;
  globalFiltersPending: boolean;
  briefingEnabled: boolean;
  onOpenAddPanel: () => void;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [defaultsOpen, setDefaultsOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement | null>(null);
  const defaultsRef = useRef<HTMLDivElement | null>(null);
  const globalActive = hasActiveAlertFiltersView(globalFilters);
  const activeDefaultCount = countActiveAlertFiltersView(globalFilters);
  const typeFilterActive = typeFilter !== "all";

  const typeOptions: Array<{ key: AlertTypeFilter; label: string; count: number }> = [
    { key: "all", label: TYPE_FILTER_LABELS.all, count: totalCount },
    { key: "company", label: TYPE_FILTER_LABELS.company, count: companyCount },
    { key: "sector", label: TYPE_FILTER_LABELS.sector, count: sectorCount },
  ];

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!filtersRef.current?.contains(event.target as Node)) {
        setFiltersOpen(false);
      }
      if (!defaultsRef.current?.contains(event.target as Node)) {
        setDefaultsOpen(false);
      }
    }
    if (!filtersOpen && !defaultsOpen) return;
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [filtersOpen, defaultsOpen]);

  return (
    <div className={cn("relative shrink-0 bg-card", searchFocused && "z-30")}>
      <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-5 py-3 md:px-4">
        <Button
          type="button"
          size="sm"
          className="h-8 shrink-0 gap-1.5 rounded-md px-3 text-sm"
          onClick={onOpenAddPanel}
          aria-label="Add alert"
        >
          <Plus size={14} strokeWidth={2} />
          Add alert
        </Button>

        <div className="min-w-[10rem] flex-1 [&_input]:h-8 [&_input]:rounded-md [&_input]:text-sm">
          <SearchInput
            ref={searchRef}
            value={query}
            onChange={onQueryChange}
            placeholder="Search alerts…"
            onFocusChange={onSearchFocusChange}
          />
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <AlertsDailyBriefingToolbarButton
            key={briefingEnabled ? "on" : "off"}
            enabled={briefingEnabled}
          />

          <div ref={filtersRef} className="relative shrink-0">
            <ToolbarButton
              active={filtersOpen || typeFilterActive}
              aria-expanded={filtersOpen}
              onClick={() => {
                setFiltersOpen((open) => !open);
                setDefaultsOpen(false);
              }}
            >
              <ListFilter size={14} strokeWidth={1.75} className="opacity-80" />
              Filter
              {typeFilterActive ? <span className={UI_COUNT_BADGE}>1</span> : null}
            </ToolbarButton>
            {filtersOpen ? (
              <SectionStack className="absolute right-0 top-full z-40 mt-1.5 w-[min(18rem,calc(100vw-2.5rem))] shadow-sm">
                <FilterSection title="Type" compact>
                  <div className="flex flex-wrap gap-2">
                    {typeOptions.map((option) => (
                      <FilterPill
                        key={option.key}
                        active={typeFilter === option.key}
                        onClick={() => onTypeFilterChange(option.key)}
                        className="h-7 px-2.5 text-[12px]"
                      >
                        {option.label}
                        <span className="tabular-nums text-muted-foreground">{option.count}</span>
                      </FilterPill>
                    ))}
                  </div>
                </FilterSection>
              </SectionStack>
            ) : null}
          </div>

          <div ref={defaultsRef} className="relative shrink-0">
            <ToolbarButton
              active={defaultsOpen || globalActive}
              aria-expanded={defaultsOpen}
              onClick={() => {
                setDefaultsOpen((open) => !open);
                setFiltersOpen(false);
              }}
            >
              <Settings2 size={14} strokeWidth={1.75} className="opacity-80" />
              Defaults
              {activeDefaultCount > 0 ? (
                <span className={UI_COUNT_BADGE}>{activeDefaultCount}</span>
              ) : null}
            </ToolbarButton>
            {defaultsOpen ? (
              <SectionStack className="absolute right-0 top-full z-40 mt-1.5 flex w-[min(24rem,calc(100vw-2.5rem))] max-h-[min(36rem,calc(100vh-5rem))] flex-col overflow-hidden shadow-sm">
                <div className="shrink-0">
                  <AlertDefaultsActiveRail
                    value={globalFilters}
                    onChange={onGlobalFiltersChange}
                  />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
                  <AlertFiltersEditor
                    value={globalFilters}
                    onChange={onGlobalFiltersChange}
                    disabled={globalFiltersPending}
                  />
                </div>
              </SectionStack>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
