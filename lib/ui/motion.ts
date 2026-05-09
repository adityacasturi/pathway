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
  list: {
    hidden: {},
    visible: {},
  },
  row: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: motionDurations.fast, ease: motionEasing.standard } },
    exit: { opacity: 0, transition: { duration: motionDurations.instant, ease: motionEasing.standard } },
  },
  menu: {
    hidden: { opacity: 0, y: -4, scale: 0.98 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: motionDurations.fast, ease: motionEasing.smooth } },
    exit: { opacity: 0, y: -4, scale: 0.98, transition: { duration: motionDurations.instant, ease: motionEasing.standard } },
  },
  step: {
    hidden: { opacity: 0, y: 5 },
    visible: { opacity: 1, y: 0, transition: { duration: motionDurations.fast, ease: motionEasing.smooth } },
    exit: { opacity: 0, y: -5, transition: { duration: motionDurations.instant, ease: motionEasing.standard } },
  },
} as const;
