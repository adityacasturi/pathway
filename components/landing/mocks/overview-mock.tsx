"use client";

import { motion } from "framer-motion";
import { StatusDot } from "@/components/status-badge";
import { PostingMetaLine } from "@/components/posting-meta-line";
import type { Status } from "@/types/application";
import {
  MockLogo,
  MockScreen,
  mockEase,
  useCountUp,
  useSceneInView,
} from "@/components/landing/mocks/shared";

const SNAPSHOT: { status: Status; label: string; count: number }[] = [
  { status: "applied", label: "Applied", count: 42 },
  { status: "oa", label: "OA", count: 18 },
  { status: "interview", label: "Interview", count: 9 },
  { status: "offer", label: "Offer", count: 3 },
  { status: "rejected", label: "Rejected", count: 11 },
];

const LATEST = [
  { company: "Jane Street", role: "Quantitative Trader Intern", season: "Summer" as const, age: "2m" },
  { company: "Stripe", role: "Software Engineer Intern", season: "Summer" as const, age: "21m" },
  { company: "Nvidia", role: "Deep Learning Intern", season: "Summer" as const, age: "44m" },
];

function SnapshotCell({
  status,
  label,
  count,
  active,
}: {
  status: Status;
  label: string;
  count: number;
  active: boolean;
}) {
  const value = useCountUp(count, active, 1000);
  return (
    <div className="flex min-h-[4rem] flex-col justify-center rounded-xl border border-border bg-card px-3 py-2.5">
      <span className="mb-1.5 flex items-center gap-1.5">
        <StatusDot status={status} size={6} />
        <span className="figure-label truncate !text-[12px]">{label}</span>
      </span>
      <span className="font-mono text-[1.3rem] leading-none tracking-tight tabular-nums">{value}</span>
    </div>
  );
}

export function OverviewMock() {
  const { ref, active } = useSceneInView<HTMLDivElement>(0.55);

  return (
    <MockScreen label="Overview">
      <div ref={ref} className="flex h-full flex-col gap-4">
        <div>
          <span className="label-micro">This season</span>
          <ul className="mt-2.5 grid grid-cols-5 gap-2">
            {SNAPSHOT.map((cell, i) => (
              <motion.li
                key={cell.status}
                initial={{ opacity: 0, y: 12 }}
                animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
                transition={{ duration: 0.45, delay: 0.3 + i * 0.06, ease: mockEase.out }}
              >
                <SnapshotCell {...cell} active={active} />
              </motion.li>
            ))}
          </ul>
        </div>

        <div className="min-h-0 flex-1">
          <div className="mb-2.5 flex items-baseline gap-3">
            <span className="label-micro">New this week</span>
            <span className="h-px flex-1" style={{ background: "var(--rule)" }} />
          </div>
          <ul className="flex flex-col gap-2">
            {LATEST.map((row, i) => (
              <motion.li
                key={row.company}
                initial={{ opacity: 0, y: 12 }}
                animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
                transition={{ duration: 0.45, delay: 0.6 + i * 0.08, ease: mockEase.out }}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
              >
                <MockLogo company={row.company} size={30} />
                <div className="min-w-0 flex-1">
                  <PostingMetaLine company={row.company} season={row.season} />
                  <p className="mt-1 truncate text-[13px] font-medium text-foreground">{row.role}</p>
                </div>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                  {row.age} ago
                </span>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </MockScreen>
  );
}
