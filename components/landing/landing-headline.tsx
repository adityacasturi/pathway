"use client";

import { motion, useReducedMotion } from "framer-motion";
import { HEADLINE_ENTRANCE_TIMINGS } from "@/lib/landing/entrance-timing";

const EASE = [0.22, 1, 0.36, 1] as const;

const line = {
  hidden: { opacity: 0, y: 14 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: HEADLINE_ENTRANCE_TIMINGS.loadDelayS + index * HEADLINE_ENTRANCE_TIMINGS.chunkStaggerS,
      duration: HEADLINE_ENTRANCE_TIMINGS.chunkDurationS,
      ease: EASE,
    },
  }),
};

export function LandingHeadline() {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <h1 id="landing-statement" className="landing-statement__headline">
        Your{" "}
        <span className="landing-statement__headline-punch">unfair advantage</span> this recruiting
        season
      </h1>
    );
  }

  return (
    <motion.h1
      id="landing-statement"
      className="landing-statement__headline landing-statement__headline--animated"
      initial="hidden"
      animate="visible"
    >
      <motion.span className="landing-statement__headline-chunk" variants={line} custom={0}>
        Your{" "}
      </motion.span>
      <motion.span
        className="landing-statement__headline-chunk landing-statement__headline-punch"
        variants={line}
        custom={1}
      >
        unfair advantage{" "}
      </motion.span>
      <motion.span className="landing-statement__headline-chunk" variants={line} custom={2}>
        this recruiting season
      </motion.span>
    </motion.h1>
  );
}
