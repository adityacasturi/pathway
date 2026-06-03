"use client";

import type { CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const SWIPE_TRANSITION = {
  duration: 0.38,
  ease: [0.23, 1, 0.32, 1] as const,
};

export type RotatingPillDirection = "up" | "down";

type Props = {
  value: string;
  minWidthCh: number;
  /** "up" exits upward / enters from below; "down" exits downward / enters from above. */
  direction: RotatingPillDirection;
  className?: string;
};

function getSwipeVariants(direction: RotatingPillDirection) {
  if (direction === "down") {
    return {
      initial: { y: "-100%", opacity: 0 },
      animate: { y: 0, opacity: 1 },
      exit: { y: "100%", opacity: 0 },
    };
  }

  return {
    initial: { y: "100%", opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: "-100%", opacity: 0 },
  };
}

/** Mono pill with swipe animation; fixed width prevents layout shift. */
export function RotatingPill({ value, minWidthCh, direction, className }: Props) {
  const reduced = useReducedMotion();
  const variants = getSwipeVariants(direction);

  if (!value) return null;

  const style = { "--lp-trust-slot-ch": String(minWidthCh) } as CSSProperties;

  if (reduced) {
    return (
      <span className={cn("lp-trust-pill", className)} style={style}>
        <span className="lp-trust-pill-label">{value}</span>
      </span>
    );
  }

  return (
    <span className={cn("lp-trust-pill", className)} style={style}>
      <span className="lp-trust-pill-clip">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={value}
            className="lp-trust-pill-word"
            initial={variants.initial}
            animate={variants.animate}
            exit={variants.exit}
            transition={SWIPE_TRANSITION}
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
}
