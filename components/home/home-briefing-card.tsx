"use client";

import { HomeSeasonSnapshot } from "@/components/home/home-season-snapshot";
import type { SeasonSnapshot } from "@/lib/home/season-snapshot";

export function HomeBriefingCard({ seasonSnapshot }: { seasonSnapshot: SeasonSnapshot }) {
  return <HomeSeasonSnapshot snapshot={seasonSnapshot} layout="rail" />;
}
