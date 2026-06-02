"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  countApplicationsByReachedStatus,
  formatPipelineReachFigure,
} from "@/lib/applications/pipeline-counts";
import { STATUSES, STATUS_LABELS } from "@/lib/config/events";
import { statusSurfaceStyle, StatusDot } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import type { Application, Status } from "@/types/application";

type StatusFilter = "all" | Status;

interface Props {
  applications: Application[];
  statusFilter: StatusFilter;
  onStatusFilterChange: (status: StatusFilter) => void;
}

export function ApplicationPipelineSummary({
  applications,
  statusFilter,
  onStatusFilterChange,
}: Props) {
  const counts = useMemo(
    () => countApplicationsByReachedStatus(applications),
    [applications],
  );

  return (
    <nav aria-label="Application pipeline summary">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {STATUSES.map((status) => (
          <li key={status} className="min-w-0">
            <PipelineSummaryCell
              status={status}
              active={statusFilter === status}
              label={STATUS_LABELS[status]}
              count={counts[status]}
              onClick={() =>
                onStatusFilterChange(statusFilter === status ? "all" : status)
              }
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function PipelineSummaryCell({
  status,
  label,
  count,
  percentTotal,
  active = false,
  href,
  onClick,
}: {
  status: Status;
  label: string;
  count: number;
  /** When set, the large figure shows `count (N%)` of this total. */
  percentTotal?: number;
  active?: boolean;
  href?: string;
  onClick?: () => void;
}) {
  const className = cn(
    "flex min-h-[4.25rem] w-full flex-col justify-center rounded-xl border px-3.5 py-3 text-left transition-[border-color,background-color,box-shadow] sm:min-h-[4.5rem] sm:px-4",
    active
      ? "text-foreground"
      : "border-border bg-card text-foreground hover:border-[color:var(--rule-strong)] hover:bg-[color-mix(in_oklab,var(--ink)_2%,var(--card))]",
  );
  const style = active ? statusSurfaceStyle(status) : undefined;
  const content = (
    <>
      <span className="mb-1.5 flex items-center gap-2">
        <StatusDot status={status} size={6} />
        <span className="figure-label truncate">{label}</span>
      </span>
      <span className="font-mono text-[1.35rem] leading-none tracking-tight tabular-nums sm:text-[1.5rem]">
        {percentTotal != null && status !== "applied"
          ? formatPipelineReachFigure(count, percentTotal)
          : count.toLocaleString("en-US")}
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} style={style} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={style}
      className={className}
    >
      {content}
    </button>
  );
}
