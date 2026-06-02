import type { FeedSeason } from "@/lib/feed/types";

export type SeasonFilter = "all" | FeedSeason;

export const SEASON_FILTER_OPTIONS: { value: SeasonFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "Summer", label: "Summer" },
  { value: "Fall", label: "Fall" },
  { value: "Spring", label: "Spring" },
  { value: "Winter", label: "Winter" },
];
