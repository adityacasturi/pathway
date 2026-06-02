"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Star } from "lucide-react";
import {
  MockLogo,
  MockScreen,
  MockToolbar,
  mockEase,
  useSceneInView,
} from "@/components/landing/mocks/shared";

const HIRING_COLOR = "oklch(0.62 0.14 145)";

type Company = { name: string; openCount: number; starred?: boolean; bump?: number };

const COMPANIES: Company[] = [
  { name: "Jane Street", openCount: 4, starred: true, bump: 6 },
  { name: "Citadel", openCount: 7 },
  { name: "Google", openCount: 9, starred: true },
  { name: "Hudson River Trading", openCount: 3 },
  { name: "Stripe", openCount: 3, bump: 5 },
  { name: "Nvidia", openCount: 11, starred: true },
  { name: "Two Sigma", openCount: 5 },
  { name: "Databricks", openCount: 8 },
];

function CompanyCardMock({ company, active }: { company: Company; active: boolean }) {
  const [count, setCount] = useState(company.openCount);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!active || company.bump == null) return;
    const t = setTimeout(() => {
      setCount(company.bump!);
      setPulse(true);
    }, 1600);
    const p = setTimeout(() => setPulse(false), 2500);
    return () => {
      clearTimeout(t);
      clearTimeout(p);
    };
  }, [active, company.bump]);

  return (
    <div className="flex h-[76px] w-full items-stretch gap-1 rounded-lg border border-border bg-card">
      <div className="flex min-w-0 flex-1 items-center gap-3 p-3.5 pr-2">
        <MockLogo company={company.name} size={42} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium leading-snug text-foreground">{company.name}</p>
          <p className="label-meta mt-1 flex items-center gap-1.5 tabular-nums text-foreground">
            <span className="inline-flex items-center justify-center px-0.5">
              <motion.span
                className="block size-1.5 rounded-full"
                animate={pulse ? { scale: [1, 1.6, 1] } : { scale: 1 }}
                transition={{ duration: 0.6, repeat: pulse ? 1 : 0 }}
                style={{
                  backgroundColor: HIRING_COLOR,
                  boxShadow: `0 0 0 1px color-mix(in oklab, ${HIRING_COLOR} 30%, transparent), 0 0 8px color-mix(in oklab, ${HIRING_COLOR} 45%, transparent)`,
                }}
              />
            </span>
            <span>{count} openings</span>
          </p>
        </div>
      </div>
      <span
        className={
          "inline-flex w-10 shrink-0 items-center justify-center rounded-r-lg " +
          (company.starred ? "text-foreground/30" : "text-muted-foreground/50")
        }
      >
        <Star size={15} strokeWidth={1.85} fill={company.starred ? "currentColor" : "none"} />
      </span>
    </div>
  );
}

export function CompaniesMock() {
  const { ref, active } = useSceneInView<HTMLDivElement>(0.55);

  return (
    <MockScreen label="Companies">
      <div ref={ref} className="flex h-full flex-col">
        <MockToolbar placeholder="Search 400+ companies…" count="392 watched" />
        <ul className="grid grid-cols-2 gap-2">
          {COMPANIES.map((company, i) => (
            <motion.li
              key={company.name}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={active ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.45, delay: 0.3 + i * 0.06, ease: mockEase.out }}
            >
              <CompanyCardMock company={company} active={active} />
            </motion.li>
          ))}
        </ul>
      </div>
    </MockScreen>
  );
}
