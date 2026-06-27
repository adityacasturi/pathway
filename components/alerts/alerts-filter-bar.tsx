"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Settings2 } from "lucide-react";
import { AlertsHelpDialog } from "@/components/alerts/alerts-help-dialog";
import {
  AlertFiltersEditor,
  countActiveAlertFiltersView,
  hasActiveAlertFiltersView,
} from "@/components/alert-filters-editor";
import { SectionStack } from "@/components/design-system/surface";
import { SearchInput } from "@/components/search-input";
import { Button } from "@/components/ui/button";
import { ToolbarButton } from "@/components/ui/toolbar-button";
import type { AlertFiltersView } from "@/lib/alerts/filters";
import { UI_TOOLBAR_FILTER_COUNT } from "@/lib/ui/selection-styles";
import { cn } from "@/lib/utils";

export function AlertsFilterBar({
  searchRef,
  query,
  onQueryChange,
  searchFocused,
  onSearchFocusChange,
  globalFilters,
  onGlobalFiltersChange,
  onOpenAddPanel,
}: {
  searchRef: React.RefObject<HTMLDivElement | null>;
  query: string;
  onQueryChange: (value: string) => void;
  searchFocused: boolean;
  onSearchFocusChange: (focused: boolean) => void;
  globalFilters: AlertFiltersView;
  onGlobalFiltersChange: (next: AlertFiltersView) => void;
  onOpenAddPanel: () => void;
}) {
  const [defaultsOpen, setDefaultsOpen] = useState(false);
  const defaultsRef = useRef<HTMLDivElement | null>(null);
  const mobileDefaultsPanelRef = useRef<HTMLDivElement | null>(null);
  const globalActive = hasActiveAlertFiltersView(globalFilters);
  const activeDefaultCount = countActiveAlertFiltersView(globalFilters);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!defaultsRef.current?.contains(event.target as Node)) {
        if (!mobileDefaultsPanelRef.current?.contains(event.target as Node)) {
          setDefaultsOpen(false);
        }
      }
    }
    if (!defaultsOpen) return;
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [defaultsOpen]);

  return (
    <div className={cn("relative shrink-0 bg-card", searchFocused && "z-30")}>
      <div className="flex flex-col gap-2.5 border-b border-border px-5 py-3 md:flex-row md:items-center md:gap-2.5 md:px-4">
        <Button
          type="button"
          size="sm"
          className="h-8 w-full shrink-0 gap-1 rounded-md px-2 text-sm md:w-auto md:gap-1.5 md:px-3"
          onClick={onOpenAddPanel}
          aria-label="Add alert"
        >
          <Plus size={14} strokeWidth={2} />
          <span className="truncate md:hidden">Add</span>
          <span className="hidden md:inline">Add alert</span>
        </Button>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div ref={defaultsRef} className="relative shrink-0">
            <ToolbarButton
              active={defaultsOpen || globalActive}
              aria-expanded={defaultsOpen}
              aria-label="Edit default filters"
              className="h-8 justify-center gap-1.5 px-2.5"
              onClick={() => setDefaultsOpen((open) => !open)}
            >
              <Settings2 size={14} strokeWidth={1.75} className="shrink-0 opacity-80" />
              <span className="hidden sm:inline">Default filters</span>
              {activeDefaultCount > 0 ? (
                <span className={UI_TOOLBAR_FILTER_COUNT}>{activeDefaultCount}</span>
              ) : null}
            </ToolbarButton>
            {defaultsOpen ? (
              <AlertsDefaultsPanel
                globalFilters={globalFilters}
                onGlobalFiltersChange={onGlobalFiltersChange}
                className="absolute left-0 top-full z-40 mt-1.5 hidden w-[min(36rem,calc(100vw-2rem))] shadow-sm sm:flex"
              />
            ) : null}
          </div>

          <div className="min-w-0 flex-1 [&_input]:h-8 [&_input]:rounded-md [&_input]:text-sm">
            <SearchInput
              ref={searchRef}
              value={query}
              onChange={onQueryChange}
              placeholder="Search alerts…"
              onFocusChange={onSearchFocusChange}
            />
          </div>

          <AlertsHelpDialog />
        </div>

        {defaultsOpen ? (
          <div
            ref={mobileDefaultsPanelRef}
            className="absolute left-5 top-full z-40 mt-1.5 w-[min(36rem,calc(100vw-2rem))] sm:hidden"
          >
            <AlertsDefaultsPanel
              globalFilters={globalFilters}
              onGlobalFiltersChange={onGlobalFiltersChange}
              className="shadow-sm"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AlertsDefaultsPanel({
  globalFilters,
  onGlobalFiltersChange,
  className,
}: {
  globalFilters: AlertFiltersView;
  onGlobalFiltersChange: (next: AlertFiltersView) => void;
  className?: string;
}) {
  return (
    <SectionStack className={className}>
      <div className="p-4">
        <AlertFiltersEditor
          value={globalFilters}
          onChange={onGlobalFiltersChange}
          sectionUnstyled
        />
      </div>
    </SectionStack>
  );
}
