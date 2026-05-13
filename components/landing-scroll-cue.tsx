"use client";

import { useEffect, useState } from "react";
import { ArrowDown } from "lucide-react";

export function LandingScrollCue() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let frame: number | null = null;
    const compute = () => {
      frame = null;
      // Tie the cue's visibility to the first product section's appear-
      // threshold so the two never both end up hidden at once. Threshold here
      // must match the one in LandingProductStory for the first section.
      const firstSection = document.querySelector<HTMLElement>(
        "#product .landing-feature",
      );
      if (!firstSection) {
        setHidden(window.scrollY > 18);
        return;
      }
      const ratio = 0.7;
      const rect = firstSection.getBoundingClientRect();
      setHidden(rect.top < window.innerHeight * ratio);
    };
    const schedule = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <a
      href="#product"
      className={`landing-scroll-cue ${hidden ? "landing-scroll-cue-hidden" : ""}`}
      aria-label="Scroll to product tour"
      aria-hidden={hidden}
      tabIndex={hidden ? -1 : undefined}
    >
      <span>Scroll</span>
      <ArrowDown size={16} strokeWidth={1.8} />
    </a>
  );
}
