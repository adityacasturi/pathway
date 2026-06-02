"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { StatusBadge } from "@/components/status-badge";
import { PostingMetaLine } from "@/components/posting-meta-line";
import type { Status } from "@/types/application";
import { cn } from "@/lib/utils";
import {
  FakeCursor,
  MockLogo,
  MockScreen,
  MockToolbar,
  mockEase,
  useSceneInView,
} from "@/components/landing/mocks/shared";

type Row = {
  company: string;
  role: string;
  location: string;
  activity: string;
  season: "Summer" | "Fall";
  status: Status;
};

const ROWS: Row[] = [
  { company: "Stripe", role: "Software Engineer Intern", location: "Seattle, WA", activity: "Oct 3", season: "Summer", status: "interview" },
  { company: "Databricks", role: "Software Engineer Intern", location: "San Francisco, CA", activity: "Oct 1", season: "Summer", status: "oa" },
  { company: "Ramp", role: "Product Engineer Intern", location: "New York, NY", activity: "Sep 28", season: "Summer", status: "applied" },
  { company: "Nvidia", role: "Deep Learning Intern", location: "Santa Clara, CA", activity: "Sep 24", season: "Summer", status: "interview" },
  { company: "Citadel", role: "Software Engineer Intern", location: "Chicago, IL", activity: "Sep 20", season: "Summer", status: "rejected" },
];

export function ApplicationsMock() {
  const { ref, active, reduced } = useSceneInView<HTMLDivElement>(0.55);
  // A fake cursor glides onto the Stripe row and clicks. The status then
  // advances from "interview" to "offer".
  const [promotedTimed, setPromotedTimed] = useState(false);
  const [clicking, setClicking] = useState(false);
  const [cursorGone, setCursorGone] = useState(false);

  useEffect(() => {
    if (!active || reduced) return;
    const click = setTimeout(() => setClicking(true), 1600);
    const promote = setTimeout(() => setPromotedTimed(true), 1760);
    const unclick = setTimeout(() => setClicking(false), 2150);
    // Cursor glides back out once it has clicked the offer.
    const leave = setTimeout(() => setCursorGone(true), 2350);
    return () => {
      clearTimeout(click);
      clearTimeout(promote);
      clearTimeout(unclick);
      clearTimeout(leave);
    };
  }, [active, reduced]);

  const promoted = active && (reduced || promotedTimed);

  return (
    <MockScreen label="Applications">
      <div ref={ref} className="flex h-full flex-col">
        <MockToolbar placeholder="Search applications…" count="83 total" />
        <ul className="flex flex-col gap-2">
          {ROWS.map((row, i) => {
            const status = row.company === "Stripe" && promoted ? "offer" : row.status;
            const justPromoted = row.company === "Stripe" && promoted;
            return (
              <motion.li
                key={row.company}
                initial={{ opacity: 0, y: 12 }}
                animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
                transition={{ duration: 0.45, delay: 0.3 + i * 0.07, ease: mockEase.out }}
                className={cn("relative", justPromoted && "lp-feed-flash rounded-lg")}
              >
                <div className="flex items-center gap-3.5 rounded-lg border border-border bg-card px-3.5 py-3">
                  <MockLogo company={row.company} size={34} />
                  <div className="min-w-0 flex-1">
                    <PostingMetaLine company={row.company} season={row.season} />
                    <p className="mt-1 truncate text-[14px] font-medium text-foreground">{row.role}</p>
                  </div>
                  <div className="hidden min-w-0 shrink-0 flex-col items-end gap-0.5 text-right sm:flex">
                    <span className="truncate text-[12px] text-foreground/72">{row.location}</span>
                    <span className="truncate font-mono text-[11px] tabular-nums text-muted-foreground">
                      {row.activity}
                    </span>
                  </div>
                  <div className="relative">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.div
                        key={status}
                        initial={justPromoted ? { opacity: 0, scale: 0.8 } : false}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.28, ease: mockEase.out }}
                      >
                        <StatusBadge status={status} variant="compact" />
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
                {row.company === "Stripe" ? (
                  <FakeCursor
                    active={active && !cursorGone}
                    clicking={clicking}
                    enterDelay={0.8}
                    className="right-7 top-1/2 -translate-y-1/2"
                  />
                ) : null}
              </motion.li>
            );
          })}
        </ul>
      </div>
    </MockScreen>
  );
}
