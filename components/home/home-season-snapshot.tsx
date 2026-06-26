"use client";

import Link from "next/link";
import { StatusDot } from "@/components/status-badge";
import { seasonSnapshotStatuses, type SeasonSnapshot } from "@/lib/home/season-snapshot";
import { STATUS_LABELS } from "@/lib/config/events";
import { cn } from "@/lib/utils";

export function HomeSeasonSnapshot({
  snapshot,
  layout = "stacked",
}: {
  snapshot: SeasonSnapshot;
  layout?: "stacked" | "rail";
}) {
  const statuses = seasonSnapshotStatuses();

  if (layout === "rail") {
    return (
      <nav
        aria-label="Application pipeline snapshot"
        className="w-full min-w-0 overflow-x-hidden"
        data-testid="home-pipeline-snapshot"
      >
        <ul className="grid w-full min-w-0 grid-cols-5">
          {statuses.map((status, index) => (
            <li
              key={status}
              className={cn(
                "flex min-w-0 overflow-hidden px-1 py-3 sm:px-4 sm:py-3.5",
                index > 0 && "border-l border-border/70",
              )}
            >
              <Link
                href={`/applications?status=${status}`}
                className="group inline-flex w-full min-w-0 flex-col items-center gap-1 transition-opacity hover:opacity-80"
              >
                <span className="flex w-full min-w-0 items-center justify-center gap-1">
                  <StatusDot status={status} size={6} />
                  <span className="truncate font-mono text-[10px] font-medium uppercase tracking-[0.04em] text-muted-foreground sm:text-[11px] sm:tracking-[0.06em]">
                    {STATUS_LABELS[status]}
                  </span>
                </span>
                <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                  {snapshot.counts[status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <section aria-labelledby="home-season-heading">
      <h2
        id="home-season-heading"
        className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground"
      >
        {snapshot.seasonLabel}
      </h2>
      <nav aria-label="Application pipeline snapshot" className="mt-3">
        <ul className={cn("flex flex-wrap gap-x-5 gap-y-4 sm:gap-x-8")}>
          {statuses.map((status) => (
            <li key={status}>
              <Link
                href={`/applications?status=${status}`}
                className="group inline-flex min-w-[4.5rem] flex-col gap-1.5 transition-opacity hover:opacity-80"
              >
                <span className="flex items-center gap-1.5">
                  <StatusDot status={status} size={6} />
                  <span className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                    {STATUS_LABELS[status]}
                  </span>
                </span>
                <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                  {snapshot.counts[status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}
