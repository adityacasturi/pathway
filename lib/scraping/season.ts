import type { ScrapedSeason } from "./types.ts";

const SEASON_PATTERN: ReadonlyArray<{ season: ScrapedSeason; re: RegExp }> = [
  { season: "Fall", re: /\bfall\b/i },
  { season: "Spring", re: /\bspring\b/i },
  { season: "Winter", re: /\bwinter\b/i },
  { season: "Summer", re: /\bsummer\b/i },
];

/** Title patterns like "Fall 2026" or "Summer '25". */
const SEASON_YEAR_PATTERN =
  /\b(fall|autumn|spring|summer|winter)\b[^a-z0-9]{0,4}(?:['']?\s*)?(?:20)?\d{2}\b/i;

export interface InferSeasonHints {
  employmentType?: string | null;
  commitment?: string | null;
  departments?: string[];
}

function seasonFromText(text: string): ScrapedSeason | null {
  const yearMatch = text.match(SEASON_YEAR_PATTERN);
  if (yearMatch) {
    const word = yearMatch[1].toLowerCase();
    if (word === "autumn" || word === "fall") return "Fall";
    if (word === "spring") return "Spring";
    if (word === "winter") return "Winter";
    if (word === "summer") return "Summer";
  }

  for (const { season, re } of SEASON_PATTERN) {
    if (re.test(text)) {
      return season;
    }
  }

  return null;
}

/** Defaults to Summer when no season is stated anywhere. */
export function inferSeason(
  title: string,
  description = "",
  hints: InferSeasonHints = {},
): ScrapedSeason {
  const hintParts = [
    hints.employmentType,
    hints.commitment,
    ...(hints.departments ?? []),
  ]
    .map((part) => part?.trim())
    .filter(Boolean);

  const combined = [title, description, ...hintParts].filter(Boolean).join(" ");
  return seasonFromText(combined) ?? "Summer";
}
