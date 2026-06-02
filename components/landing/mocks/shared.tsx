"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/*
 * Shared building blocks for the landing-page UI replicas. These are faithful,
 * non-interactive copies of real product surfaces fed with fake data, wrapped
 * in a small "app screen" chrome so each panel reads as a cropped screenshot.
 * Animations are scroll-activated via `useSceneInView`.
 */

const EASE_SMOOTH = [0.23, 1, 0.32, 1] as const;
const EASE_OUT = [0.16, 1, 0.3, 1] as const;
export const mockEase = { smooth: EASE_SMOOTH, out: EASE_OUT };

/** Local brand marks that always render (no logo proxy / auth needed). */
const LOGO_FILES: Record<string, string> = {
  "Jane Street": "jane-street",
  Citadel: "citadel",
  Stripe: "stripe",
  Nvidia: "nvidia",
  "Two Sigma": "two-sigma",
  Databricks: "databricks",
  Ramp: "ramp",
  Palantir: "palantir",
  Snowflake: "snowflake",
  Figma: "figma",
  "Goldman Sachs": "goldman-sachs",
  Apple: "apple",
  Google: "google",
  "Hudson River Trading": "hudson-river-trading",
  Coinbase: "coinbase",
  Meta: "meta",
  Microsoft: "microsoft",
  Netflix: "netflix",
  Amazon: "amazon",
  Tesla: "tesla",
  Uber: "uber",
  Airbnb: "airbnb",
  Bloomberg: "bloomberg",
  Salesforce: "salesforce",
  "Morgan Stanley": "morgan-stanley",
  OpenAI: "openai.svg",
};

export function MockLogo({ company, size = 36 }: { company: string; size?: number }) {
  const file = LOGO_FILES[company];
  const src = file ? `/company-logos/${file.includes(".") ? file : `${file}.png`}` : null;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          className="block size-full rounded-sm object-contain object-center"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="flex size-full items-center justify-center rounded-sm bg-muted text-[11px] font-semibold text-slate-700">
          {company.trim().charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}

/**
 * Scroll trigger. Returns a ref to attach and a boolean that flips true once
 * the element is revealed while scrolling *down*. Scrolling up never starts an
 * animation, and once a panel has played it stays played, since there's no
 * reason to replay it. With reduced motion we report "in view" immediately.
 */
export function useSceneInView<T extends Element = HTMLDivElement>(amount = 0.6) {
  const ref = useRef<T>(null);
  const reduced = useReducedMotion();
  const inView = useInView(ref, { amount, once: false });
  const [active, setActive] = useState(false);
  const dir = useRef<"down" | "up">("down");
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y > lastY.current) dir.current = "down";
      else if (y < lastY.current) dir.current = "up";
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    // Fire only on a downward reveal, then latch on for good. Reduced motion is
    // handled in the return value, so no state update is needed there.
    if (inView && dir.current === "down") setActive(true);
  }, [inView]);

  return { ref, active: reduced ? true : active, reduced: Boolean(reduced) };
}

/** Eased count-up that runs whenever `active` is true. */
export function useCountUp(target: number, active: boolean, durationMs = 1100) {
  const reduced = useReducedMotion();
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    if (!active || reduced) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimated(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, durationMs, reduced]);

  if (!active) return 0;
  if (reduced) return target;
  return animated;
}

/** The app-screen chrome: a page header and the body. */
export function MockScreen({
  label,
  actions,
  children,
  className,
  bodyClassName,
}: {
  label: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={cn("lp-mock-screen", className)}>
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="lp-mock-head">
          <span className="lp-mock-title display-serif">{label}</span>
          {actions ? <div className="flex items-center gap-1.5">{actions}</div> : null}
        </div>
        <div className={cn("relative min-h-0 flex-1 px-4 pb-4 pt-1 sm:px-5", bodyClassName)}>
          {children}
        </div>
        <span aria-hidden className="lp-mock-fade" />
      </div>
    </div>
  );
}

/**
 * A fake macOS-style pointer that glides in and "clicks". Position it with an
 * absolute `className` (its tip is the top-left of the SVG). `clicking` drives
 * the press pulse + ripple, so the parent can sync it with a state change.
 */
