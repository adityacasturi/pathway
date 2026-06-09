"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { CountryFlag } from "@/components/country-flag";
import { FilterSection } from "@/components/ui/filter-menu";
import { FilterChip } from "@/components/ui/filter-chip";
import type { CountryFilterOption } from "@/lib/feed/country-filter";
import { cn } from "@/lib/utils";

const COLLAPSED_PILL_ROWS_CLASS = "max-h-20 overflow-hidden";

export function CountryFilterSection({
  options,
  selected,
  onToggle,
  onClear,
  showFlags = false,
  variant = "panel",
  collapsible = false,
  chipClassName,
  dense = false,
  compact = false,
  hideLabel = false,
  clearLabel = "Clear",
  alwaysShowClear = false,
}: {
  options: CountryFilterOption[];
  selected: ReadonlySet<string>;
  onToggle: (code: string) => void;
  onClear: () => void;
  showFlags?: boolean;
  /** `panel` — bordered filter menu section; `inline` — flat section for app pages */
  variant?: "panel" | "inline";
  collapsible?: boolean;
  chipClassName?: string | ((active: boolean) => string);
  dense?: boolean;
  compact?: boolean;
  hideLabel?: boolean;
  clearLabel?: string;
  alwaysShowClear?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const pillsRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = pillsRef.current;
    if (!el || !collapsible) {
      setHasMore(false);
      return;
    }

    const measure = () => {
      if (expanded) return;
      const overflows = el.scrollHeight > el.clientHeight + 1;
      setHasMore(overflows);

      if (selected.size > 0 && overflows) {
        const selectedChip = el.querySelector<HTMLElement>('[aria-pressed="true"]');
        if (
          selectedChip &&
          selectedChip.getBoundingClientRect().bottom > el.getBoundingClientRect().bottom + 1
        ) {
          setExpanded(true);
        }
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [collapsible, expanded, selected, options]);

  if (options.length === 0) {
    return null;
  }

  const resolveChipClass = (active: boolean) =>
    typeof chipClassName === "function" ? chipClassName(active) : chipClassName;

  const chips = (
    <div
      ref={collapsible ? pillsRef : undefined}
      className={cn("flex flex-wrap gap-1.5", collapsible && !expanded && COLLAPSED_PILL_ROWS_CLASS)}
    >
      {options.map((option) => {
        const active = selected.has(option.code);
        return (
          <FilterChip
            key={option.code}
            prefix={showFlags ? <CountryFlag code={option.code} size="md" /> : undefined}
            label={option.label}
            title={option.label}
            count={option.count}
            active={active}
            onClick={() => onToggle(option.code)}
            className={resolveChipClass(active)}
          />
        );
      })}
    </div>
  );

  if (variant === "inline") {
    return (
      <div className={dense ? "space-y-2" : undefined}>
        {!hideLabel ? (
          <div className={cn("flex items-center justify-between gap-3", dense ? "min-h-5" : "mb-3")}>
            {dense ? (
              <span className="label-meta shrink-0">Country</span>
            ) : (
              <p className="text-sm font-medium text-foreground">Country</p>
            )}
            {selected.size > 0 || alwaysShowClear ? (
              <button
                type="button"
                onClick={onClear}
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {clearLabel}
              </button>
            ) : null}
          </div>
        ) : selected.size > 0 || alwaysShowClear ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClear}
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {clearLabel}
            </button>
          </div>
        ) : null}
        {chips}
        {collapsible && hasMore ? (
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {expanded ? (
              <>
                Show fewer countries
                <ChevronUp size={14} strokeWidth={1.75} aria-hidden />
              </>
            ) : (
              <>
                Show all countries
                <ChevronDown size={14} strokeWidth={1.75} aria-hidden />
              </>
            )}
          </button>
        ) : null}
        {!dense && selected.size === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No country selected means all locations.</p>
        ) : null}
      </div>
    );
  }

  return (
    <FilterSection
      title="Country"
      compact={compact}
      action={
        selected.size > 0 || alwaysShowClear
          ? { label: clearLabel, onClick: onClear }
          : undefined
      }
    >
      <div
        className={cn(
          "flex max-h-40 flex-wrap overflow-y-auto",
          compact ? "gap-2" : "gap-2.5",
        )}
      >
        {chips}
      </div>
    </FilterSection>
  );
}
