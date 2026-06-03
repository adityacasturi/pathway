"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { RotatingPill } from "@/components/landing/rotating-pill";
import {
  TRUST_BAND_COMPANY_MAX_CH,
  TRUST_BAND_HEADLINE_STATIC,
  TRUST_BAND_ROLE_MAX_CH,
  TRUST_BAND_ROLE_PAIRS,
  formatTrustBandPair,
} from "@/lib/landing/trust-band-copy";

const ROTATE_INTERVAL_MS = 3000;

export function TrustBandHeadline() {
  const reduced = useReducedMotion();
  const [pairIndex, setPairIndex] = useState(0);

  const pair = TRUST_BAND_ROLE_PAIRS[pairIndex] ?? TRUST_BAND_ROLE_PAIRS[0];
  const livePhrase = `Land your dream internship as a ${formatTrustBandPair(pair)}.`;

  useEffect(() => {
    if (reduced) return;

    const id = setInterval(() => {
      setPairIndex((current) => (current + 1) % TRUST_BAND_ROLE_PAIRS.length);
    }, ROTATE_INTERVAL_MS);

    return () => clearInterval(id);
  }, [reduced]);

  return (
    <h2 className="lp-trust-line">
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {reduced ? TRUST_BAND_HEADLINE_STATIC : livePhrase}
      </span>
      <span className="lp-trust-line__sentence" aria-hidden="true">
        <span className="lp-trust-line__text">Land your dream internship as a</span>
        <RotatingPill
          value={pair.role}
          minWidthCh={TRUST_BAND_ROLE_MAX_CH}
          direction="up"
          className="lp-trust-pill--role"
        />
        <span className="lp-trust-line__text">at</span>
        <span className="lp-trust-line__tail">
          <RotatingPill
            value={pair.company}
            minWidthCh={TRUST_BAND_COMPANY_MAX_CH}
            direction="down"
            className="lp-trust-pill--company"
          />
          <span className="lp-trust-line__period" aria-hidden="true">
            .
          </span>
        </span>
      </span>
    </h2>
  );
}