export function FakeCursor({
  active,
  clicking,
  className,
  enterDelay = 0.7,
}: {
  active: boolean;
  clicking: boolean;
  className?: string;
  enterDelay?: number;
}) {
  const reduced = useReducedMotion();
  if (reduced) return null;
  return (
    <span className={cn("pointer-events-none absolute z-30", className)} aria-hidden>
      <motion.span
        className="relative block"
        initial={{ opacity: 0, x: 26, y: 20 }}
        animate={active ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, x: 26, y: 20 }}
        transition={{ duration: 0.7, delay: enterDelay, ease: EASE_OUT }}
      >
        <motion.span
          className="absolute rounded-full"
          style={{ left: -4, top: -4, width: 26, height: 26, border: "1.5px solid var(--primary)" }}
          initial={{ opacity: 0, scale: 0.2 }}
          animate={clicking ? { opacity: [0.55, 0], scale: [0.2, 1.9] } : { opacity: 0, scale: 0.2 }}
          transition={{ duration: 0.55, ease: EASE_OUT }}
        />
        <motion.span
          className="block"
          animate={clicking ? { scale: [1, 0.82, 1] } : { scale: 1 }}
          transition={{ duration: 0.32, ease: EASE_OUT }}
        >
          <svg width="20" height="22" viewBox="0 0 20 22" fill="none" aria-hidden>
            <path
              d="M2 1.6 L2 17.4 L6.4 13.1 L9.4 19.8 L12 18.6 L9 12 L15.3 12 Z"
              fill="var(--foreground)"
              stroke="white"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
        </motion.span>
      </motion.span>
    </span>
  );
}

/** A faux search + filter toolbar, matching the real feed header rhythm. */
export function MockToolbar({ placeholder, count }: { placeholder: string; count?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="flex h-9 flex-1 items-center gap-2 rounded-xl border border-border bg-background/70 px-3">
        <span className="size-3.5 rounded-full border-[1.5px] border-muted-foreground/50" />
        <span className="text-[12px] text-muted-foreground/70">{placeholder}</span>
      </div>
      <div className="flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-[12px] text-muted-foreground">
        <span className="grid gap-[2px]">
          <span className="block h-[1.5px] w-3.5 rounded bg-current" />
          <span className="block h-[1.5px] w-3.5 rounded bg-current" />
          <span className="block h-[1.5px] w-2.5 rounded bg-current" />
        </span>
        Filters
      </div>
      {count ? (
        <span className="ml-1 hidden font-mono text-[11px] text-muted-foreground sm:inline">
          {count}
        </span>
      ) : null}
    </div>
  );
}

export type MockPosting = {
  id: string;
  company: string;
  role: string;
  location: string;
  age: string;
  season: "Summer" | "Fall" | "Spring" | "Winter";
};

export const HERO_POSTINGS: MockPosting[] = [
  { id: "p1", company: "Jane Street", role: "Quantitative Trader Intern", location: "New York, NY", age: "2m", season: "Summer" },
  { id: "p2", company: "Citadel", role: "Software Engineer Intern", location: "Chicago, IL", age: "8m", season: "Summer" },
  { id: "p3", company: "Stripe", role: "Software Engineer Intern", location: "Seattle, WA", age: "21m", season: "Summer" },
  { id: "p4", company: "Nvidia", role: "Deep Learning Intern", location: "Santa Clara, CA", age: "44m", season: "Summer" },
  { id: "p5", company: "Two Sigma", role: "Software Engineer Intern", location: "New York, NY", age: "1h", season: "Summer" },
  { id: "p6", company: "Databricks", role: "Software Engineer Intern", location: "San Francisco, CA", age: "2h", season: "Summer" },
  { id: "p7", company: "Ramp", role: "Product Engineer Intern", location: "New York, NY", age: "3h", season: "Summer" },
  { id: "p8", company: "Palantir", role: "Forward Deployed Intern", location: "Palo Alto, CA", age: "5h", season: "Summer" },
];

/** Roles that "drop in" at the top of the feed while it animates. */
export const INCOMING_POSTINGS: MockPosting[] = [
  { id: "n1", company: "Goldman Sachs", role: "Engineering Summer Analyst", location: "New York, NY", age: "now", season: "Summer" },
  { id: "n2", company: "Apple", role: "Software Engineering Intern", location: "Cupertino, CA", age: "now", season: "Summer" },
  { id: "n3", company: "Google", role: "STEP Intern", location: "Mountain View, CA", age: "now", season: "Summer" },
  { id: "n4", company: "Coinbase", role: "Software Engineer Intern", location: "Remote, US", age: "now", season: "Summer" },
  { id: "n5", company: "Snowflake", role: "Software Engineer Intern", location: "San Mateo, CA", age: "now", season: "Summer" },
];
