"use client";

import { useMemo } from "react";
import { PipelineSummaryCell } from "@/components/application-pipeline-summary";
import { countApplicationsByReachedStatus } from "@/lib/applications/pipeline-counts";
import { STATUSES, STATUS_LABELS } from "@/lib/config/events";
import type { Application } from "@/types/application";

interface Props {
  applications: Application[];
  /** Show `count (N%)` reach figures (stats pipeline). */
  showReachPercent?: boolean;
}

export function HomeSnapshot({ applications, showReachPercent = false }: Props) {
  const counts = useMemo(
    () => countApplicationsByReachedStatus(applications),
    [applications],
  );
  const percentTotal = showReachPercent ? applications.length : undefined;

  return (
    <nav aria-label="Application snapshot">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {STATUSES.map((status) => (
          <li key={status} className="min-w-0">
            <PipelineSummaryCell
              status={status}
              label={STATUS_LABELS[status]}
              count={counts[status]}
              percentTotal={percentTotal}
              href={`/applications?status=${status}`}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}
