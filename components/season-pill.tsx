import { resolveDisplaySeason, type DisplaySeason } from "@/lib/postings/season";

export function SeasonPill({
  season,
  showDot = true,
  className,
}: {
  season: string;
  showDot?: boolean;
  className?: string;
}) {
  const displaySeason = resolveDisplaySeason(season);
  return (
    <span className={`season-pill season-pill--${toneClass(displaySeason)} ${className ?? ""}`}>
      {showDot ? <span className="season-pill-dot" aria-hidden /> : null}
      <span className="season-pill-label">{displaySeason}</span>
    </span>
  );
}

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
