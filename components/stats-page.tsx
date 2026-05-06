import Link from "next/link";
import { ArrowRight, ChartNoAxesCombined, Clock3, Percent, TimerReset, Trophy } from "lucide-react";
import { STATUS_LABELS } from "@/lib/config/events";
import type { Application, EventType, Status } from "@/types/application";

type FlowNode = {
  id: string;
  label: string;
  count: number;
  x: number;
  cy: number;
  color: string;
};

type FlowLink = {
  id: string;
  source: string;
  target: string;
  value: number;
  color: string;
};

type MonthlyCount = {
  key: string;
  label: string;
  count: number;
};

type StageCount = Record<Status, number>;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const BAR_WIDTH = 12;

const FLOW_COLORS = {
  applied: "#9b9993",
  oa: "#4e83bf",
  interview: "#8067c9",
  offer: "#3f9d65",
  rejected: "#c6684a",
  pending: "#b5b3aa",
} as const;

interface Props {
  applications: Application[];
}

function hasEvent(application: Application, eventType: EventType) {
  return application.events.some((event) => event.event_type === eventType);
}

function firstEventDate(application: Application, eventType: EventType) {
  return (
    application.events
      .filter((event) => event.event_type === eventType)
      .sort((a, b) => {
        const byDate = a.event_date.localeCompare(b.event_date);
        if (byDate !== 0) return byDate;
        return a.created_at.localeCompare(b.created_at);
      })[0]?.event_date ?? null
  );
}

function applicationStartDate(application: Application) {
  return firstEventDate(application, "applied") ?? application.created_at.slice(0, 10);
}

function dateToMs(date: string) {
  return new Date(`${date}T00:00:00.000Z`).getTime();
}

