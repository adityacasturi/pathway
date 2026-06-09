"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Settings2 } from "lucide-react";
import {
  AlertDefaultsActiveRail,
  AlertFiltersEditor,
  countActiveAlertFiltersView,
  hasActiveAlertFiltersView,
} from "@/components/alert-filters-editor";
import { alertTypeFilterPillClass } from "@/components/alerts/filter-chip-styles";
import type { AlertTypeFilter } from "@/components/alerts/types";
import { FilterPill } from "@/components/design-system/toolbar";
import { SectionStack } from "@/components/design-system/surface";
import { SearchInput } from "@/components/search-input";
import { ToolbarButton } from "@/components/ui/toolbar-button";
import type { AlertFiltersView } from "@/lib/alerts/filters";
import { UI_COUNT_BADGE } from "@/lib/ui/selection-styles";
import { cn } from "@/lib/utils";

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
  onOpenAddPanel: () => void;
}) {
  const [defaultsOpen, setDefaultsOpen] = useState(false);
  const defaultsRef = useRef<HTMLDivElement | null>(null);
  const globalActive = hasActiveAlertFiltersView(globalFilters);
  const activeDefaultCount = countActiveAlertFiltersView(globalFilters);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!defaultsRef.current?.contains(event.target as Node)) {
        setDefaultsOpen(false);
      }
    }
    if (!defaultsOpen) return;
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [defaultsOpen]);

  return (
    <div className={cn("relative shrink-0 bg-card", searchFocused && "z-30")}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <div ref={defaultsRef} className="relative shrink-0">
          <ToolbarButton
            active={defaultsOpen || globalActive}
            aria-expanded={defaultsOpen}
            onClick={() => setDefaultsOpen((open) => !open)}
          >
            <Settings2 size={14} strokeWidth={1.75} className="opacity-80" />
            Defaults
            {activeDefaultCount > 0 ? (
              <span className={UI_COUNT_BADGE}>{activeDefaultCount}</span>
            ) : null}
          </ToolbarButton>
          {defaultsOpen ? (
            <SectionStack className="absolute left-0 top-full z-40 mt-1.5 flex w-[min(24rem,calc(100vw-2.5rem))] max-h-[min(36rem,calc(100vh-5rem))] flex-col overflow-hidden shadow-sm">
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

        <div className="flex min-w-[9rem] flex-1 items-center gap-2">
          <div className="min-w-0 flex-1 [&_input]:h-8 [&_input]:rounded-md [&_input]:text-sm">
            <SearchInput
              ref={searchRef}
              value={query}
              onChange={onQueryChange}
              placeholder="Search alerts…"
              onFocusChange={onSearchFocusChange}
            />
          </div>
          <ToolbarButton onClick={onOpenAddPanel} aria-label="Add alert">
            <Plus size={14} strokeWidth={1.75} className="text-foreground/70" />
            Add alert
          </ToolbarButton>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <FilterPill active={typeFilter === "all"} onClick={() => onTypeFilterChange("all")}>
            All
            <span className="tabular-nums text-muted-foreground">{totalCount}</span>
          </FilterPill>
          <FilterPill
            active={typeFilter === "company"}
            onClick={() => onTypeFilterChange("company")}
            className={alertTypeFilterPillClass("company", typeFilter === "company")}
          >
            Companies
            <span className="tabular-nums text-muted-foreground">{companyCount}</span>
          </FilterPill>
          <FilterPill
            active={typeFilter === "sector"}
            onClick={() => onTypeFilterChange("sector")}
            className={alertTypeFilterPillClass("sector", typeFilter === "sector")}
          >
            Bundles
            <span className="tabular-nums text-muted-foreground">{sectorCount}</span>
          </FilterPill>
        </div>

      </div>
    </div>
  );
}
