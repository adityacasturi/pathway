"use client";

import { IndustryIcon } from "@/components/stats/industry-icon";
import {
  MARKET_WEEK_LIST_HEADER_CLASS,
  MARKET_WEEK_LIST_ROW_CLASS,
} from "@/components/stats/market-week-list";
import { formatPercent } from "@/lib/stats/applications";
import type { IndustryActivity } from "@/lib/home/briefing";

interface Props {
  industries: IndustryActivity[];
}

export function IndustrySpotlight({ industries }: Props) {
  const industryTotal = industries.reduce((sum, row) => sum + row.newCount, 0);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className={MARKET_WEEK_LIST_HEADER_CLASS}>
        <h3 className="text-[14px] font-medium text-foreground">Industries this week</h3>
        <span className="label-meta shrink-0 tabular">{industryTotal} roles</span>
      </div>

      {industries.length === 0 ? (
        <p className="px-3.5 py-4 text-[13px] text-muted-foreground sm:px-4">Nothing this week.</p>
      ) : (
        <ul className="divide-y divide-border">
          {industries.map((row) => (
            <li key={row.industrySlug} className={MARKET_WEEK_LIST_ROW_CLASS}>
              <span className="flex min-w-0 items-center gap-2">
                <IndustryIcon slug={row.industrySlug} />
                <span className="truncate text-[13px] text-foreground">{row.label}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
                <span className="text-[13px] font-medium text-foreground">{row.newCount}</span>
                <span className="text-[11px] text-muted-foreground">
                  {formatPercent(row.newCount, industryTotal)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
