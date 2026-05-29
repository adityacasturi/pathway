import type { ApplicationSeason } from "@/types/application";

export type SeasonFilter = "all" | ApplicationSeason;

export const SEASON_FILTER_OPTIONS: { value: SeasonFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "Summer", label: "Summer" },
  { value: "Fall", label: "Fall" },
];
