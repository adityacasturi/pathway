"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDownUp, ChevronDown, LayoutGrid, RefreshCw, X } from "lucide-react";
import { SearchInput } from "@/components/search-input";
import { IndustryIcon } from "@/components/stats/industry-icon";
import { Surface } from "@/components/design-system/surface";
import { ToolbarButton } from "@/components/ui/toolbar-button";
import { cn } from "@/lib/utils";

export type CompanySortKey = "openings" | "name" | "updated";
export type CompanySortDirection = "asc" | "desc";

const SORT_OPTIONS: { key: CompanySortKey; label: string }[] = [
  { key: "openings", label: "Openings" },
  { key: "name", label: "Name" },
  { key: "updated", label: "Recently updated" },
];

export function CompaniesFilterBar({
  searchRef,
  query,
  onQueryChange,
  searchFocused,
  onSearchFocusChange,
  searchableCount,
  sortKey,
  sortDirection,
  onSortChange,
  industryFilter,
  onIndustryFilterChange,
  industryOptions,
  showIndustryFilter,
  isRefreshing,
  onRefresh,
  className,
}: {
  searchRef: React.RefObject<HTMLDivElement | null>;
  query: string;
  onQueryChange: (value: string) => void;
  searchFocused: boolean;
  onSearchFocusChange: (focused: boolean) => void;
  searchableCount: number;
  sortKey: CompanySortKey | null;
  sortDirection: CompanySortDirection;
  onSortChange: (key: CompanySortKey) => void;
  industryFilter: string;
  onIndustryFilterChange: (value: string) => void;
  industryOptions: Array<{ industry: string; label: string; count: number }>;
  showIndustryFilter: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  className?: string;
}) {
  const [sortOpen, setSortOpen] = useState(false);
  const [industryOpen, setIndustryOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement | null>(null);
  const industryRef = useRef<HTMLDivElement | null>(null);
  const activeSort = sortKey ?? "openings";

  const selectedIndustryLabel =
    industryFilter === "all"
      ? "All industries"
      : (industryOptions.find((option) => option.industry === industryFilter)?.label ??
        "All industries");

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!sortRef.current?.contains(event.target as Node)) {
        setSortOpen(false);
      }
      if (!industryRef.current?.contains(event.target as Node)) {
        setIndustryOpen(false);
      }
    }
    if (!sortOpen && !industryOpen) return;
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [sortOpen, industryOpen]);

  return (
    <div className={cn("relative shrink-0 bg-card", searchFocused && "z-30", className)}>
      <h1 className="sr-only">Companies</h1>
      <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-4 py-3">
        <div className="min-w-[10rem] flex-1 [&_input]:h-8 [&_input]:rounded-md [&_input]:text-sm">
          <SearchInput
            ref={searchRef}
            value={query}
            onChange={onQueryChange}
            placeholder="Search companies…"
            onFocusChange={onSearchFocusChange}
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {showIndustryFilter ? (
            <div ref={industryRef} className="relative lg:hidden">
              <ToolbarButton
                active={industryOpen || industryFilter !== "all"}
                aria-expanded={industryOpen}
                onClick={() => {
                  setIndustryOpen((open) => !open);
                  setSortOpen(false);
                }}
                className="max-w-[11rem]"
              >
                <span className="truncate">{selectedIndustryLabel}</span>
                <ChevronDown size={14} strokeWidth={1.75} className="shrink-0 opacity-70" />
              </ToolbarButton>
              {industryOpen ? (
                <Surface
                  padding="p-2"
                  className="absolute right-0 top-full z-40 mt-1.5 max-h-72 w-64 overflow-y-auto shadow-sm"
                >
                  <ul className="space-y-0.5">
                    <IndustryMenuItem
                      active={industryFilter === "all"}
                      label="All industries"
                      count={searchableCount}
                      icon={<LayoutGrid className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />}
                      onClick={() => {
                        onIndustryFilterChange("all");
                        setIndustryOpen(false);
                      }}
                    />
                    {industryOptions.map((option) => (
                      <IndustryMenuItem
                        key={option.industry}
                        active={industryFilter === option.industry}
                        label={option.label}
                        count={option.count}
                        icon={<IndustryIcon slug={option.industry} className="!size-5" />}
                        onClick={() => {
                          onIndustryFilterChange(option.industry);
                          setIndustryOpen(false);
                        }}
                      />
                    ))}
                  </ul>
                </Surface>
              ) : null}
            </div>
          ) : null}

          <div ref={sortRef} className="relative">
            <ToolbarButton
              active={sortOpen || sortKey !== null}
              aria-expanded={sortOpen}
              onClick={() => {
                setSortOpen((open) => !open);
                setIndustryOpen(false);
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

          <span className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden />

          <ToolbarButton
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Refresh companies"
            aria-busy={isRefreshing}
            title="Refresh"
            className="px-2"
          >
            <RefreshCw
              size={14}
              strokeWidth={1.75}
              className={cn("opacity-80", isRefreshing && "animate-spin")}
              aria-hidden
            />
          </ToolbarButton>
        </div>
      </div>

      {query.trim() ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
          <button
            type="button"
            onClick={() => onQueryChange("")}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted/40"
          >
            “{query.trim()}”
            <X size={12} strokeWidth={2} className="text-muted-foreground" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function IndustryMenuItem({
  active,
  label,
  count,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors",
          active ? "bg-muted font-medium text-foreground" : "text-foreground/80 hover:bg-muted/50",
        )}
      >
        <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
          {icon}
        </span>
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
          {count}
        </span>
      </button>
    </li>
  );
}
