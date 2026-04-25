import { cubicBezier, type Transition } from "framer-motion";

const motionDurations = {
  instant: 0.12,
  fast: 0.18,
  base: 0.28,
  slow: 0.42,
} as const;

const motionEasing = {
  smooth: cubicBezier(0.23, 1, 0.32, 1),
  standard: cubicBezier(0.25, 0.1, 0.25, 1),
} as const;

const motionTransitions = {
  fade: {
    duration: motionDurations.base,
    ease: motionEasing.standard,
  } satisfies Transition,
  lift: {
    duration: motionDurations.slow,
    ease: motionEasing.smooth,
  } satisfies Transition,
  spring: {
    type: "spring",
    stiffness: 260,
    damping: 30,
    mass: 0.7,
  } satisfies Transition,
} as const;

export const motionVariants = {
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: motionTransitions.fade },
  },
  riseIn: {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: motionTransitions.lift },
  },
  gentleScale: {
    hidden: { opacity: 0, y: 10, scale: 0.985 },
    visible: { opacity: 1, y: 0, scale: 1, transition: motionTransitions.lift },
    exit: { opacity: 0, y: 6, scale: 0.99, transition: { duration: motionDurations.fast } },
  },
} as const;
