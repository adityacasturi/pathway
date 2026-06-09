/**
 * Landing entrance sequence — strictly ordered:
 * logo → headline → CTA → schools label → school logos.
 *
 * CSS in `components/landing/statement.css` reads the `--landing-*` vars.
 */
export const LANDING_SEQUENCE_GAP_MS = 50;

export const LANDING_LOGO = {
  delayMs: 350,
  durationMs: 500,
} as const;

const headlineStartMs =
  LANDING_LOGO.delayMs + LANDING_LOGO.durationMs + LANDING_SEQUENCE_GAP_MS;

export const HEADLINE_ENTRANCE_TIMINGS = {
  startMs: headlineStartMs,
  loadDelayS: headlineStartMs / 1000,
  chunkStaggerS: 0.08,
  chunkDurationS: 0.45,
  chunkCount: 3,
  punchChunkIndex: 1,
  punchDurationMs: 480,
} as const;

const headlineLastChunkEndMs =
  headlineStartMs +
  (HEADLINE_ENTRANCE_TIMINGS.chunkCount - 1) * HEADLINE_ENTRANCE_TIMINGS.chunkStaggerS * 1000 +
  HEADLINE_ENTRANCE_TIMINGS.chunkDurationS * 1000;

/** After "unfair advantage" has fully faded in. */
const headlinePunchDelayMs =
  headlineStartMs +
  HEADLINE_ENTRANCE_TIMINGS.punchChunkIndex * HEADLINE_ENTRANCE_TIMINGS.chunkStaggerS * 1000 +
  HEADLINE_ENTRANCE_TIMINGS.chunkDurationS * 1000 +
  LANDING_SEQUENCE_GAP_MS;

const headlinePunchEndMs = headlinePunchDelayMs + HEADLINE_ENTRANCE_TIMINGS.punchDurationMs;

const heroSequenceEndMs = Math.max(headlineLastChunkEndMs, headlinePunchEndMs);

export const LANDING_CTA = {
  delayMs: heroSequenceEndMs + LANDING_SEQUENCE_GAP_MS,
  durationMs: 500,
} as const;

export const LANDING_SCHOOLS_LABEL = {
  delayMs: LANDING_CTA.delayMs + LANDING_CTA.durationMs + LANDING_SEQUENCE_GAP_MS,
  durationMs: 500,
} as const;

export const SCHOOL_LOGO_STAGGER_MS = 55;
export const SCHOOL_LOGO_DURATION_MS = 380;

export const SCHOOL_LOGO_BASE_DELAY_MS =
  LANDING_SCHOOLS_LABEL.delayMs + LANDING_SCHOOLS_LABEL.durationMs + LANDING_SEQUENCE_GAP_MS;

export const LANDING_TIMING_STYLE = {
  "--landing-enter-delay": `${LANDING_LOGO.delayMs}ms`,
  "--landing-logo-duration": `${LANDING_LOGO.durationMs}ms`,
  "--landing-punch-delay": `${headlinePunchDelayMs}ms`,
  "--landing-punch-duration": `${HEADLINE_ENTRANCE_TIMINGS.punchDurationMs}ms`,
  "--landing-cta-delay": `${LANDING_CTA.delayMs}ms`,
  "--landing-cta-duration": `${LANDING_CTA.durationMs}ms`,
  "--landing-schools-label-delay": `${LANDING_SCHOOLS_LABEL.delayMs}ms`,
  "--landing-schools-label-duration": `${LANDING_SCHOOLS_LABEL.durationMs}ms`,
  "--landing-school-logo-duration": `${SCHOOL_LOGO_DURATION_MS}ms`,
} as const;
