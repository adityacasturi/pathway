"use client";

import { FilterSection } from "@/components/ui/filter-menu";
import { FilterChip } from "@/components/ui/filter-chip";
import { FEED_SEASONS, type FeedSeason } from "@/lib/feed/types";
import { cn } from "@/lib/utils";

const SEASON_COLOR_VAR: Record<FeedSeason, string> = {
  Summer: "--season-summer-fg",
  Fall: "--season-fall-fg",
  Spring: "--season-spring-fg",
  Winter: "--season-winter-fg",
};

export function SeasonDot({ season }: { season: FeedSeason }) {
  return (
    <span
      className="size-1.5 shrink-0 rounded-full"
      style={{ backgroundColor: `var(${SEASON_COLOR_VAR[season]})` }}
      aria-hidden
    />
  );
}

const SEASON_LABELS: Record<FeedSeason, string> = {
  Summer: "Summer",
  Fall: "Fall",
  Spring: "Spring",
  Winter: "Winter",
};

export function SeasonFilterSection({
  selected,
  onToggle,
  onClear,
  counts,
  compact = false,
  chipClassName,
  clearLabel = "Clear",
  alwaysShowClear = false,
}: {
  selected: ReadonlySet<FeedSeason>;
  onToggle: (season: FeedSeason) => void;
  onClear: () => void;
  counts?: Partial<Record<FeedSeason, number>>;
  compact?: boolean;
  chipClassName?: string;
  clearLabel?: string;
  alwaysShowClear?: boolean;
}) {
  return (
    <FilterSection
      title="Season"
      compact={compact}
      action={
        selected.size > 0 || alwaysShowClear
          ? { label: clearLabel, onClick: onClear }
          : undefined
      }
    >
      <div className={cn("flex flex-wrap", compact ? "gap-2" : "gap-2.5")}>
        {FEED_SEASONS.map((season) => (
          <FilterChip
            key={season}
            prefix={<SeasonDot season={season} />}
            label={SEASON_LABELS[season]}
            count={counts?.[season]}
            active={selected.has(season)}
            onClick={() => onToggle(season)}
            className={chipClassName}
          />
        ))}
      </div>
    </FilterSection>
  );
}
