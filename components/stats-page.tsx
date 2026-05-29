"use client";

import Link from "next/link";
import { sankey, sankeyJustify } from "d3-sankey";
import { motion } from "framer-motion";
import { ArrowRight, ChartNoAxesCombined, Clock3, Percent, TimerReset, Trophy } from "lucide-react";
import { STATUS_LABELS } from "@/lib/config/events";
import {
  computeStats,
  FLOW_COLORS,
  FlowLink,
  FlowNode,
  formatDays,
  formatDecimal,
  formatPercent,
  MonthlyCount,
  pluralize,
  sampleDetail,
  StageCount,
} from "@/lib/stats/applications";
import { motionVariants } from "@/lib/ui/motion";
import { PageHeader, PageMain, PageSection, PageShell } from "@/components/ui/page";
import type { Application, Status } from "@/types/application";

const SANKEY_HEIGHT = 760;
const SANKEY_NODE_WIDTH = 14;
const SANKEY_NODE_PADDING = 64;

type PositionedSankeyNode = FlowNode & {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
};

interface Props {
  applications: Application[];
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
      detail: archivedCount > 0 ? `${archivedCount} archived` : "—",
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

function sankeyNodeOrder(id: string) {
  if (id === "no_response") return 0;
  if (id === "applications") return 1;
  if (id === "oa") return 2;
  if (id.startsWith("interview_")) return 2 + Number(id.replace("interview_", ""));
  if (id === "offers") return 100;
  if (id === "rejected") return 101;
  return 50;
}

function isTerminalSankeyNode(id: string) {
  return id === "no_response" || id === "offers" || id === "rejected";
}

function isStageSankeyNode(id: string) {
  return id === "oa" || id.startsWith("interview_");
}

function SankeyDiagram({ nodes, links, total }: { nodes: FlowNode[]; links: FlowLink[]; total: number }) {
  if (total === 0) {
    return (
      <div className="paper-card flex min-h-[320px] items-center justify-center p-8 text-center">
        <p className="text-[14px] text-muted-foreground">No applications yet.</p>
      </div>
    );
  }

  const chartWidth = Math.max(920, Math.max(...nodes.map((node) => node.x), 0) + 220);
  const graph = sankey<FlowNode, FlowLink>()
    .nodeId((node) => node.id)
    .nodeAlign(sankeyJustify)
    .nodeWidth(SANKEY_NODE_WIDTH)
    .nodePadding(SANKEY_NODE_PADDING)
    .nodeSort((a, b) => sankeyNodeOrder(a.id) - sankeyNodeOrder(b.id))
    .extent([[160, 56], [chartWidth - 200, SANKEY_HEIGHT - 76]])({
      nodes: nodes.map((node) => ({ ...node })),
      links: links.map((link) => ({ ...link })),
    });
  const outgoingCounts = new Map<string, number>();

  for (const link of graph.links) {
    const sourceId = typeof link.source === "string" ? link.source : (link.source as FlowNode).id;
    outgoingCounts.set(sourceId, (outgoingCounts.get(sourceId) ?? 0) + 1);
  }

  function ribbonPath(link: (typeof graph.links)[number]) {
    const source = link.source as unknown as PositionedSankeyNode;
    const target = link.target as unknown as PositionedSankeyNode;
    const sourceHeight = Math.max(1, source.y1 - source.y0);
    const baseWidth = Math.max(1, link.width ?? 1);
    const shouldTaperFromSource =
      isStageSankeyNode(source.id) &&
      (outgoingCounts.get(source.id) ?? 0) === 1 &&
      sourceHeight > baseWidth + 1;
    const x0 = source.x1;
    const x1 = target.x0;
    const y0 = shouldTaperFromSource
      ? (source.y0 + source.y1) / 2
      : link.y0 ?? 0;
    const y1 = link.y1 ?? 0;
    const w0 = shouldTaperFromSource ? sourceHeight : baseWidth;
    const w1 = baseWidth;
    const curve = Math.max(80, Math.abs(x1 - x0) * 0.48);

    return [
      `M ${x0} ${y0 - w0 / 2}`,
      `C ${x0 + curve} ${y0 - w0 / 2}, ${x1 - curve} ${y1 - w1 / 2}, ${x1} ${y1 - w1 / 2}`,
      `L ${x1} ${y1 + w1 / 2}`,
      `C ${x1 - curve} ${y1 + w1 / 2}, ${x0 + curve} ${y0 + w0 / 2}, ${x0} ${y0 + w0 / 2}`,
      "Z",
    ].join(" ");
  }

  return (
    <div className="paper-card overflow-hidden p-4 sm:p-6">
      <svg
        role="img"
        aria-label="Internship search Sankey diagram"
        viewBox={`0 0 ${chartWidth} ${SANKEY_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        className="mx-auto block h-auto max-h-[min(640px,72vh)] w-full"
      >
        <g fill="none">
          {graph.links.map((link) => {
            const target = typeof link.target === "string" ? link.target : (link.target as FlowNode).id;
            return (
              <path
                key={link.id}
                d={ribbonPath(link)}
                fill={link.color}
                opacity={target === "no_response" ? 0.14 : target === "rejected" ? 0.28 : 0.38}
              />
            );
          })}
        </g>
        <g>
          {graph.nodes.map((node) => {
            const x0 = node.x0 ?? 0;
            const x1 = node.x1 ?? x0 + SANKEY_NODE_WIDTH;
            const y0 = node.y0 ?? 0;
            const y1 = node.y1 ?? y0;
            const centerX = x0 + (x1 - x0) / 2;
            const centerY = y0 + (y1 - y0) / 2;
            const start = node.id === "applications";
            const terminal = isTerminalSankeyNode(node.id);
            const labelX = start ? x0 - 18 : terminal ? x1 + 18 : centerX;
            const labelY = start || terminal ? centerY - 10 : Math.max(24, y0 - 24);
            const textAnchor = start ? "end" : terminal ? "start" : "middle";
            return (
              <g key={node.id}>
                <rect
                  x={x0}
                  y={y0}
                  width={x1 - x0}
                  height={Math.max(1, y1 - y0)}
                  rx={3}
                  fill={node.color}
                />
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor={textAnchor}
                  style={{
                    fontFamily: "var(--font-sans)",
                    paintOrder: "stroke",
                    stroke: "var(--background)",
                    strokeLinejoin: "round",
                    strokeWidth: 5,
                  }}
                >
                  <tspan
                    x={labelX}
                    style={{
                      fill: "var(--ink)",
                      fontSize: 16,
                      fontWeight: 650,
                      letterSpacing: 0,
                    }}
                  >
                    {node.count}
                  </tspan>
                  <tspan
                    x={labelX}
                    dy="1.35em"
                    style={{
                      fill: "var(--ink)",
                      fontSize: 12.5,
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
          <h2 className="display-serif text-[24px] text-foreground">Applications / month</h2>
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
        <h2 className="display-serif text-[24px] text-foreground">Stage rates</h2>
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
      detail: "No final outcome yet",
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
        <h2 className="display-serif text-[24px] text-foreground">Snapshot</h2>
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
    <PageShell>
      <PageMain width="xl">
        <motion.div variants={motionVariants.riseIn} initial="hidden" animate="visible">
          <PageHeader
            title="Stats"
            actions={
              <Link
                href="/applications"
                className="group inline-flex h-11 items-center gap-2 self-start rounded-md border px-5 text-[13px] font-medium text-foreground transition-colors hover:border-rule-strong"
                style={{ borderColor: "var(--rule)" }}
              >
                Open pipeline
                <ArrowRight size={14} strokeWidth={1.75} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            }
          />
        </motion.div>

        <motion.div
          variants={motionVariants.fadeIn}
          initial="hidden"
          animate="visible"
        >
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

          <PageSection
            title="Pipeline flow"
            meta={`${active.length} active`}
            className="mb-12"
            contentClassName="pt-1"
            rule={false}
          >
            <SankeyDiagram nodes={sankey.nodes} links={sankey.links} total={active.length} />
          </PageSection>

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
        </motion.div>
      </PageMain>
    </PageShell>
  );
}
