"use client";

import { useEffect, useState } from "react";
import { ArrowDown } from "lucide-react";

export function LandingScrollCue() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let dismissed = false;
    const update = () => {
      if (dismissed) return;
      if (window.scrollY > 18) {
        dismissed = true;
        setHidden(true);
      }
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
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
