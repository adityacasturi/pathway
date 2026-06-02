"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bookmark, Plus, X } from "lucide-react";
import { PostingMetaLine, MetaSeparator } from "@/components/posting-meta-line";import {
  HERO_POSTINGS,
  INCOMING_POSTINGS,
  MockLogo,
  MockScreen,
  MockToolbar,
  mockEase,
  useSceneInView,
  type MockPosting,
} from "@/components/landing/mocks/shared";

type Variant = "wide" | "tall";

function PostingRowMock({ posting, isNew }: { posting: MockPosting; isNew: boolean }) {
  return (
    <div className="flex items-center gap-3.5 rounded-lg border border-border bg-card px-3.5 py-3">
      <MockLogo company={posting.company} size={34} />
      <div className="min-w-0 flex-1">
        <PostingMetaLine company={posting.company} season={posting.season}>
          {isNew ? (
            <>
              <MetaSeparator />
              <span className="font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-primary">
                New
              </span>
            </>
          ) : null}
        </PostingMetaLine>
        <p className="mt-1 truncate text-[14px] font-medium text-foreground">{posting.role}</p>
      </div>
      <div className="hidden min-w-0 shrink-0 flex-col items-end gap-0.5 text-right sm:flex">
        <span className="truncate text-[12px] text-foreground/72">{posting.location}</span>
        <span className="truncate font-mono text-[11px] tabular-nums text-muted-foreground">
          {posting.age === "now" ? "just now" : `${posting.age} ago`}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border/80 bg-muted/35 p-0.5">
        <span className="inline-flex size-8 items-center justify-center rounded-md text-foreground/45">
          <Plus size={15} strokeWidth={1.85} />
        </span>
        <span className="inline-flex size-8 items-center justify-center rounded-md text-foreground/45">
          <Bookmark size={15} strokeWidth={1.85} />
        </span>
        <span className="hidden size-8 items-center justify-center rounded-md text-foreground/45 sm:inline-flex">
          <X size={15} strokeWidth={1.85} />
        </span>
      </div>
    </div>
  );
}

export function OpeningsFeedMock({ variant = "wide" }: { variant?: Variant }) {
  const { ref, active, reduced } = useSceneInView<HTMLDivElement>(variant === "tall" ? 0.45 : 0.55);
  const cap = variant === "tall" ? 7 : 5;

  const [items, setItems] = useState<MockPosting[]>(() => HERO_POSTINGS.slice(0, cap));
  const [newIds, setNewIds] = useState<Set<string>>(() => new Set());
  const counterRef = useRef(0);

  useEffect(() => {
    if (!active || reduced) return;
    const interval = setInterval(() => {
      const base = INCOMING_POSTINGS[counterRef.current % INCOMING_POSTINGS.length];
      const uid = `${base.id}-${counterRef.current}`;
      counterRef.current += 1;
      setItems((prev) => [{ ...base, id: uid }, ...prev].slice(0, cap));
      setNewIds((prev) => {
        const next = new Set(prev);
        next.add(uid);
        return next;
      });
    }, 1300);
    return () => clearInterval(interval);
  }, [active, reduced, cap]);

  return (
    <MockScreen
      label="Openings"
      className={variant === "tall" ? "lp-mock-screen--tall" : undefined}
      actions={
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          <span className="lp-live-dot" /> Live
        </span>
      }
    >
      <div ref={ref} className="flex h-full flex-col">
        <MockToolbar placeholder="Search company, role, or location…" count="1,284 postings" />
        <ul className="flex flex-col gap-2.5">
          <AnimatePresence initial={false} mode="popLayout">
            {items.map((posting, index) => {
              const isNew = newIds.has(posting.id);
              return (
                <motion.li
                  key={posting.id}
                  layout="position"
                  initial={{ opacity: 0, y: isNew ? -16 : 14, scale: 0.98 }}
                  animate={active ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 14 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{
                    // Layout shift (every row sliding down when a new one drops
                    // in) runs on its own un-staggered spring so all rows move
                    // together. The enter and exit fade keeps the reveal stagger.
                    layout: { type: "spring", stiffness: 520, damping: 42, mass: 0.8 },
                    opacity: { duration: 0.4, delay: isNew ? 0 : 0.3 + Math.min(index * 0.08, 0.5) },
                    y: { duration: 0.45, delay: isNew ? 0 : 0.3 + Math.min(index * 0.08, 0.5), ease: mockEase.out },
                    scale: { duration: 0.4, ease: mockEase.out },
                  }}
                >
                  <div className={isNew ? "lp-feed-flash rounded-lg" : undefined}>
                    <PostingRowMock posting={posting} isNew={isNew} />
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </div>
    </MockScreen>
  );
}
