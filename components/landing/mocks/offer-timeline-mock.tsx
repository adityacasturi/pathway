"use client";

import { motion } from "framer-motion";
import { EVENT_TYPE_COLORS } from "@/lib/config/status-colors";
import { MockLogo, mockEase, useSceneInView } from "@/components/landing/mocks/shared";

type TimelineEvent = {
  id: string;
  label: string;
  date: string;
  notes?: string;
  color: string;
  offer?: boolean;
};

const EVENTS: TimelineEvent[] = [
  { id: "applied", label: "Applied", date: "Aug 28, 2026", color: EVENT_TYPE_COLORS.applied },
  { id: "oa", label: "OA", date: "Sep 5, 2026", notes: "Coding · 75 min", color: EVENT_TYPE_COLORS.oa },
  { id: "interview", label: "Interview", date: "Sep 18, 2026", notes: "Onsite · final round", color: EVENT_TYPE_COLORS.interview },
  { id: "offer", label: "Offer", date: "Oct 7, 2026", notes: "Accepted 🎉", color: EVENT_TYPE_COLORS.offer, offer: true },
];

function TimelineRow({ event, isLast }: { event: TimelineEvent; isLast: boolean }) {
  return (
    <div className="grid grid-cols-[20px_1fr] gap-4">
      <div className="flex flex-col items-center" aria-hidden>
        <div className="mt-1 shrink-0">
          <span
            className="block rounded-full"
            style={{
              width: 10,
              height: 10,
              background: event.color,
              boxShadow: event.offer
                ? `0 0 0 3px ${event.color}33, 0 0 12px ${event.color}aa`
                : `0 0 0 3px ${event.color}22`,
            }}
          />
        </div>
        {!isLast && <div className="mt-1 w-px flex-1 bg-border" />}
      </div>
      <div className={isLast ? "pb-0" : "pb-3.5"}>
        <div className="rounded-md border bg-card px-3.5 py-2.5" style={{ borderColor: "var(--rule)" }}>
          <p className="text-sm font-medium leading-tight text-foreground">{event.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{event.date}</p>
          {event.notes ? (
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{event.notes}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function OfferTimelineMock() {
  const { ref, active, reduced } = useSceneInView<HTMLDivElement>(0.45);

  return (
    <div
      ref={ref}
      className="relative flex h-[540px] flex-col overflow-hidden rounded-md border border-border max-[640px]:h-[460px]"
      style={{ background: "var(--paper)" }}
    >
      {/* Company + role header */}
      <div className="flex items-center gap-3 border-b px-5 py-4" style={{ borderColor: "var(--rule)" }}>
        <MockLogo company="OpenAI" size={42} />
        <div className="min-w-0">
          <p className="display-serif text-[22px] leading-none text-foreground">OpenAI</p>
          <p className="mt-1.5 text-[13px] text-muted-foreground">Research Engineer Intern</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative min-h-0 flex-1 overflow-hidden px-5 py-5">
        <div className="mb-4 flex items-baseline gap-3">
          <span className="label-micro">Timeline</span>
          <span className="h-px flex-1" style={{ background: "var(--rule)" }} />
        </div>
        <ol className="relative space-y-0">
          {EVENTS.map((event, index) => (
            <motion.li
              key={event.id}
              initial={reduced ? false : { opacity: 0, x: 28 }}
              animate={active ? { opacity: 1, x: 0 } : { opacity: 0, x: 28 }}
              transition={{ duration: 0.55, delay: 0.3 + index * 0.22, ease: mockEase.out }}
            >
              <TimelineRow event={event} isLast={index === EVENTS.length - 1} />
            </motion.li>
          ))}
        </ol>

        <span aria-hidden className="lp-mock-fade" />
      </div>
    </div>
  );
}
