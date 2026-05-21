import { resolveDisplaySeason, type DisplaySeason } from "@/lib/postings/season";

export function SeasonPill({ season }: { season: string }) {
  const displaySeason = resolveDisplaySeason(season);
  return (
    <span className={`season-pill season-pill--${toneClass(displaySeason)}`}>
      <span className="season-pill-dot" aria-hidden />
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
