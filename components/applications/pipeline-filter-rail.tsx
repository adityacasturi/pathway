"use client";

import { useMemo } from "react";
import { countApplicationsByReachedStatus } from "@/lib/applications/pipeline-counts";
import { STATUSES, STATUS_LABELS } from "@/lib/config/events";
import { FilterPill, Toolbar } from "@/components/design-system/toolbar";
import { StatusDot } from "@/components/status-badge";
import type { Application, Status } from "@/types/application";

type StatusFilter = "all" | Status;

export function PipelineFilterRail({
  applications,
  statusFilter,
  onStatusFilterChange,
}: {
  applications: Application[];
  statusFilter: StatusFilter;
  onStatusFilterChange: (status: StatusFilter) => void;
}) {
  const counts = useMemo(
    () => countApplicationsByReachedStatus(applications),
    [applications],
  );

  return (
    <Toolbar
      className="scrollbar-none shrink-0 overflow-x-auto border-b border-border px-6 py-2.5"
      aria-label="Filter by pipeline stage"
    >
      <FilterPill
        active={statusFilter === "all"}
        onClick={() => onStatusFilterChange("all")}
      >
        All
        <span className="tabular-nums text-muted-foreground">{applications.length}</span>
      </FilterPill>
      {STATUSES.map((status) => (
        <FilterPill
          key={status}
          active={statusFilter === status}
          onClick={() =>
            onStatusFilterChange(statusFilter === status ? "all" : status)
          }
        >
          <StatusDot status={status} size={6} />
          {STATUS_LABELS[status]}
          <span className="tabular-nums text-muted-foreground">{counts[status]}</span>
        </FilterPill>
      ))}
    </Toolbar>
  );
}
