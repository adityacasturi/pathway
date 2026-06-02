"use client";

import { motion } from "framer-motion";
import {
  MockLogo,
  MockScreen,
  mockEase,
  useCountUp,
  useSceneInView,
} from "@/components/landing/mocks/shared";

const CONVERSIONS = [
  { label: "Response rate", value: 41, suffix: "%" },
  { label: "Interview rate", value: 27, suffix: "%" },
  { label: "Offer rate", value: 9, suffix: "%" },
];

const TOP_COMPANIES = [
  { company: "Nvidia", count: 14 },
  { company: "Citadel", count: 11 },
  { company: "Jane Street", count: 9 },
  { company: "Stripe", count: 7 },
];

const HIRING_COLOR = "oklch(0.62 0.14 145)";

function Conversion({ label, value, suffix, active }: { label: string; value: number; suffix: string; active: boolean }) {
  const display = useCountUp(value, active, 1100);
  return (
    <div className="figure rounded-xl border border-border bg-card px-4 py-3.5">
      <span className="figure-number !text-[2rem]">
        {display}
        {suffix}
      </span>
      <span className="figure-label">{label}</span>
    </div>
  );
}

function TopCompanyRow({ company, count, active }: { company: string; count: number; active: boolean }) {
  const display = useCountUp(count, active, 1000);
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
      <MockLogo company={company} size={28} />
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{company}</span>
      <span className="inline-flex items-center gap-1.5 font-mono text-[12px] tabular-nums text-foreground">
        <span
          className="block size-1.5 rounded-full"
          style={{
            backgroundColor: HIRING_COLOR,
            boxShadow: `0 0 0 1px color-mix(in oklab, ${HIRING_COLOR} 30%, transparent), 0 0 8px color-mix(in oklab, ${HIRING_COLOR} 45%, transparent)`,
          }}
        />
        +{display} new
      </span>
    </div>
  );
}

export function InsightsMock() {
  const { ref, active } = useSceneInView<HTMLDivElement>(0.55);

  return (
    <MockScreen label="Insights">
      <div ref={ref} className="flex h-full flex-col gap-4">
        <div>
          <span className="label-micro">Conversion this season</span>
          <ul className="mt-2.5 grid grid-cols-3 gap-2">
            {CONVERSIONS.map((c, i) => (
              <motion.li
                key={c.label}
                initial={{ opacity: 0, y: 12 }}
                animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
                transition={{ duration: 0.45, delay: 0.3 + i * 0.07, ease: mockEase.out }}
              >
                <Conversion {...c} active={active} />
              </motion.li>
            ))}
          </ul>
        </div>

        <div className="min-h-0 flex-1">
          <div className="mb-2.5 flex items-baseline gap-3">
            <span className="label-micro">Top companies this week</span>
            <span className="h-px flex-1" style={{ background: "var(--rule)" }} />
          </div>
          <ul className="flex flex-col gap-2">
            {TOP_COMPANIES.map((row, i) => (
              <motion.li
                key={row.company}
                initial={{ opacity: 0, y: 12 }}
                animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
                transition={{ duration: 0.45, delay: 0.5 + i * 0.08, ease: mockEase.out }}
              >
                <TopCompanyRow {...row} active={active} />
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </MockScreen>
  );
}
