"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Settings2 } from "lucide-react";
import {
  AlertDefaultsActiveRail,
  AlertFiltersEditor,
  countActiveAlertFiltersView,
  hasActiveAlertFiltersView,
} from "@/components/alert-filters-editor";
import { AlertsDailyBriefingToolbarButton } from "@/components/alerts/alerts-daily-briefing-toolbar-button";
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
  briefingEnabled,
  onOpenAddPanel,
}: {
  searchRef: React.RefObject<HTMLDivElement | null>;
  query: string;
  onQueryChange: (value: string) => void;
  searchFocused: boolean;
  onSearchFocusChange: (focused: boolean) => void;
  globalFilters: AlertFiltersView;
  onGlobalFiltersChange: (next: AlertFiltersView) => void;
  briefingEnabled: boolean;
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
      <div className="flex flex-col gap-2.5 border-b border-border px-5 py-3 md:flex-row md:flex-wrap md:items-center md:gap-2.5 md:px-4">
        <div className="order-1 w-full min-w-0 md:order-2 md:min-w-[10rem] md:flex-1 [&_input]:h-8 [&_input]:rounded-md [&_input]:text-sm">
          <SearchInput
            ref={searchRef}
            value={query}
            onChange={onQueryChange}
            placeholder="Search alerts…"
            onFocusChange={onSearchFocusChange}
          />
        </div>

        <div className="relative order-2 grid w-full grid-cols-3 gap-2 md:contents">
          <Button
            type="button"
            size="sm"
            className="h-8 w-full gap-1 rounded-md px-2 text-sm md:order-1 md:w-auto md:gap-1.5 md:px-3"
            onClick={onOpenAddPanel}
            aria-label="Add alert"
          >
            <Plus size={14} strokeWidth={2} />
            <span className="truncate md:hidden">Add</span>
            <span className="hidden md:inline">Add alert</span>
          </Button>

          <AlertsDailyBriefingToolbarButton
            key={briefingEnabled ? "on" : "off"}
            enabled={briefingEnabled}
            className="min-w-0 w-full md:order-3 md:w-auto [&>div]:w-full [&>div]:justify-center md:[&>div]:w-auto md:[&>div]:justify-start"
          />

          <div ref={defaultsRef} className="relative min-w-0 md:order-4">
            <ToolbarButton
              active={defaultsOpen || globalActive}
              aria-expanded={defaultsOpen}
              className="h-8 w-full justify-center gap-1.5 px-2 md:w-auto md:justify-start md:px-2.5"
              onClick={() => setDefaultsOpen((open) => !open)}
            >
              <Settings2 size={14} strokeWidth={1.75} className="shrink-0 opacity-80" />
              Defaults
              {activeDefaultCount > 0 ? (
                <span className={UI_TOOLBAR_FILTER_COUNT}>{activeDefaultCount}</span>
              ) : null}
            </ToolbarButton>
            {defaultsOpen ? (
              <AlertsDefaultsPanel
                globalFilters={globalFilters}
                onGlobalFiltersChange={onGlobalFiltersChange}
                className="absolute right-0 top-full z-40 mt-1.5 hidden w-[min(24rem,calc(100vw-2.5rem))] shadow-sm md:flex"
              />
            ) : null}
          </div>

          {defaultsOpen ? (
            <div
              ref={mobileDefaultsPanelRef}
              className="absolute right-0 top-full z-40 mt-1.5 w-[min(24rem,calc(100vw-2rem))] md:hidden"
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
    <SectionStack
      className={cn(
        "flex max-h-[min(36rem,calc(100vh-5rem))] flex-col overflow-hidden",
        className,
      )}
    >
      <div className="shrink-0">
        <AlertDefaultsActiveRail value={globalFilters} onChange={onGlobalFiltersChange} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
        <AlertFiltersEditor value={globalFilters} onChange={onGlobalFiltersChange} />
      </div>
    </SectionStack>
  );
}
