"use client";

import { sankey, sankeyJustify } from "d3-sankey";
import type { FlowLink, FlowNode } from "@/lib/stats/applications";
import { pluralize } from "@/lib/stats/applications";

const SANKEY_HEIGHT = 760;
const SANKEY_NODE_WIDTH = 14;
const SANKEY_NODE_PADDING = 64;

type PositionedSankeyNode = FlowNode & {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
};

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

export function SankeyDiagram({
  nodes,
  links,
  total,
}: {
  nodes: FlowNode[];
  links: FlowLink[];
  total: number;
}) {
  if (total === 0) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-[15px] text-muted-foreground">No applications yet.</p>
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
    const y0 = shouldTaperFromSource ? (source.y0 + source.y1) / 2 : (link.y0 ?? 0);
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
    <div className="overflow-hidden rounded-xl border border-border bg-card p-4 sm:p-6">
      <svg
        role="img"
        aria-label="Application pipeline Sankey diagram"
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
