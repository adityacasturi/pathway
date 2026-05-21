export type DisplaySeason = "Summer" | "Fall" | "Spring" | "Winter";

const DISPLAY_SEASONS: readonly DisplaySeason[] = ["Summer", "Fall", "Spring", "Winter"];

/**
 * Season text for UI pills — never includes a year. Unknown or ambiguous
 * values default to Summer.
 */
export function resolveDisplaySeason(season: string): DisplaySeason {
  const normalized = season
    .trim()
    .replace(/\s+(20\d{2})\b/gi, "")
    .toLowerCase();

  for (const candidate of DISPLAY_SEASONS) {
    if (normalized === candidate.toLowerCase() || normalized.startsWith(`${candidate.toLowerCase()} `)) {
      return candidate;
    }
  }

  return "Summer";
}
