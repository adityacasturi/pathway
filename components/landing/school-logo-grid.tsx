"use client";

import { useSyncExternalStore } from "react";
import { SCHOOL_LOGO_BASE_DELAY_MS, SCHOOL_LOGO_STAGGER_MS } from "@/lib/landing/entrance-timing";
import { LANDING_SCHOOL_LOGOS } from "@/lib/landing/school-logos";

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function buildRevealDelays(): Map<string, number> {
  const order = shuffle(LANDING_SCHOOL_LOGOS.map((school) => school.src));
  return new Map(order.map((src, index) => [src, SCHOOL_LOGO_BASE_DELAY_MS + index * SCHOOL_LOGO_STAGGER_MS]));
}

let clientRevealDelays: Map<string, number> | null = null;

function getClientRevealDelays(): Map<string, number> {
  if (clientRevealDelays) return clientRevealDelays;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  clientRevealDelays = reducedMotion
    ? new Map(LANDING_SCHOOL_LOGOS.map((school) => [school.src, 0]))
    : buildRevealDelays();
  return clientRevealDelays;
}

export function SchoolLogoGrid() {
  const revealDelays = useSyncExternalStore(
    () => () => {},
    getClientRevealDelays,
    () => null,
  );

  return (
    <ul
      className={
        revealDelays ? "landing-statement__school-grid landing-statement__school-grid--revealing" : "landing-statement__school-grid"
      }
    >
      {LANDING_SCHOOL_LOGOS.map((school) => (
        <li
          key={school.src}
          style={
            revealDelays
              ? ({ "--logo-reveal-delay": `${revealDelays.get(school.src) ?? 0}ms` } as React.CSSProperties)
              : undefined
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={school.src}
            alt={school.name}
            width={school.width}
            height={school.height}
            loading="lazy"
            decoding="async"
            style={{ "--logo-scale": school.scale } as React.CSSProperties}
          />
        </li>
      ))}
    </ul>
  );
}
