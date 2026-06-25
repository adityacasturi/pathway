"use client";

import type { ReactNode } from "react";
import { LayoutGrid } from "lucide-react";
import { MotionStaggerItem, MotionStaggerList } from "@/components/design-system/motion-stagger";
import { IndustryIcon } from "@/components/stats/industry-icon";
import { UI_SELECTED, listRailCountClass } from "@/lib/ui/selection-styles";
import { cn } from "@/lib/utils";

export function CompaniesIndustryRail({
  industryFilter,
  onIndustryFilterChange,
  searchableCount,
  industryOptions,
  showIndustryFilter,
  className,
}: {
  industryFilter: string;
  onIndustryFilterChange: (value: string) => void;
  searchableCount: number;
  industryOptions: Array<{ industry: string; label: string; count: number }>;
  showIndustryFilter: boolean;
  className?: string;
}) {
  if (!showIndustryFilter) return null;

  return (
    <nav
      className={cn(
        "hidden min-h-0 w-[15.5rem] shrink-0 flex-col self-stretch border-r border-border bg-card lg:flex",
        className,
      )}
      aria-label="Filter by industry"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <MotionStaggerList as="ul" className="space-y-0.5">
          <MotionStaggerItem as="li" index={0}>
            <IndustryRailItem
              active={industryFilter === "all"}
              label="All"
              count={searchableCount}
              onClick={() => onIndustryFilterChange("all")}
              icon={<LayoutGrid className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />}
            />
          </MotionStaggerItem>
          {industryOptions.map((option, index) => (
            <MotionStaggerItem as="li" key={option.industry} index={index + 1}>
              <IndustryRailItem
                active={industryFilter === option.industry}
                label={option.label}
                count={option.count}
                onClick={() => onIndustryFilterChange(option.industry)}
                icon={
                  <IndustryIcon slug={option.industry} className="!size-4" />
                }
              />
            </MotionStaggerItem>
          ))}
        </MotionStaggerList>
      </div>
    </nav>
  );
}

function IndustryRailItem({
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
  const empty = count === 0;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
        active
          ? cn(UI_SELECTED, "font-medium")
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        empty && !active && "opacity-50",
      )}
    >
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center",
          active ? "text-[var(--selection-fg)]" : "text-muted-foreground/80",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className={listRailCountClass(active)}>{count}</span>
    </button>
  );
}