function daysBetween(start: string, end: string) {
  return Math.max(0, Math.round(((dateToMs(end) - dateToMs(start)) / MS_PER_DAY) * 10) / 10);
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

function sampleDetail(count: number) {
  return `${count} ${pluralize(count, "application")} sample`;
}

function formatDays(days: number | null) {
  if (days == null) return "n/a";
  const rounded = days < 10 ? Math.round(days * 10) / 10 : Math.round(days);
  return `${rounded}d`;
}

function formatDecimal(value: number | null) {
  if (value == null) return "n/a";
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function formatPercent(numerator: number, denominator: number) {
  if (denominator === 0) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function addMonth(key: string) {
  const [year, month] = key.split("-").map(Number);
  const next = new Date(Date.UTC(year, month, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function buildMonthlyCounts(applications: Application[]): MonthlyCount[] {
  const counts = new Map<string, number>();
  for (const application of applications) {
    const key = monthKey(applicationStartDate(application));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const keys = [...counts.keys()].sort();
  if (keys.length === 0) return [];

  const months: MonthlyCount[] = [];
  let cursor = keys[0];
  const last = keys[keys.length - 1];
  while (cursor <= last) {
    months.push({ key: cursor, label: monthLabel(cursor), count: counts.get(cursor) ?? 0 });
    cursor = addMonth(cursor);
  }

  return months.slice(-12);
}

function firstProgressDate(application: Application) {
  return (
    application.events
      .filter((event) => event.event_type !== "applied" && event.event_type !== "note")
      .sort((a, b) => {
        const byDate = a.event_date.localeCompare(b.event_date);
        if (byDate !== 0) return byDate;
        return a.created_at.localeCompare(b.created_at);
      })[0]?.event_date ?? null
  );
}

function hasProgress(application: Application) {
  return firstProgressDate(application) != null;
}

function hasTerminalDecision(application: Application) {
  return hasEvent(application, "offer") || hasEvent(application, "rejected");
}

function buildStageCounts(applications: Application[]): StageCount {
  return {
    applied: applications.length,
    oa: applications.filter((application) => hasEvent(application, "oa")).length,
    interview: applications.filter((application) => hasEvent(application, "interview")).length,
    offer: applications.filter((application) => hasEvent(application, "offer")).length,
    rejected: applications.filter((application) => hasEvent(application, "rejected")).length,
  };
}

function getOrderedInterviewEvents(application: Application) {
  return application.events
    .filter((event) => event.event_type === "interview")
    .sort((a, b) => {
      if (a.round_number != null && b.round_number != null) {
        const byRound = a.round_number - b.round_number;
        if (byRound !== 0) return byRound;
      }

      const byDate = a.event_date.localeCompare(b.event_date);
      if (byDate !== 0) return byDate;
      return a.created_at.localeCompare(b.created_at);
    });
}

function buildSankey(applications: Application[]) {
  const nodeCounts = new Map<string, number>([
    ["applications", applications.length],
  ]);
  const linkValues = new Map<string, FlowLink>();
  let maxInterviewRounds = 0;

  function addNodeVisit(id: string) {
    nodeCounts.set(id, (nodeCounts.get(id) ?? 0) + 1);
  }

  function addLink(source: string, target: string, color: string) {
    const id = `${source}_${target}`;
    const existing = linkValues.get(id);
    if (existing) {
      existing.value += 1;
      return;
    }

    linkValues.set(id, { id, source, target, value: 1, color });
  }

  for (const application of applications) {
    const hasOa = hasEvent(application, "oa");
    const interviewEvents = getOrderedInterviewEvents(application);
    const hasInterview = interviewEvents.length > 0;
    const hasOffer = hasEvent(application, "offer");
    const hasRejected = hasEvent(application, "rejected");

    maxInterviewRounds = Math.max(maxInterviewRounds, interviewEvents.length);

    if (!hasOa && !hasInterview && !hasOffer && !hasRejected) {
      addNodeVisit("no_response");
      addLink("applications", "no_response", FLOW_COLORS.pending);
      continue;
    }

    if (hasOa) {
      addNodeVisit("oa");
      addLink("applications", "oa", FLOW_COLORS.oa);
    }

    if (hasInterview) {
      let source = hasOa ? "oa" : "applications";
      for (let index = 0; index < interviewEvents.length; index += 1) {
        const roundId = `interview_${index + 1}`;
        addNodeVisit(roundId);
        addLink(source, roundId, FLOW_COLORS.interview);
        source = roundId;
      }

      if (hasOffer) {
        addNodeVisit("offers");
        addLink(source, "offers", FLOW_COLORS.offer);
      } else if (hasRejected) {
        addNodeVisit("rejected");
        addLink(source, "rejected", FLOW_COLORS.rejected);
      }

      continue;
    }

    if (hasOa) {
      if (hasOffer) {
        addNodeVisit("offers");
        addLink("oa", "offers", FLOW_COLORS.offer);
      } else if (hasRejected) {
        addNodeVisit("rejected");
        addLink("oa", "rejected", FLOW_COLORS.rejected);
      }

      continue;
    }

    if (hasOffer) {
      addNodeVisit("offers");
      addLink("applications", "offers", FLOW_COLORS.offer);
      continue;
    }

    if (hasRejected) {
      addNodeVisit("rejected");
      addLink("applications", "rejected", FLOW_COLORS.rejected);
    }
  }

  const terminalX = 650 + Math.max(1, maxInterviewRounds) * 170;
  const allNodes: FlowNode[] = [];

  allNodes.push({
    id: "applications",
    label: "Applications",
    count: applications.length,
    x: 64,
    cy: 300,
    color: FLOW_COLORS.applied,
  });

  allNodes.push({
    id: "no_response",
    label: "No response",
    count: nodeCounts.get("no_response") ?? 0,
    x: terminalX,
    cy: 96,
    color: FLOW_COLORS.pending,
  });

  allNodes.push({
    id: "oa",
    label: "OA",
    count: nodeCounts.get("oa") ?? 0,
    x: 286,
    cy: 318,
    color: FLOW_COLORS.oa,
  });

  for (let round = 1; round <= maxInterviewRounds; round += 1) {
    allNodes.push({
      id: `interview_${round}`,
      label: `Round ${round}`,
      count: nodeCounts.get(`interview_${round}`) ?? 0,
      x: 480 + (round - 1) * 170,
      cy: 318,
      color: FLOW_COLORS.interview,
    });
  }

  allNodes.push({
    id: "offers",
    label: "Offers",
    count: nodeCounts.get("offers") ?? 0,
    x: terminalX,
    cy: 318,
    color: FLOW_COLORS.offer,
  });

  allNodes.push({
    id: "rejected",
    label: "Rejected",
    count: nodeCounts.get("rejected") ?? 0,
    x: terminalX,
    cy: 498,
    color: FLOW_COLORS.rejected,
  });

  const links = [...linkValues.values()].filter((link) => link.value > 0);
  const nodes = allNodes.filter((node) => node.count > 0);

  return { nodes, links };
}

function computeStats(applications: Application[]) {
  const active = applications.filter((application) => !application.archived_at);
  const archivedCount = applications.length - active.length;
  const stageCounts = buildStageCounts(active);
  const monthlyCounts = buildMonthlyCounts(active);
  const positiveSignals = active.filter(
    (application) =>
      hasEvent(application, "oa") ||
      hasEvent(application, "interview") ||
      hasEvent(application, "offer"),
  ).length;
  const daysToOa = active
    .map((application) => {
      const appliedDate = applicationStartDate(application);
      const oaDate = firstEventDate(application, "oa");
      return oaDate ? daysBetween(appliedDate, oaDate) : null;
    })
    .filter((value): value is number => value != null);
  const daysToInterview = active
    .map((application) => {
      const appliedDate = applicationStartDate(application);
      const interviewDate = firstEventDate(application, "interview");
      return interviewDate ? daysBetween(appliedDate, interviewDate) : null;
    })
    .filter((value): value is number => value != null);
  const daysToFirstProgress = active
    .map((application) => {
      const appliedDate = applicationStartDate(application);
      const progressDate = firstProgressDate(application);
      return progressDate ? daysBetween(appliedDate, progressDate) : null;
    })
    .filter((value): value is number => value != null);
  const daysToOffer = active
    .map((application) => {
      const appliedDate = applicationStartDate(application);
      const offerDate = firstEventDate(application, "offer");
      return offerDate ? daysBetween(appliedDate, offerDate) : null;
    })
    .filter((value): value is number => value != null);
  const daysToRejection = active
    .map((application) => {
      const appliedDate = applicationStartDate(application);
      const rejectionDate = firstEventDate(application, "rejected");
      return rejectionDate ? daysBetween(appliedDate, rejectionDate) : null;
    })
    .filter((value): value is number => value != null);
  const interviewRoundCounts = active
    .map((application) => getOrderedInterviewEvents(application).length)
    .filter((count) => count > 0);
  const peakMonth = monthlyCounts.reduce<MonthlyCount | null>(
    (peak, month) => (!peak || month.count > peak.count ? month : peak),
    null,
  );

  return {
    active,
    archivedCount,
    stageCounts,
    monthlyCounts,
    positiveSignals,
    noResponseCount: active.filter((application) => !hasProgress(application)).length,
    inProcessCount: active.filter((application) => hasProgress(application) && !hasTerminalDecision(application)).length,
    avgDaysToOa: average(daysToOa),
    avgDaysToInterview: average(daysToInterview),
    avgDaysToFirstProgress: average(daysToFirstProgress),
    avgDaysToOffer: average(daysToOffer),
    avgDaysToRejection: average(daysToRejection),
    avgInterviewRounds: average(interviewRoundCounts),
    maxInterviewRounds: interviewRoundCounts.length > 0 ? Math.max(...interviewRoundCounts) : 0,
    avgApplicationsPerMonth: monthlyCounts.length > 0 ? average(monthlyCounts.map((month) => month.count)) : null,
    peakMonth,
    oaSampleSize: daysToOa.length,
    interviewSampleSize: daysToInterview.length,
    firstProgressSampleSize: daysToFirstProgress.length,
    offerSampleSize: daysToOffer.length,
    rejectionSampleSize: daysToRejection.length,
    interviewRoundSampleSize: interviewRoundCounts.length,
    sankey: buildSankey(active),
  };
}

function KpiGrid({
  total,
  archivedCount,
  stageCounts,
  positiveSignals,
  avgDaysToOa,
  avgDaysToInterview,
  oaSampleSize,
  interviewSampleSize,
}: {
  total: number;
  archivedCount: number;
  stageCounts: StageCount;
  positiveSignals: number;
  avgDaysToOa: number | null;
  avgDaysToInterview: number | null;
  oaSampleSize: number;
  interviewSampleSize: number;
}) {
  const cards = [
    {
      label: "Active apps",
      value: total.toString(),
      detail: archivedCount > 0 ? `${archivedCount} archived` : "Tracking current search",
      icon: ChartNoAxesCombined,
    },
    {
      label: "Positive signal",
      value: formatPercent(positiveSignals, total),
      detail: `${positiveSignals} reached OA or better`,
      icon: Percent,
    },
    {
      label: "Avg time to OA",
      value: formatDays(avgDaysToOa),
      detail: oaSampleSize > 0 ? sampleDetail(oaSampleSize) : "No OAs yet",
      icon: Clock3,
    },
    {
      label: "Avg time to interview",
      value: formatDays(avgDaysToInterview),
      detail: interviewSampleSize > 0 ? sampleDetail(interviewSampleSize) : "No interviews yet",
      icon: TimerReset,
    },
    {
      label: "Offer rate",
      value: formatPercent(stageCounts.offer, total),
      detail: `${stageCounts.offer} offer${stageCounts.offer === 1 ? "" : "s"}`,
      icon: Trophy,
    },
  ];

  return (
    <section className="mb-14">
      <span className="rule mb-0" />
      <div className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-5" style={{ borderColor: "var(--rule)" }}>
        {cards.map(({ label, value, detail, icon: Icon }) => (
          <div key={label} className="min-h-[138px] p-5 sm:p-6">
            <div className="mb-7 flex items-center justify-between gap-3">
              <span className="figure-label">{label}</span>
              <Icon size={14} strokeWidth={1.75} className="text-muted-foreground" />
            </div>
            <div className="figure-number text-[2.75rem]">{value}</div>
            <p className="mt-3 label-meta">{detail}</p>
          </div>
        ))}
      </div>
      <span className="rule" />
    </section>
  );
}

function sankeyNodeLabel(node: FlowNode) {
  if (node.id === "applications") return pluralize(node.count, "Application");
  if (node.id === "offers") return pluralize(node.count, "Offer");
  return node.label;
}

function SankeyDiagram({ nodes, links, total }: { nodes: FlowNode[]; links: FlowLink[]; total: number }) {
  if (total === 0) {
    return (
      <div className="paper-card flex min-h-[320px] items-center justify-center p-8 text-center">
        <p className="max-w-sm text-[14px] leading-relaxed text-muted-foreground">
          Add applications to build your search flow.
        </p>
      </div>
    );
  }

  const chartWidth = Math.max(1080, Math.max(...nodes.map((node) => node.x)) + 220);
  const nodeUnit = Math.min(15, 220 / total);
  const linkWidth = (value: number) => Math.max(22, Math.min(110, Math.sqrt(value) * 18));
  const nodeById = new Map(
    nodes.map((node) => [
      node.id,
      {
        ...node,
        height: Math.max(36, node.count * nodeUnit),
      },
    ]),
  );
  const linksBySource = new Map<string, FlowLink[]>();
  const linksByTarget = new Map<string, FlowLink[]>();

  for (const link of links) {
    linksBySource.set(link.source, [...(linksBySource.get(link.source) ?? []), link]);
    linksByTarget.set(link.target, [...(linksByTarget.get(link.target) ?? []), link]);
  }

  function stackY(link: FlowLink, side: "source" | "target") {
    const nodeId = side === "source" ? link.source : link.target;
    const node = nodeById.get(nodeId);
    const siblings = side === "source" ? linksBySource.get(nodeId) : linksByTarget.get(nodeId);
    if (!node || !siblings) return 0;

    const stackHeight = siblings.reduce((sum, item) => sum + linkWidth(item.value), 0);
    let offset = 0;
    for (const item of siblings) {
      if (item.id === link.id) break;
      offset += linkWidth(item.value);
    }
    return node.cy - stackHeight / 2 + offset + linkWidth(link.value) / 2;
  }

  function pathFor(link: FlowLink) {
    const source = nodeById.get(link.source);
    const target = nodeById.get(link.target);
    if (!source || !target) return "";

    const sx = source.x + BAR_WIDTH;
    const tx = target.x;
    const sy = stackY(link, "source");
    const ty = stackY(link, "target");
    const curve = Math.max(80, Math.abs(tx - sx) * 0.48);
    return `M ${sx} ${sy} C ${sx + curve} ${sy}, ${tx - curve} ${ty}, ${tx} ${ty}`;
  }

  return (
    <div className="paper-card overflow-x-auto p-4 sm:p-6">
      <svg
        role="img"
        aria-label="Internship search Sankey diagram"
        viewBox={`0 0 ${chartWidth} 620`}
        className="h-[520px] w-full"
        style={{ minWidth: chartWidth }}
      >
        <g fill="none">
          {links.map((link) => (
            <path
              key={link.id}
              d={pathFor(link)}
              stroke={link.color}
              strokeLinecap="butt"
              strokeWidth={linkWidth(link.value)}
              opacity={link.target === "no_response" ? 0.18 : 0.34}
            />
          ))}
        </g>
        <g>
          {[...nodeById.values()].map((node) => {
            const labelX = node.x + BAR_WIDTH / 2;
            const labelY = node.cy + node.height / 2 + 24;
            return (
              <g key={node.id}>
                <rect
                  x={node.x}
                  y={node.cy - node.height / 2}
                  width={BAR_WIDTH}
                  height={node.height}
                  rx={3}
                  fill={node.color}
                />
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  <tspan
                    x={labelX}
                    style={{
                      fill: "var(--ink)",
                      fontSize: 15,
                      fontWeight: 650,
                      letterSpacing: 0,
                    }}
                  >
                    {node.count}
                  </tspan>
                  <tspan
                    x={labelX}
                    dy="1.45em"
                    style={{
                      fill: "var(--ink)",
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: 0,
                      opacity: 0.68,
                    }}
                  >
                    {sankeyNodeLabel(node)}
                  </tspan>
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

function MonthlyApplicationsChart({ months }: { months: MonthlyCount[] }) {
  const max = Math.max(1, ...months.map((month) => month.count));

  return (
    <section className="paper-card p-5 sm:p-6">
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <div>
          <span className="label-micro">02 / Volume</span>
          <h2 className="mt-3 display-serif text-[24px] text-foreground">Applications / Month</h2>
        </div>
        <span className="label-meta">Last 12 months</span>
      </div>

      {months.length === 0 ? (
        <p className="py-12 text-center text-[14px] text-muted-foreground">No application dates yet.</p>
      ) : (
        <ul className="space-y-3">
          {months.map((month) => (
            <li key={month.key} className="grid grid-cols-[4.75rem_minmax(0,1fr)_2.5rem] items-center gap-3">
              <span className="label-meta text-foreground">{month.label}</span>
              <span className="h-2 overflow-hidden rounded-[3px] bg-[color-mix(in_oklab,var(--ink)_6%,transparent)]">
                <span
                  className="block h-full rounded-[3px] bg-primary"
                  style={{ width: `${Math.max(month.count === 0 ? 0 : 5, (month.count / max) * 100)}%` }}
                />
              </span>
              <span className="label-meta text-right tabular text-foreground">{month.count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StageConversion({ stageCounts, total }: { stageCounts: StageCount; total: number }) {
  const stages: Status[] = ["oa", "interview", "offer", "rejected"];
  const stageColor = (stage: Status) => {
    if (stage === "oa") return FLOW_COLORS.oa;
    if (stage === "interview") return FLOW_COLORS.interview;
    if (stage === "offer") return FLOW_COLORS.offer;
    return FLOW_COLORS.rejected;
  };

  return (
    <section className="paper-card p-5 sm:p-6">
      <div className="mb-6">
        <span className="label-micro">03 / Conversion</span>
        <h2 className="mt-3 display-serif text-[24px] text-foreground">Stage Rates</h2>
      </div>
      <ul className="divide-y" style={{ borderColor: "var(--rule)" }}>
        {stages.map((stage) => (
          <li key={stage} className="grid grid-cols-[minmax(0,1fr)_4rem_4rem] items-center gap-3 py-4 first:pt-0 last:pb-0">
            <Link href={`/applications?status=${stage}`} className="group min-w-0">
              <span className="flex items-center gap-2 text-[14px] font-medium text-foreground">
                <span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: stageColor(stage) }}
                />
                <span className="truncate">{STATUS_LABELS[stage]}</span>
                <ArrowRight size={12} strokeWidth={1.75} className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </span>
            </Link>
            <span className="label-meta tabular text-right text-foreground">{stageCounts[stage]}</span>
            <span className="label-meta tabular text-right">{formatPercent(stageCounts[stage], total)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SearchSnapshot({
  total,
  noResponseCount,
  inProcessCount,
  avgDaysToFirstProgress,
  avgDaysToOffer,
  avgDaysToRejection,
  avgInterviewRounds,
  maxInterviewRounds,
  avgApplicationsPerMonth,
  peakMonth,
  firstProgressSampleSize,
  offerSampleSize,
  rejectionSampleSize,
}: {
  total: number;
  noResponseCount: number;
  inProcessCount: number;
  avgDaysToFirstProgress: number | null;
  avgDaysToOffer: number | null;
  avgDaysToRejection: number | null;
  avgInterviewRounds: number | null;
  maxInterviewRounds: number;
  avgApplicationsPerMonth: number | null;
  peakMonth: MonthlyCount | null;
  firstProgressSampleSize: number;
  offerSampleSize: number;
  rejectionSampleSize: number;
}) {
  const stats = [
    {
      label: "No response",
      value: noResponseCount.toString(),
      detail: `${formatPercent(noResponseCount, total)} of active apps`,
    },
    {
      label: "In process",
      value: inProcessCount.toString(),
      detail: "Progress signal, no final decision",
    },
    {
      label: "Avg first response",
      value: formatDays(avgDaysToFirstProgress),
      detail: firstProgressSampleSize > 0 ? sampleDetail(firstProgressSampleSize) : "No responses yet",
    },
    {
      label: "Avg time to offer",
      value: formatDays(avgDaysToOffer),
      detail: offerSampleSize > 0 ? sampleDetail(offerSampleSize) : "No offers yet",
    },
    {
      label: "Avg time to rejection",
      value: formatDays(avgDaysToRejection),
      detail: rejectionSampleSize > 0 ? sampleDetail(rejectionSampleSize) : "No rejections yet",
    },
    {
      label: "Interview depth",
      value: maxInterviewRounds > 0 ? `${maxInterviewRounds} ${pluralize(maxInterviewRounds, "round")}` : "n/a",
      detail: avgInterviewRounds != null ? `${formatDecimal(avgInterviewRounds)} avg rounds` : "No interviews yet",
    },
    {
      label: "Avg apps / month",
      value: formatDecimal(avgApplicationsPerMonth),
      detail: "Across months shown",
    },
    {
      label: "Peak month",
      value: peakMonth?.label ?? "n/a",
      detail: peakMonth ? `${peakMonth.count} ${pluralize(peakMonth.count, "application")}` : "No dates yet",
    },
  ];

  return (
    <section className="paper-card p-5 sm:p-6">
      <div className="mb-2">
        <span className="label-micro">04 / Snapshot</span>
        <h2 className="mt-3 display-serif text-[24px] text-foreground">Search Snapshot</h2>
      </div>
      <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <li key={stat.label} className="border-t py-5" style={{ borderColor: "var(--rule)" }}>
            <span className="label-meta">{stat.label}</span>
            <div className="mt-3 text-[24px] font-medium leading-none tracking-[-0.035em] text-foreground tabular">
              {stat.value}
            </div>
            <p className="mt-3 label-meta">{stat.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function StatsPage({ applications }: Props) {
  const {
    active,
    archivedCount,
    stageCounts,
    monthlyCounts,
    positiveSignals,
    noResponseCount,
    inProcessCount,
    avgDaysToOa,
    avgDaysToInterview,
    avgDaysToFirstProgress,
    avgDaysToOffer,
    avgDaysToRejection,
    avgInterviewRounds,
    maxInterviewRounds,
    avgApplicationsPerMonth,
    peakMonth,
    oaSampleSize,
    interviewSampleSize,
    firstProgressSampleSize,
    offerSampleSize,
    rejectionSampleSize,
    sankey,
  } = computeStats(applications);

  return (
    <div className="page-shell min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 pt-24 sm:pt-28 lg:pt-32 pb-24">
        <header className="masthead mb-12">
          <div className="flex items-baseline justify-between pb-4">
            <span className="label-micro">Launchpad / Stats</span>
            <span className="label-meta hidden sm:inline">{active.length} active / {archivedCount} archived</span>
          </div>
          <span className="rule-strong" />
          <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <h1 className="display-serif text-[4.5rem] sm:text-[5.75rem] lg:text-[6.5rem] text-foreground">
                Stats
              </h1>
              <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
                A cleaner read on volume, timing, and where applications fall out of the funnel.
              </p>
            </div>
            <Link
              href="/applications"
              className="group inline-flex h-11 items-center gap-2 self-start rounded-md border px-5 text-[13px] font-medium text-foreground transition-colors hover:border-rule-strong"
              style={{ borderColor: "var(--rule)" }}
            >
              Open pipeline
              <ArrowRight size={14} strokeWidth={1.75} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </header>

        <KpiGrid
          total={active.length}
          archivedCount={archivedCount}
          stageCounts={stageCounts}
          positiveSignals={positiveSignals}
          avgDaysToOa={avgDaysToOa}
          avgDaysToInterview={avgDaysToInterview}
          oaSampleSize={oaSampleSize}
          interviewSampleSize={interviewSampleSize}
        />

        <section className="mb-12">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="label-micro">01 / Flow</span>
              <h2 className="mt-3 display-serif text-[30px] text-foreground">Search Sankey</h2>
            </div>
            <span className="label-meta">{active.length} active applications</span>
          </div>
          <SankeyDiagram nodes={sankey.nodes} links={sankey.links} total={active.length} />
        </section>

        <div className="grid gap-5 lg:grid-cols-[1.12fr_0.88fr]">
          <MonthlyApplicationsChart months={monthlyCounts} />
          <StageConversion stageCounts={stageCounts} total={active.length} />
        </div>

        <div className="mt-5">
          <SearchSnapshot
            total={active.length}
            noResponseCount={noResponseCount}
            inProcessCount={inProcessCount}
            avgDaysToFirstProgress={avgDaysToFirstProgress}
            avgDaysToOffer={avgDaysToOffer}
            avgDaysToRejection={avgDaysToRejection}
            avgInterviewRounds={avgInterviewRounds}
            maxInterviewRounds={maxInterviewRounds}
            avgApplicationsPerMonth={avgApplicationsPerMonth}
            peakMonth={peakMonth}
            firstProgressSampleSize={firstProgressSampleSize}
            offerSampleSize={offerSampleSize}
            rejectionSampleSize={rejectionSampleSize}
          />
        </div>
      </main>
    </div>
  );
}
