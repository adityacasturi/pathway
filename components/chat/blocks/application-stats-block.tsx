"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ChatInsetCard } from "@/components/chat/chat-panel";
import { StatusDot } from "@/components/status-badge";
import { STATUSES, STATUS_LABELS } from "@/lib/config/events";
import type { ChatApplicationStatsResult } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

export function ApplicationStatsBlock({ result }: { result: ChatApplicationStatsResult }) {
  const { activeCount, archivedCount, stageCounts } = result;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">Your pipeline</p>
        <Link
          href="/applications"
          className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary opacity-80 transition-opacity hover:opacity-100"
        >
          Applications
          <ArrowUpRight size={12} aria-hidden />
        </Link>
      </div>

      <ChatInsetCard className="space-y-4 p-4">
        <div>
          <p className="text-2xl font-semibold tabular-nums text-foreground">{activeCount}</p>
          <p className="text-xs text-muted-foreground">
            active {activeCount === 1 ? "application" : "applications"}
            {archivedCount > 0 ? ` · ${archivedCount} archived` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2" aria-label="Pipeline stages">
          {STATUSES.map((status) => (
            <div
              key={status}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs",
                "border-[color-mix(in_oklab,var(--primary)_12%,var(--border))]",
                "bg-[color-mix(in_oklab,var(--primary)_3%,var(--card))]",
              )}
            >
              <StatusDot status={status} size={6} />
              <span className="text-muted-foreground">{STATUS_LABELS[status]}</span>
              <span className="font-medium tabular-nums text-foreground">{stageCounts[status]}</span>
            </div>
          ))}
        </div>
      </ChatInsetCard>
    </div>
  );
}
