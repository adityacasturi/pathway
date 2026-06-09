import { resolveDisplaySeason, type DisplaySeason } from "@/lib/postings/season";
import { SeasonPill } from "@/components/season-pill";
import { cn } from "@/lib/utils";

function toneClass(season: DisplaySeason): string {
  switch (season) {
    case "Summer":
      return "summer";
    case "Fall":
      return "fall";
    case "Spring":
      return "spring";
    case "Winter":
      return "winter";
  }
}

const FILLED_TONE_CLASS: Record<DisplaySeason, string> = {
  Summer:
    "bg-[color-mix(in_oklab,var(--season-summer-fg)_14%,var(--tint-base))] text-[var(--season-summer-fg)]",
  Fall:
    "bg-[color-mix(in_oklab,var(--season-fall-fg)_14%,var(--tint-base))] text-[var(--season-fall-fg)]",
  Spring:
    "bg-[color-mix(in_oklab,var(--season-spring-fg)_14%,var(--tint-base))] text-[var(--season-spring-fg)]",
  Winter:
    "bg-[color-mix(in_oklab,var(--season-winter-fg)_14%,var(--tint-base))] text-[var(--season-winter-fg)]",
};

export function SeasonBadge({
  season,
  variant = "plain",
  className,
}: {
  season: string;
  variant?: "plain" | "pill" | "filled";
  className?: string;
}) {
  if (variant === "pill") {
    return <SeasonPill season={season} className={className} />;
  }

  const display = resolveDisplaySeason(season);

  if (variant === "filled") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
          FILLED_TONE_CLASS[display],
          className,
        )}
      >
        {display}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "season-pill inline-flex items-center justify-center gap-1 text-sm font-medium",
        `season-pill--${toneClass(display)}`,
        className,
      )}
    >
      <span className="season-pill-dot !size-1.5" aria-hidden />
      <span className="season-pill-label !text-sm !font-medium !normal-case !tracking-normal">
        {display}
      </span>
    </span>
  );
}
